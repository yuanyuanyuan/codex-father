import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import fs from 'node:fs';
import path from 'node:path';
const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '../schemas/applyPatchApproval.schema.json'), 'utf-8'));

const ajv = new Ajv({ strict: false });

describe('MCP Contract: applyPatchApproval', () => {
  describe('Request Validation', () => {
    const requestSchema = schema.request;
    const validateRequest = ajv.compile(requestSchema);

    it('should validate minimal approval request', () => {
      const request = {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-123',
        fileChanges: [
          {
            path: 'src/app.ts',
            type: 'modify',
            diff: '--- old\n+++ new',
          },
        ],
      };

      const isValid = validateRequest(request);
      if (!isValid) {
        console.log('Validation errors:', validateRequest.errors);
      }
      expect(isValid).toBe(true);
    });

    it('should validate request with optional reason and grantRoot', () => {
      const request = {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-456',
        fileChanges: [
          {
            path: '/data/service/config.yml',
            type: 'create',
            diff: '+++ new file',
          },
          {
            path: 'src/index.ts',
            type: 'delete',
            diff: '--- removed file',
            contentPreview: '// content preview',
          },
        ],
        reason: 'Apply Codex generated migration patch',
        grantRoot: true,
      };

      expect(validateRequest(request)).toBe(true);
    });

    it('should reject request without fileChanges', () => {
      const request = {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-123',
        reason: 'Missing changes',
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request with invalid change type', () => {
      const request = {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-123',
        fileChanges: [
          {
            path: 'src/app.ts',
            type: 'rename',
            diff: 'diff content',
          },
        ],
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request containing unknown top-level field', () => {
      const request = {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-123',
        fileChanges: [
          {
            path: 'src/app.ts',
            type: 'modify',
            diff: 'diff content',
          },
        ],
        extra: 'not allowed',
      };

      expect(validateRequest(request)).toBe(false);
    });
  });

  describe('Response Validation', () => {
    const responseSchema = schema.response;
    const validateResponse = ajv.compile(responseSchema);

    it('should validate allow decision', () => {
      const response = {
        decision: 'allow',
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should validate deny decision with note', () => {
      const response = {
        decision: 'deny',
        note: 'Requires manual review before applying',
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should reject invalid decision value', () => {
      const response = {
        decision: 'pending',
      };

      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response with unknown property', () => {
      const response = {
        decision: 'allow',
        auditTrail: 'unexpected',
      };

      expect(validateResponse(response)).toBe(false);
    });
  });
});
