import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QueueEventEmitterImpl } from '../queue/events.js';
import type { QueueEvent, QueueEventData } from '../types.js';

describe('Queue Event Emitter Contract (T016)', () => {
  let emitter: QueueEventEmitterImpl;
  let captured: QueueEventData[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-04-01T10:00:00.000Z'));
    emitter = new QueueEventEmitterImpl();
    captured = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const subscribe = (event: QueueEvent) => {
    const listener = (data: QueueEventData) => {
      captured.push(data);
    };
    emitter.on(event, listener);
    return listener;
  };

  it('dispatches task events with normalized payload', () => {
    subscribe('task_enqueued');

    emitter.emit('task_enqueued', {
      taskId: 'task-123',
      details: { priority: 5 },
    });

    expect(captured).toHaveLength(1);
    const event = captured[0];
    expect(event.event).toBe('task_enqueued');
    expect(event.timestamp).toBeInstanceOf(Date);
    expect(event.timestamp.toISOString()).toBe('2025-04-01T10:00:00.000Z');
    expect(event.taskId).toBe('task-123');
    expect(event.details).toEqual({ priority: 5 });
  });

  it('supports multiple listeners and preserves isolation', () => {
    const first = vi.fn();
    const second = vi.fn();

    emitter.on('task_completed', first);
    emitter.on('task_completed', second);

    emitter.emit('task_completed', { taskId: 'done-1', details: { durationMs: 42 } });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    const payload = first.mock.calls[0][0];
    expect(payload.event).toBe('task_completed');
    expect(payload.details).toEqual({ durationMs: 42 });

    // Ensure emitted payload cannot be mutated by listeners
    payload.details.durationMs = 1000;
    const secondArgs = second.mock.calls[0][0];
    expect(secondArgs.details).toEqual({ durationMs: 42 });
  });

  it('removes listeners via off and handles unknown events gracefully', () => {
    const listener = subscribe('task_failed');

    emitter.emit('task_failed', { taskId: 'job-1', details: {} });
    expect(captured).toHaveLength(1);

    emitter.off('task_failed', listener);
    emitter.emit('task_failed', { taskId: 'job-1', details: { retry: true } });

    expect(captured).toHaveLength(1);

    expect(() => emitter.off('queue_empty', listener)).not.toThrow();
    expect(() => emitter.emit('queue_empty', {})).not.toThrow();
  });
});
