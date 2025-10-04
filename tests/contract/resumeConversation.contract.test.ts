import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../specs/008-ultrathink-codex-0/contracts/resumeConversation.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: resumeConversation', () => {
  describe('Request Validation', () => {
    const validateRequest = ajv.compile(schema.request);

    it('should validate resume request with conversationId', () => {
      const request = {
        conversationId: '0cc175b9-c0f1-49e3-9a78-7e52e2c6f861',
      };

      expect(validateRequest(request)).toBe(true);
    });

    it('should reject request missing conversationId', () => {
      const request = {};

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request with invalid conversationId type', () => {
      const request = {
        conversationId: ['invalid'],
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request containing unexpected property', () => {
      const request = {
        conversationId: '0cc175b9-c0f1-49e3-9a78-7e52e2c6f861',
        resumeFromStep: 3,
      };

      expect(validateRequest(request)).toBe(false);
    });
  });

  describe('Response Validation', () => {
    const validateResponse = ajv.compile(schema.response);

    it('should validate success response including conversationId', () => {
      const response = {
        success: true,
        conversationId: '0cc175b9-c0f1-49e3-9a78-7e52e2c6f861',
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should validate failure response without conversationId', () => {
      const response = {
        success: false,
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should reject response missing success flag', () => {
      const response = {
        conversationId: '0cc175b9-c0f1-49e3-9a78-7e52e2c6f861',
      };

      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response with invalid conversationId type', () => {
      const response = {
        success: true,
        conversationId: 123,
      };

      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response with unknown property', () => {
      const response = {
        success: true,
        conversationId: '0cc175b9-c0f1-49e3-9a78-7e52e2c6f861',
        note: 'unexpected',
      };

      expect(validateResponse(response)).toBe(false);
    });
  });
});
