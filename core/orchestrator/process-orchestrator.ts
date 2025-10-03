import { createDefaultOrchestratorConfig } from './types.js';
import type { OrchestratorConfig, OrchestratorContext, TaskDefinition } from './types.js';

/**
 * ProcessOrchestrator 负责串联调度、状态、验证与补丁写入的核心流程喵。
 */
export class ProcessOrchestrator {
  /** 当前编排器配置。 */
  public readonly config: OrchestratorConfig;

  /**
   * 使用可选配置创建编排器实例。
   *
   * @param config 覆盖默认值的局部配置。
   */
  public constructor(config?: Partial<OrchestratorConfig>) {
    this.config = {
      ...createDefaultOrchestratorConfig(),
      ...config,
    } satisfies OrchestratorConfig;
  }

  /**
   * 基于输入任务构建运行上下文。
   *
   * @param tasks 待执行任务列表。
   * @returns 编排上下文。
   */
  public createContext(tasks: readonly TaskDefinition[]): OrchestratorContext {
    const normalizedTasks = [...tasks];
    return {
      config: this.config,
      tasks: normalizedTasks,
    };
  }

  /**
   * 编排入口，当前仅返回构造后的上下文。
   *
   * @param tasks 待执行任务列表。
   * @returns Promise 包裹的上下文占位实现。
   */
  public async orchestrate(tasks: readonly TaskDefinition[]): Promise<OrchestratorContext> {
    return Promise.resolve(this.createContext(tasks));
  }
}
