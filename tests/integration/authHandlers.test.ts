import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';

import loginApiKeySchema from '../../tests/schemas/loginApiKey.schema.json';
import loginChatGptSchema from '../../tests/schemas/loginChatGpt.schema.json';
import loginChatGptCompleteSchema from '../../tests/schemas/loginChatGptComplete.schema.json';
import cancelLoginChatGptSchema from '../../tests/schemas/cancelLoginChatGpt.schema.json';
import logoutChatGptSchema from '../../tests/schemas/logoutChatGpt.schema.json';
import getAuthStatusSchema from '../../tests/schemas/getAuthStatus.schema.json';
import authStatusChangeSchema from '../../tests/schemas/authStatusChange.schema.json';

import {
  handleLoginApiKey,
  handleLoginChatGpt,
  handleCancelLoginChatGpt,
  handleLogoutChatGpt,
  handleGetAuthStatus,
  createLoginChatGptCompleteNotification,
  createAuthStatusChangeNotification,
} from '../../src/mcp/authHandlers';

const ajv = new Ajv({ strict: false });

describe('authHandlers.loginApiKey', () => {
  const requestSchema = (loginApiKeySchema as any).definitions
    ? {
        ...(loginApiKeySchema as any).request,
        definitions: (loginApiKeySchema as any).definitions,
      }
    : (loginApiKeySchema as any).request;
  const responseSchema = (loginApiKeySchema as any).definitions
    ? {
        ...(loginApiKeySchema as any).response,
        definitions: (loginApiKeySchema as any).definitions,
      }
    : (loginApiKeySchema as any).response;

  it('应返回 success=true，响应契约校验通过', async () => {
    const validate = ajv.compile(responseSchema);

    const req = {
      jsonrpc: '2.0' as const,
      id: 'req-1',
      method: 'loginApiKey',
      params: { apiKey: 'sk-test-123' },
    };

    const res = await handleLoginApiKey(req, async (params) => {
      expect(params.apiKey).toBe('sk-test-123');
      return { success: true };
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe('req-1');
    expect(res.result).toEqual({ success: true });
    expect(validate(res.result)).toBe(true);
  });

  it('method 不匹配时抛错', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 2,
      method: 'unknown',
      params: { apiKey: 'x' },
    } as any;
    await expect(handleLoginApiKey(bad, () => ({ success: true }))).rejects.toThrow(
      /invalid method/i
    );
  });

  it('缺少必要参数应报错', async () => {
    const bad = { jsonrpc: '2.0' as const, id: 3, method: 'loginApiKey', params: {} } as any;
    await expect(handleLoginApiKey(bad, () => ({ success: true }))).rejects.toThrow(
      /invalid loginapikey request parameters/i
    );
  });

  it('契约：额外字段不允许 (request)', () => {
    const validateReq = ajv.compile(requestSchema);
    expect(validateReq({ apiKey: 'k' })).toBe(true);
    expect(validateReq({ apiKey: 'k', extra: true })).toBe(false);
  });
});

