import type { CancelResult, EnqueueResult, RetryResult, Task, TaskStatus } from '../types.js';
import { BasicQueueOperations } from './basic-operations.js';
import { BasicTaskExecutor, type ExecutionOptions } from './basic-executor.js';
import { ensureQueueStructure } from './tools.js';

export class TaskQueueAPI {
  private readonly ops: BasicQueueOperations;
  private readonly executor: BasicTaskExecutor;

  constructor(queuePath?: string) {
    const dir = ensureQueueStructure(queuePath).base;
    this.ops = new BasicQueueOperations({ queuePath: dir });
    this.executor = new BasicTaskExecutor(dir);
  }

  enqueue(def: {
    type: string;
    priority?: number;
    payload?: Record<string, unknown>;
  }): Promise<EnqueueResult> {
    return this.ops.enqueueTask({
      type: def.type,
      priority: def.priority ?? 5,
      payload: def.payload ?? {},
    });
  }

  getTask(id: string): Promise<Task | null> {
    return this.ops.getTask(id);
  }
  list(status?: TaskStatus): Promise<Task[]> {
    return this.ops.listTasks(status);
  }
  cancel(id: string, reason?: string): Promise<CancelResult> {
    return this.ops.cancelTask(id, reason);
  }
  retry(id: string): Promise<RetryResult> {
    return this.ops.retryTask(id);
  }
  stats(): Promise<Record<TaskStatus, number>> {
    return this.ops.getQueueStats();
  }
  execute(id: string, options?: ExecutionOptions): ReturnType<BasicTaskExecutor['executeTask']> {
    return this.executor.executeTask(id, options);
  }
}
