/**
 * 基础任务队列操作
 * 实现最基本的任务入队、出队和状态管理
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { randomUUID } from 'crypto';
import type { Task, TaskStatus } from '../types.js';

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
export interface CreateTaskOptions {
  type: string;
  payload: Record<string, any>;
  priority?: number;
}

/**
 * 队列状态到目录的映射
 * 注意：将 'processing' 状态映射到 'running' 目录
 */
const STATUS_DIR_MAP: Record<TaskStatus, string> = {
  pending: 'pending',
  processing: 'running', // 映射到running目录
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
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
      'running/tasks', 'running/metadata',
      'completed/tasks', 'completed/metadata',
      'failed/tasks', 'failed/metadata',
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
  async enqueueTask(options: CreateTaskOptions): Promise<string> {
    const task: Task = {
      id: randomUUID(),
      type: options.type,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      payload: options.payload,
    };

    const taskPath = this.getTaskPath(task.id, 'pending');
    const metadataPath = this.getMetadataPath(task.id, 'pending');

    try {
      // 写入任务文件
      writeFileSync(taskPath, JSON.stringify(task, null, 2), 'utf8');

      // 写入元数据
      const metadata = {
        taskId: task.id,
        priority: options.priority || 0,
        retryCount: 0,
        maxRetries: this.config.maxRetries,
        createdAt: task.createdAt,
        queuedAt: new Date(),
      };
      writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

      return task.id;
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

  /**
   * 更新任务状态
   */
  async updateTaskStatus(taskId: string, newStatus: TaskStatus, result?: any, error?: string): Promise<boolean> {
    const currentTask = await this.getTask(taskId);
    if (!currentTask) {
      return false;
    }

    const oldStatus = currentTask.status;
    const newStatusDir = STATUS_DIR_MAP[newStatus];
    const oldStatusDir = STATUS_DIR_MAP[oldStatus];

    try {
      // 更新任务对象
      currentTask.status = newStatus;
      currentTask.updatedAt = new Date();
      if (result !== undefined) {
        currentTask.result = result;
      }
      if (error !== undefined) {
        currentTask.error = error;
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
        metadata.updatedAt = new Date();
        metadata.status = newStatus;
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

  /**
   * 获取队列统计信息
   */
  async getQueueStats(): Promise<Record<TaskStatus, number>> {
    const stats: Record<TaskStatus, number> = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
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