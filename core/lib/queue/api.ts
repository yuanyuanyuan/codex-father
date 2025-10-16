import type { CancelResult, EnqueueResult, RetryResult, Task, TaskStatus } from '../types.js';

export type WireApi = 'chat' | 'responses';

export const MODEL_WIRE_API_MAP: Record<string, WireApi> = {
  'gpt-5-codex': 'responses',
  'gpt-4': 'chat',
  'gpt-4-turbo': 'chat',
  'gpt-4-turbo-preview': 'chat',
  'gpt-4-32k': 'chat',
  'gpt-3.5-turbo': 'chat',
  'gpt-3.5-turbo-16k': 'chat',
  'claude-3-opus-20240229': 'chat',
  'claude-3-sonnet-20240229': 'chat',
  'claude-3-haiku-20240307': 'chat',
  'claude-2.1': 'chat',
  'claude-2': 'chat',
};

export function getRecommendedWireApi(model: string): WireApi | null {
  return MODEL_WIRE_API_MAP[model] ?? null;
}

export function validateWireApiForModel(model: string, wireApi: WireApi): boolean {
  const recommended = getRecommendedWireApi(model);
  return recommended ? recommended === wireApi : true;
}

export function getModelsForWireApi(wireApi: WireApi): string[] {
  return Object.entries(MODEL_WIRE_API_MAP)
    .filter(([, value]) => value === wireApi)
    .map(([model]) => model);
}
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
