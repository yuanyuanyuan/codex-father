/// <reference types="node" resolution-mode="require"/>
import type { Task } from '../types.js';
export type TaskHandler = (payload: Record<string, any>) => Promise<any> | any;
export interface ExecutionOptions {
    timeout?: number;
    retryCount?: number;
    logExecution?: boolean;
}
export interface ResourceRequirements {
    memory: number;
    cpu: number;
    disk: number;
}
export interface BasicTaskExecutorOptions {
    queuePath?: string;
    maxConcurrency?: number;
    resourceDefaults?: Partial<ResourceRequirements>;
    collectMemoryUsage?: boolean;
}
export interface ExecutionResult {
    success: boolean;
    result?: any;
    error?: string;
    executionTime: number;
    retryCount: number;
    startTime: Date;
    endTime: Date;
    metrics?: ExecutionMetrics;
}
export interface ExecutionMetrics {
    durationMs: number;
    waitTimeMs?: number;
    handlerLatencyMs?: number;
    memoryUsage?: NodeJS.MemoryUsage;
}
export interface TaskExecutorCapabilities {
    supportedTypes: string[];
    maxConcurrency: number;
    averageExecutionTime: number;
    resourceRequirements: ResourceRequirements;
}
export interface ExecutionContext {
    task: Task;
    attempt: number;
    startTime: Date;
    options: ExecutionOptions;
}
export declare const BUILT_IN_TASK_TYPES: {
    readonly SHELL_COMMAND: "shell:command";
    readonly FILE_OPERATION: "file:operation";
    readonly HTTP_REQUEST: "http:request";
    readonly DATA_PROCESSING: "data:processing";
    readonly VALIDATION: "validation:check";
    readonly NOTIFICATION: "notification:send";
};
export declare class BasicTaskExecutor {
    private readonly queueOps;
    private readonly taskHandlers;
    private executionLog;
    private readonly maxLogSize;
    private readonly maxConcurrency;
    private readonly resourceDefaults;
    private readonly collectMemoryUsage;
    constructor(queuePath?: string, options?: BasicTaskExecutorOptions);
    constructor(options?: BasicTaskExecutorOptions);
    registerTaskHandler(taskType: string, handler: TaskHandler): void;
    unregisterTaskHandler(taskType: string): boolean;
    getRegisteredTaskTypes(): string[];
    executeTask(taskId: string, options?: ExecutionOptions): Promise<ExecutionResult>;
    executeNextTask(options?: ExecutionOptions): Promise<ExecutionResult | null>;
    executeTasks(taskIds: string[], options?: ExecutionOptions): Promise<ExecutionResult[]>;
    getExecutionLog(): ExecutionResult[];
    clearExecutionLog(): void;
    getExecutionStats(): {
        totalExecutions: number;
        successCount: number;
        failureCount: number;
        averageExecutionTime: number;
        successRate: number;
    };
    canHandle(taskType: string): boolean;
    getCapabilities(): TaskExecutorCapabilities;
    private executeTaskWithContext;
    private executeWithTimeout;
    private addToExecutionLog;
    private resolveOptions;
    private calculateWaitTime;
    private calculateWaitTimeFromContext;
    private ensureDate;
    private registerBuiltInHandlers;
}
