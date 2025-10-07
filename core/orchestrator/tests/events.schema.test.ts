import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateStreamEvent } from '../../lib/utils/stream-event-validator.js';

const schemaPath = resolve(process.cwd(), 'docs/schemas/stream-json-event.schema.json');

describe('Stream event schema contract (T007)', () => {
  it('declares every event type required by the orchestration spec', () => {
    const schemaContent = readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaContent) as {
      properties?: { event?: { enum?: readonly string[] } };
    };

    const allowedEvents = schema.properties?.event?.enum ?? [];

    const expectedEvents = [
      'start',
      'task_scheduled',
      'task_started',
      'tool_use',
      'task_completed',
      'task_failed',
      'task_retry_scheduled',
      'patch_generated',
      'patch_applied',
      'patch_failed',
      'patch_generation_failed',
      'task_execution_summary',
      'quick_validate_passed',
      'concurrency_reduced',
      'concurrency_increased',
      'resource_downscale',
      'resource_restore',
      'resource_exhausted',
      'session_workspace_updated',
      'manual_intervention_requested',
      'understanding_validated',
      'understanding_failed',
      'decomposition_completed',
      'decomposition_failed',
      'cancel_requested',
      'report_written',
      'report_write_failed',
      'orchestration_completed',
      'orchestration_failed',
    ];

    expect(allowedEvents).toEqual(expectedEvents);
  });

  it('accepts contract-compliant events from the quickstart scenario', () => {
    const base = {
      timestamp: '2025-10-02T10:00:00Z',
      orchestrationId: 'orc_contract',
    } as const;

    const events = [
      {
        event: 'start',
        seq: 1,
        data: { totalTasks: 3 },
      },
      {
        event: 'task_scheduled',
        seq: 2,
        taskId: 't1',
        data: { dependencies: [] },
      },
      {
        event: 'task_started',
        seq: 3,
        taskId: 't1',
        role: 'developer',
        data: { role: 'developer' },
      },
      {
        event: 'tool_use',
        seq: 4,
        taskId: 't1',
        role: 'developer',
        data: { tool: 'apply_patch', argsSummary: '+10/-2 core/index.ts' },
      },
      {
        event: 'task_completed',
        seq: 5,
        taskId: 't1',
        role: 'developer',
        data: { durationMs: 120000, outputsCount: 1 },
      },
      {
        event: 'task_failed',
        seq: 6,
        taskId: 't2',
        role: 'developer',
        data: { reason: 'timeout', errorType: 'TIMEOUT' },
      },
      {
        event: 'patch_applied',
        seq: 7,
        taskId: 't1',
        role: 'developer',
        data: { patchId: 'patch_1', targetFiles: ['src/a.ts'], sequence: 1 },
      },
      {
        event: 'patch_failed',
        seq: 8,
        taskId: 't2',
        role: 'developer',
        data: { patchId: 'patch_2', reason: 'apply_conflict', errorType: 'PATCH_CONFLICT' },
      },
      {
        event: 'concurrency_reduced',
        seq: 9,
        data: { from: 10, to: 9, reason: 'high_cpu' },
      },
      {
        event: 'concurrency_increased',
        seq: 10,
        data: { from: 9, to: 10, reason: 'recovered' },
      },
      {
        event: 'resource_downscale',
        seq: 11,
        data: { from: 10, to: 9, reason: 'cpu_high', snapshotTs: '2025-10-02T10:10:01Z' },
      },
      {
        event: 'resource_restore',
        seq: 12,
        data: { from: 9, to: 10, reason: 'cpu_normalized', snapshotTs: '2025-10-02T10:12:00Z' },
      },
      {
        event: 'resource_exhausted',
        seq: 13,
        data: { reason: 'memory', action: 'reject_new_tasks' },
      },
      {
        event: 'cancel_requested',
        seq: 14,
        data: { reason: 'user_interrupt' },
      },
      {
        event: 'orchestration_completed',
        seq: 15,
        data: { successRate: 1, totalDurationMs: 600000 },
      },
      {
        event: 'orchestration_failed',
        seq: 16,
        data: { reason: 'threshold_not_met' },
      },
    ].map((event) => ({ ...base, ...event }));

    for (const event of events) {
      const result = validateStreamEvent(event);
      expect(result.valid).toBe(true);
    }
  });
});
