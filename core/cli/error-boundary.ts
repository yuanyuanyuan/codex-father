/**
 * 错误边界系统
 * 全局错误捕获、友好消息显示和退出代码管理
 */

import chalk from 'chalk';
import { LoggerManager, log } from './logger-setup.js';
import { getConfigValue } from './config-loader.js';
import type { CommandResult } from '../lib/types.js';

/**
 * 退出代码常量
 */
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
} as const;

/**
 * 错误类型分类
 */
export enum ErrorCategory {
  VALIDATION = 'validation',
  CONFIGURATION = 'configuration',
  NETWORK = 'network',
  FILESYSTEM = 'filesystem',
  PERMISSION = 'permission',
  TIMEOUT = 'timeout',
  INTERNAL = 'internal',
  USER = 'user',
  EXTERNAL = 'external',
}

/**
 * 错误信息接口
 */
interface ErrorInfo {
  category: ErrorCategory;
  code: number;
  message: string;
  userMessage?: string;
  suggestions?: string[];
  recovery?: string[];
  context?: Record<string, any>;
}

/**
 * 应用错误基类
 */
export class AppError extends Error {
  public readonly category: ErrorCategory;
  public readonly code: number;
  public readonly userMessage?: string | undefined;
  public readonly suggestions?: string[] | undefined;
  public readonly recovery?: string[] | undefined;
  public readonly context?: Record<string, any> | undefined;

