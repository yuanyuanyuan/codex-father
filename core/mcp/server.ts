/**
 * MCP Server - MCP 协议服务器 (MVP1)
 *
 * 负责实现标准 MCP 协议,整合所有子系统
 * 参考: specs/005-docs-prd-draft/contracts/mcp-protocol.yaml
 *
 * 设计原则:
 * - 单一职责: 仅负责 MCP 协议处理
 * - 依赖倒置: 依赖于抽象的 ProcessManager 和 SessionManager
 * - 开闭原则: 可通过 BridgeLayer 扩展新工具
 *
 * 协议:
 * - 传输: stdio (line-delimited JSON)
 * - 协议版本: 2024-11-05
 * - 能力: tools, notifications
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { SingleProcessManager, createProcessManager } from '../process/manager.js';
import { SessionManager, createSessionManager } from '../session/session-manager.js';
import { BridgeLayer, createBridgeLayer } from './bridge-layer.js';
import { EventMapper, createEventMapper } from './event-mapper.js';

/**
 * MCP 服务器配置
 */
export interface MCPServerConfig {
  serverName?: string; // 服务器名称 (默认: 'codex-father')
  serverVersion?: string; // 服务器版本
  debug?: boolean; // 是否输出调试日志
  // 进程管理器配置透传
  codexCommand?: string;
  codexArgs?: string[];
  cwd?: string;
  healthCheckInterval?: number;
  maxRestartAttempts?: number;
  restartDelay?: number;
  timeout?: number;
}

/**
 * MCP 服务器 (MVP1)
 *
 * 职责 (Single Responsibility):
 * - 实现 MCP 协议 (initialize, tools/list, tools/call)
 * - 协调 ProcessManager, SessionManager, BridgeLayer
 * - 转发进度通知到客户端
 */
export class MCPServer {
  private server: Server;
  private transport: StdioServerTransport;
  private processManager: SingleProcessManager;
  private sessionManager: SessionManager;
  private bridgeLayer: BridgeLayer;
  private eventMapper: EventMapper;
  private config: MCPServerConfig;
  private handlersRegistered = false;

  constructor(config: MCPServerConfig = {}) {
    this.config = {
      serverName: config.serverName || 'codex-father',
      serverVersion: config.serverVersion || '1.0.0-mvp1',
      debug: config.debug || false,
    };
    if (config.codexCommand !== undefined) {
      this.config.codexCommand = config.codexCommand;
    }
    if (config.codexArgs !== undefined) {
      this.config.codexArgs = config.codexArgs;
    }
    if (config.cwd !== undefined) {
      this.config.cwd = config.cwd;
    }
    if (config.healthCheckInterval !== undefined) {
      this.config.healthCheckInterval = config.healthCheckInterval;
    }
    if (config.maxRestartAttempts !== undefined) {
      this.config.maxRestartAttempts = config.maxRestartAttempts;
    }
    if (config.restartDelay !== undefined) {
      this.config.restartDelay = config.restartDelay;
    }
    if (config.timeout !== undefined) {
      this.config.timeout = config.timeout;
    }

    // 创建 MCP Server
    this.server = new Server(
      {
        name: this.config.serverName || 'codex-father',
        version: this.config.serverVersion || '1.0.0-mvp1',
      },
      {
        capabilities: {
          tools: {}, // 支持工具调用
        },
      }
    );

    // 创建传输层 (stdio)
    this.transport = new StdioServerTransport();

    // 创建进程管理器
    const pmConfig: import('../process/manager.js').ProcessManagerConfig = {
      debug: !!this.config.debug,
    };
    if (this.config.codexCommand) {
      pmConfig.codexCommand = this.config.codexCommand;
    }
    if (this.config.codexArgs) {
      pmConfig.codexArgs = this.config.codexArgs;
    }
    if (this.config.cwd) {
      pmConfig.cwd = this.config.cwd;
    }
    if (typeof this.config.healthCheckInterval === 'number') {
      pmConfig.healthCheckInterval = this.config.healthCheckInterval;
    }
    if (typeof this.config.maxRestartAttempts === 'number') {
      pmConfig.maxRestartAttempts = this.config.maxRestartAttempts;
    }
    if (typeof this.config.restartDelay === 'number') {
      pmConfig.restartDelay = this.config.restartDelay;
    }
    if (typeof this.config.timeout === 'number') {
      pmConfig.timeout = this.config.timeout;
    }

    this.processManager = createProcessManager(pmConfig);

    // 创建会话管理器
    this.sessionManager = createSessionManager({
      processManager: this.processManager,
    });

    // 创建桥接层
    this.bridgeLayer = createBridgeLayer({
      sessionManager: this.sessionManager,
    });

    // 创建事件映射器
    this.eventMapper = createEventMapper({
      debug: !!this.config.debug,
    });

    // 注意: 处理器注册依赖于已启动的 ProcessManager，
    // 移至 start() 中在 processManager.start() 之后执行
  }

