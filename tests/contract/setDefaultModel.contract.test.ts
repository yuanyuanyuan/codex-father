import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../specs/_archived/008-ultrathink-codex-0/contracts/setDefaultModel.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: setDefaultModel', () => {
  const requestSchema = schema.definitions
    ? { ...schema.request, definitions: schema.definitions }
    : schema.request;
  const validateRequest = ajv.compile(requestSchema);
  const validateResponse = ajv.compile(schema.response);

  describe('Request Validation', () => {
    it('接受仅指定模型名称的请求', () => {
      expect(
        validateRequest({
          model: 'gpt-5-codex',
        })
      ).toBe(true);
    });

    it('接受清除默认模型的请求', () => {
      expect(
        validateRequest({
          model: null,
        })
      ).toBe(true);
    });

    it('接受同时设置推理强度的请求', () => {
      expect(
        validateRequest({
          model: 'gpt-5-reasoning',
          reasoningEffort: 'high',
        })
      ).toBe(true);
    });

    it('拒绝缺少 model 字段的请求', () => {
      expect(validateRequest({})).toBe(false);
    });

    it('拒绝非法的 reasoningEffort 值', () => {
      expect(
        validateRequest({
          model: 'gpt-5',
          reasoningEffort: 'extreme',
        })
      ).toBe(false);
    });

    it('拒绝包含额外字段的请求', () => {
      expect(
        validateRequest({
          model: 'gpt-5',
          dryRun: true,
        })
      ).toBe(false);
    });
  });

  describe('Response Validation', () => {
    it('接受仅包含 success 的响应', () => {
      expect(
        validateResponse({
          success: true,
        })
      ).toBe(true);
    });

    it('接受包含 message 的响应', () => {
      expect(
        validateResponse({
          success: false,
          message: '默认模型未找到',
        })
      ).toBe(true);
    });

    it('拒绝缺少 success 的响应', () => {
      expect(validateResponse({})).toBe(false);
    });

    it('拒绝额外的顶层字段', () => {
      expect(
        validateResponse({
          success: true,
          trace: 'log',
        })
      ).toBe(false);
    });
  });
});
