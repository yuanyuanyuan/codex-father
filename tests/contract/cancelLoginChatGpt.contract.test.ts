import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../specs/_archived/008-ultrathink-codex-0/contracts/cancelLoginChatGpt.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: cancelLoginChatGpt', () => {
  describe('Request Validation', () => {
    const validateRequest = ajv.compile(schema.request);

    it('should accept request with loginId', () => {
      const request = {
        loginId: 'f5d1278e-8109-4d3c-a44e-3f2e6080bdc7',
      };

      expect(validateRequest(request)).toBe(true);
    });

    it('should reject request missing loginId', () => {
      const request = {};

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request with non-string loginId', () => {
      const request = {
        loginId: 101,
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request with unknown property', () => {
      const request = {
        loginId: 'f5d1278e-8109-4d3c-a44e-3f2e6080bdc7',
        force: true,
      };

      expect(validateRequest(request)).toBe(false);
    });
  });

  describe('Response Validation', () => {
    const validateResponse = ajv.compile(schema.response);

    it('should accept success response', () => {
      const response = {
        success: true,
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should accept failure response', () => {
      const response = {
        success: false,
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should reject response missing success flag', () => {
      const response = {};

      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response with extra information', () => {
      const response = {
        success: true,
        message: 'Unsupported field',
      };

      expect(validateResponse(response)).toBe(false);
    });
  });
});
