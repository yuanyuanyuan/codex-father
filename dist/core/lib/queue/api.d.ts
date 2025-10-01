import type { EnqueueResult, Task, TaskStatus } from '../types.js';
import { type ExecutionOptions } from './basic-executor.js';
export declare class TaskQueueAPI {
    private readonly ops;
    private readonly executor;
    constructor(queuePath?: string);
    enqueue(def: {
        type: string;
        priority?: number;
        payload?: Record<string, any>;
    }): Promise<EnqueueResult>;
    getTask(id: string): Promise<Task | null>;
    list(status?: TaskStatus): Promise<Task[]>;
    cancel(id: string, reason?: string): Promise<import("../types.js").CancelResult>;
    retry(id: string): Promise<import("../types.js").RetryResult>;
    stats(): Promise<Record<TaskStatus, number>>;
    execute(id: string, options?: ExecutionOptions): Promise<import("./basic-executor.js").ExecutionResult>;
}
