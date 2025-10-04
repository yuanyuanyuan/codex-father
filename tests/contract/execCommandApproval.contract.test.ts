import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../specs/_archived/008-ultrathink-codex-0/contracts/execCommandApproval.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: execCommandApproval', () => {
  describe('Request Validation', () => {
    const validateRequest = ajv.compile(schema.request);

    it('should validate minimal command approval request', () => {
      const request = {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-789',
        command: 'npm test',
        cwd: '/data/codex-father',
      };

      expect(validateRequest(request)).toBe(true);
    });

    it('should validate request including optional reason', () => {
      const request = {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-321',
        command: 'rm -rf build',
        cwd: '/tmp/project',
        reason: 'Retry without sandbox',
      };

      expect(validateRequest(request)).toBe(true);
    });

    it('should reject request missing cwd', () => {
      const request = {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-789',
        command: 'ls',
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request with empty command string', () => {
      const request = {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-789',
        command: '',
        cwd: '/data/codex-father',
      };

      expect(validateRequest(request)).toBe(false);
    });

    it('should reject request containing unknown top-level field', () => {
      const request = {
        conversationId: 'c7b0a1e3-4d5f-6a7b-8c9d-0e1f23456789',
        callId: 'call-789',
        command: 'npm run build',
        cwd: '/data/codex-father',
        timeout: 30,
      };

      expect(validateRequest(request)).toBe(false);
    });
  });

  describe('Response Validation', () => {
    const validateResponse = ajv.compile(schema.response);

    it('should validate allow decision', () => {
      const response = {
        decision: 'allow',
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should validate deny decision with note', () => {
      const response = {
        decision: 'deny',
        note: 'Command escalated due to destructive pattern',
      };

      expect(validateResponse(response)).toBe(true);
    });

    it('should reject response with invalid decision', () => {
      const response = {
        decision: 'escalate',
      };

      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response with unknown property', () => {
      const response = {
        decision: 'allow',
        audit: 'unexpected',
      };

      expect(validateResponse(response)).toBe(false);
    });
  });
});
