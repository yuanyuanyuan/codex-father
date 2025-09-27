/**
 * 任务状态查询系统
 * 提供快速查询、过滤和搜索功能
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import type { Task, TaskStatus } from '../types.js';
import { BasicQueueOperations } from './basic-operations.js';

/**
 * 任务查询过滤器
 */
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

/**
 * 任务查询排序选项
 */
export interface TaskSortOptions {
  field: 'createdAt' | 'updatedAt' | 'type' | 'status';
  direction: 'asc' | 'desc';
}

/**
 * 分页选项
 */
export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * 查询结果
 */
export interface TaskQueryResult {
  tasks: Task[];
  total: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
}

/**
 * 任务统计信息
 */
export interface TaskStatistics {
  total: number;
  byStatus: Record<TaskStatus, number>;
  byType: Record<string, number>;
  averageExecutionTime?: number;
  successRate: number;
  oldestTask?: Task;
  newestTask?: Task;
}

/**
 * 任务状态查询类
 */
export class TaskStatusQuery {
  private queueOps: BasicQueueOperations;
  private queuePath: string;

  constructor(queuePath?: string) {
    this.queuePath = queuePath || join(process.cwd(), '.codex-father/queue');
    this.queueOps = new BasicQueueOperations({ queuePath: this.queuePath });
  }

  /**
   * 快速检查任务是否存在
   */
  async taskExists(taskId: string): Promise<boolean> {
    const task = await this.queueOps.getTask(taskId);
    return task !== null;
  }

  /**
   * 获取任务当前状态
   */
  async getTaskStatus(taskId: string): Promise<TaskStatus | null> {
    const task = await this.queueOps.getTask(taskId);
    return task ? task.status : null;
  }

