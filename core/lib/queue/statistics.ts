import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type {
  QueuePerformanceMetrics,
  QueueProcessingCapacity,
  QueueStatistics,
  QueueStorageMetrics,
  Task,
  TaskStatus,
} from '../types.js';
import { BasicQueueOperations } from './basic-operations.js';

export interface QueueStatisticsOptions {
  maxConcurrent?: number;
  throughputWindowMs?: number;
}

const STATUS_ORDER: TaskStatus[] = [
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
  private readonly queueOps: BasicQueueOperations;
  private readonly queuePath: string;
  private readonly maxConcurrent: number;
  private readonly throughputWindowMs: number;

  constructor(queuePath?: string, options: QueueStatisticsOptions = {}) {
    this.queuePath = queuePath ?? join(process.cwd(), '.codex-father/queue');
    this.queueOps = new BasicQueueOperations({ queuePath: this.queuePath });
    this.maxConcurrent = options.maxConcurrent ?? 4;
    this.throughputWindowMs = options.throughputWindowMs ?? 60 * 60 * 1000; // 1 hour
  }

  async collect(): Promise<QueueStatistics> {
    const tasksByStatus: Record<TaskStatus, number> = {
      pending: 0,
      scheduled: 0,
      processing: 0,
      retrying: 0,
      completed: 0,
      failed: 0,
      timeout: 0,
      cancelled: 0,
    };

    const tasks: Task[] = [];
    for (const status of STATUS_ORDER) {
      const statusTasks = await this.queueOps.listTasks(status);
      tasksByStatus[status] = statusTasks.length;
      tasks.push(...statusTasks.map(task => this.normalizeTask(task)));
    }

    const totalTasks = tasks.length;
    const tasksByType: Record<string, number> = {};
    const tasksByPriority: Record<number, number> = {};

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

  private normalizeTask(task: Task): Task {
    const clone: Task = {
      ...task,
      createdAt: this.ensureDate(task.createdAt),
      updatedAt: this.ensureDate(task.updatedAt),
      scheduledAt: this.ensureDate(task.scheduledAt),
      startedAt: this.ensureDate(task.startedAt),
      completedAt: this.ensureDate(task.completedAt),
    };
    return clone;
  }

  private ensureDate(value: Date | string | undefined): Date | undefined {
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

  private calculateAverageProcessingTime(tasks: Task[]): number {
    const durations = tasks
      .filter(task => task.status === 'completed' && task.startedAt && task.completedAt)
      .map(task => task.completedAt!.getTime() - task.startedAt!.getTime())
      .filter(duration => duration >= 0);

    if (durations.length === 0) {
      return 0;
    }

    const totalDuration = durations.reduce((sum, value) => sum + value, 0);
    return Math.round(totalDuration / durations.length);
  }

  private calculateProcessingCapacity(tasksByStatus: Record<TaskStatus, number>): QueueProcessingCapacity {
    const currentlyProcessing = tasksByStatus.processing;
    const availableSlots = Math.max(this.maxConcurrent - currentlyProcessing, 0);
    return {
      maxConcurrent: this.maxConcurrent,
      currentlyProcessing,
      availableSlots,
    };
  }

  private calculatePerformanceMetrics(
    tasks: Task[],
    tasksByStatus: Record<TaskStatus, number>,
    totalTasks: number
  ): QueuePerformanceMetrics {
    const completedTasks = tasks.filter(task => task.status === 'completed');
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

  private calculateThroughputPerHour(tasks: Task[]): number {
    if (tasks.length === 0) {
      return 0;
    }

    const completedTimes = tasks
      .map(task => task.completedAt)
      .filter((value): value is Date => Boolean(value))
      .map(date => date.getTime())
      .sort((a, b) => a - b);

    if (completedTimes.length === 0) {
      return 0;
    }

    const windowMs = Math.max(completedTimes.at(-1)! - completedTimes[0], this.throughputWindowMs);
    if (windowMs === 0) {
      return tasks.length * 1;
    }

    const throughput = (tasks.length * 60 * 60 * 1000) / windowMs;
    return throughput;
  }

  private calculateAverageWaitTime(tasks: Task[]): number {
    const waits = tasks
      .filter(task => task.startedAt && task.createdAt)
      .map(task => task.startedAt!.getTime() - task.createdAt.getTime())
      .filter(wait => wait >= 0);

    if (waits.length === 0) {
      return 0;
    }

    const totalWait = waits.reduce((sum, value) => sum + value, 0);
    return Math.round(totalWait / waits.length);
  }

  private calculateStorageMetrics(tasks: Task[]): QueueStorageMetrics {
    const { diskUsage, fileCount } = this.scanDirectory(this.queuePath);

    if (tasks.length === 0) {
      return {
        diskUsage,
        fileCount,
      };
    }

    const sortedByCreation = [...tasks].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    return {
      diskUsage,
      fileCount,
      oldestTask: sortedByCreation[0]?.createdAt,
      newestTask: sortedByCreation.at(-1)?.createdAt,
    };
  }

  private scanDirectory(directory: string): { diskUsage: number; fileCount: number } {
    let totalSize = 0;
    let fileCount = 0;

    const entries = readdirSync(directory, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        const nested = this.scanDirectory(entryPath);
        totalSize += nested.diskUsage;
        fileCount += nested.fileCount;
      } else {
        const stats = statSync(entryPath);
        totalSize += stats.size;
        fileCount += 1;
      }
    }

    return { diskUsage: totalSize, fileCount };
  }
}
