import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../schemas/sendUserTurn.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: sendUserTurn', () => {
  const validateRequest = ajv.compile(schema.request);
  const validateResponse = ajv.compile(schema.response);

  describe('Request Validation', () => {
    it('接受最小化的请求', () => {
      expect(
        validateRequest({
          conversationId: 'c10',
          items: [
            {
              type: 'text',
              text: 'hi',
            },
          ],
        })
      ).toBe(true);
    });

    it('接受包含可选 effort 与 summary 的请求', () => {
      expect(
        validateRequest({
          conversationId: 'c10',
          items: [
            {
              type: 'text',
              text: 'need summary',
            },
          ],
          effort: 'medium',
          summary: 'auto',
        })
      ).toBe(true);
    });

    it('拒绝缺少 conversationId 的请求', () => {
      expect(
        validateRequest({
          items: [
            {
              type: 'text',
              text: 'no id',
            },
          ],
        })
      ).toBe(false);
    });

    it('拒绝未知的 approvalPolicy 值', () => {
      expect(
        validateRequest({
          conversationId: 'c11',
          items: [
            {
              type: 'text',
              text: 'invalid policy',
            },
          ],
          approvalPolicy: 'always',
        })
      ).toBe(false);
    });

    it('拒绝非法 summary 值', () => {
      expect(
        validateRequest({
          conversationId: 'c12',
          items: [
            {
              type: 'text',
              text: 'invalid summary',
            },
          ],
          summary: 'detailed',
        })
      ).toBe(false);
    });

    it('拒绝包含额外字段的请求', () => {
      expect(
        validateRequest({
          conversationId: 'c13',
          items: [
            {
              type: 'text',
              text: 'extra',
            },
          ],
          extra: 'value',
        })
      ).toBe(false);
    });
  });

  describe('Response Validation', () => {
    it('接受 accepted=true 的响应', () => {
      expect(
        validateResponse({
          accepted: true,
        })
      ).toBe(true);
    });

    it('接受 accepted=false 的响应', () => {
      expect(
        validateResponse({
          accepted: false,
        })
      ).toBe(true);
    });

    it('拒绝缺少 accepted 字段的响应', () => {
      expect(validateResponse({})).toBe(false);
    });

    it('拒绝包含额外字段的响应', () => {
      expect(
        validateResponse({
          accepted: true,
          durationMs: 2000,
        })
      ).toBe(false);
    });
  });

  describe('版本兼容性元数据', () => {
    it('标记 effort 需要 Codex >= 0.44', () => {
      expect(schema.versionSpecificParams?.effort?.minVersion).toBe('0.44.0');
    });

    it('标记 summary 需要 Codex >= 0.44', () => {
      expect(schema.versionSpecificParams?.summary?.minVersion).toBe('0.44.0');
    });

    it('effort 属性上携带 minVersion 元数据', () => {
      expect(schema.request.properties?.effort?.minVersion).toBe('0.44.0');
    });

    it('summary 属性上携带 minVersion 元数据', () => {
      expect(schema.request.properties?.summary?.minVersion).toBe('0.44.0');
    });
  });
});
