import { TaskConfig, TaskResult, RunnerStatus } from './types.js';
import { ErrorHandler } from './utils.js';
import { JsonStorage } from './storage.js';
import { ConcurrencyManager } from './concurrency.js';
import { TaskQueue } from './queue.js';

export class TaskRunner {
  private concurrencyManager: ConcurrencyManager;
  private taskQueue: TaskQueue;
  private storage: JsonStorage;
  private maxConcurrency: number;

  constructor(maxConcurrency: number = 10) {
    this.maxConcurrency = maxConcurrency;
    this.concurrencyManager = new ConcurrencyManager(maxConcurrency);
    this.taskQueue = new TaskQueue();
    this.storage = new JsonStorage();
  }

  async run(task: TaskConfig): Promise<string> {
    ErrorHandler.validateTask(task);

    await this.checkDependencies(task);
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
        id: task.id,
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
        id: task.id,
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
    return this.concurrencyManager.cancelTask(taskId);
  }
}
