import type { Task, TaskStatus } from '../types.js';
export interface TaskFilter {
    status?: TaskStatus[];
    type?: string[];
    priority?: {
        min?: number;
        max?: number;
        values?: number[];
    };
    createdBefore?: Date;
    createdAfter?: Date;
    updatedBefore?: Date;
    updatedAfter?: Date;
    hasError?: boolean;
    hasResult?: boolean;
    payloadContains?: Record<string, any>;
}
export interface TaskSortOptions {
    field: 'createdAt' | 'updatedAt' | 'type' | 'status';
    direction: 'asc' | 'desc';
}
export interface PaginationOptions {
    page: number;
    limit: number;
}
export interface TaskQueryResult {
    tasks: Task[];
    total: number;
    page?: number;
    limit?: number;
    hasMore?: boolean;
}
export interface TaskStatistics {
    total: number;
    byStatus: Record<TaskStatus, number>;
    byType: Record<string, number>;
    averageExecutionTime?: number;
    successRate: number;
    oldestTask?: Task;
    newestTask?: Task;
}
export declare class TaskStatusQuery {
    private queueOps;
    private queuePath;
    constructor(queuePath?: string);
    taskExists(taskId: string): Promise<boolean>;
    getTaskStatus(taskId: string): Promise<TaskStatus | null>;
    queryTasks(filter?: TaskFilter, sort?: TaskSortOptions, pagination?: PaginationOptions): Promise<TaskQueryResult>;
    searchTasks(searchTerm: string, searchFields?: string[]): Promise<Task[]>;
    getTaskStatistics(): Promise<TaskStatistics>;
    getTaskTimeline(hours?: number): Promise<Array<{
        hour: string;
        count: number;
        status: TaskStatus[];
    }>>;
    getQueueHealth(): Promise<{
        healthy: boolean;
        issues: string[];
        pendingTasks: number;
        stalledTasks: number;
        oldestPendingAge: number | null;
    }>;
    private getAllTasksEfficiently;
    private applyFilter;
    private applySort;
}
