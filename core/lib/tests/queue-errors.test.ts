import { describe, expect, it } from 'vitest';

import { TaskQueueError, TASK_QUEUE_ERROR_CODES, TaskQueueErrorFactory } from '../queue/errors.js';

describe('Queue Error Contracts (T017)', () => {
  it('provides structured error with code and metadata', () => {
    const error = new TaskQueueError('Queue is full', TASK_QUEUE_ERROR_CODES.QUEUE_FULL, 'job-1', {
      capacity: 10,
      queued: 12,
    });

    expect(error).toBeInstanceOf(TaskQueueError);
    expect(error.name).toBe('TaskQueueError');
    expect(error.message).toBe('Queue is full');
    expect(error.code).toBe(TASK_QUEUE_ERROR_CODES.QUEUE_FULL);
    expect(error.taskId).toBe('job-1');
    expect(error.details).toEqual({ capacity: 10, queued: 12 });
  });

  it('exposes helpers to create common queue errors', () => {
    const notFound = TaskQueueErrorFactory.taskNotFound('missing-id');
    expect(notFound.code).toBe(TASK_QUEUE_ERROR_CODES.TASK_NOT_FOUND);
    expect(notFound.taskId).toBe('missing-id');

    const invalidStatus = TaskQueueErrorFactory.invalidStatus('job-2', 'completed', 'pending');
    expect(invalidStatus.code).toBe(TASK_QUEUE_ERROR_CODES.TASK_INVALID_STATUS);
    expect(invalidStatus.details).toEqual({ currentStatus: 'completed', expected: 'pending' });

    const full = TaskQueueErrorFactory.queueFull({ capacity: 5, queued: 5 });
    expect(full.code).toBe(TASK_QUEUE_ERROR_CODES.QUEUE_FULL);
    expect(full.details).toEqual({ capacity: 5, queued: 5 });

    const corrupted = TaskQueueErrorFactory.corruptedQueue('queue-path', 'missing metadata');
    expect(corrupted.code).toBe(TASK_QUEUE_ERROR_CODES.QUEUE_CORRUPTED);
    expect(corrupted.details).toEqual({ path: 'queue-path', reason: 'missing metadata' });
  });
});
