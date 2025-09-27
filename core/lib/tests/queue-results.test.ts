import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { BasicQueueOperations } from '../queue/basic-operations.js';

const REQUIRED_DIRS = [
  'pending/tasks',
  'pending/metadata',
  'scheduled/tasks',
  'scheduled/metadata',
  'running/tasks',
  'running/metadata',
  'retrying/tasks',
  'retrying/metadata',
  'completed/tasks',
  'completed/metadata',
  'failed/tasks',
  'failed/metadata',
  'timeout/tasks',
  'timeout/metadata',
  'cancelled/tasks',
  'cancelled/metadata',
  'locks',
  'logs',
  'tmp',
];

describe('Queue Operation Results (T011)', () => {
  let queuePath: string;
  let queueOps: BasicQueueOperations;

  beforeEach(() => {
    queuePath = mkdtempSync(join(tmpdir(), 'queue-results-'));
    for (const dir of REQUIRED_DIRS) {
      mkdirSync(join(queuePath, dir), { recursive: true });
    }
    queueOps = new BasicQueueOperations({ queuePath });
  });

  afterEach(() => {
    rmSync(queuePath, { recursive: true, force: true });
  });

  it('returns detailed enqueue result for immediate tasks', async () => {
    const result = await queueOps.enqueueTask({
      type: 'analysis',
      priority: 1,
      payload: { target: 'spec.md' },
    });

    expect(result.taskId).toMatch(/^[0-9a-f-]{36}$/);
    expect(result.queuePosition).toBeGreaterThanOrEqual(1);
    expect(result.scheduledAt).toBeUndefined();
    expect(result.estimatedStartTime).toBeInstanceOf(Date);
  });

  it('cancels running task and reports metadata', async () => {
    const { taskId } = await queueOps.enqueueTask({
      type: 'docs:generate',
      priority: 3,
      payload: {},
    });

    const dequeued = await queueOps.dequeueTask();
    expect(dequeued?.id).toBe(taskId);

    const cancelResult = await queueOps.cancelTask(taskId, 'user_cancelled');

    expect(cancelResult.taskId).toBe(taskId);
    expect(cancelResult.cancelled).toBe(true);
    expect(cancelResult.wasRunning).toBe(true);
    expect(cancelResult.reason).toBe('user_cancelled');
  });

  it('schedules retry for failed task respecting retry policy', async () => {
    const { taskId } = await queueOps.enqueueTask({
      type: 'queue:optimize',
      priority: 2,
      payload: {},
      retryPolicy: {
        maxAttempts: 3,
        baseDelay: 1_000,
        maxDelay: 10_000,
        backoffStrategy: 'exponential',
        retryableErrors: ['E_TEMP']
      },
    });

    const dequeued = await queueOps.dequeueTask();
    expect(dequeued?.id).toBe(taskId);
    await queueOps.updateTaskStatus(taskId, 'failed', undefined, 'E_TEMP');

    const retryResult = await queueOps.retryTask(taskId);

    expect(retryResult.taskId).toBe(taskId);
    expect(retryResult.retryScheduled).toBe(true);
    expect(retryResult.attemptNumber).toBeGreaterThanOrEqual(1);
    expect(retryResult.nextAttemptAt).toBeInstanceOf(Date);
  });
});
