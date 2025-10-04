import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../specs/_archived/008-ultrathink-codex-0/contracts/loginApiKey.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: loginApiKey', () => {
  describe('Request Validation', () => {
    const validateRequest = ajv.compile(schema.request);

    it('should accept request with non-empty apiKey', () => {
      const request = {
        apiKey: 'sk-example-123',
      };

      expect(validateRequest(request)).toBe(true);
    });

    it('should reject request missing apiKey', () => {
      const request = {};

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request with empty apiKey string', () => {
      const request = {
        apiKey: '',
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request with unknown property', () => {
      const request = {
        apiKey: 'sk-example-123',
        extra: true,
      };

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
        message: 'Invalid API key',
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
        status: 'ok',
      };

      expect(validateResponse(response)).toBe(false);
    });
  });
});