  /**
   * 高级任务查询
   */
  async queryTasks(
    filter?: TaskFilter,
    sort?: TaskSortOptions,
    pagination?: PaginationOptions
  ): Promise<TaskQueryResult> {
    try {
      // 获取所有任务
      let tasks = await this.getAllTasksEfficiently(filter?.status);

      // 应用过滤器
      if (filter) {
        tasks = this.applyFilter(tasks, filter);
      }

      // 应用排序
      if (sort) {
        tasks = this.applySort(tasks, sort);
      }

      const total = tasks.length;

      // 应用分页
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
    } catch (error) {
      throw new Error(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 搜索任务（基于任务类型或载荷内容）
   */
  async searchTasks(searchTerm: string, searchFields: string[] = ['type']): Promise<Task[]> {
    const allTasks = await this.queueOps.listTasks();
    const searchLower = searchTerm.toLowerCase();

    return allTasks.filter(task => {
      for (const field of searchFields) {
        let value: string = '';

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

  /**
   * 获取任务统计信息
   */
  async getTaskStatistics(): Promise<TaskStatistics> {
    const allTasks = await this.queueOps.listTasks();
    const stats = await this.queueOps.getQueueStats();

    const byType: Record<string, number> = {};
    let totalExecutionTime = 0;
    let executedTasks = 0;
    let oldestTask: Task | undefined;
    let newestTask: Task | undefined;

    for (const task of allTasks) {
      // 按类型统计
      byType[task.type] = (byType[task.type] || 0) + 1;

      // 计算执行时间（仅对已完成或失败的任务）
      if ((task.status === 'completed' || task.status === 'failed') && task.updatedAt && task.createdAt) {
        const executionTime = new Date(task.updatedAt).getTime() - new Date(task.createdAt).getTime();
        totalExecutionTime += executionTime;
        executedTasks++;
      }

      // 找出最旧和最新的任务
      if (!oldestTask || new Date(task.createdAt) < new Date(oldestTask.createdAt)) {
        oldestTask = task;
      }
      if (!newestTask || new Date(task.createdAt) > new Date(newestTask.createdAt)) {
        newestTask = task;
      }
    }

    const successRate = allTasks.length > 0
      ? stats.completed / (stats.completed + stats.failed + stats.cancelled)
      : 0;

    return {
      total: allTasks.length,
      byStatus: stats,
      byType,
      averageExecutionTime: executedTasks > 0 ? totalExecutionTime / executedTasks : undefined,
      successRate: Math.max(0, Math.min(1, successRate)), // 确保在0-1范围内
      oldestTask,
      newestTask,
    };
  }

  /**
   * 获取任务执行时间线
   */
  async getTaskTimeline(hours: number = 24): Promise<Array<{ hour: string; count: number; status: TaskStatus[] }>> {
    const allTasks = await this.queueOps.listTasks();
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const timeline: Record<string, { count: number; statuses: Set<TaskStatus> }> = {};

    for (const task of allTasks) {
      const taskTime = new Date(task.createdAt);
      if (taskTime >= cutoffTime) {
        const hourKey = taskTime.toISOString().substring(0, 13); // YYYY-MM-DDTHH

        if (!timeline[hourKey]) {
          timeline[hourKey] = { count: 0, statuses: new Set() };
        }

        timeline[hourKey].count++;
        timeline[hourKey].statuses.add(task.status);
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

  /**
   * 监控队列健康状态
   */
  async getQueueHealth(): Promise<{
    healthy: boolean;
    issues: string[];
    pendingTasks: number;
    stalledTasks: number;
    oldestPendingAge: number | null;
  }> {
    const stats = await this.queueOps.getQueueStats();
    const pendingTasks = await this.queueOps.listTasks('pending');
    const runningTasks = await this.queueOps.listTasks('processing');

    const issues: string[] = [];
    const now = Date.now();
    const stalledThreshold = 30 * 60 * 1000; // 30 minutes

    // 检查是否有卡住的任务
    const stalledTasks = runningTasks.filter(task => {
      const age = now - new Date(task.updatedAt).getTime();
      return age > stalledThreshold;
    });

    if (stalledTasks.length > 0) {
      issues.push(`${stalledTasks.length} tasks appear to be stalled`);
    }

    // 检查队列积压
    if (stats.pending > 100) {
      issues.push(`High number of pending tasks: ${stats.pending}`);
    }

    // 检查失败率
    const totalProcessed = stats.completed + stats.failed + stats.cancelled;
    if (totalProcessed > 0 && (stats.failed / totalProcessed) > 0.1) {
      issues.push(`High failure rate: ${((stats.failed / totalProcessed) * 100).toFixed(1)}%`);
    }

    // 计算最旧待处理任务的年龄
    let oldestPendingAge: number | null = null;
    if (pendingTasks.length > 0) {
      const oldest = pendingTasks.reduce((oldest, task) =>
        new Date(task.createdAt) < new Date(oldest.createdAt) ? task : oldest
      );
      oldestPendingAge = now - new Date(oldest.createdAt).getTime();
    }

    return {
      healthy: issues.length === 0,
      issues,
      pendingTasks: stats.pending,
      stalledTasks: stalledTasks.length,
      oldestPendingAge,
    };
  }

  /**
   * 高效获取所有任务（优化版本）
   */
  private async getAllTasksEfficiently(statusFilter?: TaskStatus[]): Promise<Task[]> {
    const tasks: Task[] = [];
    const defaultStatuses: TaskStatus[] = [
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

  /**
   * 应用过滤器
   */
  private applyFilter(tasks: Task[], filter: TaskFilter): Task[] {
    return tasks.filter(task => {
      // 状态过滤
      if (filter.status && !filter.status.includes(task.status)) {
        return false;
      }

      // 类型过滤
      if (filter.type && !filter.type.includes(task.type)) {
        return false;
      }

      // 优先级过滤
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

      // 创建时间过滤
      const createdAt = new Date(task.createdAt);
      if (filter.createdBefore && createdAt > filter.createdBefore) {
        return false;
      }
      if (filter.createdAfter && createdAt < filter.createdAfter) {
        return false;
      }

      // 更新时间过滤
      const updatedAt = new Date(task.updatedAt);
      if (filter.updatedBefore && updatedAt > filter.updatedBefore) {
        return false;
      }
      if (filter.updatedAfter && updatedAt < filter.updatedAfter) {
        return false;
      }

      // 错误状态过滤
      if (filter.hasError !== undefined) {
        const hasError = Boolean(task.error);
        if (filter.hasError !== hasError) {
          return false;
        }
      }

      // 结果状态过滤
      if (filter.hasResult !== undefined) {
        const hasResult = Boolean(task.result);
        if (filter.hasResult !== hasResult) {
          return false;
        }
      }

      // 载荷内容过滤
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

  /**
   * 应用排序
   */
  private applySort(tasks: Task[], sort: TaskSortOptions): Task[] {
    return tasks.sort((a, b) => {
      let valueA: any;
      let valueB: any;

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
