import { describe, it, expect } from 'vitest';

import {
  formatHttpError,
  formatJsonRpcError,
  type ErrorResponse,
} from '../../core/lib/errors/error-manager.js';

describe('errorFormatter: HTTP 错误格式化', () => {
  it('HTTP 405 + wire_api 建议', () => {
    const res: ErrorResponse = formatHttpError(
      405,
      '/v1/conversations',
      'POST',
      'Method Not Allowed',
      '0.44.0'
    );

    expect(res.code).toBe(405);
    expect(res.context.endpoint).toBe('/v1/conversations');
    expect(res.context.method).toBe('POST');
    expect(res.context.statusCode).toBe(405);
    expect(res.context.version).toBe('0.44.0');
    expect(res.message).toContain('HTTP 405 Method Not Allowed');
    expect(res.message).toContain('POST /v1/conversations');
    expect(res.message).toContain('Codex 0.44.0');
    expect(res.message).toMatch(/wire_api/i);

    // 建议至少包含 wire_api 检查与配置核对
    const suggestions = res.suggestions || [];
    const actions = suggestions.map((s: any) => s.action);
    expect(actions).toContain('check_wire_api');
    expect(actions).toContain('verify_model_config');
  });

  it('HTTP 404 + 端点不存在提示', () => {
    const res = formatHttpError(404, '/v1/unknown', 'GET', 'Not Found', '0.44.0');
    expect(res.code).toBe(404);
    expect(res.context.endpoint).toBe('/v1/unknown');
    expect(res.context.method).toBe('GET');
    expect(res.context.statusCode).toBe(404);
    expect(res.message).toContain('HTTP 404 Not Found');
    // 建议包含检查端点
    const suggestions = res.suggestions || [];
    const actions = suggestions.map((s: any) => s.action);
    expect(actions).toContain('verify_endpoint');
  });

  it('HTTP 500 + 通用错误处理', () => {
    const res = formatHttpError(500, '/v1/something', 'GET', 'Internal Server Error');
    expect(res.code).toBe(500);
    expect(res.context.statusCode).toBe(500);
    expect(res.message).toContain('HTTP 500 Internal Server Error');
    // 至少含有一个可执行建议
    const suggestions = res.suggestions || [];
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.map((s: any) => s.action)).toContain('retry_later');
  });
});

describe('errorFormatter: JSON-RPC 错误格式化', () => {
  it('-32602 (Invalid params) + 参数版本不匹配', () => {
    const res = formatJsonRpcError(
      -32602,
      "Invalid params: 'profile' requires Codex >= 0.44",
      'newConversation',
      { param: 'profile' },
      '0.42.0'
    );

    expect(res.code).toBe(-32602);
    expect(res.context.method).toBe('newConversation');
    expect(res.context.version).toBe('0.42.0');
    expect(res.message).toContain('Invalid params');
    expect(res.message).toContain('current: 0.42.0');
    expect(res.message).toContain('in newConversation');

    const suggestions = res.suggestions || [];
    const actions = suggestions.map((s: any) => s.action);
    expect(actions).toContain('upgrade_codex');
    expect(actions).toContain('remove_parameter');
  });

  it('-32601 (Method not found) + 方法不存在', () => {
    const res = formatJsonRpcError(-32601, 'Method not found', 'sendUserTurn');
    expect(res.code).toBe(-32601);
    expect(res.context.method).toBe('sendUserTurn');
    expect(res.message).toContain('Method not found');
    const suggestions = res.suggestions || [];
    const actions = suggestions.map((s: any) => s.action);
    expect(actions).toContain('check_method_name');
  });

  it('-32600 (Invalid Request) + 通用错误', () => {
    const res = formatJsonRpcError(-32600, 'Invalid Request', 'newConversation');
    expect(res.code).toBe(-32600);
    expect(res.message).toContain('Invalid Request');
    const suggestions = res.suggestions || [];
    const actions = suggestions.map((s: any) => s.action);
    expect(actions).toContain('validate_request');
  });
});

describe('errorFormatter: 上下文完整性', () => {
  it('HTTP 上下文包含 endpoint/method/version/statusCode', () => {
    const res = formatHttpError(404, '/v1/x', 'GET', 'Not Found', '0.44.0');
    expect(res.context).toMatchObject({
      endpoint: '/v1/x',
      method: 'GET',
      version: '0.44.0',
      statusCode: 404,
    });
  });

  it('JSON-RPC 上下文包含 method/version，且透传 requestId（如果提供）', () => {
    const res = formatJsonRpcError(
      -32602,
      'Invalid params',
      'newConversation',
      { requestId: 'req-123' },
      '0.44.0'
    );
    expect(res.context.method).toBe('newConversation');
    expect(res.context.version).toBe('0.44.0');
    expect(res.context.requestId).toBe('req-123');
  });
});
