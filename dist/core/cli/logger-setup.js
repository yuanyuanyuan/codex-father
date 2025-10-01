import winston from 'winston';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { getConfig, getConfigValue, isConfigLoaded } from './config-loader.js';
const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
};
const COLORS = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
};
class LogFormatter {
    static createTextFormat() {
        return winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
            const ts = typeof timestamp === 'string' || timestamp instanceof Date
                ? new Date(timestamp).toISOString()
                : new Date().toISOString();
            const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
            if (stack) {
                return `${ts} [${level.toUpperCase()}] ${message}\n${stack}${metaStr}`;
            }
            return `${ts} [${level.toUpperCase()}] ${message}${metaStr}`;
        }));
    }
    static createJsonFormat() {
        return winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json());
    }
    static createConsoleFormat() {
        return winston.format.combine(winston.format.timestamp({ format: 'HH:mm:ss' }), winston.format.errors({ stack: true }), winston.format.colorize({ colors: COLORS }), winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
            const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
            const ts = typeof timestamp === 'string'
                ? timestamp
                : new Date().toLocaleTimeString();
            if (stack) {
                return `${ts} ${level}: ${message}\n${stack}${metaStr}`;
            }
            return `${ts} ${level}: ${message}${metaStr}`;
        }));
    }
}
class TransportFactory {
    static createConsoleTransport(level, format) {
        return new winston.transports.Console({
            level,
            format: format === 'json' ? LogFormatter.createJsonFormat() : LogFormatter.createConsoleFormat(),
            handleExceptions: true,
            handleRejections: true,
        });
    }
    static createFileTransport(level, format, output) {
        if (!output.path) {
            throw new Error('File output requires a path');
        }
        const logDir = dirname(output.path);
        if (!existsSync(logDir)) {
            mkdirSync(logDir, { recursive: true });
        }
        const transportOptions = {
            filename: output.path,
            level,
            format: format === 'json' ? LogFormatter.createJsonFormat() : LogFormatter.createTextFormat(),
            handleExceptions: true,
            handleRejections: true,
        };
        if (output.rotation) {
            transportOptions.maxsize = this.parseSize(output.maxSize || '10MB');
            transportOptions.maxFiles = 5;
            transportOptions.tailable = true;
        }
        return new winston.transports.File(transportOptions);
    }
    static createSyslogTransport(level, format) {
        try {
            const Syslog = require('winston-syslog').Syslog;
            return new Syslog({
                level,
                format: format === 'json' ? LogFormatter.createJsonFormat() : LogFormatter.createTextFormat(),
                facility: 'local0',
            });
        }
        catch (error) {
            console.warn('winston-syslog not available, skipping syslog transport');
            return TransportFactory.createConsoleTransport(level, format);
        }
    }
    static parseSize(sizeStr) {
        const units = {
            B: 1,
            KB: 1024,
            MB: 1024 * 1024,
            GB: 1024 * 1024 * 1024,
        };
        const match = sizeStr.match(/^(\\d+)(B|KB|MB|GB)$/i);
        if (!match) {
            throw new Error(`Invalid size format: ${sizeStr}`);
        }
        const size = match[1];
        const unitRaw = match[2];
        if (!size || !unitRaw) {
            throw new Error(`Invalid size format: ${sizeStr}`);
        }
        const unit = unitRaw.toUpperCase();
        return parseInt(size, 10) * units[unit];
    }
}
export class LoggerManager {
    static logger = null;
    static config = null;
    static async initialize(loggingConfig) {
        let config = loggingConfig;
        if (!config && isConfigLoaded()) {
            const projectConfig = await getConfig();
            config = projectConfig.logging;
        }
        if (!config) {
            config = {
                level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
                format: 'text',
                outputs: [{ type: 'console' }],
            };
        }
        this.config = config;
        const transports = this.createTransports(config);
        this.logger = winston.createLogger({
            levels: LOG_LEVELS,
            level: config.level,
            transports,
            exitOnError: false,
            silent: process.env.NODE_ENV === 'test' && !process.env.ENABLE_LOGGING,
        });
        winston.addColors(COLORS);
        return this.logger;
    }
    static createTransports(config) {
        const transports = [];
        for (const output of config.outputs) {
            try {
                let transport;
                switch (output.type) {
                    case 'console':
                        transport = TransportFactory.createConsoleTransport(config.level, config.format);
                        break;
                    case 'file':
                        transport = TransportFactory.createFileTransport(config.level, config.format, output);
                        break;
                    case 'syslog':
                        transport = TransportFactory.createSyslogTransport(config.level, config.format);
                        break;
                    default:
                        console.warn(`Unknown log output type: ${output.type}`);
                        continue;
                }
                transports.push(transport);
            }
            catch (error) {
                const reason = error instanceof Error ? error.message : String(error);
                console.warn(`Failed to create log transport for ${output.type}: ${reason}`);
            }
        }
        if (transports.length === 0) {
            transports.push(TransportFactory.createConsoleTransport(config.level, config.format));
        }
        return transports;
    }
    static getLogger() {
        if (!this.logger) {
            throw new Error('Logger not initialized. Call LoggerManager.initialize() first.');
        }
        return this.logger;
    }
    static isInitialized() {
        return this.logger !== null;
    }
    static async reconfigure(loggingConfig) {
        if (this.logger) {
            this.logger.clear();
        }
        await this.initialize(loggingConfig);
    }
    static async shutdown() {
        if (this.logger) {
            await new Promise((resolve) => {
                this.logger.end(() => resolve());
            });
            this.logger = null;
            this.config = null;
        }
    }
    static getConfig() {
        return this.config;
    }
}
export class LogPathFactory {
    static getDefaultLogDir() {
        const configured = getConfigValue('logging.baseDir');
        const baseDir = typeof configured === 'string' && configured.trim() ? configured : process.cwd();
        return join(baseDir, '.codex-father', 'logs');
    }
    static getApplicationLogPath() {
        return join(this.getDefaultLogDir(), 'application.log');
    }
    static getErrorLogPath() {
        return join(this.getDefaultLogDir(), 'error.log');
    }
    static getAuditLogPath() {
        return join(this.getDefaultLogDir(), 'audit.log');
    }
    static getPerformanceLogPath() {
        return join(this.getDefaultLogDir(), 'performance.log');
    }
}
export class LogContext {
    static context = {};
    static setGlobalContext(context) {
        this.context = { ...this.context, ...context };
    }
    static clearGlobalContext() {
        this.context = {};
    }
    static getContext() {
        return { ...this.context };
    }
    static createContextLogger(additionalContext) {
        const logger = LoggerManager.getLogger();
        const context = { ...this.context, ...additionalContext };
        return {
            error: (message, meta) => logger.error(message, { ...context, ...meta }),
            warn: (message, meta) => logger.warn(message, { ...context, ...meta }),
            info: (message, meta) => logger.info(message, { ...context, ...meta }),
            debug: (message, meta) => logger.debug(message, { ...context, ...meta }),
        };
    }
}
let quickLogger = null;
async function getQuickLogger() {
    if (!quickLogger) {
        quickLogger = await LoggerManager.initialize();
    }
    return quickLogger;
}
export const log = {
    error: async (message, meta) => {
        const logger = await getQuickLogger();
        logger.error(message, meta);
    },
    warn: async (message, meta) => {
        const logger = await getQuickLogger();
        logger.warn(message, meta);
    },
    info: async (message, meta) => {
        const logger = await getQuickLogger();
        logger.info(message, meta);
    },
    debug: async (message, meta) => {
        const logger = await getQuickLogger();
        logger.debug(message, meta);
    },
};
export function setupDevelopmentLogging() {
    if (process.env.NODE_ENV === 'development') {
        LogContext.setGlobalContext({
            environment: 'development',
            pid: process.pid,
            nodeVersion: process.version,
        });
        process.on('uncaughtException', async (error) => {
            await log.error('Uncaught Exception', { error: error.message, stack: error.stack });
            process.exit(1);
        });
        process.on('unhandledRejection', async (reason, promise) => {
            await log.error('Unhandled Rejection', { reason, promise });
        });
    }
}
export function createPerformanceLogger() {
    const logger = LoggerManager.getLogger();
    const performanceEntries = new Map();
    return {
        start: (operation) => {
            performanceEntries.set(operation, Date.now());
        },
        end: (operation, meta) => {
            const startTime = performanceEntries.get(operation);
            if (startTime) {
                const duration = Date.now() - startTime;
                logger.info(`Performance: ${operation}`, { duration, ...meta });
                performanceEntries.delete(operation);
            }
        },
    };
}