  /**
   * 启动 MCP 服务器
   */
  async start(): Promise<void> {
    if (this.config.debug) {
      console.log('[MCPServer] Starting...');
    }

    // 启动进程管理器
    await this.processManager.start();

    // 启动后再注册处理器，确保 CodexClient 可用
    this.registerHandlers();

    // 连接传输层
    await this.server.connect(this.transport);

    if (this.config.debug) {
      console.log(`[MCPServer] Started: ${this.config.serverName} v${this.config.serverVersion}`);
    }
  }

  /**
   * 停止 MCP 服务器
   */
  async stop(): Promise<void> {
    if (this.config.debug) {
      console.log('[MCPServer] Stopping...');
    }

    // 清理会话管理器
    await this.sessionManager.cleanup();

    // 关闭服务器
    await this.server.close();

    if (this.config.debug) {
      console.log('[MCPServer] Stopped');
    }
  }

  /**
   * 注册 MCP 协议处理器 (私有方法)
   */
  private registerHandlers(): void {
    if (this.handlersRegistered) {
      return;
    }
    // 处理 tools/list 请求
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      if (this.config.debug) {
        console.log('[MCPServer] Handling tools/list');
      }

      const tools = this.bridgeLayer.getTools();

      return {
        tools,
      };
    });

    // 处理 tools/call 请求
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (this.config.debug) {
        console.log('[MCPServer] Handling tools/call:', request.params.name);
      }

      const { name, arguments: args } = request.params;

      try {
        // 调用桥接层处理工具调用
        const result = await this.bridgeLayer.callTool(name, args || {});

        // 返回 MCP 工具调用结果
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        // 返回错误信息
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  error: {
                    message: (error as Error).message,
                    name: (error as Error).name,
                  },
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    });

    // 注册 Codex 事件监听器,转发为 MCP 通知
    const codexClient = this.processManager.getClient();

    codexClient.on('notification', (notification) => {
      if (this.config.debug) {
        console.log('[MCPServer] Received Codex notification:', notification.method);
      }

      // 优先从 Codex 通知参数中提取 conversationId → 解析 jobId
      const params: unknown = notification.params;
      let conversationId: string | undefined;
      if (
        params &&
        typeof params === 'object' &&
        'conversationId' in (params as Record<string, unknown>)
      ) {
        const cid = (params as Record<string, unknown>)['conversationId'];
        if (typeof cid === 'string' && cid.length > 0) {
          conversationId = cid;
        }
      }

      if (!conversationId) {
        if (this.config.debug) {
          console.warn(
            '[MCPServer] Codex notification missing conversationId; skip progress relay'
          );
        }
        return;
      }

      const jobId = this.sessionManager.getJobIdByConversationId(conversationId);
      if (!jobId) {
        if (this.config.debug) {
          console.warn(
            `[MCPServer] No jobId mapping for conversationId=${conversationId}; skip progress relay`
          );
        }
        return;
      }

      // 映射事件
      const mcpNotification = this.eventMapper.mapEvent(
        {
          eventId: (notification.params as any)?.eventId || 'unknown',
          timestamp: new Date(),
          jobId,
          type: (notification.params as any)?.type || 'unknown',
          data: (notification.params as any) || {},
        },
        jobId
      );

      // 发送 MCP 通知 (使用 SDK 的格式)
      this.server.notification({
        method: mcpNotification.method,
        params: mcpNotification.params as unknown as Record<string, unknown>,
      });
    });

    if (this.config.debug) {
      console.log('[MCPServer] Handlers registered');
    }

    this.handlersRegistered = true;
  }

  /**
   * 获取服务器信息
   */
  getServerInfo(): { name: string; version: string } {
    return {
      name: this.config.serverName || 'codex-father',
      version: this.config.serverVersion || '1.0.0-mvp1',
    };
  }
}

/**
 * 创建 MCP 服务器的工厂函数
 *
 * @param config 配置对象
 * @returns MCPServer 实例
 */
export function createMCPServer(config?: MCPServerConfig): MCPServer {
  return new MCPServer(config);
}

/**
 * 启动 MCP 服务器的便捷函数
 *
 * @param config 配置对象
 * @returns MCPServer 实例 (已启动)
 */
export async function startMCPServer(config?: MCPServerConfig): Promise<MCPServer> {
  const server = createMCPServer(config);
  await server.start();
  return server;
}
