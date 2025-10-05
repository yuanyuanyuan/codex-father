import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../specs/__archive/008-ultrathink-codex-0/contracts/archiveConversation.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: archiveConversation', () => {
  describe('Request Validation', () => {
    const validateRequest = ajv.compile(schema.request);

    it('should validate archive request with conversationId', () => {
      const request = {
        conversationId: '92eb5fee-6ae2-4fec-b3ad-71c777531578',
      };

      expect(validateRequest(request)).toBe(true);
    });

    it('should reject request missing conversationId', () => {
      const request = {};

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request with invalid conversationId type', () => {
      const request = {
        conversationId: 10,
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request with unexpected property', () => {
      const request = {
        conversationId: '92eb5fee-6ae2-4fec-b3ad-71c777531578',
        keepLogs: false,
      };

      expect(validateRequest(request)).toBe(false);
    });
  });

  describe('Response Validation', () => {
    const validateResponse = ajv.compile(schema.response);

    it('should validate success response', () => {
      const response = {
        success: true,
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should validate failure response', () => {
      const response = {
        success: false,
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should reject response missing success flag', () => {
      const response = {};

      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response with unexpected property', () => {
      const response = {
        success: true,
        archivedAt: '2025-10-04T04:31:51Z',
      };

      expect(validateResponse(response)).toBe(false);
    });
  });
});
