/**
 * MCP Command - MCP 服务器 CLI 命令
 *
 * 负责启动和管理 MCP 服务器
 * 参考: specs/005-docs-prd-draft/tasks.md:259-268
 *
 * 功能:
 * - 启动 MCP 服务器 (codex-father mcp)
 * - 配置加载和验证
 * - 优雅关闭处理 (SIGINT, SIGTERM)
 * - 用户反馈和日志输出
 */

import type { CLIParser } from '../parser.js';
import type { CommandContext, CommandResult } from '../../lib/types.js';
import { MCPServer, createMCPServer } from '../../mcp/server.js';

/**
 * MCP 命令配置选项
 */
interface MCPCommandOptions {
  debug?: boolean; // 调试模式
  serverName?: string; // 服务器名称
  serverVersion?: string; // 服务器版本
  codexCommand?: string; // Codex 命令路径
  codexArgs?: string; // Codex 命令参数 (逗号分隔)
  cwd?: string; // 工作目录
  healthCheckInterval?: number; // 健康检查间隔(毫秒)
  maxRestartAttempts?: number; // 最大重启次数
  restartDelay?: number; // 重启延迟(毫秒)
  timeout?: number; // 请求超时时间(毫秒)
}

/**
 * MCP 服务器实例 (全局单例)
 */
let mcpServerInstance: MCPServer | null = null;

/**
 * 注册 MCP 命令
 *
 * @param parser CLI 解析器
 */
export function registerMCPCommand(parser: CLIParser): void {
  parser.registerCommand(
    'mcp',
    'Start and manage MCP (Model Context Protocol) server',
    async (context: CommandContext): Promise<CommandResult> => {
      const started = Date.now();

      try {
        // 解析选项 (只添加存在的值,避免 undefined)
        const options: MCPCommandOptions = {
          debug: context.options.debug === true || context.options.debug === 'true',
        };

        if (context.options.serverName) {
          options.serverName = context.options.serverName as string;
        }
        if (context.options.serverVersion) {
          options.serverVersion = context.options.serverVersion as string;
        }
        if (context.options.codexCommand) {
          options.codexCommand = context.options.codexCommand as string;
        }
        if (context.options.codexArgs) {
          options.codexArgs = context.options.codexArgs as string;
        }
        if (context.options.cwd) {
          options.cwd = context.options.cwd as string;
        }
        if (context.options.healthCheckInterval) {
          options.healthCheckInterval = Number(context.options.healthCheckInterval);
        }
        if (context.options.maxRestartAttempts) {
          options.maxRestartAttempts = Number(context.options.maxRestartAttempts);
        }
        if (context.options.restartDelay) {
          options.restartDelay = Number(context.options.restartDelay);
        }
        if (context.options.timeout) {
          options.timeout = Number(context.options.timeout);
        }

        // 输出启动信息
        if (!context.json) {
          console.log('🚀 Starting MCP Server...\n');
          console.log('╭─────────────────────────────────────────────────────╮');
          console.log('│  Model Context Protocol (MCP) Server               │');
          console.log('│  Codex Father MCP Integration                       │');
          console.log('╰─────────────────────────────────────────────────────╯\n');

          if (options.debug) {
            console.log('🐛 Debug mode: ENABLED');
            console.log(`📁 Working directory: ${options.cwd || process.cwd()}`);
            console.log(
              `⏱️  Timeout: ${options.timeout || 30000}ms, Health check: ${options.healthCheckInterval || 30000}ms`
            );
            console.log('');
          }
        }

        // 创建并启动 MCP 服务器 (只传递存在的选项)
        const serverConfig: Record<string, unknown> = {};
        if (options.serverName) {
          serverConfig.serverName = options.serverName;
        }
        if (options.serverVersion) {
          serverConfig.serverVersion = options.serverVersion;
        }
        if (options.debug !== undefined) {
          serverConfig.debug = options.debug;
        }

        const server = createMCPServer(serverConfig as Parameters<typeof createMCPServer>[0]);

        mcpServerInstance = server;

        // 注册优雅关闭处理器
        setupGracefulShutdown(server, context);

        // 启动服务器
        await server.start();

        const serverInfo = server.getServerInfo();

        // 输出成功信息
        if (!context.json) {
          console.log('✅ MCP Server started successfully!\n');
          console.log(`📦 Server: ${serverInfo.name} v${serverInfo.version}`);
          console.log('🔌 Transport: stdio (line-delimited JSON)');
          console.log('📡 Protocol: MCP 2024-11-05');
          console.log('🛠️  Capabilities: tools, notifications');
          console.log('\n💡 Server is running. Press Ctrl+C to stop.');
          console.log('─────────────────────────────────────────────────────\n');
        }

        // 返回成功结果
        const result: CommandResult = {
          success: true,
          message: `MCP Server started: ${serverInfo.name} v${serverInfo.version}`,
          data: context.json
            ? {
                serverName: serverInfo.name,
                serverVersion: serverInfo.version,
                transport: 'stdio',
                protocol: 'MCP 2024-11-05',
                capabilities: ['tools', 'notifications'],
              }
            : undefined,
          executionTime: Date.now() - started,
        };

        // JSON 模式下输出结果
        if (context.json) {
          console.log(JSON.stringify(result, null, 2));
        }

        // 保持服务器运行 (阻塞直到收到关闭信号)
        await keepServerAlive();

        return result;
      } catch (error) {
        const errorMessage = (error as Error).message || 'Unknown error';
        const executionTime = Date.now() - started;

        if (!context.json) {
          console.error('\n❌ Failed to start MCP Server\n');
          console.error(`🔴 Error: ${errorMessage}\n`);
        }

        return {
          success: false,
          message: 'Failed to start MCP Server',
          errors: [errorMessage],
          executionTime,
        };
      }
    },
    {
      arguments: [],
      options: [
        { flags: '--debug', description: 'Enable debug logging' },
        { flags: '--server-name <name>', description: 'Server name (default: codex-father)' },
        {
          flags: '--server-version <version>',
          description: 'Server version (default: 1.0.0-mvp1)',
        },
        {
          flags: '--codex-command <command>',
          description: 'Codex command path (default: codex)',
        },
        {
          flags: '--codex-args <args>',
          description: 'Codex command arguments, comma-separated (default: mcp)',
        },
        { flags: '--cwd <path>', description: 'Working directory (default: current directory)' },
        {
          flags: '--health-check-interval <ms>',
          description: 'Health check interval in milliseconds (default: 30000)',
        },
        {
          flags: '--max-restart-attempts <n>',
          description: 'Maximum restart attempts (default: 3)',
        },
        {
          flags: '--restart-delay <ms>',
          description: 'Restart delay in milliseconds (default: 1000)',
        },
        {
          flags: '--timeout <ms>',
          description: 'Request timeout in milliseconds (default: 30000)',
        },
      ],
    }
  );
}

