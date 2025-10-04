import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../specs/_archived/008-ultrathink-codex-0/contracts/interruptConversation.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: interruptConversation', () => {
  describe('Request Validation', () => {
    const validateRequest = ajv.compile(schema.request);

    it('should validate minimal interrupt request', () => {
      const request = {
        conversationId: 'd3b07384-d9a0-4f11-8735-7e0f0343a5ad',
      };

      expect(validateRequest(request)).toBe(true);
    });

    it('should reject request missing conversationId', () => {
      const request = {};

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request with invalid conversationId type', () => {
      const request = {
        conversationId: 42,
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request with extra top-level field', () => {
      const request = {
        conversationId: 'd3b07384-d9a0-4f11-8735-7e0f0343a5ad',
        force: true,
      };

      expect(validateRequest(request)).toBe(false);
    });
  });

  describe('Response Validation', () => {
    const validateResponse = ajv.compile(schema.response);

    it('should validate success response without message', () => {
      const response = {
        success: true,
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should validate response with optional message', () => {
      const response = {
        success: false,
        message: 'Conversation already finished',
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should reject response missing success flag', () => {
      const response = {
        message: 'Missing success field',
      };

      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response with unknown property', () => {
      const response = {
        success: true,
        info: 'unexpected',
      };

      expect(validateResponse(response)).toBe(false);
    });
  });
});
