import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BasicQueueOperations } from './basic-operations.js';
const STATUS_ORDER = [
    'pending',
    'scheduled',
    'processing',
    'retrying',
    'completed',
    'failed',
    'timeout',
    'cancelled',
];
export class QueueStatisticsCollector {
    queueOps;
    queuePath;
    maxConcurrent;
    throughputWindowMs;
    constructor(queuePath, options = {}) {
        this.queuePath = queuePath ?? join(process.cwd(), '.codex-father/queue');
        this.queueOps = new BasicQueueOperations({ queuePath: this.queuePath });
        this.maxConcurrent = options.maxConcurrent ?? 4;
        this.throughputWindowMs = options.throughputWindowMs ?? 60 * 60 * 1000;
    }
    async collect() {
        const tasksByStatus = {
            pending: 0,
            scheduled: 0,
            processing: 0,
            retrying: 0,
            completed: 0,
            failed: 0,
            timeout: 0,
            cancelled: 0,
        };
        const tasks = [];
        for (const status of STATUS_ORDER) {
            const statusTasks = await this.queueOps.listTasks(status);
            tasksByStatus[status] = statusTasks.length;
            tasks.push(...statusTasks.map((task) => this.normalizeTask(task)));
        }
        const totalTasks = tasks.length;
        const tasksByType = {};
        const tasksByPriority = {};
        for (const task of tasks) {
            tasksByType[task.type] = (tasksByType[task.type] ?? 0) + 1;
            tasksByPriority[task.priority] = (tasksByPriority[task.priority] ?? 0) + 1;
        }
        const averageProcessingTime = this.calculateAverageProcessingTime(tasks);
        const queueDepth = tasksByStatus.pending + tasksByStatus.scheduled + tasksByStatus.retrying;
        const processingCapacity = this.calculateProcessingCapacity(tasksByStatus);
        const performance = this.calculatePerformanceMetrics(tasks, tasksByStatus, totalTasks);
        const storage = this.calculateStorageMetrics(tasks);
        return {
            totalTasks,
            tasksByStatus,
            tasksByType,
            tasksByPriority,
            averageProcessingTime,
            queueDepth,
            processingCapacity,
            performance,
            storage,
        };
    }
    normalizeTask(task) {
        const createdAt = this.ensureDate(task.createdAt) ?? new Date(0);
        const updatedAt = this.ensureDate(task.updatedAt) ?? createdAt;
        const scheduledAt = this.ensureDate(task.scheduledAt);
        const startedAt = this.ensureDate(task.startedAt);
        const completedAt = this.ensureDate(task.completedAt);
        const clone = {
            ...task,
            createdAt,
            updatedAt,
        };
        if (scheduledAt) {
            clone.scheduledAt = scheduledAt;
        }
        else {
            delete clone.scheduledAt;
        }
        if (startedAt) {
            clone.startedAt = startedAt;
        }
        else {
            delete clone.startedAt;
        }
        if (completedAt) {
            clone.completedAt = completedAt;
        }
        else {
            delete clone.completedAt;
        }
        return clone;
    }
    ensureDate(value) {
        if (!value) {
            return undefined;
        }
        if (value instanceof Date) {
            return value;
        }
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return undefined;
        }
        return parsed;
    }
    calculateAverageProcessingTime(tasks) {
        const durations = tasks
            .filter((task) => task.status === 'completed' && task.startedAt && task.completedAt)
            .map((task) => task.completedAt.getTime() - task.startedAt.getTime())
            .filter((duration) => duration >= 0);
        if (durations.length === 0) {
            return 0;
        }
        const totalDuration = durations.reduce((sum, value) => sum + value, 0);
        return Math.round(totalDuration / durations.length);
    }
    calculateProcessingCapacity(tasksByStatus) {
        const currentlyProcessing = tasksByStatus.processing;
        const availableSlots = Math.max(this.maxConcurrent - currentlyProcessing, 0);
        return {
            maxConcurrent: this.maxConcurrent,
            currentlyProcessing,
            availableSlots,
        };
    }
    calculatePerformanceMetrics(tasks, tasksByStatus, totalTasks) {
        const completedTasks = tasks.filter((task) => task.status === 'completed');
        const retryingTasks = tasksByStatus.retrying;
        const throughputPerHour = this.calculateThroughputPerHour(completedTasks);
        const averageWaitTime = this.calculateAverageWaitTime(tasks);
        const successDenominator = completedTasks.length + tasksByStatus.failed + tasksByStatus.cancelled;
        const successRate = successDenominator > 0 ? completedTasks.length / successDenominator : 1;
        const retryRate = totalTasks > 0 ? retryingTasks / totalTasks : 0;
        return {
            throughputPerHour,
            averageWaitTime,
            successRate,
            retryRate,
        };
    }
    calculateThroughputPerHour(tasks) {
        if (tasks.length === 0) {
            return 0;
        }
        const completedTimes = tasks
            .map((task) => task.completedAt)
            .filter((value) => Boolean(value))
            .map((date) => date.getTime())
            .sort((a, b) => a - b);
        if (completedTimes.length === 0) {
            return 0;
        }
        const first = completedTimes[0];
        const last = completedTimes[completedTimes.length - 1];
        if (first === undefined || last === undefined) {
            return 0;
        }
        const windowMs = Math.max(last - first, this.throughputWindowMs);
        if (windowMs === 0) {
            return tasks.length * 1;
        }
        const throughput = (tasks.length * 60 * 60 * 1000) / windowMs;
        return throughput;
    }
    calculateAverageWaitTime(tasks) {
        const waits = tasks
            .filter((task) => task.startedAt && task.createdAt)
            .map((task) => task.startedAt.getTime() - task.createdAt.getTime())
            .filter((wait) => wait >= 0);
        if (waits.length === 0) {
            return 0;
        }
        const totalWait = waits.reduce((sum, value) => sum + value, 0);
        return Math.round(totalWait / waits.length);
    }
    calculateStorageMetrics(tasks) {
        const { diskUsage, fileCount } = this.scanDirectory(this.queuePath);
        if (tasks.length === 0) {
            return {
                diskUsage,
                fileCount,
            };
        }
        const sortedByCreation = [...tasks].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        const oldestCreated = sortedByCreation[0]?.createdAt;
        const newestCreated = sortedByCreation[sortedByCreation.length - 1]?.createdAt;
        return {
            diskUsage,
            fileCount,
            ...(oldestCreated ? { oldestTask: oldestCreated } : {}),
            ...(newestCreated ? { newestTask: newestCreated } : {}),
        };
    }
    scanDirectory(directory) {
        let totalSize = 0;
        let fileCount = 0;
        const entries = readdirSync(directory, { withFileTypes: true });
        for (const entry of entries) {
            const entryPath = join(directory, entry.name);
            if (entry.isDirectory()) {
                const nested = this.scanDirectory(entryPath);
                totalSize += nested.diskUsage;
                fileCount += nested.fileCount;
            }
            else {
                const stats = statSync(entryPath);
                totalSize += stats.size;
                fileCount += 1;
            }
        }
        return { diskUsage: totalSize, fileCount };
    }
}