describe('authHandlers.loginChatGpt', () => {
  const requestSchema = (loginChatGptSchema as any).definitions
    ? {
        ...(loginChatGptSchema as any).request,
        definitions: (loginChatGptSchema as any).definitions,
      }
    : (loginChatGptSchema as any).request;
  const responseSchema = (loginChatGptSchema as any).definitions
    ? {
        ...(loginChatGptSchema as any).response,
        definitions: (loginChatGptSchema as any).definitions,
      }
    : (loginChatGptSchema as any).response;

  it('应返回 loginId 与 authUrl，契约校验通过', async () => {
    const validateRes = ajv.compile(responseSchema);

    const req = { jsonrpc: '2.0' as const, id: 'req-2', method: 'loginChatGpt', params: {} };
    const res = await handleLoginChatGpt(req, async (params) => {
      expect(params).toEqual({});
      return {
        loginId: '6f5902ac-03c9-4e30-9953-b6d5c8dcf8a7',
        authUrl: 'https://auth.example.com/oauth?login=6f5902ac-03c9-4e30-9953-b6d5c8dcf8a7',
        expiresAt: '2025-10-04T05:30:00Z',
      };
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe('req-2');
    expect(validateRes(res.result)).toBe(true);
  });

  it('允许附加参数并原样传递', async () => {
    const validateRes = ajv.compile(responseSchema);
    const req = {
      jsonrpc: '2.0' as const,
      id: 3,
      method: 'loginChatGpt',
      params: { prompt: 'please', locale: 'zh-CN' },
    };

    let received: any;
    const res = await handleLoginChatGpt(req, async (params) => {
      received = params;
      return {
        loginId: '0cc175b9-c0f1-49e3-9a78-7e52e2c6f861',
        authUrl: 'https://auth.example.com/oauth?login=0cc175b9-c0f1-49e3-9a78-7e52e2c6f861',
      };
    });

    expect(received).toEqual({ prompt: 'please', locale: 'zh-CN' });
    expect(validateRes(res.result)).toBe(true);
  });

  it('method 不匹配时抛错', async () => {
    const bad = { jsonrpc: '2.0' as const, id: 'x', method: 'unknown', params: {} } as any;
    await expect(
      handleLoginChatGpt(bad, () => ({ loginId: 'a', authUrl: 'https://x.y' }) as any)
    ).rejects.toThrow(/invalid method/i);
  });

  it('契约：request 允许任意附加属性', () => {
    const validateReq = ajv.compile(requestSchema);
    expect(validateReq({})).toBe(true);
    expect(validateReq({ a: 1, b: 'x' })).toBe(true);
  });
});

describe('authHandlers.loginChatGptComplete (notification)', () => {
  const notificationSchema = (loginChatGptCompleteSchema as any).definitions
    ? {
        ...(loginChatGptCompleteSchema as any).request,
        definitions: (loginChatGptCompleteSchema as any).definitions,
      }
    : (loginChatGptCompleteSchema as any).request;

  it('应创建符合契约的 JSON-RPC 通知', () => {
    const validate = ajv.compile(notificationSchema);
    const notif = createLoginChatGptCompleteNotification({
      loginId: 'd3b07384-d9a0-4f11-8735-7e0f0343a5ad',
      success: true,
      timestamp: '2025-10-04T05:35:00Z',
    });

    expect(notif.jsonrpc).toBe('2.0');
    expect(notif.method).toBe('loginChatGptComplete');
    expect(validate(notif.params)).toBe(true);
  });

  it('缺少必要字段应抛出错误', () => {
    expect(() => createLoginChatGptCompleteNotification({} as any)).toThrow(
      /invalid loginchatgptcomplete notification parameters/i
    );
  });
});

describe('authHandlers.cancelLoginChatGpt', () => {
  const requestSchema = (cancelLoginChatGptSchema as any).definitions
    ? {
        ...(cancelLoginChatGptSchema as any).request,
        definitions: (cancelLoginChatGptSchema as any).definitions,
      }
    : (cancelLoginChatGptSchema as any).request;
  const responseSchema = (cancelLoginChatGptSchema as any).definitions
    ? {
        ...(cancelLoginChatGptSchema as any).response,
        definitions: (cancelLoginChatGptSchema as any).definitions,
      }
    : (cancelLoginChatGptSchema as any).response;

  it('应取消登录并返回 success', async () => {
    const validateRes = ajv.compile(responseSchema);
    const req = {
      jsonrpc: '2.0' as const,
      id: 'req-3',
      method: 'cancelLoginChatGpt',
      params: { loginId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789' },
    };

    const res = await handleCancelLoginChatGpt(req, async ({ loginId }) => {
      expect(loginId).toBe('c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789');
      return { success: true };
    });
    expect(validateRes(res.result)).toBe(true);
  });

  it('缺少 loginId 应抛错', async () => {
    const bad = { jsonrpc: '2.0' as const, id: 4, method: 'cancelLoginChatGpt', params: {} } as any;
    await expect(handleCancelLoginChatGpt(bad, () => ({ success: true }))).rejects.toThrow(
      /invalid cancelloginchatgpt request parameters/i
    );
  });

  it('method 不匹配时抛错', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 'x',
      method: 'unknown',
      params: { loginId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789' },
    } as any;
    await expect(handleCancelLoginChatGpt(bad, () => ({ success: true }))).rejects.toThrow(
      /invalid method/i
    );
  });

  it('契约：不允许额外字段', () => {
    const validateReq = ajv.compile(requestSchema);
    expect(validateReq({ loginId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789' })).toBe(true);
    expect(validateReq({ loginId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789', extra: 1 })).toBe(false);
  });
});

describe('authHandlers.logoutChatGpt', () => {
  const requestSchema = (logoutChatGptSchema as any).definitions
    ? {
        ...(logoutChatGptSchema as any).request,
        definitions: (logoutChatGptSchema as any).definitions,
      }
    : (logoutChatGptSchema as any).request;
  const responseSchema = (logoutChatGptSchema as any).definitions
    ? {
        ...(logoutChatGptSchema as any).response,
        definitions: (logoutChatGptSchema as any).definitions,
      }
    : (logoutChatGptSchema as any).response;

  it('应在无参数时正常处理', async () => {
    const validateRes = ajv.compile(responseSchema);
    const req = { jsonrpc: '2.0' as const, id: 'req-4', method: 'logoutChatGpt' } as any;
    const res = await handleLogoutChatGpt(req, async (params) => {
      expect(params).toEqual({});
      return { success: true };
    });
    expect(validateRes(res.result)).toBe(true);
  });

  it('传入额外参数应被拒绝', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 5,
      method: 'logoutChatGpt',
      params: { extra: true },
    } as any;
    await expect(handleLogoutChatGpt(bad, () => ({ success: true }))).rejects.toThrow(
      /invalid logoutchatgpt request parameters/i
    );
  });

  it('method 不匹配时抛错', async () => {
    const bad = { jsonrpc: '2.0' as const, id: 'x', method: 'unknown', params: {} } as any;
    await expect(handleLogoutChatGpt(bad, () => ({ success: true }))).rejects.toThrow(
      /invalid method/i
    );
  });

  it('契约：request 为空对象且不允许附加属性', () => {
    const validateReq = ajv.compile(requestSchema);
    expect(validateReq({})).toBe(true);
    expect(validateReq({ extra: 'x' })).toBe(false);
  });
});

describe('authHandlers.getAuthStatus', () => {
  const requestSchema = (getAuthStatusSchema as any).definitions
    ? {
        ...(getAuthStatusSchema as any).request,
        definitions: (getAuthStatusSchema as any).definitions,
      }
    : (getAuthStatusSchema as any).request;
  const responseSchema = (getAuthStatusSchema as any).definitions
    ? {
        ...(getAuthStatusSchema as any).response,
        definitions: (getAuthStatusSchema as any).definitions,
      }
    : (getAuthStatusSchema as any).response;

  it('应返回认证状态，含 token 与 method 时通过契约校验', async () => {
    const validateRes = ajv.compile(responseSchema);
    const req = {
      jsonrpc: '2.0' as const,
      id: 'req-5',
      method: 'getAuthStatus',
      params: { includeToken: true },
    };

    const res = await handleGetAuthStatus(req, async ({ includeToken }) => {
      expect(includeToken).toBe(true);
      return {
        authenticated: true,
        method: 'apiKey',
        token: 'tok_abc',
        expiresAt: '2025-10-04T06:00:00Z',
      };
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe('req-5');
    expect(validateRes(res.result)).toBe(true);
  });

  it('method 不匹配时抛错', async () => {
    const bad = { jsonrpc: '2.0' as const, id: 6, method: 'unknown', params: {} } as any;
    await expect(handleGetAuthStatus(bad, () => ({ authenticated: false }))).rejects.toThrow(
      /invalid method/i
    );
  });

  it('非法参数应抛错', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 'req-bad',
      method: 'getAuthStatus',
      params: { includeToken: 'yes' },
    } as any;
    await expect(handleGetAuthStatus(bad, () => ({ authenticated: false }))).rejects.toThrow(
      /invalid getauthstatus request parameters/i
    );
  });

  it('契约：request 不允许额外字段', () => {
    const validateReq = ajv.compile(requestSchema);
    expect(validateReq({})).toBe(true);
    expect(validateReq({ includeToken: true, refreshToken: false })).toBe(true);
    expect(validateReq({ x: 1 })).toBe(false);
  });
});

describe('authHandlers.authStatusChange (notification)', () => {
  const notificationSchema = (authStatusChangeSchema as any).definitions
    ? {
        ...(authStatusChangeSchema as any).request,
        definitions: (authStatusChangeSchema as any).definitions,
      }
    : (authStatusChangeSchema as any).request;
  const validate = ajv.compile(notificationSchema);

  it('应创建符合契约的通知', () => {
    const notif = createAuthStatusChangeNotification({
      authenticated: true,
      method: 'chatGpt',
      timestamp: '2025-10-04T06:10:00Z',
    });

    expect(notif.jsonrpc).toBe('2.0');
    expect(notif.method).toBe('authStatusChange');
    expect(validate(notif.params)).toBe(true);
  });

  it('缺失 authenticated 时应抛错', () => {
    expect(() => createAuthStatusChangeNotification({} as any)).toThrow(
      /invalid authstatuschange notification parameters/i
    );
  });
});

// 引入 schema：authStatusChange
import authStatusChangeSchema2 from '../../tests/schemas/authStatusChange.schema.json';
