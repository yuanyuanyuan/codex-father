import { type ExecutionOptions } from './basic-executor.js';
export interface SchedulerOptions {
    queuePath?: string;
    intervalMs?: number;
    maxConcurrent?: number;
    execution?: ExecutionOptions;
}
export declare class TaskScheduler {
    private readonly ops;
    private readonly executor;
    private readonly intervalMs;
    private readonly maxConcurrent;
    private timer;
    private running;
    constructor(options?: SchedulerOptions);
    start(): void;
    stop(): void;
    tick(): Promise<void>;
    private consumeDueRetrying;
    private run;
}
