/**
 * Session Manager Unit Tests - 会话管理器单元测试
 *
 * 测试覆盖:
 * - 会话创建和初始化
 * - 用户消息发送
 * - 审批请求处理 (exec-command, apply-patch)
 * - 会话管理 (get, list, terminate)
 * - 清理资源
 * - 错误处理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { SessionManager, createSessionManager, type IProcessManager } from '../session-manager.js';
import { CodexClient } from '../../mcp/codex-client.js';
import {
  ApprovalMode,
  SandboxPolicy,
  SessionStatus,
  ApprovalRequest,
  ApprovalType,
  ApprovalStatus,
} from '../../lib/types.js';

describe('SessionManager', () => {
  let mockProcessManager: IProcessManager;
  let mockCodexClient: CodexClient;
  let manager: SessionManager;
  const testSessionsDir = path.join(process.cwd(), '.test-sessions');

  beforeEach(() => {
    // 创建 mock CodexClient
    mockCodexClient = {
      newConversation: vi.fn().mockResolvedValue({
        conversationId: uuidv4(),
        model: 'claude-3-opus',
        rolloutPath: '/path/to/rollout.json',
      }),
      sendUserMessage: vi.fn().mockResolvedValue({ status: 'ok' }),
      request: vi.fn(),
      notify: vi.fn(),
      on: vi.fn(),
      close: vi.fn(),
      isClosed: vi.fn().mockReturnValue(false),
    } as unknown as CodexClient;

    // 创建 mock ProcessManager
    mockProcessManager = {
      getClient: vi.fn().mockReturnValue(mockCodexClient),
      isReady: vi.fn().mockReturnValue(true),
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    };

    // 创建会话管理器实例
    manager = createSessionManager({
      processManager: mockProcessManager,
      sessionsDir: testSessionsDir,
      defaultModel: 'claude-3-opus',
      defaultApprovalMode: ApprovalMode.ON_REQUEST,
      defaultSandboxPolicy: SandboxPolicy.WORKSPACE_WRITE,
      defaultTimeout: 300000,
    });

    // Mock TerminalUI.promptApproval to avoid real user interaction
    vi.spyOn(manager['terminalUI'], 'promptApproval').mockResolvedValue('allow');
  });

  afterEach(async () => {
    // 清理测试数据
    try {
      await fs.rm(testSessionsDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('基本功能', () => {
    it('应该创建 SessionManager 实例', () => {
      expect(manager).toBeInstanceOf(SessionManager);
    });

    it('应该使用默认配置', () => {
      const defaultManager = createSessionManager({
        processManager: mockProcessManager,
      });

      expect(defaultManager).toBeInstanceOf(SessionManager);
    });
  });

  describe('会话创建', () => {
    it('应该成功创建新会话', async () => {
      const result = await manager.createSession({
        sessionName: 'test-session',
        model: 'claude-3-opus',
        cwd: '/workspace',
        approvalMode: ApprovalMode.ON_REQUEST,
        sandboxPolicy: SandboxPolicy.WORKSPACE_WRITE,
        timeout: 300000,
      });

      expect(result.conversationId).toMatch(/^[0-9a-f-]{36}$/); // UUID 格式
      expect(result.jobId).toMatch(/^[0-9a-f-]{36}$/); // UUID 格式
      expect(result.rolloutPath).toBe('/path/to/rollout.json');

      // 验证调用了 newConversation
      expect(mockCodexClient.newConversation).toHaveBeenCalledWith({
        model: 'claude-3-opus',
        cwd: '/workspace',
        approvalPolicy: ApprovalMode.ON_REQUEST,
        sandbox: SandboxPolicy.WORKSPACE_WRITE,
      });
    });

    it('应该使用默认配置创建会话', async () => {
      const result = await manager.createSession({
        sessionName: 'default-session',
      });

      expect(result.conversationId).toMatch(/^[0-9a-f-]{36}$/); // UUID 格式

      // 验证使用了默认值
      expect(mockCodexClient.newConversation).toHaveBeenCalledWith({
        model: 'claude-3-opus',
        cwd: process.cwd(),
        approvalPolicy: ApprovalMode.ON_REQUEST,
        sandbox: SandboxPolicy.WORKSPACE_WRITE,
      });
    });

    it('应该在进程未就绪时启动进程管理器', async () => {
      vi.mocked(mockProcessManager.isReady).mockReturnValue(false);

      await manager.createSession({
        sessionName: 'test-session',
      });

      expect(mockProcessManager.start).toHaveBeenCalled();
    });

    it('应该在进程已就绪时不启动进程管理器', async () => {
      vi.mocked(mockProcessManager.isReady).mockReturnValue(true);

      await manager.createSession({
        sessionName: 'test-session',
      });

      expect(mockProcessManager.start).not.toHaveBeenCalled();
    });

    it('应该保存会话到内存', async () => {
      const result = await manager.createSession({
        sessionName: 'memory-test',
      });

      const session = manager.getSession(result.conversationId);
      expect(session).toBeDefined();
      expect(session!.conversationId).toBe(result.conversationId);
      expect(session!.jobId).toBe(result.jobId);
      expect(session!.status).toBe(SessionStatus.ACTIVE);
    });

    it('应该生成唯一的 jobId', async () => {
      const result1 = await manager.createSession({
        sessionName: 'session-1',
      });

      vi.mocked(mockCodexClient.newConversation).mockResolvedValue({
        conversationId: uuidv4(),
        model: 'claude-3-opus',
        rolloutPath: '/path/to/rollout2.json',
      });

      const result2 = await manager.createSession({
        sessionName: 'session-2',
      });

      expect(result1.jobId).not.toBe(result2.jobId);
    });

    it('应该创建会话目录', async () => {
      const result = await manager.createSession({
        sessionName: 'dir-test',
      });

      const session = manager.getSession(result.conversationId);
      expect(session!.sessionDir).toContain('dir-test');
      expect(session!.sessionDir).toContain(new Date().toISOString().split('T')[0]);
    });
  });

  describe('用户消息发送', () => {
    it('应该成功发送用户消息', async () => {
      const { conversationId } = await manager.createSession({
        sessionName: 'message-test',
      });

      await manager.sendUserMessage(conversationId, 'Hello, Codex!');

      expect(mockCodexClient.sendUserMessage).toHaveBeenCalledWith({
        conversationId,
        items: [{ type: 'text', text: 'Hello, Codex!' }],
      });
    });

    it('应该更新会话状态为 ACTIVE', async () => {
      const { conversationId } = await manager.createSession({
        sessionName: 'status-test',
      });

      await manager.sendUserMessage(conversationId, 'Test message');

      const session = manager.getSession(conversationId);
      expect(session!.status).toBe(SessionStatus.ACTIVE);
    });

    it('应该在会话不存在时抛出错误', async () => {
      await expect(manager.sendUserMessage('non-existent-conv', 'Test')).rejects.toThrow(
        'Session not found: non-existent-conv'
      );
    });
  });

  describe('审批请求处理: exec-command', () => {
    it('应该在 UNTRUSTED 模式下请求人工审批 (因为白名单为空)', async () => {
      const { jobId } = await manager.createSession({
        sessionName: 'approval-test',
        approvalMode: ApprovalMode.UNTRUSTED,
      });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        jobId,
        type: ApprovalType.EXEC_COMMAND,
        details: {
          command: 'ls -la',
          cwd: '/workspace',
        },
        status: ApprovalStatus.PENDING,
        createdAt: new Date(),
      };

      const decision = await manager.handleApprovalRequest(request);

      // 因为当前实现中白名单为空 (SessionManager line 209),所以会走人工审批流程
      // Mock 的 terminalUI 返回 'allow',所以决策是 'allow',状态是 APPROVED
      expect(decision).toBe('allow');
      expect(request.status).toBe(ApprovalStatus.APPROVED);
    });

    it('应该在 NEVER 模式下自动批准所有命令', async () => {
      const { jobId } = await manager.createSession({
        sessionName: 'never-mode-test',
        approvalMode: ApprovalMode.NEVER,
      });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        jobId,
        type: ApprovalType.EXEC_COMMAND,
        details: {
          command: 'rm -rf /',
          cwd: '/',
        },
        status: ApprovalStatus.PENDING,
        createdAt: new Date(),
      };

      const decision = await manager.handleApprovalRequest(request);

      expect(decision).toBe('allow');
      expect(request.status).toBe(ApprovalStatus.AUTO_APPROVED);
    });

    it('应该在命令不在白名单时请求人工审批', async () => {
      const { jobId } = await manager.createSession({
        sessionName: 'manual-approval-test',
        approvalMode: ApprovalMode.UNTRUSTED,
      });

      // Mock 用户批准
      vi.spyOn(manager['terminalUI'], 'promptApproval').mockResolvedValue('allow');

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        jobId,
        type: ApprovalType.EXEC_COMMAND,
        details: {
          command: 'dangerous-command',
          cwd: '/workspace',
        },
        status: ApprovalStatus.PENDING,
        createdAt: new Date(),
      };

      const decision = await manager.handleApprovalRequest(request);

      expect(decision).toBe('allow');
      expect(request.status).toBe(ApprovalStatus.APPROVED);
      expect(manager['terminalUI'].promptApproval).toHaveBeenCalledWith(request);
    });

    it('应该在用户拒绝时返回 deny', async () => {
      const { jobId } = await manager.createSession({
        sessionName: 'deny-test',
        approvalMode: ApprovalMode.UNTRUSTED,
      });

      // Mock 用户拒绝
      vi.spyOn(manager['terminalUI'], 'promptApproval').mockResolvedValue('deny');

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        jobId,
        type: ApprovalType.EXEC_COMMAND,
        details: {
          command: 'dangerous-command',
          cwd: '/workspace',
        },
        status: ApprovalStatus.PENDING,
        createdAt: new Date(),
      };

      const decision = await manager.handleApprovalRequest(request);

      expect(decision).toBe('deny');
      expect(request.status).toBe(ApprovalStatus.DENIED);
    });
  });

  describe('审批请求处理: apply-patch', () => {
    it('应该请求人工审批 apply-patch', async () => {
      const { jobId } = await manager.createSession({
        sessionName: 'patch-test',
      });

      // Mock 用户批准
      vi.spyOn(manager['terminalUI'], 'promptApproval').mockResolvedValue('allow');

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        jobId,
        type: ApprovalType.APPLY_PATCH,
        details: {
          fileChanges: [{ path: '/src/file.ts', type: 'modify', diff: 'diff content' }],
        },
        status: ApprovalStatus.PENDING,
        createdAt: new Date(),
      };

      const decision = await manager.handleApprovalRequest(request);

      expect(decision).toBe('allow');
      expect(request.status).toBe(ApprovalStatus.APPROVED);
      expect(manager['terminalUI'].promptApproval).toHaveBeenCalledWith(request);
    });

    it('应该在用户拒绝 patch 时返回 deny', async () => {
      const { jobId } = await manager.createSession({
        sessionName: 'patch-deny-test',
      });

      // Mock 用户拒绝
      vi.spyOn(manager['terminalUI'], 'promptApproval').mockResolvedValue('deny');

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        jobId,
        type: ApprovalType.APPLY_PATCH,
        details: {
          fileChanges: [{ path: '/etc/hosts', type: 'modify', diff: 'malicious' }],
        },
        status: ApprovalStatus.PENDING,
        createdAt: new Date(),
      };

      const decision = await manager.handleApprovalRequest(request);

      expect(decision).toBe('deny');
      expect(request.status).toBe(ApprovalStatus.DENIED);
    });
  });

  describe('审批请求错误处理', () => {
    it('应该在策略引擎不存在时抛出错误', async () => {
      const request: ApprovalRequest = {
        requestId: uuidv4(),
        jobId: 'non-existent-job',
        type: ApprovalType.EXEC_COMMAND,
        details: {
          command: 'test',
          cwd: '/test',
        },
        status: ApprovalStatus.PENDING,
        createdAt: new Date(),
      };

      await expect(manager.handleApprovalRequest(request)).rejects.toThrow(
        'Policy engine not found for job: non-existent-job'
      );
    });

    it('应该在未知审批类型时抛出错误', async () => {
      const { jobId } = await manager.createSession({
        sessionName: 'unknown-type-test',
      });

      const request: ApprovalRequest = {
        requestId: uuidv4(),
        jobId,
        type: 'unknown-type' as ApprovalType,
        details: {},
        status: ApprovalStatus.PENDING,
        createdAt: new Date(),
      };

      await expect(manager.handleApprovalRequest(request)).rejects.toThrow(
        'Unknown approval type: unknown-type'
      );
    });
  });

  describe('会话管理', () => {
    it('应该获取会话信息', async () => {
      const { conversationId, jobId } = await manager.createSession({
        sessionName: 'get-test',
      });

      const session = manager.getSession(conversationId);

      expect(session).toBeDefined();
      expect(session!.conversationId).toBe(conversationId);
      expect(session!.jobId).toBe(jobId);
    });

    it('应该在会话不存在时返回 undefined', () => {
      const session = manager.getSession('non-existent');
      expect(session).toBeUndefined();
    });

    it('应该列出所有会话', async () => {
      await manager.createSession({ sessionName: 'session-1' });

      vi.mocked(mockCodexClient.newConversation).mockResolvedValue({
        conversationId: uuidv4(),
        model: 'claude-3-opus',
        rolloutPath: '/path/to/rollout2.json',
      });

      await manager.createSession({ sessionName: 'session-2' });

      const sessions = manager.listSessions();

      expect(sessions).toHaveLength(2);
      expect(sessions[0].sessionName).toBe('session-1');
      expect(sessions[1].sessionName).toBe('session-2');
    });

    it('应该返回空数组当没有会话时', () => {
      const sessions = manager.listSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('会话终止', () => {
    it('应该成功终止会话', async () => {
      const { conversationId } = await manager.createSession({
        sessionName: 'terminate-test',
      });

      await manager.terminateSession(conversationId);

      const session = manager.getSession(conversationId);
      expect(session!.status).toBe(SessionStatus.TERMINATED);
    });

    it('应该在会话不存在时抛出错误', async () => {
      await expect(manager.terminateSession('non-existent')).rejects.toThrow(
        'Session not found: non-existent'
      );
    });

    it('应该在终止后保留会话记录', async () => {
      const { conversationId } = await manager.createSession({
        sessionName: 'keep-test',
      });

      await manager.terminateSession(conversationId);

      const session = manager.getSession(conversationId);
      expect(session).toBeDefined();
    });
  });

  describe('清理资源', () => {
    it('应该终止所有活跃会话', async () => {
      const { conversationId: conv1 } = await manager.createSession({
        sessionName: 'cleanup-1',
      });

      vi.mocked(mockCodexClient.newConversation).mockResolvedValue({
        conversationId: uuidv4(),
        model: 'claude-3-opus',
        rolloutPath: '/path/to/rollout2.json',
      });

      const { conversationId: conv2 } = await manager.createSession({
        sessionName: 'cleanup-2',
      });

      await manager.cleanup();

      const session1 = manager.getSession(conv1);
      const session2 = manager.getSession(conv2);

      expect(session1).toBeUndefined();
      expect(session2).toBeUndefined();
    });

    it('应该停止进程管理器', async () => {
      await manager.createSession({ sessionName: 'stop-test' });
      await manager.cleanup();

      expect(mockProcessManager.stop).toHaveBeenCalled();
    });

    it('应该清空所有会话映射', async () => {
      await manager.createSession({ sessionName: 'clear-test' });
      await manager.cleanup();

      const sessions = manager.listSessions();
      expect(sessions).toEqual([]);
    });
  });

  describe('工厂函数', () => {
    it('应该通过工厂函数创建实例', () => {
      const manager = createSessionManager({
        processManager: mockProcessManager,
      });

      expect(manager).toBeInstanceOf(SessionManager);
    });
  });

  describe('边缘情况', () => {
    it('应该处理包含特殊字符的会话名称', async () => {
      const result = await manager.createSession({
        sessionName: 'test-session-中文-🎉',
      });

      expect(result.conversationId).toMatch(/^[0-9a-f-]{36}$/); // UUID 格式

      const session = manager.getSession(result.conversationId);
      expect(session!.sessionName).toBe('test-session-中文-🎉');
    });

    it('应该处理长消息', async () => {
      const { conversationId } = await manager.createSession({
        sessionName: 'long-message-test',
      });

      const longMessage = 'Hello '.repeat(1000);
      await manager.sendUserMessage(conversationId, longMessage);

      expect(mockCodexClient.sendUserMessage).toHaveBeenCalledWith({
        conversationId,
        items: [{ type: 'text', text: longMessage }],
      });
    });

    it('应该处理 newConversation 失败', async () => {
      vi.mocked(mockCodexClient.newConversation).mockRejectedValue(
        new Error('Codex connection failed')
      );

      await expect(manager.createSession({ sessionName: 'fail-test' })).rejects.toThrow(
        'Codex connection failed'
      );
    });

    it('应该处理 sendUserMessage 失败', async () => {
      const { conversationId } = await manager.createSession({
        sessionName: 'send-fail-test',
      });

      vi.mocked(mockCodexClient.sendUserMessage).mockRejectedValue(new Error('Send failed'));

      await expect(manager.sendUserMessage(conversationId, 'Test')).rejects.toThrow('Send failed');
    });
  });
});