  constructor(info: ErrorInfo, cause?: Error) {
    super(info.message);
    this.name = 'AppError';
    this.category = info.category;
    this.code = info.code;
    this.userMessage = info.userMessage ?? undefined;
    this.suggestions = info.suggestions;
    this.recovery = info.recovery;
    this.context = info.context;

    // 保持原始错误的堆栈信息
    if (cause) {
      this.stack = cause.stack;
    }

    // 确保原型链正确
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * 预定义错误类型
 */
export class ValidationError extends AppError {
  constructor(message: string, field?: string, suggestions?: string[]) {
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
  constructor(message: string, configPath?: string, suggestions?: string[]) {
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
  constructor(message: string, url?: string, statusCode?: number) {
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
  constructor(operation: string, timeout: number) {
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
  constructor(message: string, path?: string) {
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

/**
 * 错误格式化器
 */
export class ErrorFormatter {
  /**
   * 格式化错误为用户友好的消息
   */
  static formatError(error: Error, options: {
    verbose?: boolean;
    json?: boolean;
    colors?: boolean;
  } = {}): string {
    const { verbose = false, json = false, colors = true } = options;

    if (json) {
      return this.formatErrorAsJson(error, verbose);
    }

    return this.formatErrorAsText(error, verbose, colors);
  }

  /**
   * 格式化为 JSON
   */
  private static formatErrorAsJson(error: Error, verbose: boolean): string {
    const errorObj: any = {
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

  /**
   * 格式化为文本
   */
  private static formatErrorAsText(error: Error, verbose: boolean, colors: boolean): string {
    const lines: string[] = [];
    const colorize = colors ? chalk : { red: (s: string) => s, yellow: (s: string) => s, gray: (s: string) => s, bold: (s: string) => s };

    if (error instanceof AppError) {
      // 用户友好的错误消息
      lines.push(colorize.red(`❌ ${error.userMessage || error.message}`));

      // 建议
      if (error.suggestions && error.suggestions.length > 0) {
        lines.push('');
        lines.push(colorize.yellow('💡 Suggestions:'));
        error.suggestions.forEach(suggestion => {
          lines.push(colorize.yellow(`   • ${suggestion}`));
        });
      }

      // 恢复步骤
      if (error.recovery && error.recovery.length > 0) {
        lines.push('');
        lines.push(colorize.yellow('🔧 Recovery steps:'));
        error.recovery.forEach((step, index) => {
          lines.push(colorize.yellow(`   ${index + 1}. ${step}`));
        });
      }

      // 上下文信息（仅在 verbose 模式）
      if (verbose && error.context) {
        lines.push('');
        lines.push(colorize.gray('📋 Context:'));
        Object.entries(error.context).forEach(([key, value]) => {
          lines.push(colorize.gray(`   ${key}: ${value}`));
        });
      }
    } else {
      // 普通错误
      lines.push(colorize.red(`❌ ${error.message}`));
    }

    // 堆栈信息（仅在 verbose 模式）
    if (verbose && error.stack) {
      lines.push('');
      lines.push(colorize.gray('📚 Stack trace:'));
      lines.push(colorize.gray(error.stack));
    }

    return lines.join('\n');
  }

  /**
   * 格式化命令结果
   */
  static formatCommandResult(result: CommandResult, options: {
    json?: boolean;
    colors?: boolean;
  } = {}): string {
    const { json = false, colors = true } = options;

    if (json) {
      return JSON.stringify(result, null, 2);
    }

    const lines: string[] = [];
    const colorize = colors ? chalk : {
      red: (s: string) => s,
      yellow: (s: string) => s,
      green: (s: string) => s,
      gray: (s: string) => s
    };

    // 主消息
    if (result.message) {
      const symbol = result.success ? '✅' : '❌';
      const color = result.success ? colorize.green : colorize.red;
      lines.push(color(`${symbol} ${result.message}`));
    }

    // 警告
    if (result.warnings && result.warnings.length > 0) {
      result.warnings.forEach(warning => {
        lines.push(colorize.yellow(`⚠️  ${warning}`));
      });
    }

    // 错误
    if (result.errors && result.errors.length > 0) {
      result.errors.forEach(error => {
        lines.push(colorize.red(`❌ ${error}`));
      });
    }

    // 数据（仅在失败时显示为建议）
    if (!result.success && result.data) {
      lines.push('');
      lines.push(colorize.gray('📋 Additional information:'));
      lines.push(colorize.gray(JSON.stringify(result.data, null, 2)));
    }

    return lines.join('\n');
  }
}

/**
 * 错误边界管理器
 */
export class ErrorBoundary {
  private static handlers: Map<string, (error: Error) => void> = new Map();
  private static isSetup = false;

  /**
   * 设置全局错误边界
   */
  static setup(options: {
    verbose?: boolean;
    json?: boolean;
    exitOnError?: boolean;
  } = {}): void {
    if (this.isSetup) {
      return;
    }

    const { verbose = false, json = false, exitOnError = true } = options;

    // 捕获未处理的异常
    process.on('uncaughtException', async (error) => {
      await this.handleFatalError(error, 'uncaughtException', { verbose, json, exitOnError });
    });

    // 捕获未处理的 Promise 拒绝
    process.on('unhandledRejection', async (reason, _promise) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      await this.handleFatalError(error, 'unhandledRejection', { verbose, json, exitOnError });
    });

    // 捕获 SIGINT (Ctrl+C)
    process.on('SIGINT', async () => {
      await this.handleInterrupt({ verbose, json, exitOnError });
    });

    // 捕获 SIGTERM
    process.on('SIGTERM', async () => {
      await this.handleTermination({ verbose, json, exitOnError });
    });

    this.isSetup = true;
  }

  /**
   * 处理致命错误
   */
  private static async handleFatalError(
    error: Error,
    type: string,
    options: { verbose: boolean; json: boolean; exitOnError: boolean }
  ): Promise<void> {
    try {
      // 记录到日志
      if (LoggerManager.isInitialized()) {
        await log.error(`Fatal error (${type})`, {
          error: error.message,
          stack: error.stack,
          type,
        });
      }

      // 输出用户友好的错误信息
      const formatted = ErrorFormatter.formatError(error, {
        verbose: options.verbose,
        json: options.json,
        colors: !options.json,
      });

      if (options.json) {
        console.log(formatted);
      } else {
        console.error(formatted);
        console.error(chalk.gray('\n💀 Application terminated due to fatal error'));
      }

      // 执行自定义处理器
      const handler = this.handlers.get(type);
      if (handler) {
        handler(error);
      }
    } catch (handlingError) {
      // 错误处理过程中出错
      console.error('Error during error handling:', handlingError);
    } finally {
      if (options.exitOnError) {
        const exitCode = error instanceof AppError ? error.code : EXIT_CODES.INTERNAL_ERROR;
        await this.gracefulExit(exitCode);
      }
    }
  }

  /**
   * 处理中断信号
   */
  private static async handleInterrupt(options: { verbose: boolean; json: boolean; exitOnError: boolean }): Promise<void> {
    if (options.json) {
      console.log(JSON.stringify({
        success: false,
        message: 'Operation cancelled by user',
        code: EXIT_CODES.INTERRUPTED,
      }));
    } else {
      console.log(chalk.yellow('\n\n⚠️  Operation cancelled by user'));
    }

    if (options.exitOnError) {
      await this.gracefulExit(EXIT_CODES.INTERRUPTED);
    }
  }

  /**
   * 处理终止信号
   */
  private static async handleTermination(options: { verbose: boolean; json: boolean; exitOnError: boolean }): Promise<void> {
    if (options.json) {
      console.log(JSON.stringify({
        success: false,
        message: 'Application terminated',
        code: EXIT_CODES.INTERRUPTED,
      }));
    } else {
      console.log(chalk.yellow('\n⚠️  Application terminated'));
    }

    if (options.exitOnError) {
      await this.gracefulExit(EXIT_CODES.INTERRUPTED);
    }
  }

  /**
   * 优雅退出
   */
  private static async gracefulExit(code: number): Promise<void> {
    try {
      // 关闭日志系统
      if (LoggerManager.isInitialized()) {
        await LoggerManager.shutdown();
      }

      // 给其他清理操作一点时间
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error during cleanup:', error);
    } finally {
      process.exit(code);
    }
  }

  /**
   * 注册错误处理器
   */
  static registerHandler(type: string, handler: (error: Error) => void): void {
    this.handlers.set(type, handler);
  }

  /**
   * 移除错误处理器
   */
  static removeHandler(type: string): void {
    this.handlers.delete(type);
  }

  /**
   * 手动处理错误
   */
  static async handleError(error: Error, options?: {
    verbose?: boolean;
    json?: boolean;
    exit?: boolean;
  }): Promise<void> {
    const opts = {
      verbose: Boolean(getConfigValue('verbose') || false),
      json: Boolean(getConfigValue('json') || false),
      exit: true,
      ...options,
    };

    // 记录错误
    if (LoggerManager.isInitialized()) {
      await log.error('Application error', {
        error: error.message,
        stack: error.stack,
        category: error instanceof AppError ? error.category : 'unknown',
      });
    }

    // 格式化并输出错误
    const formatted = ErrorFormatter.formatError(error, opts);

    if (opts.json) {
      console.log(formatted);
    } else {
      console.error(formatted);
    }

    if (opts.exit) {
      const exitCode = error instanceof AppError ? error.code : EXIT_CODES.GENERAL_ERROR;
      await this.gracefulExit(exitCode);
    }
  }
}

/**
 * 错误包装器 - 用于包装可能抛出错误的异步操作
 */
export async function withErrorBoundary<T>(
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) {
      // 已经是应用错误，直接抛出
      throw error;
    }

    // 包装为应用错误
    const appError = new AppError({
      category: ErrorCategory.INTERNAL,
      code: EXIT_CODES.INTERNAL_ERROR,
      message: error.message,
      userMessage: 'An unexpected error occurred',
      suggestions: [
        'Try running the command again',
        'Check the logs for more details',
        'Report this issue if it persists',
      ],
      context,
    }, error instanceof Error ? error : new Error(String(error)));

    throw appError;
  }
}

/**
 * 快捷错误创建函数
 */
export const createError = {
  validation: (message: string, field?: string, suggestions?: string[]) =>
    new ValidationError(message, field, suggestions),

  configuration: (message: string, configPath?: string, suggestions?: string[]) =>
    new ConfigurationError(message, configPath, suggestions),

  network: (message: string, url?: string, statusCode?: number) =>
    new NetworkError(message, url, statusCode),

  timeout: (operation: string, timeout: number) =>
    new TimeoutError(operation, timeout),

  permission: (message: string, path?: string) =>
    new PermissionError(message, path),

  internal: (message: string, context?: Record<string, any>) =>
    new AppError({
      category: ErrorCategory.INTERNAL,
      code: EXIT_CODES.INTERNAL_ERROR,
      message,
      userMessage: 'An internal error occurred',
      suggestions: ['Try again later', 'Contact support if the issue persists'],
      context: context ?? undefined,
    }),
};