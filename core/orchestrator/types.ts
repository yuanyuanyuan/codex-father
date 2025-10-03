/**
 * Orchestrator 模块的公共类型定义，覆盖编排配置、任务与状态结构喵。
 */
export type OrchestratorMode = 'sequential' | 'concurrent';

/**
 * 编排器运行配置。
 */
export interface OrchestratorConfig {
  /** 最大并发度，必须是正整数。 */
  readonly maxConcurrency: number;
  /** 成功阈值，决定任务成功率判定。 */
  readonly successThreshold: number;
  /** 任务执行模式。 */
  readonly mode: OrchestratorMode;
  /** 单个任务的超时时间（毫秒）。 */
  readonly taskTimeoutMs: number;
}

/**
 * 编排任务定义信息。
 */
export interface TaskDefinition {
  /** 任务唯一标识。 */
  readonly id: string;
  /** 任务描述。 */
  readonly description?: string;
  /** 任务期望执行时限（毫秒）。 */
  readonly expectedDurationMs?: number;
}

/**
 * 任务调度结果。
 */
export interface TaskScheduleResult {
  /** 实际将要执行的任务列表。 */
  readonly scheduledTasks: readonly TaskDefinition[];
  /** 是否触发限流或等待。 */
  readonly throttled: boolean;
}

/**
 * 快速校验的返回结果。
 */
export interface QuickValidateResult {
  /** 校验是否通过。 */
  readonly valid: boolean;
  /** 错误列表。 */
  readonly errors: readonly string[];
  /** 警告信息。 */
  readonly warnings: readonly string[];
}

/**
 * 补丁提案结构。
 */
export interface PatchProposal {
  /** 补丁的唯一标识。 */
  readonly id: string;
  /** 预期应用的文件路径列表。 */
  readonly targetFiles: readonly string[];
  /** 补丁内容摘要。 */
  readonly summary?: string;
}

/**
 * 补丁应用的结果描述。
 */
export interface PatchApplyResult {
  /** 是否应用成功。 */
  readonly success: boolean;
  /** 失败时的错误信息。 */
  readonly errorMessage?: string;
}

/**
 * 状态快照。
 */
export interface OrchestratorStateSnapshot {
  /** 当前任务完成数量。 */
  readonly completedTasks: number;
  /** 当前任务失败数量。 */
  readonly failedTasks: number;
  /** 最近一次更新时间戳。 */
  readonly updatedAt: number;
}

/**
 * 资源使用情况快照。
 */
export interface ResourceSnapshot {
  /** 进程 CPU 使用率（0-1）。 */
  readonly cpuUsage: number;
  /** 进程 RSS 内存使用量（字节）。 */
  readonly memoryUsage: number;
  /** 采样时间戳。 */
  readonly timestamp: number;
}

/**
 * 单次编排上下文。
 */
export interface OrchestratorContext {
  /** 编排配置。 */
  readonly config: OrchestratorConfig;
  /** 待执行任务列表。 */
  readonly tasks: readonly TaskDefinition[];
}

/**
 * 创建默认的编排器配置。
 *
 * @returns 默认配置对象。
 */
export function createDefaultOrchestratorConfig(): OrchestratorConfig {
  return {
    maxConcurrency: 1,
    successThreshold: 1,
    mode: 'sequential',
    taskTimeoutMs: 5 * 60 * 1000,
  };
}
