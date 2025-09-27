import { TaskQueueError, TASK_QUEUE_ERROR_CODES } from '../types.js';

export { TaskQueueError, TASK_QUEUE_ERROR_CODES };

export const TaskQueueErrorFactory = {
  queueFull(details: { capacity: number; queued: number }): TaskQueueError {
    return new TaskQueueError(
      'Task queue is full',
      TASK_QUEUE_ERROR_CODES.QUEUE_FULL,
      undefined,
      details,
    );
  },

  queueCorrupted(path: string, reason: string): TaskQueueError {
    return new TaskQueueError(
      'Task queue storage is corrupted',
      TASK_QUEUE_ERROR_CODES.QUEUE_CORRUPTED,
      undefined,
      { path, reason },
    );
  },

  corruptedQueue(path: string, reason: string): TaskQueueError {
    return this.queueCorrupted(path, reason);
  },

  queueLocked(path: string): TaskQueueError {
    return new TaskQueueError(
      'Task queue is locked',
      TASK_QUEUE_ERROR_CODES.QUEUE_LOCKED,
      undefined,
      { path },
    );
  },

  queueNotInitialized(path: string): TaskQueueError {
    return new TaskQueueError(
      'Task queue is not initialized',
      TASK_QUEUE_ERROR_CODES.QUEUE_NOT_INITIALIZED,
      undefined,
      { path },
    );
  },

  taskNotFound(taskId: string): TaskQueueError {
    return new TaskQueueError(
      `Task ${taskId} not found`,
      TASK_QUEUE_ERROR_CODES.TASK_NOT_FOUND,
      taskId,
      { taskId },
    );
  },

  invalidStatus(taskId: string, currentStatus: string, expected: string): TaskQueueError {
    return new TaskQueueError(
      `Task ${taskId} status ${currentStatus} is invalid`,
      TASK_QUEUE_ERROR_CODES.TASK_INVALID_STATUS,
      taskId,
      { currentStatus, expected },
    );
  },

  taskTimeout(taskId: string, timeout: number): TaskQueueError {
    return new TaskQueueError(
      `Task ${taskId} timed out after ${timeout}ms`,
      TASK_QUEUE_ERROR_CODES.TASK_TIMEOUT,
      taskId,
      { timeout },
    );
  },

  taskCancelled(taskId: string, reason?: string): TaskQueueError {
    return new TaskQueueError(
      `Task ${taskId} was cancelled`,
      TASK_QUEUE_ERROR_CODES.TASK_CANCELLED,
      taskId,
      { reason },
    );
  },

  retryExhausted(taskId: string, attempts: number): TaskQueueError {
    return new TaskQueueError(
      `Task ${taskId} exhausted retries`,
      TASK_QUEUE_ERROR_CODES.TASK_RETRY_EXHAUSTED,
      taskId,
      { attempts },
    );
  },

  permissionDenied(path: string): TaskQueueError {
    return new TaskQueueError(
      'Permission denied accessing queue directory',
      TASK_QUEUE_ERROR_CODES.PERMISSION_DENIED,
      undefined,
      { path },
    );
  },

  diskSpaceFull(path: string): TaskQueueError {
    return new TaskQueueError(
      'Disk space full for queue directory',
      TASK_QUEUE_ERROR_CODES.DISK_SPACE_FULL,
      undefined,
      { path },
    );
  },

  fileCorrupted(path: string, reason: string): TaskQueueError {
    return new TaskQueueError(
      'Queue file is corrupted',
      TASK_QUEUE_ERROR_CODES.FILE_CORRUPTED,
      undefined,
      { path, reason },
    );
  },

  directoryNotFound(path: string): TaskQueueError {
    return new TaskQueueError(
      'Queue directory not found',
      TASK_QUEUE_ERROR_CODES.DIRECTORY_NOT_FOUND,
      undefined,
      { path },
    );
  },

  executorNotFound(name: string): TaskQueueError {
    return new TaskQueueError(
      'Executor not found',
      TASK_QUEUE_ERROR_CODES.EXECUTOR_NOT_FOUND,
      undefined,
      { name },
    );
  },

  executorOverloaded(name: string, concurrent: number): TaskQueueError {
    return new TaskQueueError(
      'Executor is overloaded',
      TASK_QUEUE_ERROR_CODES.EXECUTOR_OVERLOADED,
      undefined,
      { name, concurrent },
    );
  },

  executorFailed(taskId: string, reason?: string): TaskQueueError {
    return new TaskQueueError(
      'Executor failed to execute task',
      TASK_QUEUE_ERROR_CODES.EXECUTOR_FAILED,
      taskId,
      { reason },
    );
  },
};
