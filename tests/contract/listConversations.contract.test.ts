import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../schemas/listConversations.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: listConversations', () => {
  const requestSchema = schema.definitions
    ? { ...schema.request, definitions: schema.definitions }
    : schema.request;
  const responseSchema = schema.definitions
    ? { ...schema.response, definitions: schema.definitions }
    : schema.response;

  describe('Request Validation', () => {
    const validateRequest = ajv.compile(requestSchema);

    it('should accept empty filter request', () => {
      const request = {};

      expect(validateRequest(request)).toBe(true);
    });

    it('should accept request filtering by status', () => {
      const request = {
        status: 'active',
      };

      expect(validateRequest(request)).toBe(true);
    });

    it('should accept request filtering by model and status', () => {
      const request = {
        status: 'paused',
        model: 'gpt-5-codex',
      };

      expect(validateRequest(request)).toBe(true);
    });

    it('should reject request with invalid status value', () => {
      const request = {
        status: 'unknown',
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request with unexpected property', () => {
      const request = {
        includeArchived: true,
      };

      expect(validateRequest(request)).toBe(false);
    });
  });

  describe('Response Validation', () => {
    const validateResponse = ajv.compile(responseSchema);

    it('should validate response with empty conversation list', () => {
      const response = {
        conversations: [],
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should validate response with populated conversations', () => {
      const response = {
        conversations: [
          {
            id: '6f5902ac-03c9-4e30-9953-b6d5c8dcf8a7',
            model: 'gpt-5',
            createdAt: '2025-10-04T04:31:51Z',
            status: 'active',
            title: 'Bug triage session',
          },
          {
            id: 'a02f3e77-df12-4d08-991d-9b2a6c49d6a3',
            model: 'o3',
            createdAt: '2025-09-30T12:00:00Z',
            status: 'archived',
          },
        ],
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should reject response missing required conversations field', () => {
      const response = {};

      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response with invalid conversation entry', () => {
      const response = {
        conversations: [
          {
            id: '6f5902ac-03c9-4e30-9953-b6d5c8dcf8a7',
            model: 'gpt-5',
            createdAt: '2025-10-04T04:31:51Z',
          },
        ],
      };

      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response containing unknown top-level property', () => {
      const response = {
        conversations: [],
        nextPageToken: 'abc',
      };

      expect(validateResponse(response)).toBe(false);
    });
  });
});
