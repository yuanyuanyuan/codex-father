/**
 * MCP Server 单元测试
 * 测试 MCP 服务器的工具注册、协议处理、会话管理等功能
 *
 * 测试覆盖:
 * - 工具注册和验证
 * - 请求处理
 * - 响应格式
 * - 错误处理
 * - 会话管理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPServer } from '../../../src/interfaces/mcp/server.js';
import { TaskRunner } from '../../../src/core/TaskRunner.js';
import { SessionManager } from '../../../src/interfaces/mcp/session-manager.js';
import { SecurityManager } from '../../../src/interfaces/mcp/security-manager.js';

// Mock 依赖模块
vi.mock('../../../src/core/TaskRunner.js');
vi.mock('../../../src/interfaces/mcp/session-manager.js');
vi.mock('../../../src/interfaces/mcp/security-manager.js');

describe('MCP Server Unit Tests', () => {
  let mcpServer: MCPServer;
  let mockTaskRunner: any;
  let mockSessionManager: any;
  let mockSecurityManager: any;
  let mockWriteStream: any;

  beforeEach(() => {
    // 创建 Mock 实例
    mockTaskRunner = {
      run: vi.fn().mockResolvedValue('task-id-123'),
      getStatus: vi.fn().mockReturnValue({
        running: 2,
        maxConcurrency: 10,
        pending: 1,
        completed: 5,
      }),
      getResult: vi.fn(),
      cancel: vi.fn().mockResolvedValue(true),
    };

    mockSessionManager = {
      createSession: vi.fn().mockReturnValue('session-123'),
      updateSession: vi.fn(),
      getSession: vi.fn(),
      cleanupExpiredSessions: vi.fn(),
    };

    mockSecurityManager = {
      validateCommand: vi.fn().mockReturnValue(true),
      validateFilePath: vi.fn().mockReturnValue(true),
      enforceSecurityPolicy: vi.fn(),
    };

    mockWriteStream = {
      write: vi.fn(),
      end: vi.fn(),
    };

    // 设置 Mock 返回值
    (TaskRunner as any).mockImplementation(() => mockTaskRunner);
    (SessionManager as any).mockImplementation(() => mockSessionManager);
    (SecurityManager as any).mockImplementation(() => mockSecurityManager);

    mcpServer = new MCPServer(mockTaskRunner as any);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('应该正确初始化 MCP Server', () => {
      expect(mcpServer).toBeDefined();
      expect(TaskRunner).toHaveBeenCalledWith();
    });

    it('应该初始化会话管理器', () => {
      expect(SessionManager).toHaveBeenCalled();
    });

    it('应该初始化安全管理器', () => {
      expect(SecurityManager).toHaveBeenCalled();
    });
  });

  describe('工具注册', () => {
    it('应该注册所有六件套工具', () => {
      const tools = mcpServer.getTools();

      expect(tools).toHaveLength(6);
      expect(tools.map((t) => t.name)).toContain('codex_exec');
      expect(tools.map((t) => t.name)).toContain('codex_status');
      expect(tools.map((t) => t.name)).toContain('codex_logs');
      expect(tools.map((t) => t.name)).toContain('codex_reply');
      expect(tools.map((t) => t.name)).toContain('codex_list');
      expect(tools.map((t) => t.name)).toContain('codex_cancel');
    });

    it('每个工具都应该有正确的 schema', () => {
      const tools = mcpServer.getTools();

      tools.forEach((tool) => {
        expect(tool.name).toBeDefined();
        expect(tool.description).toBeDefined();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
      });
    });

    it('codex_exec 工具应该有正确的参数 schema', () => {
      const execTool = mcpServer.getTools().find((t) => t.name === 'codex_exec');

      expect(execTool).toBeDefined();
      expect(execTool!.inputSchema.properties.prompt).toBeDefined();
      expect(execTool!.inputSchema.properties.command).toBeDefined();
      expect(execTool!.inputSchema.properties.environment).toBeDefined();
      expect(execTool!.inputSchema.properties.priority).toBeDefined();
      expect(execTool!.inputSchema.properties.dependencies).toBeDefined();
      expect(execTool!.inputSchema.properties.timeout).toBeDefined();

      // 验证 anyOf 规则（prompt 或 command 必需其一）
      expect(execTool!.inputSchema.anyOf).toBeDefined();
      expect(execTool!.inputSchema.anyOf).toHaveLength(2);
    });

    it('codex_status 工具应该有正确的必需参数', () => {
      const statusTool = mcpServer.getTools().find((t) => t.name === 'codex_status');

      expect(statusTool).toBeDefined();
      expect(statusTool!.inputSchema.required).toContain('taskId');
      expect(statusTool!.inputSchema.properties.includeResult).toBeDefined();
    });

    it('所有工具都应该有合理的参数限制', () => {
      const tools = mcpServer.getTools();

      const listTool = tools.find((t) => t.name === 'codex_list');
      expect(listTool!.inputSchema.properties.limit.minimum).toBe(1);
      expect(listTool!.inputSchema.properties.limit.maximum).toBe(100);

      const logsTool = tools.find((t) => t.name === 'codex_logs');
      expect(logsTool!.inputSchema.properties.tailLines.minimum).toBe(1);
      expect(logsTool!.inputSchema.properties.tailLines.maximum).toBe(1000);
    });
  });

  describe('codex_exec 工具处理', () => {
    it('应该处理 prompt 类型任务', async () => {
      const request = {
        params: {
          name: 'codex_exec',
          arguments: {
            prompt: 'Create a simple API endpoint',
            environment: 'nodejs',
            priority: 'normal',
          },
        },
      };

      mockTaskRunner.run.mockResolvedValue('task-123');

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(mockTaskRunner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          prompt: 'Create a simple API endpoint',
          environment: 'nodejs',
          priority: 'normal',
        })
      );

      expect(response.content[0].text).toMatch(/✅ Task accepted/);
      expect(response.content[0].text).toContain('task-123');
    });

    it('应该处理 command 类型任务', async () => {
      const request = {
        params: {
          name: 'codex_exec',
          arguments: {
            command: 'echo "Hello World"',
            environment: 'shell',
          },
        },
      };

      mockTaskRunner.run.mockResolvedValue('cmd-task-456');

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(mockTaskRunner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          command: 'echo "Hello World"',
          environment: 'shell',
        })
      );

      expect(response.content[0].text).toContain('cmd-task-456');
    });

    it('应该支持自定义任务ID', async () => {
      const request = {
        params: {
          name: 'codex_exec',
          arguments: {
            taskId: 'custom-task-001',
            command: 'npm test',
            environment: 'nodejs',
          },
        },
      };

      mockTaskRunner.run.mockResolvedValue('custom-task-001');

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(mockTaskRunner.run).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'custom-task-001',
        })
      );

      expect(response.content[0].text).toContain('custom-task-001');
    });

    it('应该验证必需参数', async () => {
      const request = {
        params: {
          name: 'codex_exec',
          arguments: {
            environment: 'nodejs',
            // 缺少 prompt 或 command
          },
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602);
      expect(response.error.message).toContain('prompt or command is required');
    });

    it('应该验证环境类型', async () => {
      const request = {
        params: {
          name: 'codex_exec',
          arguments: {
            command: 'echo test',
            environment: 'invalid-env',
          },
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602);
    });

    it('应该处理任务执行错误', async () => {
      const request = {
        params: {
          name: 'codex_exec',
          arguments: {
            prompt: 'Test task',
            environment: 'nodejs',
          },
        },
      };

      mockTaskRunner.run.mockRejectedValue(new Error('Task execution failed'));

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32002);
      expect(response.error.message).toContain('Task execution failed');
    });

    it('应该调用安全管理器验证', async () => {
      const request = {
        params: {
          name: 'codex_exec',
          arguments: {
            command: 'rm -rf /',
            environment: 'shell',
          },
        },
      };

      mockSecurityManager.validateCommand.mockReturnValue(false);

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(mockSecurityManager.validateCommand).toHaveBeenCalledWith('rm -rf /');
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32005); // Security violation
    });

    it('应该创建会话', async () => {
      const request = {
        params: {
          name: 'codex_exec',
          arguments: {
            prompt: 'Test with session',
            environment: 'nodejs',
          },
        },
      };

      mockTaskRunner.run.mockResolvedValue('session-task-123');

      await mcpServer.handleToolCall(request, mockWriteStream);

      expect(mockSessionManager.createSession).toHaveBeenCalledWith('session-task-123');
    });
  });

  describe('codex_status 工具处理', () => {
    it('应该返回任务状态', async () => {
      const mockStatus = {
        taskId: 'status-test-123',
        status: 'running',
        progress: 45,
        startTime: new Date().toISOString(),
      };

      mockTaskRunner.getResult.mockReturnValue(mockStatus);

      const request = {
        params: {
          name: 'codex_status',
          arguments: {
            taskId: 'status-test-123',
            includeResult: false,
          },
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(mockTaskRunner.getResult).toHaveBeenCalledWith('status-test-123');
      expect(response.content[0].text).toContain('status-test-123');
      expect(response.content[0].text).toContain('running');
    });

    it('应该包含结果（如果请求）', async () => {
      const mockStatus = {
        taskId: 'result-test-123',
        status: 'completed',
        result: { files: ['app.js'], summary: 'Task completed successfully' },
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        duration: 5000,
      };

      mockTaskRunner.getResult.mockReturnValue(mockStatus);

      const request = {
        params: {
          name: 'codex_status',
          arguments: {
            taskId: 'result-test-123',
            includeResult: true,
          },
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      const statusData = JSON.parse(response.content[0].text);
      expect(statusData.result).toBeDefined();
      expect(statusData.result.files).toContain('app.js');
    });

    it('应该处理不存在的任务', async () => {
      mockTaskRunner.getResult.mockReturnValue(undefined);

      const request = {
        params: {
          name: 'codex_status',
          arguments: {
            taskId: 'non-existent-task',
          },
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32001); // Task not found
    });

    it('应该验证必需参数', async () => {
      const request = {
        params: {
          name: 'codex_status',
          arguments: {}, // 缺少 taskId
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602);
    });
  });

  describe('codex_logs 工具处理', () => {
    it('应该获取任务日志', async () => {
      const mockLogs = {
        entries: [
          { timestamp: '2024-01-01T12:00:00Z', level: 'info', message: 'Task started' },
          { timestamp: '2024-01-01T12:01:00Z', level: 'info', message: 'Processing...' },
        ],
        cursor: 'next-page-token',
        hasMore: true,
      };

      // Mock 日志获取逻辑
      vi.spyOn(mcpServer as any, 'getTaskLogs').mockResolvedValue(mockLogs);

      const request = {
        params: {
          name: 'codex_logs',
          arguments: {
            taskId: 'logs-test-123',
            tailLines: 50,
          },
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      const logsData = JSON.parse(response.content[0].text);
      expect(logsData.entries).toHaveLength(2);
      expect(logsData.cursor).toBe('next-page-token');
      expect(logsData.hasMore).toBe(true);
    });

    it('应该限制日志行数', async () => {
      const mockLogs = {
        entries: [
          { timestamp: '2024-01-01T12:00:00Z', level: 'info', message: 'Entry 1' },
          { timestamp: '2024-01-01T12:00:01Z', level: 'info', message: 'Entry 2' },
          { timestamp: '2024-01-01T12:00:02Z', level: 'info', message: 'Entry 3' },
        ],
        cursor: null,
        hasMore: false,
      };

      vi.spyOn(mcpServer as any, 'getTaskLogs').mockResolvedValue(mockLogs);

      const request = {
        params: {
          name: 'codex_logs',
          arguments: {
            taskId: 'logs-test-123',
            tailLines: 2,
          },
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(mcpServer.getTaskLogs).toHaveBeenCalledWith('logs-test-123', { tailLines: 2 });
    });

    it('应该支持分页', async () => {
      vi.spyOn(mcpServer as any, 'getTaskLogs').mockResolvedValue({
        entries: [{ timestamp: '2024-01-01T12:02:00Z', level: 'info', message: 'Next page' }],
        cursor: 'page-2-token',
        hasMore: false,
      });

      const request = {
        params: {
          name: 'codex_logs',
          arguments: {
            taskId: 'logs-test-123',
            cursor: 'page-1-token',
          },
        },
      };

      await mcpServer.handleToolCall(request, mockWriteStream);

      expect(mcpServer.getTaskLogs).toHaveBeenCalledWith('logs-test-123', {
        cursor: 'page-1-token',
      });
    });
  });

  describe('codex_reply 工具处理', () => {
    it('应该成功回复任务', async () => {
      vi.spyOn(mcpServer as any, 'appendToTask').mockResolvedValue(true);

      const request = {
        params: {
          name: 'codex_reply',
          arguments: {
            taskId: 'reply-test-123',
            message: 'Please add error handling',
            files: ['src/error-handler.js'],
          },
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(mcpServer.appendToTask).toHaveBeenCalledWith('reply-test-123', {
        message: 'Please add error handling',
        files: ['src/error-handler.js'],
      });

      expect(response.content[0].text).toContain('Context added to task');
    });

    it('应该验证文件路径', async () => {
      const request = {
        params: {
          name: 'codex_reply',
          arguments: {
            taskId: 'reply-test-123',
            message: 'Test message',
            files: ['../../../etc/passwd'], // 危险路径
          },
        },
      };

      mockSecurityManager.validateFilePath.mockReturnValue(false);

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(mockSecurityManager.validateFilePath).toHaveBeenCalledWith('../../../etc/passwd');
      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32005); // Security violation
    });

    it('应该处理不存在的任务', async () => {
      vi.spyOn(mcpServer as any, 'appendToTask').mockResolvedValue(false);

      const request = {
        params: {
          name: 'codex_reply',
          arguments: {
            taskId: 'non-existent-task',
            message: 'Test message',
          },
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32001); // Task not found
    });
  });

  describe('codex_list 工具处理', () => {
    it('应该返回任务列表', async () => {
      const mockTasks = [
        { taskId: 'task-1', status: 'running', startTime: new Date() },
        { taskId: 'task-2', status: 'completed', startTime: new Date() },
        { taskId: 'task-3', status: 'pending', startTime: new Date() },
      ];

      vi.spyOn(mcpServer as any, 'listTasks').mockResolvedValue({
        tasks: mockTasks,
        total: 3,
        cursor: 'next-page',
        hasMore: true,
      });

      const request = {
        params: {
          name: 'codex_list',
          arguments: {
            status: ['running', 'pending'],
            limit: 20,
          },
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(mcpServer.listTasks).toHaveBeenCalledWith({
        status: ['running', 'pending'],
        limit: 20,
      });

      const listData = JSON.parse(response.content[0].text);
      expect(listData.tasks).toHaveLength(3);
      expect(listData.total).toBe(3);
      expect(listData.hasMore).toBe(true);
    });

    it('应该支持状态过滤', async () => {
      vi.spyOn(mcpServer as any, 'listTasks').mockResolvedValue({
        tasks: [{ taskId: 'running-task', status: 'running' }],
        total: 1,
        cursor: null,
        hasMore: false,
      });

      const request = {
        params: {
          name: 'codex_list',
          arguments: {
            status: ['running'],
          },
        },
      };

      await mcpServer.handleToolCall(request, mockWriteStream);

      expect(mcpServer.listTasks).toHaveBeenCalledWith({ status: ['running'] });
    });

    it('应该验证限制参数', async () => {
      const request = {
        params: {
          name: 'codex_list',
          arguments: {
            limit: 200, // 超过最大限制
          },
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602);
    });
  });

  describe('codex_cancel 工具处理', () => {
    it('应该成功取消任务', async () => {
      const request = {
        params: {
          name: 'codex_cancel',
          arguments: {
            taskId: 'cancel-test-123',
          },
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(mockTaskRunner.cancel).toHaveBeenCalledWith('cancel-test-123');
      expect(response.content[0].text).toContain('Task cancelled successfully');
    });

    it('应该处理取消失败', async () => {
      mockTaskRunner.cancel.mockResolvedValue(false);

      const request = {
        params: {
          name: 'codex_cancel',
          arguments: {
            taskId: 'cannot-cancel',
          },
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32001); // Task not found or cannot cancel
    });

    it('应该处理取消异常', async () => {
      mockTaskRunner.cancel.mockRejectedValue(new Error('Cancel operation failed'));

      const request = {
        params: {
          name: 'codex_cancel',
          arguments: {
            taskId: 'error-task',
          },
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32003); // Internal error
    });
  });

  describe('错误处理和边界情况', () => {
    it('应该处理未知工具名称', async () => {
      const request = {
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32601); // Method not found
    });

    it('应该处理格式错误的参数', async () => {
      const request = {
        params: {
          name: 'codex_exec',
          arguments: 'invalid-arguments-string',
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602); // Invalid params
    });

    it('应该处理系统级错误', async () => {
      // Mock TaskRunner 抛出异常
      mockTaskRunner.run.mockImplementation(() => {
        throw new Error('System error');
      });

      const request = {
        params: {
          name: 'codex_exec',
          arguments: {
            prompt: 'Test task',
            environment: 'nodejs',
          },
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32603); // Internal error
    });
  });

  describe('响应格式验证', () => {
    it('所有成功响应都应该有正确的格式', async () => {
      const request = {
        params: {
          name: 'codex_exec',
          arguments: {
            prompt: 'Test response format',
            environment: 'nodejs',
          },
        },
      };

      mockTaskRunner.run.mockResolvedValue('format-test-123');

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(response.content).toBeDefined();
      expect(Array.isArray(response.content)).toBe(true);
      expect(response.content[0].type).toBe('text');
      expect(response.content[0].text).toBeDefined();
    });

    it('所有错误响应都应该有正确的格式', async () => {
      const request = {
        params: {
          name: 'codex_exec',
          arguments: {}, // 无效参数
        },
      };

      const response = await mcpServer.handleToolCall(request, mockWriteStream);

      expect(response.error).toBeDefined();
      expect(response.error.code).toBeDefined();
      expect(response.error.message).toBeDefined();
      expect(typeof response.error.code).toBe('number');
      expect(typeof response.error.message).toBe('string');
    });
  });
});
