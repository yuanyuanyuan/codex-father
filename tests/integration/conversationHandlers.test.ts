import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';

import archiveSchema from '../../specs/__archive/008-ultrathink-codex-0/contracts/archiveConversation.schema.json';
import resumeSchema from '../../specs/__archive/008-ultrathink-codex-0/contracts/resumeConversation.schema.json';
import interruptSchema from '../../specs/__archive/008-ultrathink-codex-0/contracts/interruptConversation.schema.json';
import listSchema from '../../specs/__archive/008-ultrathink-codex-0/contracts/listConversations.schema.json';
import {
  handleArchiveConversation,
  handleResumeConversation,
  handleInterruptConversation,
  handleListConversations,
} from '../../src/mcp/conversationHandlers';

const ajv = new Ajv({ strict: false });

describe('conversationHandlers.archiveConversation', () => {
  const requestSchema = (archiveSchema as any).definitions
    ? { ...(archiveSchema as any).request, definitions: (archiveSchema as any).definitions }
    : (archiveSchema as any).request;
  const responseSchema = (archiveSchema as any).definitions
    ? { ...(archiveSchema as any).response, definitions: (archiveSchema as any).definitions }
    : (archiveSchema as any).response;

  it('应调用 archive 并返回 success，响应契约校验通过', async () => {
    const validateResponse = ajv.compile(responseSchema);

    const request = {
      jsonrpc: '2.0' as const,
      id: 'req-arch-1',
      method: 'archiveConversation',
      params: {
        conversationId: '6f5902ac-03c9-4e30-9953-b6d5c8dcf8a7',
      },
    };

    const res = await handleArchiveConversation(request, async ({ conversationId }) => {
      expect(conversationId).toBe('6f5902ac-03c9-4e30-9953-b6d5c8dcf8a7');
      return { success: true };
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe('req-arch-1');
    expect(res.result).toEqual({ success: true });
    expect(validateResponse(res.result)).toBe(true);
  });

  it('支持返回 success=false 的结果并通过契约校验', async () => {
    const validateResponse = ajv.compile(responseSchema);

    const request = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'archiveConversation',
      params: {
        conversationId: 'a02f3e77-df12-4d08-991d-9b2a6c49d6a3',
      },
    };

    const res = await handleArchiveConversation(request, async () => ({ success: false }));
    expect(res.result).toEqual({ success: false });
    expect(validateResponse(res.result)).toBe(true);
  });

  it('method 不匹配时应抛出错误', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 'x',
      method: 'unknown',
      params: { conversationId: '6f5902ac-03c9-4e30-9953-b6d5c8dcf8a7' },
    } as any;

    await expect(handleArchiveConversation(bad, async () => ({ success: true }))).rejects.toThrow(
      /invalid method/i
    );
  });

  it('缺少必要参数时应抛出错误', async () => {
    const badParams = {
      jsonrpc: '2.0' as const,
      id: 'req-3',
      method: 'archiveConversation',
      params: {},
    } as any;

    await expect(
      handleArchiveConversation(badParams, async () => ({ success: true }))
    ).rejects.toThrow(/invalid archiveconversation request parameters/i);
  });

  it('契约测试：应接受符合 schema 的请求并拒绝异常字段', () => {
    const validateRequest = ajv.compile(requestSchema);

    // 合法请求
    expect(validateRequest({ conversationId: '6f5902ac-03c9-4e30-9953-b6d5c8dcf8a7' })).toBe(true);

    // 非法：多余字段
    expect(
      validateRequest({
        conversationId: '6f5902ac-03c9-4e30-9953-b6d5c8dcf8a7',
        extra: true,
      })
    ).toBe(false);
  });
});

describe('conversationHandlers.resumeConversation', () => {
  const requestSchema = (resumeSchema as any).definitions
    ? { ...(resumeSchema as any).request, definitions: (resumeSchema as any).definitions }
    : (resumeSchema as any).request;
  const responseSchema = (resumeSchema as any).definitions
    ? { ...(resumeSchema as any).response, definitions: (resumeSchema as any).definitions }
    : (resumeSchema as any).response;

  it('应返回 success=true 且包含 conversationId，并通过契约校验', async () => {
    const validateResponse = ajv.compile(responseSchema);

    const request = {
      jsonrpc: '2.0' as const,
      id: 'req-1',
      method: 'resumeConversation',
      params: {
        conversationId: '0cc175b9-c0f1-49e3-9a78-7e52e2c6f861',
      },
    };

    const res = await handleResumeConversation(request, async (req) => {
      expect(req.conversationId).toBe('0cc175b9-c0f1-49e3-9a78-7e52e2c6f861');
      return { success: true, conversationId: req.conversationId };
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe('req-1');
    expect(res.result).toEqual({
      success: true,
      conversationId: '0cc175b9-c0f1-49e3-9a78-7e52e2c6f861',
    });
    expect(validateResponse(res.result)).toBe(true);
  });

  it('应返回 success=false（可不包含 conversationId），并通过契约校验', async () => {
    const validateResponse = ajv.compile(responseSchema);

    const request = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'resumeConversation',
      params: {
        conversationId: '1cc175b9-c0f1-49e3-9a78-7e52e2c6f862',
      },
    };

    const res = await handleResumeConversation(request, () => ({ success: false }));
    expect(res.result).toEqual({ success: false });
    expect(validateResponse(res.result)).toBe(true);
  });

  it('应在 method 不匹配时抛出错误', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 'x',
      method: 'unknown',
      params: { conversationId: '0cc175b9-c0f1-49e3-9a78-7e52e2c6f861' },
    } as any;

    await expect(handleResumeConversation(bad, () => ({ success: true }))).rejects.toThrow(
      /invalid method/i
    );
  });

  it('应在缺少必要参数时抛出错误', async () => {
    const badParams = {
      jsonrpc: '2.0' as const,
      id: 'req-3',
      method: 'resumeConversation',
      params: {},
    } as any;

    await expect(handleResumeConversation(badParams, () => ({ success: true }))).rejects.toThrow(
      /invalid resumeconversation request parameters/i
    );
  });
});

