import { join } from 'path';
import { BasicQueueOperations } from './basic-operations.js';
export class TaskStatusQuery {
    queueOps;
    queuePath;
    constructor(queuePath) {
        this.queuePath = queuePath || join(process.cwd(), '.codex-father/queue');
        this.queueOps = new BasicQueueOperations({ queuePath: this.queuePath });
    }
    async taskExists(taskId) {
        const task = await this.queueOps.getTask(taskId);
        return task !== null;
    }
    async getTaskStatus(taskId) {
        const task = await this.queueOps.getTask(taskId);
        return task ? task.status : null;
    }
    async queryTasks(filter, sort, pagination) {
        try {
            let tasks = await this.getAllTasksEfficiently(filter?.status);
            if (filter) {
                tasks = this.applyFilter(tasks, filter);
            }
            if (sort) {
                tasks = this.applySort(tasks, sort);
            }
            const total = tasks.length;
            if (pagination) {
                const startIndex = (pagination.page - 1) * pagination.limit;
                const endIndex = startIndex + pagination.limit;
                tasks = tasks.slice(startIndex, endIndex);
                return {
                    tasks,
                    total,
                    page: pagination.page,
                    limit: pagination.limit,
                    hasMore: endIndex < total,
                };
            }
            return { tasks, total };
        }
        catch (error) {
            throw new Error(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async searchTasks(searchTerm, searchFields = ['type']) {
        const allTasks = await this.queueOps.listTasks();
        const searchLower = searchTerm.toLowerCase();
        return allTasks.filter((task) => {
            for (const field of searchFields) {
                let value = '';
                switch (field) {
                    case 'type':
                        value = task.type;
                        break;
                    case 'id':
                        value = task.id;
                        break;
                    case 'payload':
                        value = JSON.stringify(task.payload);
                        break;
                    case 'result':
                        value = task.result ? JSON.stringify(task.result) : '';
                        break;
                    case 'error':
                        value = task.error || '';
                        break;
                    default:
                        continue;
                }
                if (value.toLowerCase().includes(searchLower)) {
                    return true;
                }
            }
            return false;
        });
    }
    async getTaskStatistics() {
        const allTasks = await this.queueOps.listTasks();
        const stats = await this.queueOps.getQueueStats();
        const byType = {};
        let totalExecutionTime = 0;
        let executedTasks = 0;
        let oldestTask;
        let newestTask;
        for (const task of allTasks) {
            byType[task.type] = (byType[task.type] || 0) + 1;
            if ((task.status === 'completed' || task.status === 'failed') &&
                task.updatedAt &&
                task.createdAt) {
                const executionTime = new Date(task.updatedAt).getTime() - new Date(task.createdAt).getTime();
                totalExecutionTime += executionTime;
                executedTasks++;
            }
            if (!oldestTask || new Date(task.createdAt) < new Date(oldestTask.createdAt)) {
                oldestTask = task;
            }
            if (!newestTask || new Date(task.createdAt) > new Date(newestTask.createdAt)) {
                newestTask = task;
            }
        }
        const completedCount = stats.completed ?? 0;
        const failedCount = stats.failed ?? 0;
        const cancelledCount = stats.cancelled ?? 0;
        const successDenominator = completedCount + failedCount + cancelledCount;
        const successRate = allTasks.length > 0 && successDenominator > 0
            ? completedCount / successDenominator
            : 0;
        return {
            total: allTasks.length,
            byStatus: stats,
            byType,
            successRate: Math.max(0, Math.min(1, successRate)),
            ...(executedTasks > 0
                ? { averageExecutionTime: totalExecutionTime / executedTasks }
                : {}),
            ...(oldestTask ? { oldestTask } : {}),
            ...(newestTask ? { newestTask } : {}),
        };
    }
    async getTaskTimeline(hours = 24) {
        const allTasks = await this.queueOps.listTasks();
        const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
        const timeline = {};
        for (const task of allTasks) {
            const taskTime = new Date(task.createdAt);
            if (taskTime >= cutoffTime) {
                const hourKey = taskTime.toISOString().substring(0, 13);
                const bucket = timeline[hourKey] ?? { count: 0, statuses: new Set() };
                bucket.count += 1;
                bucket.statuses.add(task.status);
                timeline[hourKey] = bucket;
            }
        }
        return Object.entries(timeline)
            .map(([hour, data]) => ({
            hour,
            count: data.count,
            status: Array.from(data.statuses),
        }))
            .sort((a, b) => a.hour.localeCompare(b.hour));
    }
    async getQueueHealth() {
        const stats = await this.queueOps.getQueueStats();
        const pendingTasks = await this.queueOps.listTasks('pending');
        const runningTasks = await this.queueOps.listTasks('processing');
        const issues = [];
        const now = Date.now();
        const stalledThreshold = 30 * 60 * 1000;
        const stalledTasks = runningTasks.filter((task) => {
            const age = now - new Date(task.updatedAt).getTime();
            return age > stalledThreshold;
        });
        if (stalledTasks.length > 0) {
            issues.push(`${stalledTasks.length} tasks appear to be stalled`);
        }
        const pendingCount = stats.pending ?? 0;
        if (pendingCount > 100) {
            issues.push(`High number of pending tasks: ${pendingCount}`);
        }
        const completedCount = stats.completed ?? 0;
        const failedCount = stats.failed ?? 0;
        const cancelledCount = stats.cancelled ?? 0;
        const totalProcessed = completedCount + failedCount + cancelledCount;
        if (totalProcessed > 0 && failedCount / totalProcessed > 0.1) {
            issues.push(`High failure rate: ${((failedCount / totalProcessed) * 100).toFixed(1)}%`);
        }
        let oldestPendingAge = null;
        if (pendingTasks.length > 0) {
            const oldest = pendingTasks.reduce((oldest, task) => new Date(task.createdAt) < new Date(oldest.createdAt) ? task : oldest);
            oldestPendingAge = now - new Date(oldest.createdAt).getTime();
        }
        return {
            healthy: issues.length === 0,
            issues,
            pendingTasks: pendingCount,
            stalledTasks: stalledTasks.length,
            oldestPendingAge,
        };
    }
    async getAllTasksEfficiently(statusFilter) {
        const tasks = [];
        const defaultStatuses = [
            'pending',
            'scheduled',
            'processing',
            'retrying',
            'completed',
            'failed',
            'timeout',
            'cancelled',
        ];
        const statusesToCheck = statusFilter && statusFilter.length > 0 ? statusFilter : defaultStatuses;
        for (const status of statusesToCheck) {
            const statusTasks = await this.queueOps.listTasks(status);
            tasks.push(...statusTasks);
        }
        return tasks;
    }
    applyFilter(tasks, filter) {
        return tasks.filter((task) => {
            if (filter.status && !filter.status.includes(task.status)) {
                return false;
            }
            if (filter.type && !filter.type.includes(task.type)) {
                return false;
            }
            if (filter.priority) {
                const { min, max, values } = filter.priority;
                if (typeof min === 'number' && task.priority < min) {
                    return false;
                }
                if (typeof max === 'number' && task.priority > max) {
                    return false;
                }
                if (values && values.length > 0 && !values.includes(task.priority)) {
                    return false;
                }
            }
            const createdAt = new Date(task.createdAt);
            if (filter.createdBefore && createdAt > filter.createdBefore) {
                return false;
            }
            if (filter.createdAfter && createdAt < filter.createdAfter) {
                return false;
            }
            const updatedAt = new Date(task.updatedAt);
            if (filter.updatedBefore && updatedAt > filter.updatedBefore) {
                return false;
            }
            if (filter.updatedAfter && updatedAt < filter.updatedAfter) {
                return false;
            }
            if (filter.hasError !== undefined) {
                const hasError = Boolean(task.error);
                if (filter.hasError !== hasError) {
                    return false;
                }
            }
            if (filter.hasResult !== undefined) {
                const hasResult = Boolean(task.result);
                if (filter.hasResult !== hasResult) {
                    return false;
                }
            }
            if (filter.payloadContains) {
                for (const [key, value] of Object.entries(filter.payloadContains)) {
                    if (task.payload[key] !== value) {
                        return false;
                    }
                }
            }
            return true;
        });
    }
    applySort(tasks, sort) {
        return tasks.sort((a, b) => {
            let valueA;
            let valueB;
            switch (sort.field) {
                case 'createdAt':
                    valueA = new Date(a.createdAt).getTime();
                    valueB = new Date(b.createdAt).getTime();
                    break;
                case 'updatedAt':
                    valueA = new Date(a.updatedAt).getTime();
                    valueB = new Date(b.updatedAt).getTime();
                    break;
                case 'type':
                    valueA = a.type;
                    valueB = b.type;
                    break;
                case 'status':
                    valueA = a.status;
                    valueB = b.status;
                    break;
                default:
                    return 0;
            }
            if (valueA < valueB) {
                return sort.direction === 'asc' ? -1 : 1;
            }
            if (valueA > valueB) {
                return sort.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }
}
