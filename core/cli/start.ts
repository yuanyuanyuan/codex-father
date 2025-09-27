/**
 * CLI 应用启动入口
 * 整合所有组件并启动 Codex Father CLI
 */

import { ErrorBoundary, withErrorBoundary, createError } from './error-boundary.js';
import { LoggerManager, setupDevelopmentLogging } from './logger-setup.js';
import { getConfig } from './config-loader.js';
import { parser } from './parser.js';
import { LegacyCommandHandler, routeLegacyCommand } from './legacy-compatibility.js';
import type { CommandContext, CommandResult } from '../lib/types.js';

/**
 * CLI 应用类
 */
class CodexFatherCLI {
  private initialized = false;

  /**
   * 初始化 CLI 应用
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await withErrorBoundary(async () => {
      // 1. 设置错误边界
      ErrorBoundary.setup({
        verbose: process.env.NODE_ENV === 'development' || process.env.CODEX_VERBOSE === 'true',
        json: process.env.CODEX_JSON === 'true',
        exitOnError: process.env.NODE_ENV !== 'test',
      });

      // 2. 加载配置
      const config = await getConfig();

      // 3. 初始化日志系统
      await LoggerManager.initialize(config.logging);

      // 4. 设置开发模式日志
      if (process.env.NODE_ENV === 'development') {
        setupDevelopmentLogging();
      }

      // 5. 注册遗留命令处理器
      this.registerLegacyCommands();

      // 6. 注册现代命令处理器（将来扩展）
      this.registerModernCommands();

      this.initialized = true;
    }, { operation: 'CLI initialization' });
  }

  /**
   * 注册遗留命令（start, job, test 等）
   */
  private registerLegacyCommands(): void {
    // start 命令
    parser.registerCommand(
      'start',
      'Execute start.sh script with TypeScript wrapper',
      async (context: CommandContext): Promise<CommandResult> => {
        return await LegacyCommandHandler.handleStart(context);
      },
      {
        aliases: [],
        arguments: [
          { name: 'args', description: 'Arguments to pass to start.sh', required: false }
        ],
        options: [
          { flags: '--timeout <ms>', description: 'Execution timeout in milliseconds' },
          { flags: '--capture', description: 'Capture script output', defaultValue: true },
        ],
      }
    );

    // job 命令
    parser.registerCommand(
      'job',
      'Execute job.sh script with TypeScript wrapper',
      async (context: CommandContext): Promise<CommandResult> => {
        return await LegacyCommandHandler.handleJob(context);
      },
      {
        aliases: [],
        arguments: [
          { name: 'args', description: 'Arguments to pass to job.sh', required: false }
        ],
        options: [
          { flags: '--timeout <ms>', description: 'Execution timeout in milliseconds' },
          { flags: '--capture', description: 'Capture script output', defaultValue: true },
        ],
      }
    );

    // test 命令
    parser.registerCommand(
      'test',
      'Execute test scripts with TypeScript wrapper',
      async (context: CommandContext): Promise<CommandResult> => {
        return await LegacyCommandHandler.handleTest(context);
      },
      {
        aliases: ['run-tests'],
        arguments: [
          { name: 'args', description: 'Arguments to pass to test script', required: false }
        ],
        options: [
          { flags: '--timeout <ms>', description: 'Execution timeout in milliseconds' },
          { flags: '--capture', description: 'Capture script output', defaultValue: true },
        ],
      }
    );
  }

