/**
 * BridgeLayer Happy Path Integration Tests
 *
 * 覆盖：tools/list, tools/call 快速返回，审批映射（conversationId→jobId）
 */

import { describe, it, expect, vi } from 'vitest';
import { BridgeLayer, type ISessionManager } from '../../core/mcp/bridge-layer.js';
import { ApprovalRequest, ApprovalType, ApprovalStatus } from '../../core/lib/types.js';

describe('BridgeLayer Happy Path', () => {
  it('tools/list 应包含 start-codex-task', () => {
    const fakeSession: ISessionManager = {
      async createSession() {
        throw new Error('not used');
      },
      async sendUserMessage() {
        throw new Error('not used');
      },
      async handleApprovalRequest() {
        return 'allow' as const;
      },
      getJobIdByConversationId() {
        return undefined;
      },
    };

    const bridge = new BridgeLayer({ sessionManager: fakeSession });
    const tools = bridge.getTools();
    expect(tools.some((t) => t.name === 'start-codex-task')).toBe(true);
  });

  it('tools/call start-codex-task 应快速返回并生成 jobId(UUID)', async () => {
    const calls: any[] = [];
    const fakeSession: ISessionManager = {
      async createSession(options) {
        calls.push({ method: 'createSession', options });
        // 模拟后台异步成功
        return {
          conversationId: 'conv-123',
          jobId: options.jobId || 'job-x',
          rolloutPath: '/tmp/rollout.json',
        };
      },
      async sendUserMessage() {
        calls.push({ method: 'sendUserMessage' });
      },
      async handleApprovalRequest() {
        return 'allow' as const;
      },
      getJobIdByConversationId() {
        return undefined;
      },
    };

    const bridge = new BridgeLayer({ sessionManager: fakeSession });

    const start = Date.now();
    const result = await (bridge as any).callTool('start-codex-task', {
      prompt: 'do something',
    });
    const elapsed = Date.now() - start;

    expect(result.status).toBe('accepted');
    // UUID 基本格式校验
    expect(result.jobId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(elapsed).toBeLessThan(200); // 应快速返回
  });

  it('审批请求应使用 conversationId→jobId 映射', async () => {
    const decisionSpy = vi.fn(async (_req: ApprovalRequest) => 'allow' as const);
    const fakeSession: ISessionManager = {
      async createSession() {
        throw new Error('not used');
      },
      async sendUserMessage() {
        throw new Error('not used');
      },
      async handleApprovalRequest(req: ApprovalRequest) {
        decisionSpy(req);
        return 'allow' as const;
      },
      getJobIdByConversationId(conversationId: string) {
        if (conversationId === 'conv-abc') return 'job-abc-uuid-0000-0000-000000000000';
        return undefined;
      },
    };

    const bridge = new BridgeLayer({ sessionManager: fakeSession });

    const res = await bridge.handleExecCommandApproval('rid-1', {
      conversationId: 'conv-abc',
      callId: 'call-1',
      command: 'ls -la',
      cwd: '/',
    });

    expect(res.decision).toBe('allow');
    expect(decisionSpy).toHaveBeenCalled();
    const arg = decisionSpy.mock.calls[0][0] as ApprovalRequest;
    expect(arg.jobId).toBe('job-abc-uuid-0000-0000-000000000000');
    expect(arg.type).toBe('exec-command');
    expect(arg.status).toBe(ApprovalStatus.PENDING);
  });
});

