import type { PatchApplyResult, PatchProposal } from './types.js';

/**
 * PatchApplier 管理补丁应用与结果反馈喵。
 */
export class PatchApplier {
  /**
   * 应用补丁：支持 git 优先与回退到 native 的策略。
   * 说明：返回值遵循 PatchApplyResult，但在需要时会附带
   *  - strategy: 'git' | 'native'
   *  - usedFallback: boolean
   * 以便测试进行断言（结构化类型允许返回额外字段）。
   */
  public async apply(
    proposal: PatchProposal,
    options?: {
      gitApplyAvailable?: boolean;
      fallbackToNative?: boolean;
      strategies?: {
        git?: (
          p: PatchProposal
        ) => Promise<PatchApplyResult & { strategy?: 'git' | 'native'; usedFallback?: boolean }>;
        native?: (
          p: PatchProposal
        ) => Promise<PatchApplyResult & { strategy?: 'git' | 'native'; usedFallback?: boolean }>;
      };
    }
  ): Promise<PatchApplyResult> {
    // 1) 基本校验：必须包含目标文件
    if (!proposal?.targetFiles || proposal.targetFiles.length === 0) {
      return {
        success: false,
        errorMessage: '目标文件为空（target files empty），补丁无法应用',
      };
    }

    const gitAvailable = options?.gitApplyAvailable === true && !!options?.strategies?.git;
    const canFallback = options?.fallbackToNative === true && !!options?.strategies?.native;
    const git = options?.strategies?.git;
    const native = options?.strategies?.native;

    // 2) 若 git 可用则优先尝试 git
    if (gitAvailable && git) {
      try {
        const gitRes = await git(proposal);
        if (gitRes?.success) {
          return { ...gitRes, strategy: 'git' } as PatchApplyResult;
        }

        // git 执行但失败：若允许回退则尝试 native
        if (canFallback && native) {
          const nativeRes = await native(proposal);
          if (nativeRes?.success) {
            return { ...nativeRes, strategy: 'native', usedFallback: true } as PatchApplyResult;
          }
          return {
            ...nativeRes,
            success: false,
            errorMessage: this.composeFallbackError(nativeRes?.errorMessage, 'git apply 失败'),
          } as PatchApplyResult;
        }

        // 不允许回退则直接失败
        return {
          success: false,
          errorMessage: gitRes?.errorMessage ?? 'git apply 失败',
        };
      } catch (e) {
        // git 抛错：若允许回退则尝试 native
        if (canFallback && native) {
          const nativeRes = await native(proposal);
          if (nativeRes?.success) {
            return { ...nativeRes, strategy: 'native', usedFallback: true } as PatchApplyResult;
          }
          return {
            ...nativeRes,
            success: false,
            errorMessage: this.composeFallbackError(
              nativeRes?.errorMessage,
              `git 异常：${this.formatError(e)}`
            ),
          } as PatchApplyResult;
        }

        return {
          success: false,
          errorMessage: `git 应用异常且未回退：${this.formatError(e)}`,
        };
      }
    }

    // 3) 其它情况：若提供 native 则直接走 native
    if (native) {
      const res = await native(proposal);
      if (res?.success) {
        return { ...res, strategy: 'native' } as PatchApplyResult;
      }
      return {
        ...res,
        success: false,
        errorMessage: res?.errorMessage ?? 'native 应用失败',
      } as PatchApplyResult;
    }

    // 4) 无可用策略时，返回失败
    return {
      success: false,
      errorMessage: '无可用补丁策略（git/native 均不可用）',
    };
  }

  private composeFallbackError(nativeMsg?: string, gitReason?: string): string {
    // 测试断言需要包含 "native"/"失败"/"fallback" 关键词
    const parts: string[] = [];
    if (nativeMsg) {
      parts.push(nativeMsg);
    }
    if (gitReason) {
      parts.push(gitReason);
    }
    parts.push('native fallback 失败');
    return parts.join('；');
  }

  private formatError(err: unknown): string {
    if (err instanceof Error && err.message) {
      return err.message;
    }
    if (typeof err === 'string') {
      return err;
    }
    try {
      return JSON.stringify(err);
    } catch {
      return '未知错误';
    }
  }
}
