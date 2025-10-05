/**
 * PRD CLI 基础框架
 * 实现统一的命令行接口，包含全局选项、命令解析、错误处理和配置管理
 */

import { Command, program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import type { PRDDraft } from '../models/prd-draft.js';
import type { UserRole } from '../models/user-role.js';

/**
 * 全局 CLI 选项接口
 */
export interface PRDGlobalOptions {
  config?: string; // 配置文件路径
  json: boolean; // JSON 输出格式
  verbose: boolean; // 详细输出
  quiet: boolean; // 静默模式
  help: boolean; // 帮助信息
  workingDirectory: string; // 工作目录
  profile?: string; // 用户配置文件
  timeout: number; // 操作超时时间（秒）
}

/**
 * 命令执行上下文
 */
export interface PRDCommandContext {
  args: string[];
  options: PRDGlobalOptions & Record<string, any>;
  workingDirectory: string;
  configPath?: string;
  userConfig: PRDUserConfig;
  spinner?: ora.Ora;
}

/**
 * 命令执行结果
 */
export interface PRDCommandResult {
  success: boolean;
  message?: string;
  data?: any;
  error?: Error;
  exitCode: number;
  executionTime: number;
  warnings?: string[];
}

/**
 * 用户配置接口
 */
export interface PRDUserConfig {
  defaultTemplate?: string;
  defaultAuthor?: string;
  outputFormat: 'table' | 'json' | 'yaml';
  editor: string;
  permissions: {
    role: UserRole['name'];
    defaultPermissions: string[];
  };
  preferences: {
    autoSave: boolean;
    confirmDelete: boolean;
    showProgress: boolean;
    colorOutput: boolean;
  };
  templates: {
    [key: string]: {
      path: string;
      description: string;
    };
  };
}

/**
 * 命令处理器接口
 */
export interface PRDCommandHandler {
  (context: PRDCommandContext): Promise<PRDCommandResult>;
}

/**
 * 注册的命令映射
 */
const registeredCommands = new Map<
  string,
  {
    handler: PRDCommandHandler;
    description: string;
    options?: any[];
  }
>();

/**
 * 默认用户配置
 */
const DEFAULT_USER_CONFIG: PRDUserConfig = {
  outputFormat: 'table',
  editor: process.env.EDITOR || 'vim',
  permissions: {
    role: 'developer',
    defaultPermissions: ['read', 'write'],
  },
  preferences: {
    autoSave: true,
    confirmDelete: true,
    showProgress: true,
    colorOutput: true,
  },
  templates: {},
};

/**
 * PRD CLI 解析器类
 */
export class PRDCLIParser {
  private command: Command;
  private globalOptions: PRDGlobalOptions = {
    json: false,
    verbose: false,
    quiet: false,
    help: false,
    workingDirectory: process.cwd(),
    timeout: 30,
  };

  constructor(commandInstance?: Command) {
    this.command = commandInstance ?? program;
    this.setupGlobalOptions();
    this.setupErrorHandling();
  }

  /**
   * 设置全局选项
   */
  private setupGlobalOptions(): void {
    this.command
      .name('prd')
      .description('PRD (Product Requirements Document) 管理工具')
      .version(this.getVersion())
      .option('-c, --config <path>', '指定配置文件路径')
      .option('-j, --json', '以 JSON 格式输出结果')
      .option('-v, --verbose', '显示详细输出信息')
      .option('-q, --quiet', '静默模式，仅显示错误')
      .option('-p, --profile <name>', '使用指定的用户配置文件')
      .option('--timeout <seconds>', '设置操作超时时间', '30')
      .option('--working-directory <path>', '设置工作目录', process.cwd());
  }

  /**
   * 设置错误处理
   */
  private setupErrorHandling(): void {
    // 处理未捕获的异常
    process.on('uncaughtException', (error) => {
      this.handleError(error, 'Uncaught Exception');
      process.exit(1);
    });

    // 处理未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason, promise) => {
      this.handleError(new Error(String(reason)), 'Unhandled Promise Rejection');
      process.exit(1);
    });
  }

  /**
   * 注册命令
   */
  registerCommand(
    name: string,
    description: string,
    handler: PRDCommandHandler,
    options: any[] = []
  ): void {
    registeredCommands.set(name, { handler, description, options });

    const subCommand = this.command.command(name).description(description);

    // 添加命令特定选项
    options.forEach((option) => {
      if (option.flags && option.description) {
        subCommand.option(option.flags, option.description, option.defaultValue);
      }
    });

    subCommand.action(async (...args) => {
      const commandOptions = args[args.length - 1];
      const commandArgs = args.slice(0, -1);

      await this.executeCommand(name, commandArgs, commandOptions);
    });
  }

  /**
   * 执行命令
   */
  async executeCommand(
    commandName: string,
    args: string[],
    options: any
  ): Promise<PRDCommandResult> {
    const startTime = Date.now();
    let spinner: ora.Ora | undefined;

    try {
      // 加载配置
      const userConfig = await this.loadUserConfig(options.config, options.profile);

      // 创建执行上下文
      const context: PRDCommandContext = {
        args,
        options: { ...this.globalOptions, ...options },
        workingDirectory: options.workingDirectory || process.cwd(),
        configPath: options.config,
        userConfig,
        spinner: undefined,
      };

      // 显示进度指示器
      if (userConfig.preferences.showProgress && !options.quiet && !options.json) {
        spinner = ora(`执行命令: ${commandName}`).start();
        context.spinner = spinner;
      }

      // 获取命令处理器
      const commandInfo = registeredCommands.get(commandName);
      if (!commandInfo) {
        throw new Error(`未知命令: ${commandName}`);
      }

      // 执行命令
      const result = await commandInfo.handler(context);

      // 停止进度指示器
      if (spinner) {
        if (result.success) {
          spinner.succeed(`命令执行成功: ${commandName}`);
        } else {
          spinner.fail(`命令执行失败: ${commandName}`);
        }
      }

      // 格式化输出
      this.formatOutput(result, context);

      return {
        ...result,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      if (spinner) {
        spinner.fail(`命令执行出错: ${commandName}`);
      }

      const result: PRDCommandResult = {
        success: false,
        error: error as Error,
        exitCode: 1,
        executionTime: Date.now() - startTime,
      };

      this.handleError(error as Error, `Command: ${commandName}`);
      return result;
    }
  }

  /**
   * 加载用户配置
   */
  async loadUserConfig(configPath?: string, profile?: string): Promise<PRDUserConfig> {
    try {
      const configFile = configPath || this.findConfigFile();

      if (!configFile || !existsSync(configFile)) {
        return { ...DEFAULT_USER_CONFIG };
      }

      const configData = JSON.parse(readFileSync(configFile, 'utf-8'));

      // 如果指定了 profile，则使用对应的配置
      const config =
        profile && configData.profiles?.[profile]
          ? { ...configData.default, ...configData.profiles[profile] }
          : configData.default || configData;

      return { ...DEFAULT_USER_CONFIG, ...config };
    } catch (error) {
      console.warn(chalk.yellow(`警告: 无法加载配置文件，使用默认配置`));
      return { ...DEFAULT_USER_CONFIG };
    }
  }

  /**
   * 查找配置文件
   */
  private findConfigFile(): string | null {
    const configNames = ['.prdrc', '.prd.json', 'prd.config.json'];
    const searchPaths = [process.cwd(), process.env.HOME || process.env.USERPROFILE || ''];

    for (const dir of searchPaths) {
      for (const name of configNames) {
        const configPath = join(dir, name);
        if (existsSync(configPath)) {
          return configPath;
        }
      }
    }

    return null;
  }

  /**
   * 格式化输出
   */
  private formatOutput(result: PRDCommandResult, context: PRDCommandContext): void {
    if (context.options.quiet && result.success) {
      return;
    }

    if (context.options.json) {
      console.log(
        JSON.stringify(
          {
            success: result.success,
            data: result.data,
            message: result.message,
            warnings: result.warnings,
            executionTime: result.executionTime,
          },
          null,
          2
        )
      );
      return;
    }

    const colorOutput = context.userConfig.preferences.colorOutput;

    if (result.success) {
      if (result.message) {
        console.log(colorOutput ? chalk.green('✓ ' + result.message) : '✓ ' + result.message);
      }

      if (result.data && context.userConfig.outputFormat === 'table') {
        this.displayAsTable(result.data);
      } else if (result.data) {
        console.log(result.data);
      }
    } else {
      if (result.message) {
        console.error(colorOutput ? chalk.red('✗ ' + result.message) : '✗ ' + result.message);
      }
    }

    // 显示警告
    if (result.warnings && result.warnings.length > 0) {
      result.warnings.forEach((warning) => {
        console.warn(colorOutput ? chalk.yellow('⚠ ' + warning) : '⚠ ' + warning);
      });
    }

    // 显示执行时间
    if (context.options.verbose) {
      console.log(
        colorOutput
          ? chalk.gray(`执行时间: ${result.executionTime}ms`)
          : `执行时间: ${result.executionTime}ms`
      );
    }
  }

  /**
   * 以表格形式显示数据
   */
  private displayAsTable(data: any): void {
    if (Array.isArray(data) && data.length > 0) {
      console.table(data);
    } else if (typeof data === 'object' && data !== null) {
      console.table([data]);
    } else {
      console.log(data);
    }
  }

  /**
   * 错误处理
   */
  private handleError(error: Error, context: string): void {
    const timestamp = new Date().toISOString();

    console.error(chalk.red(`\n[${timestamp}] 错误发生在: ${context}`));
    console.error(chalk.red(`错误信息: ${error.message}`));

    if (this.globalOptions.verbose && error.stack) {
      console.error(chalk.gray(`错误堆栈:\n${error.stack}`));
    }

    // 提供帮助信息
    console.error(chalk.cyan('\n使用 --help 查看命令帮助信息'));
    console.error(chalk.cyan('使用 --verbose 查看详细错误信息'));
  }

  /**
   * 获取版本信息
   */
  private getVersion(): string {
    try {
      const packagePath = resolve(__dirname, '../../package.json');
      if (existsSync(packagePath)) {
        const packageData = JSON.parse(readFileSync(packagePath, 'utf-8'));
        return packageData.version || process.env.npm_package_version || '1.6.0';
      }
    } catch (error) {
      // 忽略版本读取错误
    }
    return process.env.npm_package_version || '1.6.0';
  }

  /**
   * 解析命令行参数
   */
  async parse(argv?: string[]): Promise<void> {
    try {
      await this.command.parseAsync(argv);
    } catch (error) {
      this.handleError(error as Error, 'Command parsing');
      process.exit(1);
    }
  }

  /**
   * 获取已注册的命令列表
   */
  getRegisteredCommands(): Map<
    string,
    { handler: PRDCommandHandler; description: string; options?: any[] }
  > {
    return new Map(registeredCommands);
  }
}

/**
 * 创建 PRD CLI 实例
 */
export function createPRDCLI(): PRDCLIParser {
  return new PRDCLIParser();
}

/**
 * 辅助函数：格式化时间
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  const seconds = Math.floor(milliseconds / 1000);
  const ms = milliseconds % 1000;

  if (seconds < 60) {
    return `${seconds}.${Math.floor(ms / 100)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}m${remainingSeconds}s`;
}

/**
 * 辅助函数：验证配置
 */
export function validateConfig(config: Partial<PRDUserConfig>): string[] {
  const errors: string[] = [];

  if (config.outputFormat && !['table', 'json', 'yaml'].includes(config.outputFormat)) {
    errors.push('outputFormat 必须是 table、json 或 yaml 之一');
  }

  if (
    config.permissions?.role &&
    !['architect', 'product_manager', 'developer', 'tester', 'viewer'].includes(
      config.permissions.role
    )
  ) {
    errors.push('role 必须是有效的用户角色');
  }

  return errors;
}
