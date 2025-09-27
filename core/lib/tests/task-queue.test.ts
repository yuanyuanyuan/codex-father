import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { BasicQueueOperations } from '../queue/basic-operations.js';
import type { Task } from '../types.js';

const REQUIRED_DIRS = [
  'pending/tasks',
  'pending/metadata',
  'running/tasks',
  'running/metadata',
  'completed/tasks',
  'completed/metadata',
  'failed/tasks',
  'failed/metadata',
  'cancelled/tasks',
  'cancelled/metadata',
  'locks',
  'logs',
  'tmp',
];

describe('Task Queue Core Operations (T009)', () => {
  let queuePath: string;
  let queueOps: BasicQueueOperations;

  beforeEach(() => {
    queuePath = mkdtempSync(join(tmpdir(), 'queue-test-'));
    for (const dir of REQUIRED_DIRS) {
      mkdirSync(join(queuePath, dir), { recursive: true });
    }
    queueOps = new BasicQueueOperations({ queuePath });
  });

  afterEach(() => {
    rmSync(queuePath, { recursive: true, force: true });
  });

  it('enqueues tasks with metadata written to pending queue', async () => {
    const taskId = await queueOps.enqueueTask({
      type: 'analysis',
      payload: { file: 'docs.md' },
      priority: 2,
    });

    const taskFile = join(queuePath, 'pending/tasks', `${taskId}.json`);
    const metadataFile = join(queuePath, 'pending/metadata', `${taskId}.json`);

    expect(existsSync(taskFile)).toBe(true);
    expect(existsSync(metadataFile)).toBe(true);

    const task: Task = JSON.parse(readFileSync(taskFile, 'utf8'));
    expect(task).toMatchObject({ id: taskId, type: 'analysis', status: 'pending' });
    expect(task.payload).toEqual({ file: 'docs.md' });

    const metadata = JSON.parse(readFileSync(metadataFile, 'utf8'));
    expect(metadata).toMatchObject({ taskId, priority: 2, retryCount: 0 });
  });

  it('dequeues next pending task and transitions to processing state', async () => {
    const firstId = await queueOps.enqueueTask({ type: 'task-a', payload: {} });
    const secondId = await queueOps.enqueueTask({ type: 'task-b', payload: {} });

    const dequeued = await queueOps.dequeueTask();
    expect(dequeued?.id).toBeDefined();
    expect([firstId, secondId]).toContain(dequeued?.id ?? '');

    const runningTask = await queueOps.getTask(dequeued!.id);
    expect(runningTask?.status).toBe('processing');
    const runningPath = join(queuePath, 'running/tasks', `${dequeued!.id}.json`);
    expect(existsSync(runningPath)).toBe(true);
  });

  it('updates task status to completed with result payload', async () => {
    const taskId = await queueOps.enqueueTask({ type: 'report', payload: { range: 'phase1' } });

    await queueOps.updateTaskStatus(taskId, 'completed', { summary: 'ok' });

    const completedTask = await queueOps.getTask(taskId);
    expect(completedTask?.status).toBe('completed');
    expect(completedTask?.result).toEqual({ summary: 'ok' });

    const completedFile = join(queuePath, 'completed/tasks', `${taskId}.json`);
    expect(existsSync(completedFile)).toBe(true);
  });

  it('returns null when attempting to dequeue from an empty queue', async () => {
    const result = await queueOps.dequeueTask();
    expect(result).toBeNull();
  });

  it('returns false when updating status of unknown task', async () => {
    const updated = await queueOps.updateTaskStatus('missing-id', 'failed', undefined, 'not found');
    expect(updated).toBe(false);
  });
});
