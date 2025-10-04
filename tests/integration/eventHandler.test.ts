import { describe, it, expect, beforeEach } from 'vitest';
import Ajv from 'ajv';

import schema from '../../specs/008-ultrathink-codex-0/contracts/codex-event.schema.json';

// 被测对象
import {
  parseCodexEvent,
  emitMcpNotification,
  setNotificationSink,
  type CodexEvent,
} from '../../src/mcp/eventHandler';

const ajv = new Ajv({ strict: false });
const notificationSchema = schema.definitions
  ? { ...schema.request, definitions: schema.definitions }
  : (schema as any).request;
const validateCodexEvent = ajv.compile(notificationSchema);

describe('eventHandler', () => {
  beforeEach(() => {
    // 清理 sink，保持测试彼此独立
    setNotificationSink(undefined as any);
  });

  describe('parseCodexEvent()', () => {
    it('应解析 JSON-RPC Notification 形式 (Event)', () => {
      const raw = {
        jsonrpc: '2.0',
        method: 'codex/event',
        params: {
          type: 'agent_message',
          message: 'hello',
          role: 'assistant',
          _meta: { requestId: 'req-123' },
        },
      };

      const parsed = parseCodexEvent(raw);
      expect(parsed.type).toBe('agent_message');
      expect(parsed.message).toBe('hello');
      expect(parsed.role).toBe('assistant');
      expect(parsed._meta?.requestId).toBe('req-123');
      // 契约校验
      expect(validateCodexEvent(parsed)).toBe(true);
    });

    it('应解析事件负载对象形式 (EventMsg)', () => {
      const raw = {
        type: 'exec_approval_request',
        callId: 'c-001',
        command: ['echo', 'hi'],
        cwd: '/workspace',
      };

      const parsed = parseCodexEvent(raw);
      expect(parsed.type).toBe('exec_approval_request');
      expect(parsed.callId).toBe('c-001');
      expect(parsed.cwd).toBe('/workspace');
      // 契约校验
      expect(validateCodexEvent(parsed)).toBe(true);
    });

    it('应对缺少必需字段的事件抛出错误', () => {
      const bad = { type: 'agent_message' } as any; // 缺少 message
      expect(() => parseCodexEvent(bad)).toThrowError(/invalid codex event/i);
    });
  });

  describe('emitMcpNotification()', () => {
    it('应生成并推送 codex/event 通知，包含 _meta.requestId', async () => {
      const event: CodexEvent = {
        type: 'task_complete',
        conversationId: 'conv-001',
        _meta: { requestId: 'req-999' },
      } as any;

      let captured: any = null;
      setNotificationSink((notif) => {
        captured = notif;
      });

      emitMcpNotification(event);

      expect(captured).toBeTruthy();
      expect(captured.method).toBe('codex/event');
      expect(captured.params).toBeDefined();
      expect(captured.params.type).toBe('task_complete');
      expect(captured.params._meta.requestId).toBe('req-999');

      // 契约校验（通知的 params 必须符合 request schema）
      expect(validateCodexEvent(captured.params)).toBe(true);
    });
  });
});
