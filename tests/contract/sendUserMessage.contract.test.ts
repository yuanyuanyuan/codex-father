import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../schemas/sendUserMessage.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: sendUserMessage', () => {
  const validateRequest = ajv.compile(schema.request);
  const validateResponse = ajv.compile(schema.response);

  describe('Request Validation', () => {
    it('接受文本消息列表', () => {
      expect(
        validateRequest({
          conversationId: 'c01',
          items: [
            {
              type: 'text',
              text: 'hello codex',
            },
          ],
        })
      ).toBe(true);
    });

    it('接受混合文本与图片的消息', () => {
      expect(
        validateRequest({
          conversationId: 'c02',
          items: [
            {
              type: 'text',
              text: '请查看图像',
            },
            {
              type: 'image',
              imageUrl: 'data:image/png;base64,ZmFrZQ==',
            },
          ],
        })
      ).toBe(true);
    });

    it('拒绝缺少 conversationId 的请求', () => {
      expect(
        validateRequest({
          items: [
            {
              type: 'text',
              text: '无会话',
            },
          ],
        })
      ).toBe(false);
    });

    it('拒绝空 items 数组', () => {
      expect(
        validateRequest({
          conversationId: 'c03',
          items: [],
        })
      ).toBe(false);
    });

    it('拒绝未知 item 类型', () => {
      expect(
        validateRequest({
          conversationId: 'c04',
          items: [
            {
              type: 'audio',
              text: 'unsupported',
            },
          ],
        })
      ).toBe(false);
    });

    it('拒绝缺少 type 字段的消息项', () => {
      expect(
        validateRequest({
          conversationId: 'c05',
          items: [
            {
              text: 'missing type',
            },
          ],
        })
      ).toBe(false);
    });

    it('拒绝包含额外属性的请求', () => {
      expect(
        validateRequest({
          conversationId: 'c06',
          items: [
            {
              type: 'text',
              text: 'hello',
            },
          ],
          priority: 'high',
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

    it('拒绝缺少 accepted 的响应', () => {
      expect(validateResponse({})).toBe(false);
    });

    it('拒绝包含额外字段的响应', () => {
      expect(
        validateResponse({
          accepted: true,
          error: 'invalid',
        })
      ).toBe(false);
    });
  });
});
