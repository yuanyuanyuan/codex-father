import { BasicQueueOperations } from './basic-operations.js';
import { BasicTaskExecutor, type ExecutionOptions } from './basic-executor.js';
import type { Task } from '../types.js';
import { ensureQueueStructure } from './tools.js';

export interface SchedulerOptions {
  queuePath?: string;
  intervalMs?: number;
  maxConcurrent?: number;
  execution?: ExecutionOptions;
}

export class TaskScheduler {
  private readonly ops: BasicQueueOperations;
  private readonly executor: BasicTaskExecutor;
  private readonly intervalMs: number;
  private readonly maxConcurrent: number;
  private timer: NodeJS.Timeout | null = null;
  private running = 0;

  constructor(options: SchedulerOptions = {}) {
    const dir = ensureQueueStructure(options.queuePath).base;
    this.ops = new BasicQueueOperations({ queuePath: dir });
    this.executor = new BasicTaskExecutor(dir);
    this.intervalMs = Math.max(options.intervalMs ?? 1000, 1);
    this.maxConcurrent = Math.max(options.maxConcurrent ?? 1, 1);
  }

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = null;
  }

  async tick(): Promise<void> {
    // 1) Promote due scheduled tasks to pending
    const scheduled = await this.ops.listTasks('scheduled');
    const now = Date.now();
    for (const t of scheduled) {
      const due = t.scheduledAt ? new Date(t.scheduledAt).getTime() <= now : true;
      if (due) {
        await this.ops.updateTaskStatus(t.id, 'pending');
      }
    }

    // 2) Start due retrying tasks first (respect max concurrency)
    await this.consumeDueRetrying(now);

    // 3) Fill remaining slots with pending tasks
    while (this.running < this.maxConcurrent) {
      const next = await this.ops.dequeueTask();
      if (!next) {
        break;
      }
      await this.run(next);
    }
  }

  private async consumeDueRetrying(nowValue: number): Promise<void> {
    const retrying = await this.ops.listTasks('retrying');
    // run tasks whose scheduledAt <= now
    const due = retrying.filter(
      (t) => t.scheduledAt && new Date(t.scheduledAt).getTime() <= nowValue
    );
    for (const task of due) {
      if (this.running >= this.maxConcurrent) {
        break;
      }
      await this.ops.updateTaskStatus(task.id, 'processing');
      await this.run(task);
    }
  }

  private async run(task: Task): Promise<void> {
    this.running += 1;
    try {
      await this.executor.executeTask(task.id);
    } finally {
      this.running -= 1;
    }
  }
}
