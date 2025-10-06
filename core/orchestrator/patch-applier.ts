import type { PatchApplyResult, PatchProposal } from './types.js';

type StrategyId = 'git' | 'native';

type StrategyResult = PatchApplyResult & {
  readonly strategy?: StrategyId;
  readonly usedFallback?: boolean;
};

type StrategyExecutor = (proposal: PatchProposal) => Promise<StrategyResult>;

export interface PatchApplyOptions {
  readonly gitApplyAvailable?: boolean;
  readonly fallbackToNative?: boolean;
  readonly strategies?: Partial<Record<StrategyId, StrategyExecutor>>;
}

const ensureStrategyResult = (
  result: StrategyResult,
  strategy: StrategyId,
  usedFallback: boolean
): StrategyResult => ({
  ...result,
  strategy: result.strategy ?? strategy,
  usedFallback: result.usedFallback ?? usedFallback,
});

const formatError = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return '未知错误';
  }
};

const buildGitFailureMessage = (
  reason: string,
  fallbackRequested: boolean,
  nativeAvailable: boolean
): string => {
  const messageParts = ['git 策略失败'];
  if (reason) {
    messageParts.push(`原因: ${reason}`);
  }
  if (fallbackRequested) {
    messageParts.push(
      nativeAvailable ? 'native fallback 已启用但未执行' : 'native fallback 不可用'
    );
  } else {
    messageParts.push('fallback 未启用');
  }
  return messageParts.join('；');
};

const withFallbackContext = (result: StrategyResult, gitReason: string): StrategyResult => {
  if (result.success) {
    if (result.errorMessage) {
      return {
        ...result,
        errorMessage: `${result.errorMessage}；native fallback 提示：git 原因 ${gitReason}`,
      };
    }
    return result;
  }

  const fallbackMessage = result.errorMessage
    ? `${result.errorMessage}；native fallback 失败（git 原因：${gitReason}）`
    : `native fallback 失败（git 原因：${gitReason}）`;

  return {
    ...result,
    errorMessage: fallbackMessage,
  };
};

/**
 * PatchApplier 管理补丁应用与结果反馈喵。
 */
export class PatchApplier {
  /**
   * 应用补丁提案：优先尝试 git 策略，必要时回退到 native。
   */
  public async apply(
    proposal: PatchProposal,
    options?: PatchApplyOptions
  ): Promise<PatchApplyResult> {
    if (!proposal.targetFiles || proposal.targetFiles.length === 0) {
      return {
        success: false,
        errorMessage: '目标文件为空，补丁无法应用',
      };
    }

    const strategies = options?.strategies ?? {};
    const gitStrategy = options?.gitApplyAvailable === true ? strategies.git : undefined;
    const nativeStrategy = strategies.native;
    const fallbackRequested = options?.fallbackToNative === true;

    if (!gitStrategy && !nativeStrategy) {
      return {
        success: false,
        errorMessage: '未提供可用策略，native fallback 不可用，补丁应用失败',
      };
    }

    const runNativeFallback = async (gitReason: string): Promise<StrategyResult> => {
      if (!nativeStrategy) {
        return {
          success: false,
          strategy: 'git',
          usedFallback: false,
          errorMessage: buildGitFailureMessage(gitReason, true, false),
        };
      }

      try {
        const nativeResult = ensureStrategyResult(await nativeStrategy(proposal), 'native', true);
        return withFallbackContext(nativeResult, gitReason);
      } catch (nativeError) {
        const failureResult: StrategyResult = {
          success: false,
          strategy: 'native',
          usedFallback: true,
          errorMessage: formatError(nativeError),
        };
        return withFallbackContext(failureResult, gitReason);
      }
    };

    if (gitStrategy) {
      try {
        const gitResult = ensureStrategyResult(await gitStrategy(proposal), 'git', false);

        if (gitResult.success) {
          return gitResult;
        }

        const failureReason = gitResult.errorMessage ?? 'git 策略返回失败';

        if (fallbackRequested) {
          return await runNativeFallback(failureReason);
        }

        return {
          ...gitResult,
          errorMessage: buildGitFailureMessage(failureReason, false, Boolean(nativeStrategy)),
        };
      } catch (gitError) {
        const gitReason = formatError(gitError);

        if (fallbackRequested) {
          return await runNativeFallback(gitReason);
        }

        return {
          success: false,
          strategy: 'git',
          usedFallback: false,
          errorMessage: gitReason,
        } as unknown as PatchApplyResult;
      }
    }

    if (nativeStrategy) {
      try {
        const nativeResult = await nativeStrategy(proposal);
        return ensureStrategyResult(nativeResult, 'native', false);
      } catch (nativeError) {
        return {
          success: false,
          strategy: 'native',
          usedFallback: false,
          errorMessage: formatError(nativeError),
        } as unknown as PatchApplyResult;
      }
    }

    return {
      success: false,
      errorMessage: '未提供可用策略，native fallback 不可用，补丁应用失败',
    };
  }
}
