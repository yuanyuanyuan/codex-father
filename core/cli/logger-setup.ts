/**
 * 日志系统设置
 * 基于 winston 的统一日志配置和输出格式
 */

import winston from 'winston';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import type { LoggingConfig, LogOutput } from '../lib/types.js';
import { getConfig, getConfigValue, isConfigLoaded } from './config-loader.js';

/**
 * 日志级别映射
 */
const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

/**
 * 颜色映射
 */
const COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
};

/**
 * 日志格式器
 */
class LogFormatter {
  /**
   * 创建文本格式器
   */
  static createTextFormat(): winston.Logform.Format {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const ts =
          typeof timestamp === 'string' || timestamp instanceof Date
            ? new Date(timestamp).toISOString()
            : new Date().toISOString();
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';

        if (stack) {
          return `${ts} [${level.toUpperCase()}] ${message}\n${stack}${metaStr}`;
        }

        return `${ts} [${level.toUpperCase()}] ${message}${metaStr}`;
      })
    );
  }

  /**
   * 创建 JSON 格式器
   */
  static createJsonFormat(): winston.Logform.Format {
    return winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );
  }

  /**
   * 创建控制台格式器
   */
  static createConsoleFormat(): winston.Logform.Format {
    return winston.format.combine(
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.colorize({ colors: COLORS }),
      winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        const ts = typeof timestamp === 'string' ? timestamp : new Date().toLocaleTimeString();

        if (stack) {
          return `${ts} ${level}: ${message}\n${stack}${metaStr}`;
        }

        return `${ts} ${level}: ${message}${metaStr}`;
      })
    );
  }
}

/**
 * 传输器工厂
 */
class TransportFactory {
  /**
   * 创建控制台传输器
   */
  static createConsoleTransport(
    level: string,
    format: 'text' | 'json'
  ): winston.transports.ConsoleTransportInstance {
    return new winston.transports.Console({
      level,
      format:
        format === 'json' ? LogFormatter.createJsonFormat() : LogFormatter.createConsoleFormat(),
      handleExceptions: true,
      handleRejections: true,
    });
  }

  /**
   * 创建文件传输器
   */
  static createFileTransport(
    level: string,
    format: 'text' | 'json',
    output: LogOutput
  ): winston.transports.FileTransportInstance {
    if (!output.path) {
      throw new Error('File output requires a path');
    }

    // 确保目录存在
    const logDir = dirname(output.path);
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    const transportOptions: winston.transports.FileTransportOptions = {
      filename: output.path,
      level,
      format: format === 'json' ? LogFormatter.createJsonFormat() : LogFormatter.createTextFormat(),
      handleExceptions: true,
      handleRejections: true,
    };

    // 配置日志轮转
    if (output.rotation) {
      transportOptions.maxsize = this.parseSize(output.maxSize || '10MB');
      transportOptions.maxFiles = 5;
      transportOptions.tailable = true;
    }

    return new winston.transports.File(transportOptions);
  }

  /**
   * 创建系统日志传输器
   */
  static createSyslogTransport(level: string, format: 'text' | 'json'): winston.transport {
    // 注意：需要安装 winston-syslog 包
    // 这里提供基本实现框架
    try {
      const Syslog = require('winston-syslog').Syslog;
      return new Syslog({
        level,
        format:
          format === 'json' ? LogFormatter.createJsonFormat() : LogFormatter.createTextFormat(),
        facility: 'local0',
      });
    } catch (error) {
      console.warn('winston-syslog not available, skipping syslog transport');
      // 回退到控制台
      return TransportFactory.createConsoleTransport(level, format);
    }
  }

  /**
   * 解析文件大小字符串
   */
  private static parseSize(sizeStr: string): number {
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

    const unit = unitRaw.toUpperCase() as keyof typeof units;
    return parseInt(size, 10) * units[unit];
  }
}

/**
 * 日志管理器
 */
export class LoggerManager {
  private static logger: winston.Logger | null = null;
  private static config: LoggingConfig | null = null;

  /**
   * 初始化日志系统
   */
  static async initialize(loggingConfig?: LoggingConfig): Promise<winston.Logger> {
    // 获取配置
    let config = loggingConfig;
    if (!config && isConfigLoaded()) {
      const projectConfig = await getConfig();
      config = projectConfig.logging;
    }

    if (!config) {
      // 使用默认配置
      config = {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        format: 'text',
        outputs: [{ type: 'console' }],
      };
    }

    this.config = config;

    // 创建传输器
    const transports = this.createTransports(config);

    // 创建 logger
    this.logger = winston.createLogger({
      levels: LOG_LEVELS,
      level: config.level,
      transports,
      exitOnError: false,
      silent: process.env.NODE_ENV === 'test' && !process.env.ENABLE_LOGGING,
    });

    // 添加颜色
    winston.addColors(COLORS);

    return this.logger;
  }

  /**
   * 创建传输器
   */
  private static createTransports(config: LoggingConfig): winston.transport[] {
    const transports: winston.transport[] = [];

    for (const output of config.outputs) {
      try {
        let transport: winston.transport;

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
            console.warn(`Unknown log output type: ${(output as any).type}`);
            continue;
        }

        transports.push(transport);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        console.warn(`Failed to create log transport for ${output.type}: ${reason}`);
      }
    }

