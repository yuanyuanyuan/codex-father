/**
 * MCP Server Unit Tests - MCP 服务器单元测试
 *
 * 测试覆盖:
 * - 服务器创建和配置
 * - 启动和停止流程
 * - MCP 协议处理 (tools/list, tools/call)
 * - 事件转发
 * - 错误处理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPServer, createMCPServer, startMCPServer } from '../server.js';
import { PROJECT_VERSION } from '../../lib/version.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createProcessManager, type SingleProcessManager } from '../../process/manager.js';
import { createSessionManager, type SessionManager } from '../../session/session-manager.js';
import { createBridgeLayer, type BridgeLayer } from '../bridge-layer.js';
import { createEventMapper, type EventMapper } from '../event-mapper.js';

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/server/index.js', () => {
  return {
    Server: vi.fn(),
  };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => {
  return {
    StdioServerTransport: vi.fn(),
  };
});

vi.mock('../../process/manager.js', () => {
  return {
    createProcessManager: vi.fn(),
  };
});

vi.mock('../../session/session-manager.js', () => {
  return {
    createSessionManager: vi.fn(),
  };
});

vi.mock('../bridge-layer.js', () => {
  return {
    createBridgeLayer: vi.fn(),
    registerDiagnosticTools: vi.fn(async () => {}),
  };
});

vi.mock('../event-mapper.js', () => {
  return {
    createEventMapper: vi.fn(),
  };
});

describe('MCPServer', () => {
  let mockServer: any;
  let mockTransport: any;
  let mockProcessManager: any;
  let mockSessionManager: any;
  let mockBridgeLayer: any;
  let registerDiagnosticTools: any;
  let mockEventMapper: any;
  let mockCodexClient: any;

  beforeEach(async () => {
    // 创建 mock MCP Server
    mockServer = {
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      setRequestHandler: vi.fn(),
      notification: vi.fn(),
    };
    vi.mocked(Server).mockImplementation(() => mockServer);

    // 创建 mock Transport
    mockTransport = {};
    vi.mocked(StdioServerTransport).mockImplementation(() => mockTransport);

    // 创建 mock CodexClient
    mockCodexClient = {
      on: vi.fn(),
      off: vi.fn(),
    };

    // 创建 mock ProcessManager
    mockProcessManager = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      getClient: vi.fn().mockReturnValue(mockCodexClient),
      isReady: vi.fn().mockReturnValue(true),
      getStatus: vi.fn().mockReturnValue('ready'),
    };
    vi.mocked(createProcessManager).mockReturnValue(mockProcessManager);

    // 创建 mock SessionManager
    mockSessionManager = {
      cleanup: vi.fn().mockResolvedValue(undefined),
      createSession: vi.fn().mockResolvedValue({
        conversationId: 'conv-123',
        jobId: 'job-123',
        rolloutPath: '/path/to/rollout',
      }),
      sendUserMessage: vi.fn().mockResolvedValue(undefined),
      getJobIdByConversationId: vi.fn().mockReturnValue('job-123'),
    };
    vi.mocked(createSessionManager).mockReturnValue(mockSessionManager);

    // 创建 mock BridgeLayer
    mockBridgeLayer = {
      getTools: vi.fn().mockReturnValue([
        {
          name: 'test-tool',
          description: 'A test tool',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ]),
      callTool: vi.fn().mockResolvedValue({ success: true, data: 'result' }),
    };
    vi.mocked(createBridgeLayer).mockReturnValue(mockBridgeLayer);
    // capture registerDiagnosticTools from mocked module (ESM import)
    ({ registerDiagnosticTools } = await import('../bridge-layer.js'));

    // 创建 mock EventMapper
    mockEventMapper = {
      mapEvent: vi.fn().mockReturnValue({
        method: 'notifications/progress',
        params: {
          progressToken: 'token-123',
          progress: 50,
          total: 100,
        },
      }),
    };
    vi.mocked(createEventMapper).mockReturnValue(mockEventMapper);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('基本功能', () => {
    it('应该创建 MCPServer 实例', () => {
      const server = createMCPServer();

      expect(server).toBeInstanceOf(MCPServer);
    });

    it('应该使用默认配置', () => {
      const server = createMCPServer();
      const info = server.getServerInfo();

      expect(info.name).toBe('codex-father');
      expect(info.version).toBe(PROJECT_VERSION);
    });

    it('应该使用自定义配置', () => {
      const server = createMCPServer({
        serverName: 'custom-server',
        serverVersion: '2.0.0',
        debug: true,
      });
      const info = server.getServerInfo();

      expect(info.name).toBe('custom-server');
      expect(info.version).toBe('2.0.0');
    });

    it('应该创建所有必需的子系统', () => {
      createMCPServer();

      expect(Server).toHaveBeenCalledWith(
        {
          name: 'codex-father',
          version: PROJECT_VERSION,
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );
      expect(StdioServerTransport).toHaveBeenCalled();
      expect(createProcessManager).toHaveBeenCalled();
      expect(createSessionManager).toHaveBeenCalled();
      expect(createBridgeLayer).toHaveBeenCalled();
      expect(createEventMapper).toHaveBeenCalled();
    });
  });

  describe('启动和停止', () => {
    it('应该成功启动服务器', async () => {
      const server = createMCPServer();

      await server.start();

      expect(mockProcessManager.start).toHaveBeenCalled();
      expect(mockServer.connect).toHaveBeenCalledWith(mockTransport);
    });

    it('应该成功停止服务器', async () => {
      const server = createMCPServer();
      await server.start();

      await server.stop();

      expect(mockSessionManager.cleanup).toHaveBeenCalled();
      expect(mockServer.close).toHaveBeenCalled();
    });

    it('应该通过 startMCPServer 便捷函数启动', async () => {
      const server = await startMCPServer();

      expect(server).toBeInstanceOf(MCPServer);
      expect(mockProcessManager.start).toHaveBeenCalled();
      expect(mockServer.connect).toHaveBeenCalled();
    });
  });

  describe('MCP 协议处理', () => {
    it('应该注册 tools/list 处理器', async () => {
      const server = createMCPServer();
      await server.start();

      // 验证 setRequestHandler 被调用了两次 (tools/list 和 tools/call)
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(2);
    });

    it('应该处理 tools/list 请求', async () => {
      const server = createMCPServer();
      await server.start();

      // 获取 tools/list 处理器
      const listToolsHandler = mockServer.setRequestHandler.mock.calls[0][1];

      const result = await listToolsHandler();

      expect(mockBridgeLayer.getTools).toHaveBeenCalled();
      expect(result).toEqual({
        tools: [
          {
            name: 'test-tool',
            description: 'A test tool',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      });
    });

    it('应该处理 tools/call 请求 (成功)', async () => {
      const server = createMCPServer();
      await server.start();

      // 获取 tools/call 处理器
      const callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];

      const request = {
        params: {
          name: 'test-tool',
          arguments: { arg1: 'value1' },
        },
      };

      const result = await callToolHandler(request);

      expect(mockBridgeLayer.callTool).toHaveBeenCalledWith('test-tool', { arg1: 'value1' });
      expect(result).toEqual({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, data: 'result' }, null, 2),
          },
        ],
      });
    });

    it('应该处理 tools/call 请求 (无参数)', async () => {
      const server = createMCPServer();
      await server.start();

      const callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];

      const request = {
        params: {
          name: 'test-tool',
          // arguments 为 undefined
        },
      };

      await callToolHandler(request);

      expect(mockBridgeLayer.callTool).toHaveBeenCalledWith('test-tool', {});
    });

    it('应该处理 tools/call 请求错误', async () => {
      const server = createMCPServer();
      await server.start();

      // Mock callTool 抛出错误
      mockBridgeLayer.callTool.mockRejectedValueOnce(new Error('Tool execution failed'));

      const callToolHandler = mockServer.setRequestHandler.mock.calls[1][1];

      const request = {
        params: {
          name: 'test-tool',
          arguments: {},
        },
      };

      const result = await callToolHandler(request);

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Tool execution failed');
    });
  });

  describe('事件转发', () => {
    it('应该注册 Codex 事件监听器', async () => {
      const server = createMCPServer();
      await server.start();

      expect(mockCodexClient.on).toHaveBeenCalledWith('notification', expect.any(Function));
    });

    it('应该转发 Codex 通知为 MCP 通知', async () => {
      const server = createMCPServer();
      await server.start();

      // 获取事件监听器
      const notificationListener = mockCodexClient.on.mock.calls[0][1];

      // 模拟 Codex 通知
      const codexNotification = {
        method: 'codex/progress',
        params: {
          eventId: 'event-123',
          type: 'progress',
          progress: 50,
          total: 100,
        },
      };

      notificationListener(codexNotification);

      expect(mockEventMapper.mapEvent).toHaveBeenCalled();
      expect(mockServer.notification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'token-123',
          progress: 50,
          total: 100,
        },
      });
    });
  });

  describe('错误处理', () => {
    it('应该处理 ProcessManager 启动失败', async () => {
      mockProcessManager.start.mockRejectedValueOnce(new Error('Failed to start process'));

      const server = createMCPServer();

      await expect(server.start()).rejects.toThrow('Failed to start process');
    });

    it('应该处理 Server.connect 失败', async () => {
      mockServer.connect.mockRejectedValueOnce(new Error('Failed to connect'));

      const server = createMCPServer();

      await expect(server.start()).rejects.toThrow('Failed to connect');
    });

    it('应该处理 SessionManager.cleanup 失败', async () => {
      mockSessionManager.cleanup.mockRejectedValueOnce(new Error('Failed to cleanup'));

      const server = createMCPServer();
      await server.start();

      await expect(server.stop()).rejects.toThrow('Failed to cleanup');
    });
  });

  describe('工厂函数', () => {
    it('应该通过工厂函数创建实例', () => {
      const server = createMCPServer({ serverName: 'test-server' });

      expect(server).toBeInstanceOf(MCPServer);
      expect(server.getServerInfo().name).toBe('test-server');
    });

    it('应该通过 startMCPServer 创建并启动实例', async () => {
      const server = await startMCPServer({ serverName: 'test-server' });

      expect(server).toBeInstanceOf(MCPServer);
      expect(mockProcessManager.start).toHaveBeenCalled();
    });

    it('在 enableDiagnosticTools=true 时注册诊断只读工具', async () => {
      const server = createMCPServer({ enableDiagnosticTools: true });
      await server.start();

      expect(registerDiagnosticTools).toHaveBeenCalledWith(mockBridgeLayer);
    });
  });

  describe('调试模式', () => {
    it('应该在调试模式下输出日志', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const server = createMCPServer({ debug: true });
      await server.start();

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[MCPServer] Starting'));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`[MCPServer] Started: codex-father v${PROJECT_VERSION}`)
      );

      consoleSpy.mockRestore();
    });
  });
});
