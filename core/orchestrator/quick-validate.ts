import type { QuickValidateResult } from './types.js';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execCb);

/**
 * 快速校验器参数。
 */
export interface QuickValidateOptions {
  /** 预期执行的任务数量（可选，仅用于基本 sanity 校验）。 */
  readonly tasksCount?: number;
  /** 顺序执行的校验步骤（shell 命令）。 */
  readonly steps?: readonly string[];
  /** 当 steps 缺失或为空时，是否直接视为失败。 */
  readonly failOnMissing?: boolean;
  /** 可选的工作目录。 */
  readonly cwd?: string;
}

/**
 * 对即将执行的任务和配置进行轻量校验喵。
 *
 * @param options 校验选项。
 * @returns 校验结果。
 */
export async function quickValidate(options?: QuickValidateOptions): Promise<QuickValidateResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 基本 sanity 校验
  if (options?.tasksCount !== undefined && options.tasksCount < 0) {
    errors.push('tasksCount 不能为负数');
  }

  const steps = options?.steps ?? [];
  const failOnMissing = options?.failOnMissing === true;
  const cwd = options?.cwd;

  // 若未提供 steps
  if (steps.length === 0) {
    if (failOnMissing) {
      errors.push('quickValidate: 缺少 steps 配置');
    } else {
      warnings.push('quickValidate: 未配置 steps，跳过命令校验');
    }
  }

  // 顺序执行 steps（若有）
  for (const raw of steps) {
    const cmd = (raw ?? '').trim();
    if (!cmd) {
      const msg = 'quickValidate: 空的步骤项（空字符串）';
      if (failOnMissing) {
        errors.push(msg);
      } else {
        warnings.push(msg);
      }
      continue;
    }

    try {
      await exec(cmd, { cwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
    } catch (e) {
      const reason = e instanceof Error && e.message ? e.message : String(e);
      errors.push(`quickValidate: 步骤执行失败: \"${cmd}\" → ${reason}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  } satisfies QuickValidateResult;
}
