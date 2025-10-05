/**
 * CLI 参数解析器
 * 基于 commander.js 的统一参数解析和命令路由
 */

import { Command, program } from 'commander';
import chalk from 'chalk';
import type { CommandContext, CommandResult } from '../lib/types.js';
import { handleMetaCommand, CommandDiscovery } from './commands/meta-commands.js';
import { PROJECT_VERSION } from '../lib/version.js';

/**
 * 全局选项接口
 */
interface GlobalOptions {
  verbose: boolean;
  dryRun: boolean;
  json: boolean;
  config?: string;
  workingDirectory: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * 命令处理器接口
 */
export interface CommandHandler {
  (context: CommandContext): Promise<CommandResult>;
}

/**
 * 注册的命令映射
 */
const registeredCommands = new Map<string, CommandHandler>();

/**
 * CLI 参数解析器类
 */
export class CLIParser {
  private command: Command;
  private globalOptions: GlobalOptions = {
    verbose: false,
    dryRun: false,
    json: false,
    workingDirectory: process.cwd(),
    logLevel: 'info',
  };

  constructor(commandInstance?: Command) {
    this.command = commandInstance ?? program;
    this.setupGlobalOptions();
    this.setupMetaCommands();
    this.setupErrorHandling();
  }

  /**
   * 设置全局选项
   */
  private setupGlobalOptions(): void {
    this.command
      .name('codex-father')
      .description(
        'TypeScript-based CLI tool for project management with task queues and MCP integration'
      )
      .version(PROJECT_VERSION, '-v, --version', 'Display version information')
      .helpOption('-h, --help', 'Display help information');

    // 全局选项
    this.command
      .option('--verbose', 'Enable verbose output', false)
      .option('--dry-run', 'Show what would be done without executing', false)
      .option('--json', 'Output in JSON format', false)
      .option('--config <path>', 'Specify config file path')
      .option('--cwd <path>', 'Change working directory', process.cwd())
      .option(
        '--log-level <level>',
        'Set log level (debug|info|warn|error)',
        this.globalOptions.logLevel
      );

    // 全局选项处理钩子
    this.command.hook('preAction', (thisCommand) => {
      const opts = thisCommand.opts();
      this.globalOptions = {
        verbose: opts.verbose || false,
        dryRun: opts.dryRun || false,
        json: opts.json || false,
        config: opts.config,
        workingDirectory: opts.cwd || process.cwd(),
        logLevel: this.normalizeLogLevel(opts.logLevel),
      };

      // 切换工作目录
      if (this.globalOptions.workingDirectory !== process.cwd()) {
        try {
          process.chdir(this.globalOptions.workingDirectory);
        } catch (error) {
          this.handleError(
            new Error(
              `Failed to change directory to ${this.globalOptions.workingDirectory}: ${error}`
            )
          );
          process.exit(1);
        }
      }
    });
  }

  /**
   * 设置元命令（version, help）
   */
  private setupMetaCommands(): void {
    // version 命令已在构造函数中设置
    // help 命令使用 commander.js 内置处理

    // 自定义帮助处理
    this.command.configureHelp({
      sortSubcommands: true,
      subcommandTerm: (cmd) => cmd.name() + ' ' + cmd.usage(),
    });
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    // 未知命令处理
    this.command.on('command:*', (operands) => {
      const unknownCommand = operands[0];

      if (this.globalOptions.json) {
        this.outputJSON({
          success: false,
          error: `Unknown command: ${unknownCommand}`,
          suggestions: CommandDiscovery.getCommandSuggestions(unknownCommand),
        });
      } else {
        console.error(chalk.red(`❌ Unknown command: ${chalk.bold(unknownCommand)}`));

        const suggestions = CommandDiscovery.getCommandSuggestions(unknownCommand);
        if (suggestions.length > 0) {
          console.error(chalk.yellow(`\n💡 Did you mean one of these?`));
          suggestions.forEach((suggestion) => {
            console.error(chalk.yellow(`   ${suggestion}`));
          });
        }

        console.error(chalk.gray(`\nRun '${this.command.name()} --help' for available commands.`));
      }

      process.exit(1);
    });

    // 参数验证错误处理
    this.command.exitOverride((err) => {
      if (this.globalOptions.json) {
        this.outputJSON({
          success: false,
          error: err.message,
          code: err.code,
        });
      } else {
        if (err.code === 'commander.helpDisplayed') {
          // 正常的帮助显示，不是错误
          process.exit(0);
        } else if (err.code === 'commander.version') {
          // 正常的版本显示，不是错误
          process.exit(0);
        } else {
          console.error(chalk.red(`❌ ${err.message}`));
        }
      }
      process.exit(err.exitCode || 1);
    });
  }

