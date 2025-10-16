import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';

import getUserSavedConfigSchema from '../../tests/schemas/getUserSavedConfig.schema.json';
import setDefaultModelSchema from '../../tests/schemas/setDefaultModel.schema.json';
import getUserAgentSchema from '../../tests/schemas/getUserAgent.schema.json';
import userInfoSchema from '../../tests/schemas/userInfo.schema.json';

import {
  handleGetUserSavedConfig,
  handleSetDefaultModel,
  handleGetUserAgent,
  handleUserInfo,
} from '../../src/mcp/configHandlers';

const ajv = new Ajv({ strict: false });

describe('configHandlers.getUserSavedConfig', () => {
  const requestSchema = (getUserSavedConfigSchema as any).definitions
    ? {
        ...(getUserSavedConfigSchema as any).request,
        definitions: (getUserSavedConfigSchema as any).definitions,
      }
    : (getUserSavedConfigSchema as any).request;
  const responseSchema = (getUserSavedConfigSchema as any).definitions
    ? {
        ...(getUserSavedConfigSchema as any).response,
        definitions: (getUserSavedConfigSchema as any).definitions,
      }
    : (getUserSavedConfigSchema as any).response;

  it('应返回用户保存的配置并通过契约校验', async () => {
    const validateRes = ajv.compile(responseSchema);

    const req = { jsonrpc: '2.0' as const, id: 'req-1', method: 'getUserSavedConfig' } as any;
    const res = await handleGetUserSavedConfig(req, async (params) => {
      expect(params).toEqual({});
      return {
        config: {
          profiles: {
            default: { model: 'gpt-5' },
          },
          model: 'gpt-5',
        },
      };
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe('req-1');
    expect(validateRes(res.result)).toBe(true);
  });

  it('method 不匹配时应抛出错误', async () => {
    const bad = { jsonrpc: '2.0' as const, id: 2, method: 'unknown', params: {} } as any;
    await expect(
      handleGetUserSavedConfig(bad, () => ({ config: { profiles: {} } }))
    ).rejects.toThrow(/invalid method/i);
  });

  it('传入额外参数应被拒绝', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 3,
      method: 'getUserSavedConfig',
      params: { extra: true },
    } as any;
    await expect(
      handleGetUserSavedConfig(bad, () => ({ config: { profiles: {} } }))
    ).rejects.toThrow(/invalid getusersavedconfig request parameters/i);
  });

  it('契约：request 为空对象且不允许附加属性', () => {
    const validateReq = ajv.compile(requestSchema);
    expect(validateReq({})).toBe(true);
    expect(validateReq({ extra: 1 })).toBe(false);
  });
});

describe('configHandlers.setDefaultModel', () => {
  const requestSchema = (setDefaultModelSchema as any).definitions
    ? {
        ...(setDefaultModelSchema as any).request,
        definitions: (setDefaultModelSchema as any).definitions,
      }
    : (setDefaultModelSchema as any).request;
  const responseSchema = (setDefaultModelSchema as any).definitions
    ? {
        ...(setDefaultModelSchema as any).response,
        definitions: (setDefaultModelSchema as any).definitions,
      }
    : (setDefaultModelSchema as any).response;

  it('应设置默认模型并通过契约校验', async () => {
    const validateRes = ajv.compile(responseSchema);
    const req = {
      jsonrpc: '2.0' as const,
      id: 'req-2',
      method: 'setDefaultModel',
      params: { model: 'gpt-5', reasoningEffort: 'medium' as const },
    };

    const res = await handleSetDefaultModel(req, async ({ model, reasoningEffort }) => {
      expect(model).toBe('gpt-5');
      expect(reasoningEffort).toBe('medium');
      return { success: true };
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe('req-2');
    expect(validateRes(res.result)).toBe(true);
  });

  it('应接受 model=null（清除默认模型）', async () => {
    const validateRes = ajv.compile(responseSchema);
    const req = {
      jsonrpc: '2.0' as const,
      id: 3,
      method: 'setDefaultModel',
      params: { model: null },
    };
    const res = await handleSetDefaultModel(req, async ({ model }) => {
      expect(model).toBeNull();
      return { success: true, message: 'cleared' };
    });
    expect(validateRes(res.result)).toBe(true);
  });

  it('非法参数（reasoningEffort 值不在枚举内）应报错', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 'req-bad',
      method: 'setDefaultModel',
      params: { model: 'gpt-5', reasoningEffort: 'extreme' },
    } as any;
    await expect(handleSetDefaultModel(bad, () => ({ success: false }))).rejects.toThrow(
      /invalid setdefaultmodel request parameters/i
    );
  });

  it('method 不匹配时应抛出错误', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 4,
      method: 'unknown',
      params: { model: 'gpt-5' },
    } as any;
    await expect(handleSetDefaultModel(bad, () => ({ success: true }))).rejects.toThrow(
      /invalid method/i
    );
  });

  it('契约：不允许额外字段', () => {
    const validateReq = ajv.compile(requestSchema);
    expect(validateReq({ model: 'gpt-5' })).toBe(true);
    expect(validateReq({ model: null })).toBe(true);
    expect(validateReq({ model: 'gpt-5', extra: 'x' })).toBe(false);
  });
});

