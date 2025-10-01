import type { Task, TaskDefinition, TaskMetadata, TaskRetryPolicy, TaskStatus } from '../types.js';
export interface CreateTaskOptions {
    now?: Date;
    idGenerator?: () => string;
    environment?: string;
}
export declare const DEFAULT_TASK_RETRY_POLICY: TaskRetryPolicy;
export declare const DEFAULT_TASK_METADATA: TaskMetadata;
export declare const TASK_STATUS_TRANSITIONS: Array<{
    from: TaskStatus;
    to: TaskStatus[];
}>;
export declare function isValidStatusTransition(from: TaskStatus, to: TaskStatus): boolean;
export declare function createTaskFromDefinition(definition: TaskDefinition, options?: CreateTaskOptions): Task;
