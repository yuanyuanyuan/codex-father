import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { BasicQueueOperations } from '../queue/basic-operations.js';
import { QueueStatisticsCollector } from '../queue/statistics.js';

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

describe('Queue Statistics (T013)', () => {
  let queuePath: string;
  let queueOps: BasicQueueOperations;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    queuePath = mkdtempSync(join(tmpdir(), 'queue-stats-'));
    for (const dir of REQUIRED_DIRS) {
      mkdirSync(join(queuePath, dir), { recursive: true });
    }

    queueOps = new BasicQueueOperations({ queuePath });
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(queuePath, { recursive: true, force: true });
  });

  it('collects detailed queue statistics including performance and storage metrics', async () => {
    const enqueueTask = async (
      type: string,
      priority: number,
      payload: Record<string, any>,
      scheduledAt?: Date
    ) => {
      return queueOps.enqueueTask({ type, priority, payload, scheduledAt });
    };

    const pending = await enqueueTask('docs:pending', 2, {});

    const scheduledAt = new Date('2025-01-01T02:00:00Z');
    const scheduled = await enqueueTask('docs:scheduled', 3, {}, scheduledAt);

    vi.setSystemTime(new Date('2025-01-01T00:10:00Z'));
    const processing = await enqueueTask('queue:processing', 4, {});
    await queueOps.updateTaskStatus(processing.taskId, 'processing', undefined, undefined, {
      startedAt: new Date('2025-01-01T00:12:00Z'),
    });

    vi.setSystemTime(new Date('2025-01-01T00:20:00Z'));
    const retrying = await enqueueTask('queue:retry', 5, {});
    await queueOps.updateTaskStatus(retrying.taskId, 'retrying', undefined, undefined, {
      scheduledAt: new Date('2025-01-01T00:50:00Z'),
    });

    vi.setSystemTime(new Date('2025-01-01T00:30:00Z'));
    const completedA = await enqueueTask('queue:completed', 6, { tag: 'A' });
    await queueOps.updateTaskStatus(completedA.taskId, 'processing', undefined, undefined, {
      startedAt: new Date('2025-01-01T00:35:00Z'),
    });
    await queueOps.updateTaskStatus(completedA.taskId, 'completed', { summary: 'ok' }, undefined, {
      completedAt: new Date('2025-01-01T00:40:00Z'),
    });

    vi.setSystemTime(new Date('2025-01-01T00:45:00Z'));
    const completedB = await enqueueTask('queue:completed', 7, { tag: 'B' });
    await queueOps.updateTaskStatus(completedB.taskId, 'processing', undefined, undefined, {
      startedAt: new Date('2025-01-01T00:50:00Z'),
    });
    await queueOps.updateTaskStatus(completedB.taskId, 'completed', { summary: 'ok' }, undefined, {
      completedAt: new Date('2025-01-01T01:40:00Z'),
    });

    vi.setSystemTime(new Date('2025-01-01T01:00:00Z'));
    const failed = await enqueueTask('queue:failed', 8, {});
    await queueOps.updateTaskStatus(failed.taskId, 'processing', undefined, undefined, {
      startedAt: new Date('2025-01-01T01:05:00Z'),
    });
    await queueOps.updateTaskStatus(failed.taskId, 'failed', undefined, 'E_FAIL', {
      completedAt: new Date('2025-01-01T01:15:00Z'),
    });

    const collector = new QueueStatisticsCollector(queuePath, { maxConcurrent: 3 });
    const stats = await collector.collect();

    expect(stats.totalTasks).toBe(7);
    expect(stats.tasksByStatus.pending).toBe(1);
    expect(stats.tasksByStatus.scheduled).toBe(1);
    expect(stats.tasksByStatus.processing).toBe(1);
    expect(stats.tasksByStatus.retrying).toBe(1);
    expect(stats.tasksByStatus.completed).toBe(2);
    expect(stats.tasksByStatus.failed).toBe(1);

    expect(stats.tasksByType['queue:completed']).toBe(2);
    expect(stats.tasksByPriority[6]).toBe(1);
    expect(stats.queueDepth).toBe(3);

    expect(stats.processingCapacity.maxConcurrent).toBe(3);
    expect(stats.processingCapacity.currentlyProcessing).toBe(1);
    expect(stats.processingCapacity.availableSlots).toBe(2);

    expect(stats.averageProcessingTime).toBe(1_650_000);
    expect(stats.performance.throughputPerHour).toBeCloseTo(2, 2);
    expect(stats.performance.averageWaitTime).toBe(255_000);
    expect(stats.performance.successRate).toBeCloseTo(2 / 3, 5);
    expect(stats.performance.retryRate).toBeCloseTo(1 / 7, 5);

    expect(stats.storage.fileCount).toBeGreaterThan(0);
    expect(stats.storage.diskUsage).toBeGreaterThan(0);
    expect(stats.storage.oldestTask?.toISOString()).toBe(new Date('2025-01-01T00:00:00.000Z').toISOString());
    expect(stats.storage.newestTask?.toISOString()).toBe(new Date('2025-01-01T01:00:00.000Z').toISOString());
  });
});
