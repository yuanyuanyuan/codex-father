import { describe, it, expect } from 'vitest';

import type { ValidationError } from '../types.js';
import {
  validateStreamEvent,
  type StreamJsonEvent,
  type StreamEventValidationResult,
} from '../utils/stream-event-validator.js';

function collectErrorCodes(errors: ValidationError[]): string[] {
  return errors.map((error) => error.code);
}

describe('validateStreamEvent', () => {
  it('应接受符合 schema 的有效事件', () => {
    const event: StreamJsonEvent = {
      event: 'task_started',
      timestamp: '2025-10-03T12:00:00Z',
      orchestrationId: 'orc-123',
      seq: 2,
      taskId: 'task-42',
      role: 'planner',
      agentId: 'agent-alpha',
      data: { message: '开始执行任务' },
    };

    const result = validateStreamEvent(event) as StreamEventValidationResult & {
      valid: true;
      event: StreamJsonEvent;
    };

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.event).toEqual(event);
  });

  it('应拒绝缺少必填字段的事件', () => {
    const result = validateStreamEvent({
      event: 'start',
      timestamp: '2025-10-03T12:00:00Z',
      seq: 1,
      data: {},
    });

    expect(result.valid).toBe(false);
    expect(collectErrorCodes(result.errors)).toContain('STREAM_EVENT_REQUIRED');
    expect(result.errors.some((error) => error.field === 'orchestrationId')).toBe(true);
  });

  it('应拒绝未在枚举中的事件类型', () => {
    const result = validateStreamEvent({
      event: 'unknown',
      timestamp: '2025-10-03T12:00:00Z',
      orchestrationId: 'orc-1',
      seq: 1,
      data: {},
    });

    expect(result.valid).toBe(false);
    expect(collectErrorCodes(result.errors)).toContain('STREAM_EVENT_INVALID_EVENT');
  });

  it('应拒绝非 RFC3339 时间戳', () => {
    const result = validateStreamEvent({
      event: 'start',
      timestamp: 'not-a-date',
      orchestrationId: 'orc-1',
      seq: 1,
      data: {},
    });

    expect(result.valid).toBe(false);
    expect(collectErrorCodes(result.errors)).toContain('STREAM_EVENT_INVALID_TIMESTAMP');
  });

  it('应拒绝非整数或负数的 seq', () => {
    const nonInteger = validateStreamEvent({
      event: 'start',
      timestamp: '2025-10-03T12:00:00Z',
      orchestrationId: 'orc-1',
      seq: 1.5,
      data: {},
    });

    expect(nonInteger.valid).toBe(false);
    expect(collectErrorCodes(nonInteger.errors)).toContain('STREAM_EVENT_INVALID_SEQ');

    const negative = validateStreamEvent({
      event: 'start',
      timestamp: '2025-10-03T12:00:00Z',
      orchestrationId: 'orc-1',
      seq: -1,
      data: {},
    });

    expect(negative.valid).toBe(false);
    expect(collectErrorCodes(negative.errors)).toContain('STREAM_EVENT_INVALID_SEQ');
  });

  it('应拒绝非对象的数据字段', () => {
    const result = validateStreamEvent({
      event: 'start',
      timestamp: '2025-10-03T12:00:00Z',
      orchestrationId: 'orc-1',
      seq: 1,
      data: null,
    });

    expect(result.valid).toBe(false);
    expect(collectErrorCodes(result.errors)).toContain('STREAM_EVENT_INVALID_DATA');
  });

  it('应拒绝包含未声明属性的事件', () => {
    const result = validateStreamEvent({
      event: 'start',
      timestamp: '2025-10-03T12:00:00Z',
      orchestrationId: 'orc-1',
      seq: 1,
      data: {},
      extra: 'nope',
    });

    expect(result.valid).toBe(false);
    expect(collectErrorCodes(result.errors)).toContain('STREAM_EVENT_UNKNOWN_PROPERTY');
  });

  it('应在可选字段存在但类型不正确时返回错误', () => {
    const result = validateStreamEvent({
      event: 'start',
      timestamp: '2025-10-03T12:00:00Z',
      orchestrationId: 'orc-1',
      seq: 1,
      data: {},
      taskId: 123,
    });

    expect(result.valid).toBe(false);
    expect(collectErrorCodes(result.errors)).toContain('STREAM_EVENT_INVALID_TYPE');
    expect(result.errors.some((error) => error.field === 'taskId')).toBe(true);
  });
});
