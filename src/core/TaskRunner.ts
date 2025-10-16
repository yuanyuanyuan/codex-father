import { TaskConfig, TaskResult, RunnerStatus } from './types.js';
import { ErrorHandler } from './utils.js';
import { JsonStorage } from './storage.js';
import { ConcurrencyManager } from './concurrency.js';
import { TaskQueue } from './queue.js';

export type TaskRunnerDependencies = {
  storage?: JsonStorage;
  concurrencyManager?: ConcurrencyManager;
  taskQueue?: TaskQueue;
};

export class TaskRunner {
  private concurrencyManager: ConcurrencyManager;
  private taskQueue: TaskQueue;
  private storage: JsonStorage;
  private maxConcurrency: number;
  private activeTasks: Set<string>;
  private readonly dependencies: TaskRunnerDependencies;

  constructor(maxConcurrency: number = 10, dependencies: TaskRunnerDependencies = {}) {
    this.maxConcurrency = maxConcurrency;
    this.dependencies = dependencies;
    this.concurrencyManager =
      dependencies.concurrencyManager ?? new ConcurrencyManager(maxConcurrency);
    this.taskQueue = dependencies.taskQueue ?? new TaskQueue();
    this.storage = dependencies.storage ?? new JsonStorage();
    this.activeTasks = new Set();
  }

  async run(task: TaskConfig): Promise<string> {
    ErrorHandler.validateTask(task);

    await this.checkDependencies(task);
    if (this.activeTasks.has(task.id)) {
      throw new Error(`Task ${task.id} is already queued or running`);
    }
    this.activeTasks.add(task.id);
    this.taskQueue.enqueue(task);
    void this.processQueue();

    return task.id;
  }

  getResult(taskId: string): TaskResult | undefined {
    return this.storage.getResult(taskId);
  }

  getStatus(): RunnerStatus {
    return {
      running: this.concurrencyManager.getRunningCount(),
      maxConcurrency: this.maxConcurrency,
      pending: this.taskQueue.getPendingCount(),
      completed: this.storage.getCompletedCount(),
    };
  }

  private async processQueue(): Promise<void> {
    while (this.concurrencyManager.canAcquireSlot() && this.taskQueue.hasNext()) {
      const task = this.taskQueue.dequeue();
      if (task) {
        void this.executeTask(task);
      }
    }
  }

  private async executeTask(task: TaskConfig): Promise<void> {
    this.concurrencyManager.acquireSlot(task.id);
    const start = new Date();

    try {
      const result = await ErrorHandler.withTimeout(
        task.execute(),
        task.timeout ?? 600000 // 10 minutes default
      );

      const end = new Date();
      const taskResult: TaskResult = {
        taskId: task.id,
        success: true,
        result,
        startTime: start,
        endTime: end,
        duration: end.getTime() - start.getTime(),
      };

      this.storage.saveResult(taskResult);
    } catch (e: any) {
      const end = new Date();
      const taskResult: TaskResult = {
        taskId: task.id,
        success: false,
        error: e?.message ?? String(e),
        startTime: start,
        endTime: end,
        duration: end.getTime() - start.getTime(),
      };

      ErrorHandler.logError(task.id, e);
      this.storage.saveResult(taskResult);
    } finally {
      this.concurrencyManager.releaseSlot(task.id);
      this.activeTasks.delete(task.id);
      void this.processQueue();
    }
  }

  private async checkDependencies(task: TaskConfig): Promise<void> {
    if (!task.dependencies || task.dependencies.length === 0) {
      return;
    }

    for (const depId of task.dependencies) {
      const depResult = this.storage.getResult(depId);
      if (!depResult || !depResult.success) {
        throw new Error(`Dependency failed: ${depId}`);
      }
    }
  }

  async cancel(taskId: string): Promise<boolean> {
    const cancelled = this.concurrencyManager.cancelTask(taskId);

    if (cancelled) {
      // 保存取消结果
      const cancelResult: TaskResult = {
        taskId,
        success: false,
        error: 'Task was cancelled',
        startTime: new Date(),
        endTime: new Date(),
        duration: 0,
        cancelled: true,
      };
      this.storage.saveResult(cancelResult);
      this.activeTasks.delete(taskId);
    }

    return cancelled;
  }

  async cleanup(): Promise<void> {
    // 等待所有运行中的任务完成
    const maxWaitTime = 30000; // 30秒
    const startTime = Date.now();

    while (this.concurrencyManager.getRunningCount() > 0 && Date.now() - startTime < maxWaitTime) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // 重置核心组件，确保后续调用仍然安全
    const { concurrencyManager, taskQueue, storage } = this.dependencies;

    this.concurrencyManager = concurrencyManager ?? new ConcurrencyManager(this.maxConcurrency);
    this.taskQueue = taskQueue ?? new TaskQueue();
    this.storage = storage ?? new JsonStorage();

    if (concurrencyManager && typeof (concurrencyManager as any).reset === 'function') {
      (concurrencyManager as any).reset();
    }
    if (taskQueue && typeof (taskQueue as any).clear === 'function') {
      (taskQueue as any).clear();
    }
    if (storage && typeof (storage as any).clear === 'function') {
      (storage as any).clear();
    }
    this.activeTasks.clear();
  }
}
