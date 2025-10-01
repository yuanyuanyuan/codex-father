import chalk from 'chalk';
import { BasicQueueOperations } from '../lib/queue/basic-operations.js';
import { TaskStatusQuery, } from '../lib/queue/status-query.js';
import { BasicTaskExecutor, BUILT_IN_TASK_TYPES, } from '../lib/queue/basic-executor.js';
export class QueueCLIBridge {
    queueOps;
    statusQuery;
    executor;
    constructor(queuePath) {
        this.queueOps = new BasicQueueOperations(queuePath ? { queuePath } : {});
        this.statusQuery = new TaskStatusQuery(queuePath);
        this.executor = new BasicTaskExecutor(queuePath);
    }
    async handleCreateTask(context, options) {
        try {
            const { type, payload, execute = false, wait = false, timeout } = options;
            if (!type) {
                return {
                    success: false,
                    message: 'Task type is required',
                    errors: ['Please specify a task type using --type'],
                    executionTime: 0,
                };
            }
            let parsedPayload = {};
            if (payload !== undefined) {
                if (typeof payload === 'string') {
                    try {
                        parsedPayload = JSON.parse(payload);
                    }
                    catch (error) {
                        return {
                            success: false,
                            message: 'Invalid payload JSON',
                            errors: [error instanceof Error ? error.message : 'Unable to parse payload'],
                            executionTime: 0,
                        };
                    }
                }
                else if (typeof payload === 'object' && payload !== null) {
                    parsedPayload = payload;
                }
                else {
                    return {
                        success: false,
                        message: 'Unsupported payload type',
                        errors: ['Payload must be a JSON object or stringified JSON'],
                        executionTime: 0,
                    };
                }
            }
            const priority = typeof options.priority === 'number' ? options.priority : 5;
            const scheduledAtDate = options.scheduledAt
                ? new Date(options.scheduledAt)
                : undefined;
            if (scheduledAtDate && Number.isNaN(scheduledAtDate.getTime())) {
                return {
                    success: false,
                    message: 'Invalid scheduledAt value',
                    errors: ['scheduledAt must be a valid ISO timestamp or Date'],
                    executionTime: 0,
                };
            }
            const definition = {
                type,
                priority,
                payload: parsedPayload,
                ...(scheduledAtDate ? { scheduledAt: scheduledAtDate } : {}),
            };
            const enqueueResult = await this.queueOps.enqueueTask(definition);
            const { taskId, queuePosition, estimatedStartTime, scheduledAt } = enqueueResult;
            const result = {
                taskId,
                queuePosition,
                estimatedStartTime,
                scheduledAt,
            };
            let executionTime = 0;
            const startTime = Date.now();
            if (execute) {
                const execOptions = typeof timeout === 'number' ? { timeout } : {};
                const execResult = await this.executor.executeTask(taskId, execOptions);
                result.execution = execResult;
                executionTime = execResult.executionTime;
                if (!execResult.success && !wait) {
                    return {
                        success: false,
                        message: `Task created but execution failed: ${execResult.error}`,
                        data: result,
                        errors: [execResult.error || 'Unknown execution error'],
                        executionTime: Date.now() - startTime,
                    };
                }
            }
            executionTime = executionTime || Date.now() - startTime;
            if (context.json) {
                return {
                    success: true,
                    data: result,
                    executionTime,
                };
            }
            const messages = [`✅ Task created: ${chalk.cyan(taskId)}`];
            if (typeof queuePosition === 'number') {
                messages.push(`📬 Queue position: ${queuePosition}`);
            }
            if (estimatedStartTime instanceof Date) {
                messages.push(`⏱️ Estimated start: ${estimatedStartTime.toISOString()}`);
            }
            if (execute) {
                const execResult = result.execution;
                if (execResult?.success) {
                    messages.push(`✅ Task executed successfully in ${execResult.executionTime.toFixed(2)}ms`);
                }
                else if (execResult) {
                    messages.push(`❌ Task execution failed: ${execResult.error}`);
                }
            }
            const message = messages.join('\n');
            return {
                success: true,
                message,
                ...(context.verbose ? { data: result } : {}),
                executionTime,
            };
        }
        catch (error) {
            return {
                success: false,
                message: 'Failed to create task',
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                executionTime: 0,
            };
        }
    }
    async handleListTasks(context, options = {}) {
        try {
            const startTime = Date.now();
            const filter = {};
            if (options.status) {
                filter.status = options.status;
            }
            if (options.type) {
                filter.type = options.type;
            }
            const sort = options.sort
                ? {
                    field: options.sort,
                    direction: options.order || 'desc',
                }
                : undefined;
            const pagination = options.limit
                ? {
                    page: options.page || 1,
                    limit: options.limit,
                }
                : undefined;
            const queryResult = await this.statusQuery.queryTasks(filter, sort, pagination);
            const executionTime = Date.now() - startTime;
            if (context.json) {
                return {
                    success: true,
                    data: queryResult,
                    executionTime,
                };
            }
            const message = this.formatTaskList(queryResult.tasks, options.format || 'table');
            return {
                success: true,
                message,
                ...(context.verbose ? { data: queryResult } : {}),
                executionTime,
            };
        }
        catch (error) {
            return {
                success: false,
                message: 'Failed to list tasks',
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                executionTime: 0,
            };
        }
    }
    async handleTaskStatus(context, taskId) {
        try {
            const startTime = Date.now();
            if (!taskId) {
                return {
                    success: false,
                    message: 'Task ID is required',
                    errors: ['Please provide a task ID'],
                    executionTime: 0,
                };
            }
            const task = await this.queueOps.getTask(taskId);
            if (!task) {
                return {
                    success: false,
                    message: `Task not found: ${taskId}`,
                    errors: [`No task found with ID: ${taskId}`],
                    executionTime: Date.now() - startTime,
                };
            }
            if (context.json) {
                return {
                    success: true,
                    data: task,
                    executionTime: Date.now() - startTime,
                };
            }
            const message = this.formatTaskDetails(task);
            return {
                success: true,
                message,
                ...(context.verbose ? { data: task } : {}),
                executionTime: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                message: 'Failed to get task status',
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                executionTime: 0,
            };
        }
    }
    async handleExecuteTask(context, taskId, options = {}) {
        try {
            const startTime = Date.now();
            if (!taskId) {
                return {
                    success: false,
                    message: 'Task ID is required',
                    errors: ['Please provide a task ID'],
                    executionTime: 0,
                };
            }
            const execResult = await this.executor.executeTask(taskId, options);
            if (context.json) {
                return {
                    success: execResult.success,
                    data: execResult,
                    executionTime: Date.now() - startTime,
                };
            }
            const message = execResult.success
                ? `✅ Task executed successfully in ${execResult.executionTime.toFixed(2)}ms`
                : `❌ Task execution failed: ${execResult.error}`;
            const baseResult = {
                success: execResult.success,
                message,
                ...(context.verbose ? { data: execResult } : {}),
                executionTime: Date.now() - startTime,
            };
            if (!execResult.success) {
                baseResult.errors = [execResult.error || 'Unknown error'];
            }
            return baseResult;
        }
        catch (error) {
            return {
                success: false,
                message: 'Failed to execute task',
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                executionTime: 0,
            };
        }
    }
    async handleQueueStats(context) {
        try {
            const startTime = Date.now();
            const [queueStats, taskStats, executionStats, healthStatus] = await Promise.all([
                this.queueOps.getQueueStats(),
                this.statusQuery.getTaskStatistics(),
                this.executor.getExecutionStats(),
                this.statusQuery.getQueueHealth(),
            ]);
            const stats = {
                queue: queueStats,
                tasks: taskStats,
                execution: executionStats,
                health: healthStatus,
            };
            const executionTime = Date.now() - startTime;
            if (context.json) {
                return {
                    success: true,
                    data: stats,
                    executionTime,
                };
            }
            const message = this.formatQueueStats(stats);
            return {
                success: true,
                message,
                ...(context.verbose ? { data: stats } : {}),
                executionTime,
            };
        }
        catch (error) {
            return {
                success: false,
                message: 'Failed to get queue statistics',
                errors: [error instanceof Error ? error.message : 'Unknown error'],
                executionTime: 0,
            };
        }
    }
    registerTaskHandler(taskType, handler) {
        this.executor.registerTaskHandler(taskType, handler);
    }
    getAvailableTaskTypes() {
        return [...this.executor.getRegisteredTaskTypes(), ...Object.values(BUILT_IN_TASK_TYPES)];
    }
    formatTaskList(tasks, format) {
        if (tasks.length === 0) {
            return '📭 No tasks found';
        }
        switch (format) {
            case 'json':
                return JSON.stringify(tasks, null, 2);
            case 'list':
                return tasks
                    .map((task) => {
                    const status = this.getStatusIcon(task.status);
                    const time = new Date(task.createdAt).toLocaleString();
                    return `${status} ${chalk.cyan(task.id)} [${chalk.yellow(task.type)}] - ${time}`;
                })
                    .join('\\n');
            case 'table':
            default:
                const headers = ['ID', 'Type', 'Status', 'Created', 'Updated'];
                const rows = tasks.map((task) => [
                    task.id.substring(0, 8) + '...',
                    task.type,
                    this.getStatusIcon(task.status) + ' ' + task.status,
                    new Date(task.createdAt).toLocaleString(),
                    new Date(task.updatedAt).toLocaleString(),
                ]);
                return this.formatTable(headers, rows);
        }
    }
    formatTaskDetails(task) {
        const lines = [
            `📋 Task Details: ${chalk.cyan(task.id)}`,
            '',
            `${chalk.bold('Type:')} ${task.type}`,
            `${chalk.bold('Status:')} ${this.getStatusIcon(task.status)} ${task.status}`,
            `${chalk.bold('Created:')} ${new Date(task.createdAt).toLocaleString()}`,
            `${chalk.bold('Updated:')} ${new Date(task.updatedAt).toLocaleString()}`,
        ];
        if (task.result) {
            lines.push('', `${chalk.bold('Result:')}`, JSON.stringify(task.result, null, 2));
        }
        if (task.error) {
            lines.push('', `${chalk.bold('Error:')} ${chalk.red(task.error)}`);
        }
        if (task.payload && Object.keys(task.payload).length > 0) {
            lines.push('', `${chalk.bold('Payload:')}`, JSON.stringify(task.payload, null, 2));
        }
        return lines.join('\\n');
    }
    formatQueueStats(stats) {
        const lines = [
            '📊 Queue Statistics',
            '',
            `${chalk.bold('Queue Status:')}`,
            `  Pending: ${chalk.yellow(stats.queue.pending)}`,
            `  Running: ${chalk.blue(stats.queue.processing)}`,
            `  Completed: ${chalk.green(stats.queue.completed)}`,
            `  Failed: ${chalk.red(stats.queue.failed)}`,
            `  Cancelled: ${chalk.gray(stats.queue.cancelled)}`,
            '',
            `${chalk.bold('Task Statistics:')}`,
            `  Total Tasks: ${stats.tasks.total}`,
            `  Success Rate: ${(stats.tasks.successRate * 100).toFixed(1)}%`,
        ];
        if (stats.tasks.averageExecutionTime) {
            lines.push(`  Average Execution Time: ${stats.tasks.averageExecutionTime.toFixed(2)}ms`);
        }
        if (stats.execution.totalExecutions > 0) {
            lines.push('', `${chalk.bold('Execution Statistics:')}`, `  Total Executions: ${stats.execution.totalExecutions}`, `  Success Count: ${chalk.green(stats.execution.successCount)}`, `  Failure Count: ${chalk.red(stats.execution.failureCount)}`, `  Average Time: ${stats.execution.averageExecutionTime.toFixed(2)}ms`);
        }
        lines.push('', `${chalk.bold('Health Status:')} ${stats.health.healthy ? '✅ Healthy' : '⚠️  Issues Detected'}`);
        if (!stats.health.healthy) {
            lines.push('Issues:', ...stats.health.issues.map((issue) => `  - ${issue}`));
        }
        return lines.join('\\n');
    }
    getStatusIcon(status) {
        const icons = {
            pending: '⏳',
            processing: '🔄',
            completed: '✅',
            failed: '❌',
            cancelled: '🚫',
        };
        return icons[status] || '❓';
    }
    formatTable(headers, rows) {
        if (rows.length === 0) {
            return 'No data';
        }
        const colWidths = headers.map((header, i) => {
            const dataWidth = Math.max(...rows.map((row) => (row[i] || '').length));
            return Math.max(header.length, dataWidth);
        });
        const separator = '┼' + colWidths.map((w) => '─'.repeat(w + 2)).join('┼') + '┼';
        const topBorder = '┌' + colWidths.map((w) => '─'.repeat(w + 2)).join('┬') + '┐';
        const bottomBorder = '└' + colWidths.map((w) => '─'.repeat(w + 2)).join('┴') + '┘';
        const formatRow = (row) => {
            return ('│' +
                row
                    .map((cell, i) => {
                    const width = colWidths[i] ?? headers[i]?.length ?? 0;
                    return ` ${(cell || '').padEnd(width)} `;
                })
                    .join('│') +
                '│');
        };
        const lines = [
            topBorder,
            formatRow(headers.map((h) => chalk.bold(h))),
            separator,
            ...rows.map(formatRow),
            bottomBorder,
        ];
        return lines.join('\\n');
    }
}
