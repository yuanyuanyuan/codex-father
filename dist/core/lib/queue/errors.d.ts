import { TaskQueueError, TASK_QUEUE_ERROR_CODES } from '../types.js';
export { TaskQueueError, TASK_QUEUE_ERROR_CODES };
export declare const TaskQueueErrorFactory: {
    queueFull(details: {
        capacity: number;
        queued: number;
    }): TaskQueueError;
    queueCorrupted(path: string, reason: string): TaskQueueError;
    corruptedQueue(path: string, reason: string): TaskQueueError;
    queueLocked(path: string): TaskQueueError;
    queueNotInitialized(path: string): TaskQueueError;
    taskNotFound(taskId: string): TaskQueueError;
    invalidStatus(taskId: string, currentStatus: string, expected: string): TaskQueueError;
    taskTimeout(taskId: string, timeout: number): TaskQueueError;
    taskCancelled(taskId: string, reason?: string): TaskQueueError;
    retryExhausted(taskId: string, attempts: number): TaskQueueError;
    permissionDenied(path: string): TaskQueueError;
    diskSpaceFull(path: string): TaskQueueError;
    fileCorrupted(path: string, reason: string): TaskQueueError;
    directoryNotFound(path: string): TaskQueueError;
    executorNotFound(name: string): TaskQueueError;
    executorOverloaded(name: string, concurrent: number): TaskQueueError;
    executorFailed(taskId: string, reason?: string): TaskQueueError;
};
