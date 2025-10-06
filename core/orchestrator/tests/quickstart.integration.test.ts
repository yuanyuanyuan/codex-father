import { describe, expect, it } from 'vitest';

import { validateStreamEvent } from '../../lib/utils/stream-event-validator.js';

describe('Quickstart stream events integration (T009)', () => {
  it('accepts the minimal quickstart event stream', () => {
    const baseTimestamp = Date.parse('2025-10-02T10:00:00Z');
    const orchestrationId = 'orc_quickstart';

    const rawEvents = [
      { event: 'start', seq: 1, data: { totalTasks: 1 } },
      { event: 'task_scheduled', seq: 2, taskId: 't1', data: {} },
      { event: 'task_started', seq: 3, taskId: 't1', data: {} },
      { event: 'tool_use', seq: 4, taskId: 't1', data: { tool: 'apply_patch' } },
      { event: 'task_completed', seq: 5, taskId: 't1', data: { durationMs: 180000 } },
      { event: 'orchestration_completed', seq: 6, data: { successRate: 1 } },
    ] as const;

    const events = rawEvents.map((event, index) => ({
      ...event,
      orchestrationId,
      timestamp: new Date(baseTimestamp + index * 1000).toISOString(),
    }));

    const seqValues: number[] = [];

    for (const streamEvent of events) {
      const result = validateStreamEvent(streamEvent);
      expect(result.valid).toBe(true);
      seqValues.push(streamEvent.seq);
    }

    expect(seqValues).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