  /**
   * 注册子命令
   */
  registerCommand(
    name: string,
    description: string,
    handler: CommandHandler,
    options?: {
      usage?: string;
      aliases?: string[];
      arguments?: Array<{ name: string; description: string; required?: boolean }>;
      options?: Array<{
        flags: string;
        description: string;
        defaultValue?: string | boolean | number | string[] | number[];
      }>;
    }
  ): void {
    const subCommand = this.command.command(name).description(description);

    // 添加别名
    if (options?.aliases) {
      options.aliases.forEach((alias) => subCommand.alias(alias));
    }

    // 添加参数
    if (options?.arguments) {
      options.arguments.forEach((arg) => {
        const argString = arg.required ? `<${arg.name}>` : `[${arg.name}]`;
        subCommand.argument(argString, arg.description);
      });
    }

    // 添加选项
    if (options?.options) {
      options.options.forEach((opt) => {
        if (typeof opt.defaultValue === 'number') {
          subCommand.option(
            opt.flags,
            opt.description,
            (value: string) => Number(value),
            opt.defaultValue
          );
          return;
        }

        if (
          Array.isArray(opt.defaultValue) &&
          opt.defaultValue.every((item) => typeof item === 'number')
        ) {
          subCommand.option(
            opt.flags,
            opt.description,
            (value: string, previous: unknown) => {
              const prior = Array.isArray(previous) ? previous : [];
              return [...prior, Number(value)];
            },
            opt.defaultValue
          );
          return;
        }

        const normalizedDefault = this.normalizeOptionDefault(opt.defaultValue);
        if (normalizedDefault !== undefined) {
          subCommand.option(opt.flags, opt.description, normalizedDefault);
        } else {
          subCommand.option(opt.flags, opt.description);
        }
      });
    }

    // 注册处理器
    subCommand.action(async (...args) => {
      let result: CommandResult | undefined;
      try {
        const context = this.buildCommandContext(args);
        result = await handler(context);
        this.outputResult(result);
      } catch (error) {
        this.handleError(error);
        process.exit(1);
        return;
      }

      if (!result) {
        process.exit(1);
        return;
      }

      if (typeof result.exitCode === 'number') {
        process.exit(result.exitCode);
      } else if (!result.success) {
        process.exit(1);
      }
    });

    if (options?.usage) {
      subCommand.usage(options.usage);
    }

    // 存储到注册表
    registeredCommands.set(name, handler);
  }

  /**
   * 构建命令上下文
   */
  private buildCommandContext(args: unknown[]): CommandContext {
    // 最后一个参数通常是 Command 实例和选项
    const commandCandidate = args[args.length - 1];
    let options: Record<string, unknown> = {};

    // 检查是否有有效的 Command 实例
    if (this.isCommanderCommand(commandCandidate)) {
      options = commandCandidate.opts();
    }

    // 前面的参数是命令参数
    const rawArgs = args.slice(0, this.isCommanderCommand(commandCandidate) ? -1 : args.length);
    const commandArgs = rawArgs.filter((arg): arg is string => typeof arg === 'string');

    return {
      args: commandArgs,
      options: { ...this.globalOptions, ...options },
      workingDirectory: this.globalOptions.workingDirectory,
      configPath: this.globalOptions.config || '',
      verbose: this.globalOptions.verbose,
      dryRun: this.globalOptions.dryRun,
      json: this.globalOptions.json,
      logLevel: this.globalOptions.logLevel,
    };
  }

  /**
   * 输出命令结果
   */
  private outputResult(result: CommandResult): void {
    if (this.globalOptions.json) {
      this.outputJSON(result);
    } else {
      this.outputHuman(result);
    }
  }

  /**
   * JSON 格式输出
   */
  private outputJSON(data: unknown): void {
    console.log(JSON.stringify(data, null, 2));
  }

  /**
   * 人类可读格式输出
   */
  private outputHuman(result: CommandResult): void {
    if (result.message) {
      if (result.success) {
        console.log(result.message);
      } else {
        console.error(chalk.red(result.message));
      }
    }

    // 显示警告
    if (result.warnings && result.warnings.length > 0) {
      result.warnings.forEach((warning) => {
        console.warn(chalk.yellow(`⚠️  ${warning}`));
      });
    }

    // 显示错误
    if (result.errors && result.errors.length > 0) {
      result.errors.forEach((error) => {
        console.error(chalk.red(`❌ ${error}`));
      });
    }

    // 在 verbose 模式下显示执行时间
    if (this.globalOptions.verbose && result.executionTime !== undefined) {
      console.log(chalk.gray(`⏱️  Execution time: ${result.executionTime}ms`));
    }
  }

