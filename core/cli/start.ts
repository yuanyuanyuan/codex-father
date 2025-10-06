/**
 * CLI 应用启动入口
 * 整合所有组件并启动 Codex Father CLI
 */

import { ErrorBoundary, withErrorBoundary, createError } from './error-boundary.js';
import { LoggerManager, setupDevelopmentLogging } from './logger-setup.js';
import { getConfig } from './config-loader.js';
import { parser } from './parser.js';
import { LegacyCommandHandler } from './legacy-compatibility.js';
import { registerTaskCommand } from './commands/task-command.js';
import { registerConfigCommand } from './commands/config-command.js';
import { registerQueueCommand } from './commands/queue-command.js';
import { registerMCPCommand } from './commands/mcp-command.js';
import { registerOrchestrateCommand } from './commands/orchestrate-command.js';
import { registerLogsCommand } from './commands/logs-command.js';
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

    await withErrorBoundary(
      async () => {
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
      },
      { operation: 'CLI initialization' }
    );
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
          { name: 'args', description: 'Arguments to pass to start.sh', required: false },
        ],
        options: [
          { flags: '--timeout <ms>', description: 'Execution timeout in milliseconds' },
          { flags: '--capture', description: 'Capture script output', defaultValue: true },
          {
            flags: '--instructions <file>',
            description: 'Path to structured instructions file (JSON/YAML/XML)',
          },
          {
            flags: '--task <id>',
            description: 'Task id defined in structured instructions',
          },
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
        arguments: [{ name: 'args', description: 'Arguments to pass to job.sh', required: false }],
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
          { name: 'args', description: 'Arguments to pass to test script', required: false },
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
    registerTaskCommand(parser);

    registerConfigCommand(parser);

    // queue 命令（完整队列管理）
    registerQueueCommand(parser);

    // mcp 命令 (MVP1 实现)
    registerMCPCommand(parser);

    // logs 命令（导出/跟随会话日志）
    registerLogsCommand(parser);

    // orchestrate 命令（多 Agent 编排脚手架）
    registerOrchestrateCommand(parser);

    // status 命令 (立即可用)
    parser.registerCommand(
      'status',
      'Show system status and health check',
      async (context: CommandContext): Promise<CommandResult> => {
        return await this.handleStatusCommand(context);
      },
      {
        options: [{ flags: '--detailed', description: 'Show detailed status information' }],
      }
    );
  }

  /**
   * 处理状态命令
   */
  private async handleStatusCommand(context: CommandContext): Promise<CommandResult> {
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();

    try {
      const config = await getConfig();
      const { validateLegacyScripts } = await import('./legacy-compatibility.js');
      const scriptValidation = await validateLegacyScripts();

      const finalMemory = process.memoryUsage();
      const executionTime = Date.now() - startTime;

      type MemorySnapshot = {
        rssBytes: number;
        heapTotalBytes: number;
        heapUsedBytes: number;
        externalBytes: number;
        arrayBuffersBytes: number;
        sharedArrayBuffersBytes: number;
        rssMB: number;
        heapUsedMB: number;
      };

      const extractSharedArrayBuffers = (snapshot: NodeJS.MemoryUsage): number => {
        if ('sharedArrayBuffers' in snapshot) {
          const value = (snapshot as { sharedArrayBuffers?: unknown }).sharedArrayBuffers;
          return typeof value === 'number' ? value : 0;
        }
        return 0;
      };

      const formatMemorySnapshot = (
        snapshot: NodeJS.MemoryUsage,
        sharedOverride?: number
      ): MemorySnapshot => {
        const rss = snapshot.rss;
        const heapTotal = snapshot.heapTotal;
        const heapUsed = snapshot.heapUsed;
        const external = snapshot.external ?? 0;
        const arrayBuffers = snapshot.arrayBuffers ?? 0;
        const sharedArrayBuffers = sharedOverride ?? extractSharedArrayBuffers(snapshot);

        return {
          rssBytes: rss,
          heapTotalBytes: heapTotal,
          heapUsedBytes: heapUsed,
          externalBytes: external,
          arrayBuffersBytes: arrayBuffers,
          sharedArrayBuffersBytes: sharedArrayBuffers,
          rssMB: Number((rss / 1024 / 1024).toFixed(2)),
          heapUsedMB: Number((heapUsed / 1024 / 1024).toFixed(2)),
        };
      };

      const memoryUsage = {
        initial: formatMemorySnapshot(initialMemory),
        final: formatMemorySnapshot(finalMemory),
        peak: formatMemorySnapshot(
          {
            rss: Math.max(initialMemory.rss, finalMemory.rss),
            heapTotal: Math.max(initialMemory.heapTotal, finalMemory.heapTotal),
            heapUsed: Math.max(initialMemory.heapUsed, finalMemory.heapUsed),
            external: Math.max(initialMemory.external ?? 0, finalMemory.external ?? 0),
            arrayBuffers: Math.max(initialMemory.arrayBuffers ?? 0, finalMemory.arrayBuffers ?? 0),
          },
          Math.max(extractSharedArrayBuffers(initialMemory), extractSharedArrayBuffers(finalMemory))
        ),
        delta: {
          rssBytes: finalMemory.rss - initialMemory.rss,
          heapUsedBytes: finalMemory.heapUsed - initialMemory.heapUsed,
          rssMB: Number(((finalMemory.rss - initialMemory.rss) / 1024 / 1024).toFixed(2)),
          heapUsedMB: Number(
            ((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)
          ),
        },
      };

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
        performance: {
          executionTimeMs: executionTime,
          uptimeSeconds: Number(process.uptime().toFixed(3)),
          memoryUsage,
        },
      };

      if (context.json) {
        return {
          success: true,
          data: statusData,
          executionTime,
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
      messages.push('');
      messages.push('⏱️ Performance Metrics:');
      messages.push(`   Execution Time: ${executionTime}ms`);
      messages.push(`   Uptime: ${statusData.performance.uptimeSeconds}s`);
      messages.push(`   RSS Memory: ${statusData.performance.memoryUsage.final.rssMB} MB`);
      messages.push(`   Heap Used: ${statusData.performance.memoryUsage.final.heapUsedMB} MB`);

      return {
        success: true,
        message: messages.join('\n'),
        data: context.options.detailed ? statusData : undefined,
        executionTime,
      };
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      throw createError.internal('Failed to get status information', { error: cause.message });
    }
  }

  /**
   * 启动 CLI 应用
   */
  async start(argv?: string[]): Promise<void> {
    await withErrorBoundary(
      async () => {
        // 初始化
        await this.initialize();

        // 解析并执行命令
        await parser.parse(argv);
      },
      { operation: 'CLI startup' }
    );
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