/**
 * 设置优雅关闭处理器
 *
 * @param server MCP 服务器实例
 * @param context 命令上下文
 */
function setupGracefulShutdown(server: MCPServer, context: CommandContext): void {
  const handleShutdown = async (signal: string) => {
    if (!context.json) {
      console.log(`\n\n🛑 Received ${signal}, shutting down gracefully...\n`);
    }

    try {
      await server.stop();

      if (!context.json) {
        console.log('✅ MCP Server stopped successfully.\n');
      }

      process.exit(0);
    } catch (error) {
      if (!context.json) {
        console.error(`❌ Error during shutdown: ${(error as Error).message}\n`);
      }
      process.exit(1);
    }
  };

  // 注册信号处理器
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));

  // 注册 uncaughtException 和 unhandledRejection 处理器
  process.on('uncaughtException', async (error) => {
    if (!context.json) {
      console.error(`\n❌ Uncaught Exception: ${error.message}\n`);
      console.error(error.stack);
    }

    try {
      await server.stop();
    } catch (stopError) {
      // 忽略停止错误
    }

    process.exit(1);
  });

  process.on('unhandledRejection', async (reason) => {
    if (!context.json) {
      console.error(`\n❌ Unhandled Rejection: ${reason}\n`);
    }

    try {
      await server.stop();
    } catch (stopError) {
      // 忽略停止错误
    }

    process.exit(1);
  });
}

/**
 * 保持服务器运行 (阻塞直到收到关闭信号)
 *
 * @returns Promise (永不 resolve,除非收到关闭信号)
 */
async function keepServerAlive(): Promise<void> {
  return new Promise(() => {
    // 无限阻塞,直到进程被信号终止
    // 信号处理器会调用 process.exit() 来退出
  });
}

/**
 * 获取当前 MCP 服务器实例 (用于测试)
 *
 * @returns MCPServer 实例或 null
 */
export function getMCPServerInstance(): MCPServer | null {
  return mcpServerInstance;
}

/**
 * 清理 MCP 服务器实例 (用于测试)
 */
export function clearMCPServerInstance(): void {
  mcpServerInstance = null;
}