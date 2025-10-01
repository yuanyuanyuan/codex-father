export type DMTaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'retrying' | 'cancelled';
export interface RetryPolicy {
    maxAttempts: number;
    baseDelay: number;
    backoffStrategy: 'linear' | 'exponential' | 'fixed';
    maxDelay: number;
}
export interface PriorityLevel {
    name: string;
    value: number;
}
export interface MonitoringConfig {
    enabled: boolean;
    sampleRate?: number;
}
export interface DMTask {
    id: string;
    type: string;
    priority: number;
    payload: Record<string, any>;
    status: DMTaskStatus;
    createdAt: Date;
    updatedAt: Date;
    attempts: number;
    lastError?: string;
    scheduledAt?: Date;
}
export interface TaskQueueSystem {
    id: string;
    queueDirectory: string;
    maxConcurrency: number;
    retryPolicy: RetryPolicy;
    priorityLevels: PriorityLevel[];
    monitoring: MonitoringConfig;
}
export declare function canTransitionStatus(from: DMTaskStatus, to: DMTaskStatus): boolean;
export declare function nextRetryDelay(policy: RetryPolicy, attempt: number): number;
