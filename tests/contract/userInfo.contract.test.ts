import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../schemas/userInfo.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: userInfo', () => {
  const validateRequest = ajv.compile(schema.request);
  const validateResponse = ajv.compile(schema.response);

  describe('Request Validation', () => {
    it('接受空请求', () => {
      expect(validateRequest({})).toBe(true);
    });

    it('拒绝包含额外属性的请求', () => {
      expect(
        validateRequest({
          fetchAvatar: true,
        })
      ).toBe(false);
    });

    it('拒绝非对象请求', () => {
      expect(validateRequest(null)).toBe(false);
    });
  });

  describe('Response Validation', () => {
    it('接受仅包含 allegedUserEmail 的响应', () => {
      expect(
        validateResponse({
          allegedUserEmail: 'user@example.com',
        })
      ).toBe(true);
    });

    it('接受包含完整用户信息的响应', () => {
      expect(
        validateResponse({
          id: 'user-123',
          email: 'verified@example.com',
          name: 'Codex Engineer',
          allegedUserEmail: 'user@example.com',
        })
      ).toBe(true);
    });

    it('拒绝缺少 allegedUserEmail 的响应', () => {
      expect(
        validateResponse({
          id: 'user-123',
        })
      ).toBe(false);
    });

    it('拒绝非法邮箱格式', () => {
      expect(
        validateResponse({
          allegedUserEmail: 'not-an-email',
        })
      ).toBe(false);
    });

    it('拒绝包含未知属性的响应', () => {
      expect(
        validateResponse({
          allegedUserEmail: 'user@example.com',
          role: 'admin',
        })
      ).toBe(false);
    });
  });
});
