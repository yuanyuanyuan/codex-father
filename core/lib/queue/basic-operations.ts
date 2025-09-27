/**
 * 基础任务队列操作
 * 实现最基本的任务入队、出队和状态管理
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import type {
  Task,
  TaskStatus,
  TaskDefinition,
  EnqueueResult,
  CancelResult,
  RetryResult,
} from '../types.js';
import { createTaskFromDefinition } from './task-definition.js';

/**
 * 队列配置
 */
export interface QueueConfig {
  queuePath: string;
  lockTimeout: number; // milliseconds
  maxRetries: number;
}

/**
 * 任务创建选项
 */
const STATUS_DIR_MAP: Record<TaskStatus, string> = {
  pending: 'pending',
  scheduled: 'scheduled',
  processing: 'running',
  completed: 'completed',
  failed: 'failed',
  retrying: 'retrying',
  cancelled: 'cancelled',
  timeout: 'timeout',
};

/**
 * 基础队列操作类
 */
export class BasicQueueOperations {
  private config: QueueConfig;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      queuePath: resolve(process.cwd(), '.codex-father/queue'),
      lockTimeout: 30000, // 30 seconds
      maxRetries: 3,
      ...config,
    };

    this.ensureQueueStructure();
  }

  /**
   * 确保队列目录结构存在
   */
  private ensureQueueStructure(): void {
    const basePath = this.config.queuePath;

    if (!existsSync(basePath)) {
      throw new Error(`Queue directory does not exist: ${basePath}`);
    }

    // 验证必要的目录结构
    const requiredDirs = [
      'pending/tasks', 'pending/metadata',
      'scheduled/tasks', 'scheduled/metadata',
      'running/tasks', 'running/metadata',
      'retrying/tasks', 'retrying/metadata',
      'completed/tasks', 'completed/metadata',
      'failed/tasks', 'failed/metadata',
      'timeout/tasks', 'timeout/metadata',
      'cancelled/tasks', 'cancelled/metadata',
      'locks', 'logs', 'tmp'
    ];

    for (const dir of requiredDirs) {
      const dirPath = join(basePath, dir);
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true });
      }
    }
  }

  /**
   * 创建新任务并入队
   */
  async enqueueTask(definition: TaskDefinition): Promise<EnqueueResult> {
    const createdAt = new Date();
    const task = createTaskFromDefinition(definition, { now: createdAt });

    const taskPath = this.getTaskPath(task.id, task.status);
    const metadataPath = this.getMetadataPath(task.id, task.status);

    try {
      writeFileSync(taskPath, JSON.stringify(task, null, 2), 'utf8');

      const metadata = {
        taskId: task.id,
        priority: task.priority,
        attempts: task.attempts,
        maxAttempts: task.maxAttempts,
        retryPolicy: task.retryPolicy,
        timeout: task.timeout,
        scheduledAt: task.scheduledAt,
        createdAt: task.createdAt,
        queuedAt: createdAt,
        status: task.status,
        metadata: task.metadata,
      };
      writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

      const queuePosition = task.status === 'pending' ? this.countTasks('pending') : undefined;
      const estimatedStartTime =
        task.status === 'scheduled'
          ? task.scheduledAt ?? new Date(createdAt.getTime())
          : new Date(createdAt.getTime());

      return {
        taskId: task.id,
        queuePosition,
        estimatedStartTime,
        scheduledAt: task.scheduledAt,
      };
    } catch (error) {
      throw new Error(`Failed to enqueue task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * 获取下一个待执行的任务
   */
  async dequeueTask(): Promise<Task | null> {
    const pendingDir = join(this.config.queuePath, 'pending/tasks');

    try {
      const files = readdirSync(pendingDir);
      if (files.length === 0) {
        return null;
      }

      // 获取第一个JSON文件
      const taskFile = files.find(f => f.endsWith('.json'));
      if (!taskFile) {
        return null;
      }

      const taskId = taskFile.replace('.json', '');
      const task = await this.getTask(taskId);

      if (task && task.status === 'pending') {
        // 将任务移动到running状态
        await this.updateTaskStatus(taskId, 'processing');
        return task;
      }

      return null;
    } catch (error) {
      console.error('Error dequeuing task:', error);
      return null;
    }
  }

  /**
   * 获取任务信息
   */
  async getTask(taskId: string): Promise<Task | null> {
    // 在所有状态目录中查找任务
    for (const status of Object.keys(STATUS_DIR_MAP) as TaskStatus[]) {
      const taskPath = this.getTaskPath(taskId, status);
      if (existsSync(taskPath)) {
        try {
          const taskData = readFileSync(taskPath, 'utf8');
          const task: Task = JSON.parse(taskData);
          return task;
        } catch (error) {
          console.error(`Error reading task ${taskId}:`, error);
          return null;
        }
      }
    }
    return null;
  }

  async cancelTask(taskId: string, reason?: string): Promise<CancelResult> {
    const task = await this.getTask(taskId);
    if (!task) {
      return {
        taskId,
        cancelled: false,
        reason,
        wasRunning: false,
      };
    }

    const wasRunning = task.status === 'processing';
    const cancellableStatuses: TaskStatus[] = ['pending', 'scheduled', 'processing', 'retrying'];

    if (!cancellableStatuses.includes(task.status)) {
      return {
        taskId,
        cancelled: false,
        reason,
        wasRunning,
      };
    }

    const updated = await this.updateTaskStatus(taskId, 'cancelled');
    return {
      taskId,
      cancelled: updated,
      reason,
      wasRunning,
    };
  }

  async retryTask(taskId: string): Promise<RetryResult> {
    const task = await this.getTask(taskId);
    if (!task) {
      return {
        taskId,
        retryScheduled: false,
        attemptNumber: 0,
        reason: 'task_not_found',
      };
    }

    const attemptsSoFar = task.attempts;
    const maxAttempts = task.retryPolicy?.maxAttempts ?? 0;

    if (attemptsSoFar >= maxAttempts) {
      return {
        taskId,
        retryScheduled: false,
        attemptNumber: attemptsSoFar,
        reason: 'max_attempts_reached',
      };
    }

    const delayMs = this.calculateRetryDelay(task);
    const nextAttemptAt = new Date(Date.now() + delayMs);

    const updated = await this.updateTaskStatus(taskId, 'retrying', undefined, undefined, {
      scheduledAt: nextAttemptAt,
    });

    return {
      taskId,
      retryScheduled: updated,
      nextAttemptAt,
      attemptNumber: attemptsSoFar + 1,
      reason: updated ? undefined : 'update_failed',
    };
  }

  /**
   * 更新任务状态
   */
  async updateTaskStatus(
    taskId: string,
    newStatus: TaskStatus,
    result?: any,
    error?: string,
    updates?: Partial<Task>
  ): Promise<boolean> {
    const currentTask = await this.getTask(taskId);
    if (!currentTask) {
      return false;
    }

    const oldStatus = currentTask.status;
    try {
      const now = new Date();

      currentTask.status = newStatus;
      currentTask.updatedAt = now;

      if (newStatus === 'processing') {
        currentTask.startedAt = now;
        currentTask.attempts += 1;
      }

      if (newStatus === 'completed') {
        currentTask.completedAt = now;
      }

      if (result !== undefined) {
        currentTask.result = result;
      }
      if (error !== undefined) {
        currentTask.error = error;
        currentTask.lastError = error;
      }

      if (updates) {
        Object.assign(currentTask, updates);
      }

      // 计算新旧路径
      const oldTaskPath = this.getTaskPath(taskId, oldStatus);
      const newTaskPath = this.getTaskPath(taskId, newStatus);
      const oldMetadataPath = this.getMetadataPath(taskId, oldStatus);
      const newMetadataPath = this.getMetadataPath(taskId, newStatus);

      // 写入新位置
      writeFileSync(newTaskPath, JSON.stringify(currentTask, null, 2), 'utf8');

      // 移动元数据（如果存在）
      if (existsSync(oldMetadataPath)) {
        const metadata = JSON.parse(readFileSync(oldMetadataPath, 'utf8'));
        metadata.updatedAt = now;
        metadata.status = newStatus;
        metadata.attempts = currentTask.attempts;
        metadata.lastError = currentTask.lastError;
        metadata.result = currentTask.result;
        if (updates?.scheduledAt) {
          metadata.scheduledAt = updates.scheduledAt;
        }
        writeFileSync(newMetadataPath, JSON.stringify(metadata, null, 2), 'utf8');
        unlinkSync(oldMetadataPath);
      }

      // 删除旧位置的文件
      if (existsSync(oldTaskPath)) {
        unlinkSync(oldTaskPath);
      }

      return true;
    } catch (error) {
      console.error(`Error updating task status for ${taskId}:`, error);
      return false;
    }
  }

  /**
   * 获取任务文件路径
   */
  private getTaskPath(taskId: string, status: TaskStatus): string {
    const statusDir = STATUS_DIR_MAP[status];
    return join(this.config.queuePath, statusDir, 'tasks', `${taskId}.json`);
  }

  /**
   * 获取元数据文件路径
   */
  private getMetadataPath(taskId: string, status: TaskStatus): string {
    const statusDir = STATUS_DIR_MAP[status];
    return join(this.config.queuePath, statusDir, 'metadata', `${taskId}.json`);
  }

  private calculateRetryDelay(task: Task): number {
    const policy = task.retryPolicy;
    const baseDelay = Math.max(policy?.baseDelay ?? 1000, 0);
    const maxDelay = Math.max(policy?.maxDelay ?? baseDelay, baseDelay);
    const attemptIndex = Math.max(task.attempts, 0);
    const strategy = policy?.backoffStrategy ?? 'exponential';

    let delay = baseDelay;
    switch (strategy) {
      case 'fixed':
        delay = baseDelay;
        break;
      case 'linear':
        delay = baseDelay * (attemptIndex + 1);
        break;
      case 'exponential':
      default:
        delay = baseDelay * Math.pow(2, attemptIndex);
        break;
    }

    if (policy?.retryableErrors && policy.retryableErrors.length > 0) {
      // ensure non-retryable errors fall back to minimum delay
      if (task.lastError && !policy.retryableErrors.includes(task.lastError)) {
        delay = baseDelay;
      }
    }

    return Math.min(delay, maxDelay);
  }

  private countTasks(status: TaskStatus): number {
    const statusDir = STATUS_DIR_MAP[status];
    const tasksDir = join(this.config.queuePath, statusDir, 'tasks');

    try {
      const files = readdirSync(tasksDir);
      return files.filter(file => file.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }

  /**
   * 获取队列统计信息
   */
  async getQueueStats(): Promise<Record<TaskStatus, number>> {
    const stats: Record<TaskStatus, number> = {
      pending: 0,
      scheduled: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      retrying: 0,
      cancelled: 0,
      timeout: 0,
    };

    for (const status of Object.keys(STATUS_DIR_MAP) as TaskStatus[]) {
      const statusDir = STATUS_DIR_MAP[status];
      const tasksDir = join(this.config.queuePath, statusDir, 'tasks');

      try {
        if (existsSync(tasksDir)) {
          const files = readdirSync(tasksDir);
          stats[status] = files.filter(f => f.endsWith('.json')).length;
        }
      } catch (error) {
        console.error(`Error reading ${status} tasks directory:`, error);
      }
    }

    return stats;
  }

  /**
   * 列出指定状态的所有任务
   */
  async listTasks(status?: TaskStatus): Promise<Task[]> {
    const tasks: Task[] = [];
    const statusesToCheck = status ? [status] : Object.keys(STATUS_DIR_MAP) as TaskStatus[];

    for (const taskStatus of statusesToCheck) {
      const statusDir = STATUS_DIR_MAP[taskStatus];
      const tasksDir = join(this.config.queuePath, statusDir, 'tasks');

      try {
        if (existsSync(tasksDir)) {
          const files = readdirSync(tasksDir);
          for (const file of files) {
            if (file.endsWith('.json')) {
              const taskPath = join(tasksDir, file);
              const taskData = readFileSync(taskPath, 'utf8');
              const task: Task = JSON.parse(taskData);
              tasks.push(task);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading tasks in ${taskStatus} status:`, error);
      }
    }

    return tasks.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
}