  /**
   * 注册现代命令（将来扩展）
   */
  private registerModernCommands(): void {
    // task 命令 (计划中)
    parser.registerCommand(
      'task',
      'Task queue management (coming soon)',
      async (context: CommandContext): Promise<CommandResult> => {
        return {
          success: false,
          message: 'Task management is not yet implemented',
          errors: ['This feature is planned for Phase 2 implementation'],
          warnings: ['Use legacy scripts for now: ./start.sh, ./job.sh'],
          executionTime: 0,
        };
      },
      {
        arguments: [
          { name: 'action', description: 'Task action (create, list, status, cancel, retry, logs)', required: true }
        ],
      }
    );

    // config 命令 (计划中)
    parser.registerCommand(
      'config',
      'Configuration management (coming soon)',
      async (context: CommandContext): Promise<CommandResult> => {
        return {
          success: false,
          message: 'Configuration management is not yet implemented',
          errors: ['This feature is planned for Phase 2 implementation'],
          warnings: ['Basic configuration loading is available, but CLI management is not ready'],
          executionTime: 0,
        };
      },
      {
        arguments: [
          { name: 'action', description: 'Config action (get, set, list, validate, init)', required: true }
        ],
      }
    );

    // mcp 命令 (计划中)
    parser.registerCommand(
      'mcp',
      'MCP server management (coming soon)',
      async (context: CommandContext): Promise<CommandResult> => {
        return {
          success: false,
          message: 'MCP server management is not yet implemented',
          errors: ['This feature is planned for Phase 2 implementation'],
          warnings: ['MCP integration will be available in Phase 2'],
          executionTime: 0,
        };
      },
      {
        arguments: [
          { name: 'action', description: 'MCP action (start, stop, status, logs, tools)', required: true }
        ],
      }
    );

    // status 命令 (立即可用)
    parser.registerCommand(
      'status',
      'Show system status and health check',
      async (context: CommandContext): Promise<CommandResult> => {
        return await this.handleStatusCommand(context);
      },
      {
        options: [
          { flags: '--detailed', description: 'Show detailed status information' },
        ],
      }
    );
  }

  /**
   * 处理状态命令
   */
  private async handleStatusCommand(context: CommandContext): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      const config = await getConfig();
      const { validateLegacyScripts } = await import('./legacy-compatibility.js');
      const scriptValidation = await validateLegacyScripts();

      const statusData = {
        environment: config.environment,
        nodeVersion: process.version,
        platform: `${process.platform} ${process.arch}`,
        workingDirectory: process.cwd(),
        configLoaded: true,
        loggingInitialized: LoggerManager.isInitialized(),
        legacyScripts: {
          valid: scriptValidation.valid,
          missing: scriptValidation.missing,
          issues: scriptValidation.issues,
        },
        phase: {
          current: 'Phase 1 - Non-interactive CLI',
          completed: ['Project structure', 'TypeScript setup', 'CLI framework'],
          pending: ['Task queue system', 'Git automation', 'Container integration'],
        },
      };

      if (context.json) {
        return {
          success: true,
          data: statusData,
          executionTime: Date.now() - startTime,
        };
      }

      const messages = [
        '🚀 Codex Father CLI Status',
        '',
        `📦 Environment: ${statusData.environment}`,
        `⚙️  Node.js: ${statusData.nodeVersion}`,
        `💻 Platform: ${statusData.platform}`,
        `📁 Working Directory: ${statusData.workingDirectory}`,
        '',
        `✅ Configuration: ${statusData.configLoaded ? 'Loaded' : 'Not loaded'}`,
        `✅ Logging: ${statusData.loggingInitialized ? 'Initialized' : 'Not initialized'}`,
        '',
        '📜 Legacy Scripts:',
        `   Status: ${statusData.legacyScripts.valid ? '✅ Valid' : '❌ Issues found'}`,
      ];

      if (statusData.legacyScripts.missing.length > 0) {
        messages.push(`   Missing: ${statusData.legacyScripts.missing.join(', ')}`);
      }

      if (statusData.legacyScripts.issues.length > 0) {
        messages.push(`   Issues: ${statusData.legacyScripts.issues.join(', ')}`);
      }

      messages.push('');
      messages.push('🏗️ Implementation Progress:');
      messages.push(`   Current: ${statusData.phase.current}`);
      messages.push(`   Completed: ${statusData.phase.completed.join(', ')}`);
      messages.push(`   Pending: ${statusData.phase.pending.join(', ')}`);

      return {
        success: true,
        message: messages.join('\n'),
        data: context.options.detailed ? statusData : undefined,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      throw createError.internal('Failed to get status information', { error: error.message });
    }
  }

  /**
   * 启动 CLI 应用
   */
  async start(argv?: string[]): Promise<void> {
    await withErrorBoundary(async () => {
      // 初始化
      await this.initialize();

      // 解析并执行命令
      await parser.parse(argv);
    }, { operation: 'CLI startup' });
  }
}

/**
 * 创建并启动 CLI 应用实例
 */
export default async function startCLI(argv?: string[]): Promise<void> {
  const cli = new CodexFatherCLI();
  await cli.start(argv);
}

/**
 * 如果作为主模块运行，直接启动
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  startCLI().catch((error) => {
    console.error('Failed to start CLI:', error);
    process.exit(1);
  });
}