import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../specs/__archive/008-ultrathink-codex-0/contracts/getUserAgent.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: getUserAgent', () => {
  const validateRequest = ajv.compile(schema.request);
  const validateResponse = ajv.compile(schema.response);

  describe('Request Validation', () => {
    it('接受空请求对象', () => {
      expect(validateRequest({})).toBe(true);
    });

    it('拒绝包含多余字段的请求', () => {
      expect(
        validateRequest({
          verbose: true,
        })
      ).toBe(false);
    });

    it('拒绝非对象类型的请求', () => {
      expect(validateRequest('request')).toBe(false);
    });
  });

  describe('Response Validation', () => {
    it('接受包含 userAgent 的响应', () => {
      expect(
        validateResponse({
          userAgent: 'codex-mcp/0.42.0 (linux; x86_64)',
        })
      ).toBe(true);
    });

    it('拒绝缺少 userAgent 的响应', () => {
      expect(validateResponse({})).toBe(false);
    });

    it('拒绝空字符串形式的 userAgent', () => {
      expect(
        validateResponse({
          userAgent: '',
        })
      ).toBe(false);
    });

    it('接受包含附加信息的 userAgent 字符串', () => {
      expect(
        validateResponse({
          userAgent: 'codex-mcp/0.44.1 sandbox(read-only) node/20.12',
        })
      ).toBe(true);
    });
  });
});
