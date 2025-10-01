import type { Task, TaskStatus, TaskDefinition, EnqueueResult, CancelResult, RetryResult } from '../types.js';
export interface QueueConfig {
    queuePath: string;
    lockTimeout: number;
    maxRetries: number;
}
export declare class BasicQueueOperations {
    private config;
    constructor(config?: Partial<QueueConfig>);
    private ensureQueueStructure;
    enqueueTask(definition: TaskDefinition): Promise<EnqueueResult>;
    dequeueTask(): Promise<Task | null>;
    getTask(taskId: string): Promise<Task | null>;
    cancelTask(taskId: string, reason?: string): Promise<CancelResult>;
    retryTask(taskId: string): Promise<RetryResult>;
    updateTaskStatus(taskId: string, newStatus: TaskStatus, result?: any, error?: string, updates?: Partial<Task>): Promise<boolean>;
    private getTaskPath;
    private getMetadataPath;
    private calculateRetryDelay;
    private countTasks;
    getQueueStats(): Promise<Record<TaskStatus, number>>;
    listTasks(status?: TaskStatus): Promise<Task[]>;
}