    // 确保至少有一个传输器
    if (transports.length === 0) {
      transports.push(TransportFactory.createConsoleTransport(config.level, config.format));
    }

    return transports;
  }

  /**
   * 获取 logger 实例
   */
  static getLogger(): winston.Logger {
    if (!this.logger) {
      throw new Error('Logger not initialized. Call LoggerManager.initialize() first.');
    }
    return this.logger;
  }

  /**
   * 检查 logger 是否已初始化
   */
  static isInitialized(): boolean {
    return this.logger !== null;
  }

  /**
   * 重新配置日志系统
   */
  static async reconfigure(loggingConfig: LoggingConfig): Promise<void> {
    if (this.logger) {
      // 清理现有传输器
      this.logger.clear();
    }

    // 重新初始化
    await this.initialize(loggingConfig);
  }

  /**
   * 安全关闭日志系统
   */
  static async shutdown(): Promise<void> {
    if (this.logger) {
      await new Promise<void>((resolve) => {
        this.logger!.end(() => resolve());
      });
      this.logger = null;
      this.config = null;
    }
  }

  /**
   * 获取当前配置
   */
  static getConfig(): LoggingConfig | null {
    return this.config;
  }
}

/**
 * 默认日志路径工厂
 */
export class LogPathFactory {
  /**
   * 获取默认日志目录
   */
  static getDefaultLogDir(): string {
    const configured = getConfigValue('logging.baseDir');
    const baseDir =
      typeof configured === 'string' && configured.trim() ? configured : process.cwd();
    return join(baseDir, '.codex-father', 'logs');
  }

  /**
   * 获取应用日志路径
   */
  static getApplicationLogPath(): string {
    return join(this.getDefaultLogDir(), 'application.log');
  }

  /**
   * 获取错误日志路径
   */
  static getErrorLogPath(): string {
    return join(this.getDefaultLogDir(), 'error.log');
  }

  /**
   * 获取审计日志路径
   */
  static getAuditLogPath(): string {
    return join(this.getDefaultLogDir(), 'audit.log');
  }

  /**
   * 获取性能日志路径
   */
  static getPerformanceLogPath(): string {
    return join(this.getDefaultLogDir(), 'performance.log');
  }
}

/**
 * 日志上下文增强器
 */
export class LogContext {
  private static context: Record<string, any> = {};

  /**
   * 设置全局上下文
   */
  static setGlobalContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * 清除全局上下文
   */
  static clearGlobalContext(): void {
    this.context = {};
  }

  /**
   * 获取当前上下文
   */
  static getContext(): Record<string, any> {
    return { ...this.context };
  }

  /**
   * 创建带上下文的日志方法
   */
  static createContextLogger(additionalContext?: Record<string, any>) {
    const logger = LoggerManager.getLogger();
    const context = { ...this.context, ...additionalContext };

    return {
      error: (message: string, meta?: any) => logger.error(message, { ...context, ...meta }),
      warn: (message: string, meta?: any) => logger.warn(message, { ...context, ...meta }),
      info: (message: string, meta?: any) => logger.info(message, { ...context, ...meta }),
      debug: (message: string, meta?: any) => logger.debug(message, { ...context, ...meta }),
    };
  }
}

/**
 * 快捷日志函数
 */
let quickLogger: winston.Logger | null = null;

/**
 * 获取快捷 logger（自动初始化）
 */
async function getQuickLogger(): Promise<winston.Logger> {
  if (!quickLogger) {
    quickLogger = await LoggerManager.initialize();
  }
  return quickLogger;
}

/**
 * 导出的快捷日志方法
 */
export const log = {
  error: async (message: string, meta?: any) => {
    const logger = await getQuickLogger();
    logger.error(message, meta);
  },
  warn: async (message: string, meta?: any) => {
    const logger = await getQuickLogger();
    logger.warn(message, meta);
  },
  info: async (message: string, meta?: any) => {
    const logger = await getQuickLogger();
    logger.info(message, meta);
  },
  debug: async (message: string, meta?: any) => {
    const logger = await getQuickLogger();
    logger.debug(message, meta);
  },
};

/**
 * 开发模式辅助函数
 */
export function setupDevelopmentLogging(): void {
  if (process.env.NODE_ENV === 'development') {
    // 设置开发模式特定的日志配置
    LogContext.setGlobalContext({
      environment: 'development',
      pid: process.pid,
      nodeVersion: process.version,
    });

    // 捕获未处理的异常和拒绝
    process.on('uncaughtException', async (error) => {
      await log.error('Uncaught Exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      await log.error('Unhandled Rejection', { reason, promise });
    });
  }
}

/**
 * 性能日志辅助函数
 */
export function createPerformanceLogger() {
  const logger = LoggerManager.getLogger();
  const performanceEntries = new Map<string, number>();

  return {
    start: (operation: string) => {
      performanceEntries.set(operation, Date.now());
    },
    end: (operation: string, meta?: any) => {
      const startTime = performanceEntries.get(operation);
      if (startTime) {
        const duration = Date.now() - startTime;
        logger.info(`Performance: ${operation}`, { duration, ...meta });
        performanceEntries.delete(operation);
      }
    },
  };
}
