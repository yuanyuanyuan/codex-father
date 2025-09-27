import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { BasicQueueOperations } from '../queue/basic-operations.js';
import { TaskStatusQuery } from '../queue/status-query.js';

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

describe('Task Filter Contract (T012)', () => {
  let queuePath: string;
  let queueOps: BasicQueueOperations;
  let statusQuery: TaskStatusQuery;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));

    queuePath = mkdtempSync(join(tmpdir(), 'queue-filter-'));
    for (const dir of REQUIRED_DIRS) {
      mkdirSync(join(queuePath, dir), { recursive: true });
    }

    queueOps = new BasicQueueOperations({ queuePath });
    statusQuery = new TaskStatusQuery(queuePath);
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(queuePath, { recursive: true, force: true });
  });

  it('filters tasks by status and type', async () => {
    const { taskId: pendingId } = await queueOps.enqueueTask({
      type: 'docs:sync',
      priority: 2,
      payload: {},
    });

    const { taskId: completedId } = await queueOps.enqueueTask({
      type: 'build:artifacts',
      priority: 3,
      payload: {},
    });
    await queueOps.updateTaskStatus(completedId, 'completed', { summary: 'done' });

    const result = await statusQuery.queryTasks({
      status: ['completed'],
      type: ['build:artifacts'],
    });

    expect(result.total).toBe(1);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].id).toBe(completedId);
    expect(result.tasks[0].status).toBe('completed');

    const pendingOnly = await statusQuery.queryTasks({ status: ['pending'] });
    expect(pendingOnly.tasks.map(task => task.id)).toContain(pendingId);
    expect(pendingOnly.tasks.every(task => task.status === 'pending')).toBe(true);
  });

  it('filters tasks within a priority range', async () => {
    const { taskId: lowPriority } = await queueOps.enqueueTask({ type: 'queue:low', priority: 1, payload: {} });
    const { taskId: midPriority } = await queueOps.enqueueTask({ type: 'queue:mid', priority: 5, payload: {} });
    const { taskId: highPriority } = await queueOps.enqueueTask({ type: 'queue:high', priority: 9, payload: {} });

    const result = await statusQuery.queryTasks({
      priority: { min: 3, max: 7 },
    });

    const ids = result.tasks.map(task => task.id);
    expect(ids).toContain(midPriority);
    expect(ids).not.toContain(lowPriority);
    expect(ids).not.toContain(highPriority);
  });

  it('filters tasks by creation timestamps', async () => {
    const { taskId: earlyTask } = await queueOps.enqueueTask({ type: 'timeline:early', priority: 2, payload: {} });

    vi.setSystemTime(new Date('2025-01-01T04:00:00Z'));
    const cutoff = new Date('2025-01-01T02:00:00Z');

    const { taskId: lateTask } = await queueOps.enqueueTask({ type: 'timeline:late', priority: 4, payload: {} });

    const filtered = await statusQuery.queryTasks({ createdAfter: cutoff });
    const ids = filtered.tasks.map(task => task.id);

    expect(ids).toContain(lateTask);
    expect(ids).not.toContain(earlyTask);
  });
});
