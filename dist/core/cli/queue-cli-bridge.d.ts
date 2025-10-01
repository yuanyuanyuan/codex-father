import type { CommandContext, CommandResult } from '../lib/types.js';
import { ExecutionOptions } from '../lib/queue/basic-executor.js';
export interface CLICreateTaskOptions {
    type?: string;
    payload?: Record<string, unknown> | string;
    priority?: number;
    scheduledAt?: string | Date;
    execute?: boolean;
    wait?: boolean;
    timeout?: number;
}
export interface CLIQueryOptions {
    status?: string[];
    type?: string[];
    limit?: number;
    page?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    format?: 'table' | 'json' | 'list';
}
export declare class QueueCLIBridge {
    private queueOps;
    private statusQuery;
    private executor;
    constructor(queuePath?: string);
    handleCreateTask(context: CommandContext, options: CLICreateTaskOptions): Promise<CommandResult>;
    handleListTasks(context: CommandContext, options?: CLIQueryOptions): Promise<CommandResult>;
    handleTaskStatus(context: CommandContext, taskId: string): Promise<CommandResult>;
    handleExecuteTask(context: CommandContext, taskId: string, options?: ExecutionOptions): Promise<CommandResult>;
    handleQueueStats(context: CommandContext): Promise<CommandResult>;
    registerTaskHandler(taskType: string, handler: any): void;
    getAvailableTaskTypes(): string[];
    private formatTaskList;
    private formatTaskDetails;
    private formatQueueStats;
    private getStatusIcon;
    private formatTable;
}
