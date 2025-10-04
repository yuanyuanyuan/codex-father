import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../specs/_archived/008-ultrathink-codex-0/contracts/logoutChatGpt.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: logoutChatGpt', () => {
  describe('Request Validation', () => {
    const validateRequest = ajv.compile(schema.request);

    it('should accept empty logout request', () => {
      const request = {};

      expect(validateRequest(request)).toBe(true);
    });

    it('should reject request with unexpected property', () => {
      const request = {
        reason: 'user_cancelled',
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject non-object request payload', () => {
      const request = null;

      expect(validateRequest(request)).toBe(false);
    });
  });

  describe('Response Validation', () => {
    const validateResponse = ajv.compile(schema.response);

    it('should accept success response without message', () => {
      const response = {
        success: true,
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should accept response with optional message', () => {
      const response = {
        success: false,
        message: 'No active session',
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should reject response missing success flag', () => {
      const response = {
        message: 'Missing success',
      };

      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response with unknown property', () => {
      const response = {
        success: true,
        code: 'unexpected',
      };

      expect(validateResponse(response)).toBe(false);
    });
  });
});
