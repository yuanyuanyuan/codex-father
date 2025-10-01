import chalk from 'chalk';
import { LoggerManager, log } from './logger-setup.js';
import { getConfigValue } from './config-loader.js';
export const EXIT_CODES = {
    SUCCESS: 0,
    GENERAL_ERROR: 1,
    INVALID_USAGE: 2,
    COMMAND_NOT_FOUND: 127,
    PERMISSION_DENIED: 126,
    CONFIGURATION_ERROR: 78,
    NETWORK_ERROR: 68,
    TIMEOUT_ERROR: 124,
    INTERRUPTED: 130,
    INTERNAL_ERROR: 70,
};
export var ErrorCategory;
(function (ErrorCategory) {
    ErrorCategory["VALIDATION"] = "validation";
    ErrorCategory["CONFIGURATION"] = "configuration";
    ErrorCategory["NETWORK"] = "network";
    ErrorCategory["FILESYSTEM"] = "filesystem";
    ErrorCategory["PERMISSION"] = "permission";
    ErrorCategory["TIMEOUT"] = "timeout";
    ErrorCategory["INTERNAL"] = "internal";
    ErrorCategory["USER"] = "user";
    ErrorCategory["EXTERNAL"] = "external";
})(ErrorCategory || (ErrorCategory = {}));
export class AppError extends Error {
    category;
    code;
    userMessage;
    suggestions;
    recovery;
    context;
    constructor(info, cause) {
        super(info.message);
        this.name = 'AppError';
        this.category = info.category;
        this.code = info.code;
        this.userMessage = info.userMessage ?? undefined;
        this.suggestions = info.suggestions;
        this.recovery = info.recovery;
        this.context = info.context;
        if (cause?.stack) {
            this.stack = cause.stack;
        }
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
export class ValidationError extends AppError {
    constructor(message, field, suggestions) {
        super({
            category: ErrorCategory.VALIDATION,
            code: EXIT_CODES.INVALID_USAGE,
            message,
            userMessage: `Invalid input: ${message}`,
            suggestions: suggestions || [
                'Check the command syntax and try again',
                'Use --help to see available options',
            ],
            context: { field },
        });
    }
}
export class ConfigurationError extends AppError {
    constructor(message, configPath, suggestions) {
        super({
            category: ErrorCategory.CONFIGURATION,
            code: EXIT_CODES.CONFIGURATION_ERROR,
            message,
            userMessage: `Configuration error: ${message}`,
            suggestions: suggestions || [
                'Check your configuration file syntax',
                'Run config validate to identify issues',
                'Use config init to create a new configuration',
            ],
            context: { configPath },
        });
    }
}
export class NetworkError extends AppError {
    constructor(message, url, statusCode) {
        super({
            category: ErrorCategory.NETWORK,
            code: EXIT_CODES.NETWORK_ERROR,
            message,
            userMessage: `Network error: ${message}`,
            suggestions: [
                'Check your internet connection',
                'Verify the service is accessible',
                'Try again later',
            ],
            context: { url, statusCode },
        });
    }
}
export class TimeoutError extends AppError {
    constructor(operation, timeout) {
        super({
            category: ErrorCategory.TIMEOUT,
            code: EXIT_CODES.TIMEOUT_ERROR,
            message: `Operation '${operation}' timed out after ${timeout}ms`,
            userMessage: `The operation took too long and was cancelled`,
            suggestions: [
                'Try increasing the timeout limit',
                'Check if the operation is still running',
                'Contact support if the issue persists',
            ],
            context: { operation, timeout },
        });
    }
}
export class PermissionError extends AppError {
    constructor(message, path) {
        super({
            category: ErrorCategory.PERMISSION,
            code: EXIT_CODES.PERMISSION_DENIED,
            message,
            userMessage: `Permission denied: ${message}`,
            suggestions: [
                'Check file/directory permissions',
                'Run with appropriate privileges if needed',
                'Ensure you have access to the required resources',
            ],
            context: { path },
        });
    }
}
export class ErrorFormatter {
    static formatError(error, options = {}) {
        const { verbose = false, json = false, colors = true } = options;
        if (json) {
            return this.formatErrorAsJson(error, verbose);
        }
        return this.formatErrorAsText(error, verbose, colors);
    }
    static formatErrorAsJson(error, verbose) {
        const errorObj = {
            success: false,
            error: {
                message: error.message,
                name: error.name,
            },
        };
        if (error instanceof AppError) {
            errorObj.error.category = error.category;
            errorObj.error.code = error.code;
            errorObj.error.userMessage = error.userMessage;
            errorObj.error.suggestions = error.suggestions;
            errorObj.error.recovery = error.recovery;
            errorObj.error.context = error.context;
        }
        if (verbose && error.stack) {
            errorObj.error.stack = error.stack;
        }
        return JSON.stringify(errorObj, null, 2);
    }
    static formatErrorAsText(error, verbose, colors) {
        const lines = [];
        const colorize = colors
            ? chalk
            : {
                red: (s) => s,
                yellow: (s) => s,
                gray: (s) => s,
                bold: (s) => s,
            };
        if (error instanceof AppError) {
            lines.push(colorize.red(`❌ ${error.userMessage || error.message}`));
            if (error.suggestions && error.suggestions.length > 0) {
                lines.push('');
                lines.push(colorize.yellow('💡 Suggestions:'));
                error.suggestions.forEach((suggestion) => {
                    lines.push(colorize.yellow(`   • ${suggestion}`));
                });
            }
            if (error.recovery && error.recovery.length > 0) {
                lines.push('');
                lines.push(colorize.yellow('🔧 Recovery steps:'));
                error.recovery.forEach((step, index) => {
                    lines.push(colorize.yellow(`   ${index + 1}. ${step}`));
                });
            }
            if (verbose && error.context) {
                lines.push('');
                lines.push(colorize.gray('📋 Context:'));
                Object.entries(error.context).forEach(([key, value]) => {
                    lines.push(colorize.gray(`   ${key}: ${value}`));
                });
            }
        }
        else {
            lines.push(colorize.red(`❌ ${error.message}`));
        }
        if (verbose && error.stack) {
            lines.push('');
            lines.push(colorize.gray('📚 Stack trace:'));
            lines.push(colorize.gray(error.stack));
        }
        return lines.join('\n');
    }
    static formatCommandResult(result, options = {}) {
        const { json = false, colors = true } = options;
        if (json) {
            return JSON.stringify(result, null, 2);
        }
        const lines = [];
        const colorize = colors
            ? chalk
            : {
                red: (s) => s,
                yellow: (s) => s,
                green: (s) => s,
                gray: (s) => s,
            };
        if (result.message) {
            const symbol = result.success ? '✅' : '❌';
            const color = result.success ? colorize.green : colorize.red;
            lines.push(color(`${symbol} ${result.message}`));
        }
        if (result.warnings && result.warnings.length > 0) {
            result.warnings.forEach((warning) => {
                lines.push(colorize.yellow(`⚠️  ${warning}`));
            });
        }
        if (result.errors && result.errors.length > 0) {
            result.errors.forEach((error) => {
                lines.push(colorize.red(`❌ ${error}`));
            });
        }
        if (!result.success && result.data) {
            lines.push('');
            lines.push(colorize.gray('📋 Additional information:'));
            lines.push(colorize.gray(JSON.stringify(result.data, null, 2)));
        }
        return lines.join('\n');
    }
}
export class ErrorBoundary {
    static handlers = new Map();
    static isSetup = false;
    static setup(options = {}) {
        if (this.isSetup) {
            return;
        }
        const { verbose = false, json = false, exitOnError = true } = options;
        process.on('uncaughtException', async (error) => {
            await this.handleFatalError(error, 'uncaughtException', { verbose, json, exitOnError });
        });
        process.on('unhandledRejection', async (reason, _promise) => {
            const error = reason instanceof Error ? reason : new Error(String(reason));
            await this.handleFatalError(error, 'unhandledRejection', { verbose, json, exitOnError });
        });
        process.on('SIGINT', async () => {
            await this.handleInterrupt({ verbose, json, exitOnError });
        });
        process.on('SIGTERM', async () => {
            await this.handleTermination({ verbose, json, exitOnError });
        });
        this.isSetup = true;
    }
    static async handleFatalError(error, type, options) {
        try {
            if (LoggerManager.isInitialized()) {
                await log.error(`Fatal error (${type})`, {
                    error: error.message,
                    stack: error.stack,
                    type,
                });
            }
            const formatted = ErrorFormatter.formatError(error, {
                verbose: options.verbose,
                json: options.json,
                colors: !options.json,
            });
            if (options.json) {
                console.log(formatted);
            }
            else {
                console.error(formatted);
                console.error(chalk.gray('\n💀 Application terminated due to fatal error'));
            }
            const handler = this.handlers.get(type);
            if (handler) {
                handler(error);
            }
        }
        catch (handlingError) {
            console.error('Error during error handling:', handlingError);
        }
        finally {
            if (options.exitOnError) {
                const exitCode = error instanceof AppError ? error.code : EXIT_CODES.INTERNAL_ERROR;
                await this.gracefulExit(exitCode);
            }
        }
    }
    static async handleInterrupt(options) {
        if (options.json) {
            console.log(JSON.stringify({
                success: false,
                message: 'Operation cancelled by user',
                code: EXIT_CODES.INTERRUPTED,
            }));
        }
        else {
            console.log(chalk.yellow('\n\n⚠️  Operation cancelled by user'));
        }
        if (options.exitOnError) {
            await this.gracefulExit(EXIT_CODES.INTERRUPTED);
        }
    }
    static async handleTermination(options) {
        if (options.json) {
            console.log(JSON.stringify({
                success: false,
                message: 'Application terminated',
                code: EXIT_CODES.INTERRUPTED,
            }));
        }
        else {
            console.log(chalk.yellow('\n⚠️  Application terminated'));
        }
        if (options.exitOnError) {
            await this.gracefulExit(EXIT_CODES.INTERRUPTED);
        }
    }
    static async gracefulExit(code) {
        try {
            if (LoggerManager.isInitialized()) {
                await LoggerManager.shutdown();
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        catch (error) {
            console.error('Error during cleanup:', error);
        }
        finally {
            process.exit(code);
        }
    }
    static registerHandler(type, handler) {
        this.handlers.set(type, handler);
    }
    static removeHandler(type) {
        this.handlers.delete(type);
    }
    static async handleError(error, options) {
        const opts = {
            verbose: Boolean(getConfigValue('verbose') || false),
            json: Boolean(getConfigValue('json') || false),
            exit: true,
            ...options,
        };
        if (LoggerManager.isInitialized()) {
            await log.error('Application error', {
                error: error.message,
                stack: error.stack,
                category: error instanceof AppError ? error.category : 'unknown',
            });
        }
        const formatted = ErrorFormatter.formatError(error, opts);
        if (opts.json) {
            console.log(formatted);
        }
        else {
            console.error(formatted);
        }
        if (opts.exit) {
            const exitCode = error instanceof AppError ? error.code : EXIT_CODES.GENERAL_ERROR;
            await this.gracefulExit(exitCode);
        }
    }
}
export async function withErrorBoundary(operation, context) {
    try {
        return await operation();
    }
    catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        const baseError = error instanceof Error ? error : new Error(String(error));
        const appError = new AppError({
            category: ErrorCategory.INTERNAL,
            code: EXIT_CODES.INTERNAL_ERROR,
            message: baseError.message,
            userMessage: 'An unexpected error occurred',
            suggestions: [
                'Try running the command again',
                'Check the logs for more details',
                'Report this issue if it persists',
            ],
            ...(context ? { context } : {}),
        }, baseError);
        throw appError;
    }
}
export const createError = {
    validation: (message, field, suggestions) => new ValidationError(message, field, suggestions),
    configuration: (message, configPath, suggestions) => new ConfigurationError(message, configPath, suggestions),
    network: (message, url, statusCode) => new NetworkError(message, url, statusCode),
    timeout: (operation, timeout) => new TimeoutError(operation, timeout),
    permission: (message, path) => new PermissionError(message, path),
    internal: (message, context) => new AppError({
        category: ErrorCategory.INTERNAL,
        code: EXIT_CODES.INTERNAL_ERROR,
        message,
        userMessage: 'An internal error occurred',
        suggestions: ['Try again later', 'Contact support if the issue persists'],
        ...(context ? { context } : {}),
    }),
};
