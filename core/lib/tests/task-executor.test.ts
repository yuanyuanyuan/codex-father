import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { BasicQueueOperations } from '../queue/basic-operations.js';
import { BasicTaskExecutor, BUILT_IN_TASK_TYPES } from '../queue/basic-executor.js';

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

describe('Task Executor Contract (T014)', () => {
  let queuePath: string;
  let queueOps: BasicQueueOperations;
  let executor: BasicTaskExecutor;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.setSystemTime(new Date('2025-03-01T00:00:00Z'));

    queuePath = mkdtempSync(join(tmpdir(), 'task-executor-'));
    for (const dir of REQUIRED_DIRS) {
      mkdirSync(join(queuePath, dir), { recursive: true });
    }

    queueOps = new BasicQueueOperations({ queuePath });
    executor = new BasicTaskExecutor(queuePath, {
      maxConcurrency: 3,
      resourceDefaults: {
        memory: 64 * 1024 * 1024,
        cpu: 40,
        disk: 10 * 1024 * 1024,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(queuePath, { recursive: true, force: true });
  });

  it('executes tasks, tracks metrics, and reports capabilities', async () => {
    executor.registerTaskHandler('test:metrics', async (payload) => {
      await new Promise((resolve) => setTimeout(resolve, 75));
      return { doubled: payload.value * 2 };
    });

    const { taskId } = await queueOps.enqueueTask({
      type: 'test:metrics',
      priority: 5,
      payload: { value: 21 },
    });

    vi.setSystemTime(new Date('2025-03-01T00:10:00Z'));

    const executionPromise = executor.executeTask(taskId, { timeout: 1000 });
    await vi.advanceTimersByTimeAsync(80);
    const result = await executionPromise;

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ doubled: 42 });
    expect(result.retryCount).toBe(1);

    expect(result.metrics).toBeDefined();
    expect(result.metrics?.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics?.handlerLatencyMs).toBeGreaterThanOrEqual(0);
    expect(result.metrics?.waitTimeMs).toBe(600_000);
    expect(result.metrics?.memoryUsage?.rss).toBeGreaterThan(0);

    const stored = await queueOps.getTask(taskId);
    expect(stored?.status).toBe('completed');
    expect(stored?.result).toEqual({ doubled: 42 });
    expect(new Date(stored?.startedAt ?? 0).getTime()).toBeGreaterThan(
      new Date(stored?.createdAt ?? 0).getTime()
    );
    expect(new Date(stored?.completedAt ?? 0).getTime()).toBeGreaterThanOrEqual(
      new Date(stored?.startedAt ?? 0).getTime()
    );

    const capabilities = executor.getCapabilities();
    expect(capabilities.supportedTypes).toEqual(
      expect.arrayContaining(['test:metrics', ...Object.values(BUILT_IN_TASK_TYPES)])
    );
    expect(capabilities.maxConcurrency).toBe(3);
    expect(capabilities.averageExecutionTime).toBeGreaterThanOrEqual(result.executionTime);
    expect(capabilities.resourceRequirements).toEqual({
      memory: 64 * 1024 * 1024,
      cpu: 40,
      disk: 10 * 1024 * 1024,
    });
  });

  it('records failures with metrics and preserves error details', async () => {
    executor.registerTaskHandler('test:failure', async () => {
      await new Promise((_, reject) => setTimeout(() => reject(new Error('handler exploded')), 50));
    });

    const { taskId } = await queueOps.enqueueTask({
      type: 'test:failure',
      priority: 4,
      payload: {},
      retryPolicy: {
        maxAttempts: 2,
        baseDelay: 100,
        maxDelay: 1000,
        backoffStrategy: 'exponential',
      },
    });

    vi.setSystemTime(new Date('2025-03-01T01:00:00Z'));

    const execution = executor.executeTask(taskId, { timeout: 1000 });
    await vi.advanceTimersByTimeAsync(60);
    const result = await execution;

    expect(result.success).toBe(false);
    expect(result.error).toContain('handler exploded');
    expect(result.metrics?.waitTimeMs).toBe(3_600_000);
    expect(result.metrics?.durationMs).toBeGreaterThanOrEqual(
      result.metrics?.handlerLatencyMs ?? 0
    );

    const stored = await queueOps.getTask(taskId);
    expect(stored?.status).toBe('failed');
    expect(stored?.attempts).toBe(1);
    expect(stored?.lastError).toContain('handler exploded');
  });

  it('enforces execution timeouts and reports failure metrics', async () => {
    executor.registerTaskHandler('test:timeout', async () => {
      return new Promise(() => {});
    });

    const { taskId } = await queueOps.enqueueTask({
      type: 'test:timeout',
      priority: 2,
      payload: {},
    });

    vi.setSystemTime(new Date('2025-03-01T02:00:00Z'));

    const execution = executor.executeTask(taskId, { timeout: 150 });
    await vi.advanceTimersByTimeAsync(200);
    const result = await execution;

    expect(result.success).toBe(false);
    expect(result.error).toContain('timed out');
    expect(result.metrics?.waitTimeMs).toBe(7_200_000);

    const stored = await queueOps.getTask(taskId);
    expect(stored?.status).toBe('failed');
    expect(stored?.error).toContain('timed out');
  });
});
