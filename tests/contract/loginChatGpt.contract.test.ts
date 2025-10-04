import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../specs/008-ultrathink-codex-0/contracts/loginChatGpt.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: loginChatGpt', () => {
  describe('Request Validation', () => {
    const validateRequest = ajv.compile(schema.request);

    it('should accept empty request payload', () => {
      const request = {};

      expect(validateRequest(request)).toBe(true);
    });

    it('should accept request with optional metadata', () => {
      const request = {
        prompt: 'Continue login flow',
      };

      expect(validateRequest(request)).toBe(true);
    });

    it('should reject non-object request payload', () => {
      const request = 'invalid';

      expect(validateRequest(request)).toBe(false);
    });
  });

  describe('Response Validation', () => {
    const validateResponse = ajv.compile(schema.response);

    it('should accept minimal response with loginId and authUrl', () => {
      const response = {
        loginId: '1a79a4d6-60f5-4d3e-8f08-4bf2d780d0c5',
        authUrl: 'https://auth.example.com/oauth',
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should accept response with optional expiresAt', () => {
      const response = {
        loginId: '1a79a4d6-60f5-4d3e-8f08-4bf2d780d0c5',
        authUrl: 'https://auth.example.com/oauth',
        expiresAt: '2025-10-04T05:00:00Z',
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should reject response missing loginId', () => {
      const response = {
        authUrl: 'https://auth.example.com/oauth',
      };

      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response missing authUrl', () => {
      const response = {
        loginId: '1a79a4d6-60f5-4d3e-8f08-4bf2d780d0c5',
      };

      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response with unexpected property', () => {
      const response = {
        loginId: '1a79a4d6-60f5-4d3e-8f08-4bf2d780d0c5',
        authUrl: 'https://auth.example.com/oauth',
        state: 'pending',
      };

      expect(validateResponse(response)).toBe(false);
    });
  });
});