  /**
   * 错误处理
   */
  private handleError(error: unknown): void {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    const code = this.extractErrorCode(error);

    if (this.globalOptions.json) {
      this.outputJSON({
        success: false,
        error: normalizedError.message,
        code,
        stack: this.globalOptions.verbose ? normalizedError.stack : undefined,
      });
      return;
    }

    console.error(chalk.red(`❌ Error: ${normalizedError.message}`));

    if (this.globalOptions.verbose && normalizedError.stack) {
      console.error(chalk.gray(normalizedError.stack));
    }
  }

  /**
   * 解析并执行命令
   */
  async parse(argv?: string[]): Promise<void> {
    try {
      // 特殊处理：如果没有参数或只有全局选项，显示帮助
      const args = argv || process.argv;
      if (args.length <= 2) {
        this.command.help();
        return;
      }

      // 检查是否是元命令
      const command = args[2];
      if (!command) {
        this.command.help();
        return;
      }
      if (['--version', '-v', '--help', '-h'].includes(command)) {
        // 让 commander.js 处理
        await this.command.parseAsync(args);
        return;
      }

      // 尝试处理元命令
      const context = this.buildCommandContext([]);
      const metaResult = await handleMetaCommand(command, context);

      if (metaResult) {
        this.outputResult(metaResult);
        return;
      }

      // 解析常规命令
      await this.command.parseAsync(args);
    } catch (error) {
      if (this.isProcessExitError(error)) {
        throw error;
      }

      this.handleError(error);
      process.exit(1);
    }
  }

  /**
   * 获取已注册的命令列表
   */
  getRegisteredCommands(): string[] {
    return Array.from(registeredCommands.keys());
  }

  /**
   * 获取 Commander 实例（用于高级配置）
   */
  getProgram(): Command {
    return this.command;
  }

  /**
   * 规范化日志级别
   */
  private normalizeLogLevel(level?: string): 'debug' | 'info' | 'warn' | 'error' {
    const allowedLevels = new Set(['debug', 'info', 'warn', 'error']);
    if (!level) {
      return 'info';
    }

    const normalized = String(level).toLowerCase();
    return (allowedLevels.has(normalized) ? normalized : 'info') as
      | 'debug'
      | 'info'
      | 'warn'
      | 'error';
  }

  private normalizeOptionDefault(
    value: string | boolean | number | string[] | number[] | undefined
  ): string | boolean | string[] | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (typeof value === 'string' || typeof value === 'boolean') {
      return value;
    }

    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      return value as string[];
    }

    return undefined;
  }

  private isCommanderCommand(value: unknown): value is Command {
    return Boolean(value) && typeof (value as Command).opts === 'function';
  }

  private extractErrorCode(value: unknown): string | undefined {
    if (typeof value === 'object' && value !== null && 'code' in value) {
      const code = (value as { code?: unknown }).code;
      return typeof code === 'string' ? code : undefined;
    }
    return undefined;
  }

  private isProcessExitError(error: unknown): error is Error {
    if (!(error instanceof Error)) {
      return false;
    }

    return error.message.startsWith('process.exit:');
  }
}

/**
 * 默认解析器实例
 */
export const parser = new CLIParser();

/**
 * 快捷注册函数
 */
export function registerCommand(
  name: string,
  description: string,
  handler: CommandHandler,
  options?: Parameters<CLIParser['registerCommand']>[3]
): void {
  parser.registerCommand(name, description, handler, options);
}

/**
 * 参数验证工具
 */
export class ParameterValidator {
  /**
   * 验证必需参数
   */
  static validateRequired(value: unknown, name: string): void {
    if (value === undefined || value === null || value === '') {
      throw new Error(`Required parameter '${name}' is missing`);
    }
  }

  /**
   * 验证数字范围
   */
  static validateRange(value: number, min: number, max: number, name: string): void {
    if (value < min || value > max) {
      throw new Error(`Parameter '${name}' must be between ${min} and ${max}, got ${value}`);
    }
  }

  /**
   * 验证枚举值
   */
  static validateEnum(value: string, allowedValues: string[], name: string): void {
    if (!allowedValues.includes(value)) {
      throw new Error(
        `Parameter '${name}' must be one of: ${allowedValues.join(', ')}, got '${value}'`
      );
    }
  }

  /**
   * 验证文件路径
   */
  static validatePath(value: string, name: string, mustExist = false): void {
    if (!value || typeof value !== 'string') {
      throw new Error(`Parameter '${name}' must be a valid path`);
    }

    if (mustExist) {
      const fs = require('fs');
      if (!fs.existsSync(value)) {
        throw new Error(`Path '${value}' for parameter '${name}' does not exist`);
      }
    }
  }
}
