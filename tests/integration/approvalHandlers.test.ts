import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';

import schema from '../../specs/008-ultrathink-codex-0/contracts/applyPatchApproval.schema.json';
import { handleApplyPatchApproval } from '../../src/mcp/approvalHandlers';

const ajv = new Ajv({ strict: false });

describe('approvalHandlers.applyPatchApproval', () => {
  it('应返回 allow 决策并符合响应契约', async () => {
    const validateResponse = ajv.compile(schema.response);

    const request = {
      jsonrpc: '2.0' as const,
      id: 'req-1',
      method: 'applyPatchApproval',
      params: {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-123',
        fileChanges: [{ path: 'src/app.ts', type: 'modify' as const, diff: '--- old\n+++ new' }],
      },
    };

    const res = await handleApplyPatchApproval(request, () => 'allow');

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe('req-1');
    expect(res.result).toEqual({ decision: 'allow' });

    // 契约校验
    expect(validateResponse(res.result)).toBe(true);
  });

  it('应返回 deny 决策并可附加 note', async () => {
    const validateResponse = ajv.compile(schema.response);

    const request = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'applyPatchApproval',
      params: {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-999',
        fileChanges: [{ path: '/etc/config', type: 'delete' as const, diff: '--- removed' }],
        reason: 'Requires privileged access',
      },
    };
    const res = await handleApplyPatchApproval(request, () => ({
      decision: 'deny',
      note: 'Requires manual inspection',
    }));

    expect(res.result).toEqual({ decision: 'deny', note: 'Requires manual inspection' });
    expect(validateResponse(res.result)).toBe(true);
  });

  it('应在 method 不匹配时返回错误', async () => {
    const bad = { ...baseRequest, method: 'unknown' } as any;
    await expect(handleApplyPatchApproval(bad, () => 'allow')).rejects.toThrow(/invalid method/i);
  });

  it('应在缺少必要参数时抛出错误', async () => {
    const badParams = {
      jsonrpc: '2.0' as const,
      id: 'req-3',
      method: 'applyPatchApproval',
      params: {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-3',
      },
    } as any;

    await expect(handleApplyPatchApproval(badParams, () => 'allow')).rejects.toThrow(
      /invalid applypatchapproval request parameters/i
    );
  });
});

// 基础请求模板（便于复用）
const baseRequest = {
  jsonrpc: '2.0' as const,
  id: 'req-base',
  method: 'applyPatchApproval' as const,
  params: {
    conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
    callId: 'call-base',
    fileChanges: [{ path: 'a.txt', type: 'modify' as const, diff: '---\n+++' }],
  },
};
