/**
 * Bridge Layer Unit Tests - MCP 桥接层单元测试
 *
 * 测试覆盖:
 * - 工具注册和获取
 * - start-codex-task 工具调用
 * - 审批请求处理 (applyPatchApproval, execCommandApproval)
 * - 自定义工具注册/注销
 * - 配置管理
 * - 错误处理
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { BridgeLayer, createBridgeLayer, type ISessionManager } from '../bridge-layer.js';
import { ApprovalMode, SandboxPolicy, ApprovalRequest, ApprovalType } from '../../lib/types.js';
import type { MCPTool, MCPToolsCallResult } from '../protocol/types.js';

describe('BridgeLayer', () => {
  let mockSessionManager: ISessionManager;
  let bridge: BridgeLayer;

  beforeEach(() => {
    // 创建 mock SessionManager
    mockSessionManager = {
      createSession: vi.fn().mockResolvedValue({
        conversationId: 'conv-123',
        jobId: 'job-456',
        rolloutPath: '/path/to/rollout.json',
      }),
      sendUserMessage: vi.fn().mockResolvedValue(undefined),
      handleApprovalRequest: vi.fn().mockResolvedValue('allow'),
    };

    // 创建桥接层实例
    bridge = createBridgeLayer({
      sessionManager: mockSessionManager,
      defaultModel: 'claude-3-opus',
      defaultApprovalMode: ApprovalMode.ON_REQUEST,
      defaultSandboxPolicy: SandboxPolicy.WORKSPACE_WRITE,
      defaultTimeout: 300000,
    });
  });

  describe('基本功能', () => {
    it('应该创建 BridgeLayer 实例', () => {
      expect(bridge).toBeInstanceOf(BridgeLayer);
    });

    it('应该使用默认配置', () => {
      const defaultBridge = createBridgeLayer({
        sessionManager: mockSessionManager,
      });

      expect(defaultBridge).toBeInstanceOf(BridgeLayer);
    });
  });

  describe('工具注册和获取', () => {
    it('应该注册默认工具 (start-codex-task)', () => {
      const tools = bridge.getTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('start-codex-task');
      expect(tools[0].description).toContain('Start a new Codex AI task');
      expect(tools[0].inputSchema.required).toEqual(['prompt']);
    });

    it('应该返回正确的工具 schema', () => {
      const tools = bridge.getTools();
      const startTaskTool = tools[0];

      expect(startTaskTool.inputSchema.type).toBe('object');
      expect(startTaskTool.inputSchema.properties).toHaveProperty('prompt');
      expect(startTaskTool.inputSchema.properties).toHaveProperty('sessionName');
      expect(startTaskTool.inputSchema.properties).toHaveProperty('model');
      expect(startTaskTool.inputSchema.properties).toHaveProperty('cwd');
      expect(startTaskTool.inputSchema.properties).toHaveProperty('approvalPolicy');
      expect(startTaskTool.inputSchema.properties).toHaveProperty('sandbox');
      expect(startTaskTool.inputSchema.properties).toHaveProperty('timeout');
    });

    it('应该包含枚举值定义', () => {
      const tools = bridge.getTools();
      const startTaskTool = tools[0];

      // 验证 approvalPolicy 枚举
      expect(startTaskTool.inputSchema.properties.approvalPolicy.enum).toEqual([
        'untrusted',
        'on-request',
        'on-failure',
        'never',
      ]);

      // 验证 sandbox 枚举
      expect(startTaskTool.inputSchema.properties.sandbox.enum).toEqual([
        'read-only',
        'workspace-write',
        'danger-full-access',
      ]);
    });
  });

  describe('start-codex-task 工具调用', () => {
    it('应该成功启动 Codex 任务', async () => {
      const result = await bridge.callTool('start-codex-task', {
        prompt: 'Test prompt',
      });

      expect(result.status).toBe('accepted');
      expect(result.jobId).toBe('job-456');
      expect(result.conversationId).toBe('conv-123');
      expect(result.message).toContain('Task started successfully');

      // 验证调用了 createSession
      expect(mockSessionManager.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-opus',
          approvalMode: ApprovalMode.ON_REQUEST,
          sandboxPolicy: SandboxPolicy.WORKSPACE_WRITE,
          timeout: 300000,
        })
      );

      // 验证调用了 sendUserMessage
      expect(mockSessionManager.sendUserMessage).toHaveBeenCalledWith('conv-123', 'Test prompt');
    });

    it('应该使用自定义参数启动任务', async () => {
      const result = await bridge.callTool('start-codex-task', {
        prompt: 'Custom task',
        sessionName: 'my-session',
        model: 'gpt-4',
        cwd: '/custom/path',
        approvalPolicy: ApprovalMode.NEVER,
        sandbox: SandboxPolicy.READ_ONLY,
        timeout: 60000,
      });

      expect(result.status).toBe('accepted');

      // 验证使用了自定义参数
      expect(mockSessionManager.createSession).toHaveBeenCalledWith({
        sessionName: 'my-session',
        model: 'gpt-4',
        cwd: '/custom/path',
        approvalMode: ApprovalMode.NEVER,
        sandboxPolicy: SandboxPolicy.READ_ONLY,
        timeout: 60000,
      });
    });

    it('应该自动生成会话名称', async () => {
      await bridge.callTool('start-codex-task', {
        prompt: 'Test prompt',
      });

      // 验证生成的会话名称格式
      const createSessionCall = vi.mocked(mockSessionManager.createSession).mock.calls[0];
      const sessionName = createSessionCall[0].sessionName;

      expect(sessionName).toMatch(/^task-\d{4}-\d{2}-\d{2}-\d+$/);
    });

    it('应该使用默认 cwd (process.cwd())', async () => {
      await bridge.callTool('start-codex-task', {
        prompt: 'Test prompt',
      });

      const createSessionCall = vi.mocked(mockSessionManager.createSession).mock.calls[0];
      expect(createSessionCall[0].cwd).toBe(process.cwd());
    });

    it('应该在任务失败时返回 rejected 状态', async () => {
      vi.mocked(mockSessionManager.createSession).mockRejectedValue(
        new Error('Session creation failed')
      );

      const result = await bridge.callTool('start-codex-task', {
        prompt: 'Test prompt',
      });

      expect(result.status).toBe('rejected');
      expect(result.jobId).toBe('none');
      expect(result.message).toContain('Task failed');
      expect(result.message).toContain('Session creation failed');
    });

    it('应该拒绝无效的工具参数 (非对象)', async () => {
      await expect(bridge.callTool('start-codex-task', 'invalid')).rejects.toThrow(
        'Invalid tool parameters: must be an object'
      );
    });

    it('应该拒绝缺少 prompt 的参数', async () => {
      await expect(
        bridge.callTool('start-codex-task', {
          sessionName: 'test',
        })
      ).rejects.toThrow('Invalid tool parameters: prompt is required');
    });

    it('应该拒绝 prompt 不是字符串的参数', async () => {
      await expect(
        bridge.callTool('start-codex-task', {
          prompt: 123,
        })
      ).rejects.toThrow('Invalid tool parameters: prompt is required and must be a string');
    });

    it('应该拒绝 null 参数', async () => {
      await expect(bridge.callTool('start-codex-task', null)).rejects.toThrow(
        'Invalid tool parameters: must be an object'
      );
    });
  });

  describe('工具调用错误处理', () => {
    it('应该在调用未知工具时抛出错误', async () => {
      await expect(bridge.callTool('unknown-tool', { test: 'data' })).rejects.toThrow(
        'Unknown tool: unknown-tool'
      );
    });
  });

  describe('审批请求处理: applyPatchApproval', () => {
    it('应该处理 applyPatchApproval 并返回决策', async () => {
      const requestId = 'req-123';
      const params = {
        conversationId: 'conv-123',
        callId: 'call-456',
        fileChanges: [
          { path: '/src/file.ts', type: 'modify', diff: 'diff content' },
          { path: '/src/new.ts', type: 'create', diff: 'new file' },
        ],
        reason: 'Implement feature',
      };

      const result = await bridge.handleApplyPatchApproval(requestId, params);

      expect(result.decision).toBe('allow');

      // 验证调用了 handleApprovalRequest
      expect(mockSessionManager.handleApprovalRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'call-456',
          jobId: 'conv-123',
          type: ApprovalType.APPLY_PATCH,
          details: {
            fileChanges: params.fileChanges,
            reason: 'Implement feature',
            grantRoot: undefined,
          },
        })
      );
    });

    it('应该处理包含 grantRoot 的请求', async () => {
      const params = {
        conversationId: 'conv-123',
        callId: 'call-456',
        fileChanges: [{ path: '/etc/config', type: 'modify', diff: 'diff' }],
        grantRoot: true,
      };

      await bridge.handleApplyPatchApproval('req-123', params);

      const approvalRequest = vi.mocked(mockSessionManager.handleApprovalRequest).mock.calls[0][0];

      expect(approvalRequest.details.grantRoot).toBe(true);
    });

    it('应该在拒绝时返回 deny 决策', async () => {
      vi.mocked(mockSessionManager.handleApprovalRequest).mockResolvedValue('deny');

      const params = {
        conversationId: 'conv-123',
        callId: 'call-456',
        fileChanges: [{ path: '/file.ts', type: 'delete', diff: 'removed' }],
      };

      const result = await bridge.handleApplyPatchApproval('req-123', params);

      expect(result.decision).toBe('deny');
    });

    it('应该拒绝无效的参数 (非对象)', async () => {
      await expect(bridge.handleApplyPatchApproval('req-123', 'invalid')).rejects.toThrow(
        'Invalid approval request parameters'
      );
    });

    it('应该拒绝 null 参数', async () => {
      await expect(bridge.handleApplyPatchApproval('req-123', null)).rejects.toThrow(
        'Invalid approval request parameters'
      );
    });
  });

  describe('审批请求处理: execCommandApproval', () => {
    it('应该处理 execCommandApproval 并返回决策', async () => {
      const requestId = 'req-123';
      const params = {
        conversationId: 'conv-123',
        callId: 'call-456',
        command: 'npm install',
        cwd: '/workspace',
        reason: 'Install dependencies',
      };

      const result = await bridge.handleExecCommandApproval(requestId, params);

      expect(result.decision).toBe('allow');

      // 验证调用了 handleApprovalRequest
      expect(mockSessionManager.handleApprovalRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: 'call-456',
          jobId: 'conv-123',
          type: ApprovalType.EXEC_COMMAND,
          details: {
            command: 'npm install',
            cwd: '/workspace',
            reason: 'Install dependencies',
          },
        })
      );
    });

    it('应该处理没有 reason 的请求', async () => {
      const params = {
        conversationId: 'conv-123',
        callId: 'call-456',
        command: 'ls',
        cwd: '/tmp',
      };

      await bridge.handleExecCommandApproval('req-123', params);

      const approvalRequest = vi.mocked(mockSessionManager.handleApprovalRequest).mock.calls[0][0];

      expect(approvalRequest.details.reason).toBeUndefined();
    });

    it('应该在拒绝时返回 deny 决策', async () => {
      vi.mocked(mockSessionManager.handleApprovalRequest).mockResolvedValue('deny');

      const params = {
        conversationId: 'conv-123',
        callId: 'call-456',
        command: 'rm -rf /',
        cwd: '/',
      };

      const result = await bridge.handleExecCommandApproval('req-123', params);

      expect(result.decision).toBe('deny');
    });

    it('应该拒绝无效的参数 (非对象)', async () => {
      await expect(bridge.handleExecCommandApproval('req-123', 'invalid')).rejects.toThrow(
        'Invalid approval request parameters'
      );
    });

    it('应该拒绝 null 参数', async () => {
      await expect(bridge.handleExecCommandApproval('req-123', null)).rejects.toThrow(
        'Invalid approval request parameters'
      );
    });
  });

  describe('自定义工具注册', () => {
    it('应该注册自定义工具', () => {
      const customTool: MCPTool = {
        name: 'custom-tool',
        description: 'A custom tool for testing',
        inputSchema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
          required: ['input'],
        },
      };

      const customHandler = vi.fn().mockResolvedValue({
        status: 'accepted',
        jobId: 'custom-job',
        message: 'Custom tool executed',
      });

      bridge.registerTool(customTool, customHandler);

      const tools = bridge.getTools();
      expect(tools).toHaveLength(2);
      expect(tools.find((t) => t.name === 'custom-tool')).toBeDefined();
    });

    it('应该调用自定义工具处理器', async () => {
      const customHandler = vi.fn().mockResolvedValue({
        status: 'accepted',
        jobId: 'custom-job',
        message: 'Success',
      });

      const customTool: MCPTool = {
        name: 'my-tool',
        description: 'Test tool',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      bridge.registerTool(customTool, customHandler);

      const result = await bridge.callTool('my-tool', { test: 'data' });

      expect(customHandler).toHaveBeenCalledWith({ test: 'data' });
      expect(result.status).toBe('accepted');
      expect(result.jobId).toBe('custom-job');
    });

    it('应该覆盖已存在的工具', () => {
      const newStartTaskTool: MCPTool = {
        name: 'start-codex-task',
        description: 'Modified tool',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      };

      const newHandler = vi.fn().mockResolvedValue({
        status: 'accepted',
        jobId: 'new-job',
        message: 'Modified',
      });

      bridge.registerTool(newStartTaskTool, newHandler);

      const tools = bridge.getTools();
      expect(tools).toHaveLength(1);
      expect(tools[0].description).toBe('Modified tool');
    });
  });

  describe('工具注销', () => {
    it('应该注销工具', () => {
      const result = bridge.unregisterTool('start-codex-task');

      expect(result).toBe(true);

      const tools = bridge.getTools();
      expect(tools).toHaveLength(0);
    });

    it('应该在工具不存在时返回 false', () => {
      const result = bridge.unregisterTool('non-existent-tool');

      expect(result).toBe(false);
    });

    it('应该在注销后无法调用工具', async () => {
      bridge.unregisterTool('start-codex-task');

      await expect(bridge.callTool('start-codex-task', { prompt: 'test' })).rejects.toThrow(
        'Unknown tool: start-codex-task'
      );
    });
  });

  describe('工厂函数', () => {
    it('应该通过工厂函数创建实例', () => {
      const bridge = createBridgeLayer({
        sessionManager: mockSessionManager,
      });

      expect(bridge).toBeInstanceOf(BridgeLayer);
    });
  });

  describe('边缘情况', () => {
    it('应该处理空字符串 prompt', async () => {
      await expect(bridge.callTool('start-codex-task', { prompt: '' })).rejects.toThrow(
        'Invalid tool parameters: prompt is required and must be a string'
      );
    });

    it('应该处理包含特殊字符的 prompt', async () => {
      const result = await bridge.callTool('start-codex-task', {
        prompt: 'Line 1\nLine 2\tTabbed\n测试中文 🎉',
      });

      expect(result.status).toBe('accepted');
      expect(mockSessionManager.sendUserMessage).toHaveBeenCalledWith(
        'conv-123',
        'Line 1\nLine 2\tTabbed\n测试中文 🎉'
      );
    });

    it('应该处理复杂的文件变更列表', async () => {
      const fileChanges = Array.from({ length: 50 }, (_, i) => ({
        path: `/src/file${i}.ts`,
        type: 'modify' as const,
        diff: `diff content ${i}`,
      }));

      const params = {
        conversationId: 'conv-123',
        callId: 'call-456',
        fileChanges,
      };

      const result = await bridge.handleApplyPatchApproval('req-123', params);

      expect(result.decision).toBe('allow');

      const approvalRequest = vi.mocked(mockSessionManager.handleApprovalRequest).mock.calls[0][0];

      expect(approvalRequest.details.fileChanges).toHaveLength(50);
    });

    it('应该处理长命令字符串', async () => {
      const longCommand = 'npm install ' + 'package '.repeat(100);

      const params = {
        conversationId: 'conv-123',
        callId: 'call-456',
        command: longCommand,
        cwd: '/workspace',
      };

      const result = await bridge.handleExecCommandApproval('req-123', params);

      expect(result.decision).toBe('allow');

      const approvalRequest = vi.mocked(mockSessionManager.handleApprovalRequest).mock.calls[0][0];

      expect(approvalRequest.details.command).toBe(longCommand);
    });

    it('应该处理 sendUserMessage 失败的情况', async () => {
      vi.mocked(mockSessionManager.sendUserMessage).mockRejectedValue(
        new Error('Message send failed')
      );

      const result = await bridge.callTool('start-codex-task', {
        prompt: 'Test prompt',
      });

      expect(result.status).toBe('rejected');
      expect(result.message).toContain('Message send failed');
    });

    it('应该处理 handleApprovalRequest 抛出错误的情况', async () => {
      vi.mocked(mockSessionManager.handleApprovalRequest).mockRejectedValue(
        new Error('Approval failed')
      );

      const params = {
        conversationId: 'conv-123',
        callId: 'call-456',
        command: 'test',
        cwd: '/test',
      };

      await expect(bridge.handleExecCommandApproval('req-123', params)).rejects.toThrow(
        'Approval failed'
      );
    });
  });
});
