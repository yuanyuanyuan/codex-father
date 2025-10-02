import { describe, expect, it } from 'vitest';

import {
  createTaskFromDefinition,
  DEFAULT_TASK_RETRY_POLICY,
  DEFAULT_TASK_METADATA,
  isValidStatusTransition,
  TASK_STATUS_TRANSITIONS,
} from '../queue/task-definition.js';
import type { TaskDefinition, TaskMetadata, TaskRetryPolicy, TaskStatus } from '../types.js';

describe('Task Definition Contract (T010)', () => {
  it('creates task from definition with sensible defaults and derived metadata', () => {
    const definition: TaskDefinition = {
      type: 'docs:sync',
      priority: 5,
      payload: { target: 'README.md' },
    };

    const now = new Date('2025-09-27T12:00:00Z');
    const task = createTaskFromDefinition(definition, {
      now,
      idGenerator: () => 'task-fixed-id',
    });

    expect(task.id).toBe('task-fixed-id');
    expect(task.type).toBe(definition.type);
    expect(task.priority).toBe(definition.priority);
    expect(task.payload).toEqual(definition.payload);
    expect(task.status).toBe('pending');
    expect(task.createdAt).toEqual(now);
    expect(task.updatedAt).toEqual(now);
    expect(task.scheduledAt).toBeUndefined();
    expect(task.attempts).toBe(0);
    expect(task.maxAttempts).toBe(DEFAULT_TASK_RETRY_POLICY.maxAttempts);
    expect(task.retryPolicy).toEqual(DEFAULT_TASK_RETRY_POLICY);

    expect(task.metadata).toMatchObject({
      ...DEFAULT_TASK_METADATA,
      tags: [],
    });
    expect(Array.isArray(task.metadata.tags)).toBe(true);
    expect(task.timeout).toBeGreaterThan(0);
  });

  it('respects scheduled tasks, metadata overrides, and retry options', () => {
    const scheduledAt = new Date('2025-09-28T00:00:00Z');
    const definition: TaskDefinition = {
      type: 'queue:optimize',
      priority: 2,
      payload: { window: 'nightly' },
      scheduledAt,
      retryPolicy: {
        maxAttempts: 5,
        baseDelay: 2_000,
        maxDelay: 30_000,
        backoffStrategy: 'exponential',
        retryableErrors: ['E_CONN_RESET'],
      },
      metadata: {
        ...DEFAULT_TASK_METADATA,
        source: 'scheduler',
        tags: ['nightly', 'maintenance'],
      },
      timeout: 45_000,
    };

    const task = createTaskFromDefinition(definition, {
      idGenerator: () => 'scheduled-id',
      now: new Date('2025-09-27T00:00:00Z'),
    });

    expect(task.id).toBe('scheduled-id');
    expect(task.status).toBe('scheduled');
    expect(task.scheduledAt).toEqual(scheduledAt);
    expect(task.retryPolicy).toEqual(definition.retryPolicy);
    expect(task.maxAttempts).toBe(definition.retryPolicy?.maxAttempts);
    expect(task.metadata.source).toBe('scheduler');
    expect(task.metadata.tags).toEqual(['nightly', 'maintenance']);
    expect(task.timeout).toBe(45_000);
  });

  it('marks overdue scheduled tasks as pending when now is not provided', () => {
    const pastScheduledAt = new Date(Date.now() - 60_000);
    const definition: TaskDefinition = {
      type: 'cleanup',
      priority: 1,
      payload: {},
      scheduledAt: pastScheduledAt,
    };

    const task = createTaskFromDefinition(definition, { idGenerator: () => 'overdue-id' });

    expect(task.status).toBe('pending');
    expect(task.scheduledAt).toEqual(pastScheduledAt);
  });

  it('enforces allowed task status transitions', () => {
    const allowed: Array<[TaskStatus, TaskStatus]> = [
      ['pending', 'processing'],
      ['processing', 'completed'],
      ['processing', 'failed'],
      ['processing', 'timeout'],
      ['retrying', 'processing'],
      ['scheduled', 'pending'],
    ];

    for (const [from, to] of allowed) {
      expect(isValidStatusTransition(from, to)).toBe(true);
    }

    const disallowed: Array<[TaskStatus, TaskStatus]> = [
      ['completed', 'pending'],
      ['failed', 'processing'],
      ['cancelled', 'retrying'],
      ['timeout', 'processing'],
    ];

    for (const [from, to] of disallowed) {
      expect(isValidStatusTransition(from, to)).toBe(false);
    }

    // ensure transition map includes every status from definition
    const allStatuses = new Set<TaskStatus>();
    TASK_STATUS_TRANSITIONS.forEach((entry) => {
      allStatuses.add(entry.from);
      entry.to.forEach((status) => allStatuses.add(status));
    });

    expect(allStatuses.has('pending')).toBe(true);
    expect(allStatuses.has('scheduled')).toBe(true);
    expect(allStatuses.has('retrying')).toBe(true);
    expect(allStatuses.has('timeout')).toBe(true);
  });
});
