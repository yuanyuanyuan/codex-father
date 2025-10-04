import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../specs/008-ultrathink-codex-0/contracts/getAuthStatus.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: getAuthStatus', () => {
  describe('Request Validation', () => {
    const validateRequest = ajv.compile(schema.request);

    it('should accept empty request payload', () => {
      const request = {};

      expect(validateRequest(request)).toBe(true);
    });

    it('should accept request asking for token inclusion', () => {
      const request = {
        includeToken: true,
      };

      expect(validateRequest(request)).toBe(true);
    });

    it('should accept request with includeToken and refreshToken flags', () => {
      const request = {
        includeToken: true,
        refreshToken: false,
      };

      expect(validateRequest(request)).toBe(true);
    });

    it('should reject request with non-boolean flag', () => {
      const request = {
        includeToken: 'yes',
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request with unexpected property', () => {
      const request = {
        includeToken: true,
        verbose: true,
      };

      expect(validateRequest(request)).toBe(false);
    });
  });

  describe('Response Validation', () => {
    const validateResponse = ajv.compile(schema.response);

    it('should accept minimal response with authenticated flag', () => {
      const response = {
        authenticated: false,
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should accept response including optional fields', () => {
      const response = {
        authenticated: true,
        method: 'chatGpt',
        token: 'session-token',
        expiresAt: '2025-10-04T05:15:00Z',
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should reject response missing authenticated flag', () => {
      const response = {
        method: 'apiKey',
      };

      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response with invalid method value', () => {
      const response = {
        authenticated: true,
        method: 'oauth',
      };

      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response with unknown property', () => {
      const response = {
        authenticated: true,
        method: 'apiKey',
        details: {},
      };

      expect(validateResponse(response)).toBe(false);
    });
  });
});
