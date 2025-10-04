import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from './newConversation.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: newConversation', () => {
  describe('Request Validation', () => {
    const validateRequest = ajv.compile(schema.request);

    it('should validate minimal request (no params)', () => {
      const request = {};
      expect(validateRequest(request)).toBe(true);
    });

    it('should validate request with model only', () => {
      const request = { model: 'gpt-5' };
      expect(validateRequest(request)).toBe(true);
    });

    it('should validate complete request with all params (0.44)', () => {
      const request = {
        model: 'gpt-5-codex',
        profile: 'codex-father-auto-fix',
        cwd: '/path/to/workspace',
        approvalPolicy: 'on-request',
        sandbox: 'workspace-write',
        config: {
          model_reasoning_effort: 'medium',
          custom_option: 'value',
        },
        baseInstructions: 'You are a helpful assistant',
        includePlanTool: true,
        includeApplyPatchTool: false,
      };
      expect(validateRequest(request)).toBe(true);
    });

    it('should validate request with 0.42 compatible params', () => {
      const request = {
        model: 'gpt-5',
        cwd: '/workspace',
        approvalPolicy: 'on-failure',
        sandbox: 'read-only',
        config: { model_provider: 'openai' },
      };
      expect(validateRequest(request)).toBe(true);
    });

    it('should reject invalid approvalPolicy', () => {
      const request = { approvalPolicy: 'invalid-policy' };
      expect(validateRequest(request)).toBe(false);
    });

    it('should reject invalid sandbox mode', () => {
      const request = { sandbox: 'super-safe' };
      expect(validateRequest(request)).toBe(false);
    });

    it('should reject invalid model type', () => {
      const request = { model: 123 };
      expect(validateRequest(request)).toBe(false);
    });

    it('should reject invalid config type', () => {
      const request = { config: 'not-an-object' };
      expect(validateRequest(request)).toBe(false);
    });

    it('should reject unknown properties', () => {
      const request = { unknownProp: 'value' };
      expect(validateRequest(request)).toBe(false);
    });
  });

  describe('Response Validation', () => {
    const validateResponse = ajv.compile(schema.response);

    it('should validate minimal response (0.42)', () => {
      const response = {
        conversationId: 'c7b0a1e3-4d5f-6g7h-8i9j-0k1l2m3n4o5p',
        model: 'gpt-5',
        rolloutPath: '/home/user/.codex/sessions/abc123/rollout.jsonl',
      };
      expect(validateResponse(response)).toBe(true);
    });

    it('should validate response with reasoningEffort (0.44)', () => {
      const response = {
        conversationId: 'abc-123',
        model: 'gpt-5-codex',
        reasoningEffort: 'medium',
        rolloutPath: '/path/to/rollout.jsonl',
      };
      expect(validateResponse(response)).toBe(true);
    });

    it('should reject response missing conversationId', () => {
      const response = {
        model: 'gpt-5',
        rolloutPath: '/path/to/rollout.jsonl',
      };
      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response missing model', () => {
      const response = {
        conversationId: 'abc-123',
        rolloutPath: '/path/to/rollout.jsonl',
      };
      expect(validateResponse(response)).toBe(false);
    });

    it('should reject response missing rolloutPath', () => {
      const response = {
        conversationId: 'abc-123',
        model: 'gpt-5',
      };
      expect(validateResponse(response)).toBe(false);
    });

    it('should reject invalid reasoningEffort enum', () => {
      const response = {
        conversationId: 'abc-123',
        model: 'gpt-5-codex',
        reasoningEffort: 'ultra-high',
        rolloutPath: '/path/to/rollout.jsonl',
      };
      expect(validateResponse(response)).toBe(false);
    });

    it('should reject unknown properties', () => {
      const response = {
        conversationId: 'abc-123',
        model: 'gpt-5',
        rolloutPath: '/path/to/rollout.jsonl',
        unknownField: 'value',
      };
      expect(validateResponse(response)).toBe(false);
    });
  });

  describe('Version Compatibility', () => {
    it('should document profile param requires 0.44+', () => {
      expect(schema.versionSpecificParams?.profile?.minVersion).toBe('0.44.0');
    });

    it('should document reasoningEffort response requires 0.44+', () => {
      expect(schema.versionSpecificResponse?.reasoningEffort?.minVersion).toBe('0.44.0');
    });

    it('should have correct incompatible behavior for profile', () => {
      const behavior = schema.versionSpecificParams?.profile?.incompatibleBehavior;
      expect(behavior).toContain("Invalid params: 'profile' requires Codex >= 0.44");
    });
  });
});