describe('conversationHandlers.interruptConversation', () => {
  const responseSchema = (interruptSchema as any).definitions
    ? { ...(interruptSchema as any).response, definitions: (interruptSchema as any).definitions }
    : (interruptSchema as any).response;

  it('应返回成功结果并符合响应契约', async () => {
    const validateResponse = ajv.compile(responseSchema);

    const request = {
      jsonrpc: '2.0' as const,
      id: 'req-1',
      method: 'interruptConversation',
      params: {
        conversationId: 'd3b07384-d9a0-4f11-8735-7e0f0343a5ad',
      },
    };

    const res = await handleInterruptConversation(request, async () => ({ success: true }));

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe('req-1');
    expect(res.result).toEqual({ success: true });
    expect(validateResponse(res.result)).toBe(true);
  });

  it('应将解析后的请求参数传递给实现函数', async () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'interruptConversation',
      params: {
        conversationId: '0b1f4c0a-9f5c-46f0-8ab7-4f0f3d2c1b2a',
      },
    };

    let receivedId: string | undefined;
    const res = await handleInterruptConversation(request, async (req) => {
      receivedId = req.conversationId;
      return { success: true, message: 'Interrupted' };
    });

    expect(receivedId).toBe('0b1f4c0a-9f5c-46f0-8ab7-4f0f3d2c1b2a');
    expect(res.result).toEqual({ success: true, message: 'Interrupted' });
  });

  it('应在 method 不匹配时返回错误', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 'x',
      method: 'unknown',
      params: { conversationId: 'd3b07384-d9a0-4f11-8735-7e0f0343a5ad' },
    } as any;

    await expect(handleInterruptConversation(bad, async () => ({ success: true }))).rejects.toThrow(
      /invalid method/i
    );
  });

  it('应在缺少必要参数时抛出错误', async () => {
    const badParams = {
      jsonrpc: '2.0' as const,
      id: 'req-3',
      method: 'interruptConversation',
      params: {},
    } as any;

    await expect(
      handleInterruptConversation(badParams, async () => ({ success: true }))
    ).rejects.toThrow(/invalid interruptconversation request parameters/i);
  });
});

describe('conversationHandlers.listConversations', () => {
  const responseSchema = (listSchema as any).definitions
    ? { ...(listSchema as any).response, definitions: (listSchema as any).definitions }
    : (listSchema as any).response;
  const validateResponse = ajv.compile(responseSchema);

  it('应返回会话列表并符合响应契约', async () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 'req-1',
      method: 'listConversations',
      params: { status: 'active' as const },
    };

    const mockResult = {
      conversations: [
        {
          id: '6f5902ac-03c9-4e30-9953-b6d5c8dcf8a7',
          model: 'gpt-5',
          createdAt: '2025-10-04T04:31:51Z',
          status: 'active' as const,
          title: 'Bug triage',
        },
      ],
    };

    const res = await handleListConversations(request, async () => mockResult);

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe('req-1');
    expect(res.result).toEqual(mockResult);
    expect(validateResponse(res.result)).toBe(true);
  });

  it('应在无 params 时按空过滤处理', async () => {
    const request = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'listConversations',
    } as any;

    const res = await handleListConversations(request, async (req) => {
      expect(req).toEqual({});
      return { conversations: [] };
    });

    expect(res.result).toEqual({ conversations: [] });
    expect(validateResponse(res.result)).toBe(true);
  });

  it('应在 method 不匹配时抛出错误', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 'x',
      method: 'unknown',
      params: {},
    } as any;

    await expect(handleListConversations(bad, async () => ({ conversations: [] }))).rejects.toThrow(
      /invalid method/i
    );
  });

  it('应在参数无效时抛出错误', async () => {
    const badParams = {
      jsonrpc: '2.0' as const,
      id: 'req-bad',
      method: 'listConversations',
      params: { status: 'unknown' },
    } as any;

    await expect(
      handleListConversations(badParams, async () => ({ conversations: [] }))
    ).rejects.toThrow(/invalid listconversations request parameters/i);
  });
});
