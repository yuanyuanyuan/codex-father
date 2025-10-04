import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../../specs/008-ultrathink-codex-0/contracts/loginChatGptComplete.schema.json';

const ajv = new Ajv({ strict: false });

describe('MCP Contract: loginChatGptComplete', () => {
  describe('Notification Validation', () => {
    const validateNotification = ajv.compile(schema.request);

    it('should accept successful login notification', () => {
      const notification = {
        loginId: '9c1185a5-c5e9-4e6d-b44e-23a9809071fb',
        success: true,
        timestamp: '2025-10-04T05:30:00Z',
      };

      expect(validateNotification(notification)).toBe(true);
    });

    it('should accept failed login notification with error message', () => {
      const notification = {
        loginId: '9c1185a5-c5e9-4e6d-b44e-23a9809071fb',
        success: false,
        error: 'User cancelled consent',
      };

      expect(validateNotification(notification)).toBe(true);
    });

    it('should reject notification missing loginId', () => {
      const notification = {
        success: true,
      };

      expect(validateNotification(notification)).toBe(false);
    });

    it('should reject notification missing success flag', () => {
      const notification = {
        loginId: '9c1185a5-c5e9-4e6d-b44e-23a9809071fb',
      };

      expect(validateNotification(notification)).toBe(false);
    });

    it('should reject notification with unknown property', () => {
      const notification = {
        loginId: '9c1185a5-c5e9-4e6d-b44e-23a9809071fb',
        success: true,
        retry: true,
      };

      expect(validateNotification(notification)).toBe(false);
    });

    it('should reject notification with non-boolean success', () => {
      const notification = {
        loginId: '9c1185a5-c5e9-4e6d-b44e-23a9809071fb',
        success: 'yes',
      };

      expect(validateNotification(notification)).toBe(false);
    });
  });

  describe('Response Validation', () => {
    const validateResponse = ajv.compile(schema.response);

    it('should allow null response for notification', () => {
      expect(validateResponse(null)).toBe(true);
    });

    it('should reject non-null response payload', () => {
      expect(validateResponse({})).toBe(false);
    });
  });
});
