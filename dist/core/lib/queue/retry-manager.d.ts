import type { RetryResult, Task } from '../types.js';
export interface RetryManagerOptions {
    queuePath?: string;
}
export declare class RetryManager {
    private readonly ops;
    constructor(options?: RetryManagerOptions);
    scheduleRetryIfEligible(taskId: string): Promise<RetryResult>;
    sweepFailedAndTimeout(): Promise<{
        checked: number;
        scheduled: number;
    }>;
    nextRetryDelayPreview(task: Task): Promise<number>;
}
