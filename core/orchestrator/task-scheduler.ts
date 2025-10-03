import { createDefaultOrchestratorConfig } from './types.js';
import type { OrchestratorConfig, TaskDefinition, TaskScheduleResult } from './types.js';

/**
 * TaskScheduler 负责根据编排配置生成下一批可执行任务喵。
 */
export class TaskScheduler {
  /** 任务调度使用的配置。 */
  private readonly config: OrchestratorConfig;

  /**
   * 创建任务调度器。
   *
   * @param config 可选调度配置。
   */
  public constructor(config?: Partial<OrchestratorConfig>) {
    this.config = {
      ...createDefaultOrchestratorConfig(),
      ...config,
    } satisfies OrchestratorConfig;
  }

  /**
   * 根据配置裁剪待执行任务。
   *
   * @param tasks 待调度任务。
   * @returns 调度结果。
   */
  public schedule(tasks: readonly TaskDefinition[]): TaskScheduleResult {
    const scheduledTasks = tasks.slice(0, this.config.maxConcurrency);
    const throttled = tasks.length > scheduledTasks.length;
    return {
      scheduledTasks,
      throttled,
    };
  }
}
