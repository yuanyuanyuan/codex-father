import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';

import schema from '../../specs/008-ultrathink-codex-0/contracts/execCommandApproval.schema.json';
import { handleExecCommandApproval } from '../../src/mcp/approvalHandlers';

const ajv = new Ajv({ strict: false });

describe('approvalHandlers.execCommandApproval', () => {
  it('应处理有效的 JSON-RPC 请求并返回 allow 决策', async () => {
    const validateResponse = ajv.compile(schema.response);

    const request = {
      jsonrpc: '2.0' as const,
      id: 'req-1',
      method: 'execCommandApproval',
      params: {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-789',
        command: 'npm test',
        cwd: '/data/codex-father',
      },
    };

    const res = await handleExecCommandApproval(request, () => 'allow');

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe('req-1');
    expect(res.result).toBeDefined();
    expect(res.result?.decision).toBe('allow');

    // 契约校验（响应）
    expect(validateResponse(res.result)).toBe(true);
  });

  it('应支持返回带 note 的 deny 决策', async () => {
    const validateResponse = ajv.compile(schema.response);

    const request = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'execCommandApproval',
      params: {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-321',
        command: 'rm -rf build',
        cwd: '/tmp/project',
        reason: 'Retry without sandbox',
      },
    };

    const res = await handleExecCommandApproval(request, () => ({
      decision: 'deny',
      note: 'Command escalated due to destructive pattern',
    }));

    expect(res.result?.decision).toBe('deny');
    expect(res.result?.note).toContain('destructive');
    expect(validateResponse(res.result)).toBe(true);
  });

  it('应拒绝无效 method 的请求', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 'x',
      method: 'applyPatchApproval', // 错误的方法
      params: {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-1',
        command: 'echo hi',
        cwd: '/tmp',
      },
    };

    await expect(handleExecCommandApproval(bad as any, () => 'allow')).rejects.toThrow(
      /invalid method/i
    );
  });

  it('应拒绝缺少必需字段的请求 (缺少 cwd)', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 3,
      method: 'execCommandApproval',
      params: {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-2',
        command: 'ls',
      },
    };

    await expect(handleExecCommandApproval(bad as any, () => 'allow')).rejects.toThrow(
      /invalid execcommandapproval request parameters/i
    );
  });
});
