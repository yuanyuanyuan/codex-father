import type { QuickValidateResult } from './types.js';

/**
 * 快速校验器参数。
 */
export interface QuickValidateOptions {
  /** 预期执行的任务数量。 */
  readonly tasksCount?: number;
}

/**
 * 对即将执行的任务和配置进行轻量校验喵。
 *
 * @param options 校验选项。
 * @returns 校验结果。
 */
export async function quickValidate(options?: QuickValidateOptions): Promise<QuickValidateResult> {
  if (options?.tasksCount !== undefined && options.tasksCount < 0) {
    return {
      valid: false,
      errors: ['tasksCount 不能为负数'],
      warnings: [],
    };
  }

  return {
    valid: true,
    errors: [],
    warnings: [],
  };
}
