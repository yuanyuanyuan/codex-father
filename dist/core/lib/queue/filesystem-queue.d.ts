import type { BackupResult, CancelResult, CorruptionIssue, EnqueueResult, IntegrityCheckResult, MigrationResult, QueueDirectoryStructure, RepairResult, RestoreResult, RetryResult, Task, TaskDefinition, TaskStatus } from '../types.js';
import { type QueueConfig } from './basic-operations.js';
export interface FileSystemQueueOptions extends Partial<QueueConfig> {
    queuePath?: string;
}
export declare class FileSystemQueue {
    private readonly queueOps;
    private readonly queuePath;
    private constructor();
    static initialize(options?: FileSystemQueueOptions): Promise<FileSystemQueue>;
    getDirectoryStructure(): QueueDirectoryStructure;
    enqueue(task: TaskDefinition): Promise<EnqueueResult>;
    dequeue(): Promise<Task | null>;
    getTask(taskId: string): Promise<Task | null>;
    updateTaskStatus(taskId: string, status: TaskStatus, result?: any, error?: string): Promise<void>;
    listTasks(filter?: TaskStatus): Promise<Task[]>;
    cancelTask(taskId: string, reason?: string): Promise<CancelResult>;
    retryTask(taskId: string): Promise<RetryResult>;
    purgeCompletedTasks(): Promise<{
        totalPurged: number;
        tasksRemaining: number;
        diskSpaceFreed: number;
    }>;
    getQueueStats(): Promise<Record<TaskStatus, number>>;
    shutdown(): Promise<void>;
    validateIntegrity(): Promise<IntegrityCheckResult>;
    repairCorruption(issues: CorruptionIssue[]): Promise<RepairResult>;
    backup(destinationPath: string): Promise<BackupResult>;
    restore(backupPath: string): Promise<RestoreResult>;
    migrate(newVersion: string): Promise<MigrationResult>;
}