describe('configHandlers.getUserAgent', () => {
  const requestSchema = (getUserAgentSchema as any).definitions
    ? {
        ...(getUserAgentSchema as any).request,
        definitions: (getUserAgentSchema as any).definitions,
      }
    : (getUserAgentSchema as any).request;
  const responseSchema = (getUserAgentSchema as any).definitions
    ? {
        ...(getUserAgentSchema as any).response,
        definitions: (getUserAgentSchema as any).definitions,
      }
    : (getUserAgentSchema as any).response;

  it('应返回 userAgent 并通过契约校验', async () => {
    const validateRes = ajv.compile(responseSchema);
    const req = { jsonrpc: '2.0' as const, id: 'req-3', method: 'getUserAgent', params: {} };

    const res = await handleGetUserAgent(req, async (params) => {
      expect(params).toEqual({});
      return { userAgent: 'codex-father/1.0.0 (+vitest)' };
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe('req-3');
    expect(validateRes(res.result)).toBe(true);
  });

  it('method 不匹配时应抛出错误', async () => {
    const bad = { jsonrpc: '2.0' as const, id: 2, method: 'unknown', params: {} } as any;
    await expect(handleGetUserAgent(bad, () => ({ userAgent: 'x' }))).rejects.toThrow(
      /invalid method/i
    );
  });

  it('传入额外参数应被拒绝', async () => {
    const bad = {
      jsonrpc: '2.0' as const,
      id: 3,
      method: 'getUserAgent',
      params: { extra: 1 },
    } as any;
    await expect(handleGetUserAgent(bad, () => ({ userAgent: 'x' }))).rejects.toThrow(
      /invalid getuseragent request parameters/i
    );
  });

  it('契约：request 为空对象且不允许附加属性', () => {
    const validateReq = ajv.compile(requestSchema);
    expect(validateReq({})).toBe(true);
    expect(validateReq({ extra: 'x' })).toBe(false);
  });
});

describe('configHandlers.userInfo', () => {
  const requestSchema = (userInfoSchema as any).definitions
    ? {
        ...(userInfoSchema as any).request,
        definitions: (userInfoSchema as any).definitions,
      }
    : (userInfoSchema as any).request;
  const responseSchema = (userInfoSchema as any).definitions
    ? {
        ...(userInfoSchema as any).response,
        definitions: (userInfoSchema as any).definitions,
      }
    : (userInfoSchema as any).response;

  it('应返回用户信息并通过契约校验（allegedUserEmail 必须存在）', async () => {
    const validateRes = ajv.compile(responseSchema);
    const req = { jsonrpc: '2.0' as const, id: 'req-4', method: 'userInfo', params: {} };

    const res = await handleUserInfo(req, async (params) => {
      expect(params).toEqual({});
      return {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Codex User',
        allegedUserEmail: 'user@example.com',
      };
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe('req-4');
    expect(validateRes(res.result)).toBe(true);
  });

  it('method 不匹配时应抛出错误', async () => {
    const bad = { jsonrpc: '2.0' as const, id: 2, method: 'unknown', params: {} } as any;
    await expect(
      handleUserInfo(bad, () => ({ allegedUserEmail: 'user@example.com' }))
    ).rejects.toThrow(/invalid method/i);
  });

  it('传入额外参数应被拒绝', async () => {
    const bad = { jsonrpc: '2.0' as const, id: 3, method: 'userInfo', params: { a: 1 } } as any;
    await expect(
      handleUserInfo(bad, () => ({ allegedUserEmail: 'user@example.com' }))
    ).rejects.toThrow(/invalid userinfo request parameters/i);
  });

  it('契约：request 为空对象且不允许附加属性；响应必须包含 allegedUserEmail', () => {
    const validateReq = ajv.compile(requestSchema);
    const validateRes = ajv.compile(responseSchema);
    expect(validateReq({})).toBe(true);
    expect(validateReq({ extra: true })).toBe(false);
    expect(validateRes({ id: 'x', email: 'user@example.com', name: 'n' })).toBe(false);
    expect(validateRes({ allegedUserEmail: 'user@example.com' })).toBe(true);
  });
});
