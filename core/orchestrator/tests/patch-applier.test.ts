import { describe, expect, it, vi } from 'vitest';
import { PatchApplier } from '../patch-applier';
import type { PatchApplyOptions } from '../patch-applier';
import type { PatchProposal } from '../types';

type StrategyResult = Awaited<ReturnType<PatchApplier['apply']>>;
type StrategyFn = (proposal: PatchProposal) => Promise<StrategyResult>;

describe('PatchApplier 策略分支', () => {
  const buildProposal = (overrides: Partial<PatchProposal> = {}): PatchProposal => ({
    id: overrides.id ?? 'patch_demo',
    targetFiles: overrides.targetFiles ?? ['src/app.ts'],
    summary: overrides.summary,
  });

  const invoke = async (
    applier: PatchApplier,
    proposal: PatchProposal,
    options?: PatchApplyOptions
  ): Promise<StrategyResult> => applier.apply(proposal, options);

  it('git 可用时应优先调用 git 策略并返回 strategy="git"', async () => {
    const applier = new PatchApplier();
    const proposal = buildProposal({ id: 'patch_git_first' });
    const gitStrategy = vi.fn<StrategyFn>().mockResolvedValue({
      success: true,
      strategy: 'git',
    } as StrategyResult);
    const nativeStrategy = vi.fn<StrategyFn>().mockResolvedValue({
      success: true,
      strategy: 'native',
    } as StrategyResult);

    const result = await invoke(applier, proposal, {
      gitApplyAvailable: true,
      fallbackToNative: true,
      strategies: { git: gitStrategy, native: nativeStrategy },
    });

    expect(gitStrategy, 'git 策略应被优先执行').toHaveBeenCalledTimes(1);
    expect(nativeStrategy, 'git 策略成功时不应触发 native').not.toHaveBeenCalled();
    expect(result.strategy, '成功结果需明确标记使用的策略').toBe('git');
    expect(result.success, 'git 策略成功时 overall 结果也应成功').toBe(true);
  });

  it('git 失败时应回退 native 并标记 usedFallback=true', async () => {
    const applier = new PatchApplier();
    const proposal = buildProposal({ id: 'patch_git_fallback' });
    const gitStrategy = vi.fn<StrategyFn>().mockResolvedValue({
      success: false,
      errorMessage: 'git apply rejected',
      strategy: 'git',
    } as StrategyResult);
    const nativeStrategy = vi.fn<StrategyFn>().mockResolvedValue({
      success: true,
      strategy: 'native',
    } as StrategyResult);

    const result = await invoke(applier, proposal, {
      gitApplyAvailable: true,
      fallbackToNative: true,
      strategies: { git: gitStrategy, native: nativeStrategy },
    });

    expect(gitStrategy, 'git 策略应先执行即便失败').toHaveBeenCalledTimes(1);
    expect(nativeStrategy, 'git 失败后必须执行 native 作为回退').toHaveBeenCalledTimes(1);
    expect(result.success, '回退成功则整体结果仍应成功').toBe(true);
    expect(result.strategy, '结果策略应指向 native').toBe('native');
    expect(result.usedFallback, '触发回退时需标记 usedFallback').toBe(true);
  });

  it('目标文件为空时直接失败并返回清晰错误信息', async () => {
    const applier = new PatchApplier();
    const proposal = buildProposal({ id: 'patch_empty', targetFiles: [] });

    const result = await invoke(applier, proposal);

    expect(result.success, '缺少目标文件时必须失败').toBe(false);
    expect(result.errorMessage ?? '', '错误信息应提示目标文件为空').toMatch(
      /目标文件|target file|空/
    );
  });

  it('当 git 抛错且 native 也失败时需冒泡最终失败错误', async () => {
    const applier = new PatchApplier();
    const proposal = buildProposal({ id: 'patch_double_failure' });
    const gitStrategy = vi.fn<StrategyFn>().mockRejectedValue(new Error('git apply exploded'));
    const nativeStrategy = vi.fn<StrategyFn>().mockResolvedValue({
      success: false,
      strategy: 'native',
      errorMessage: 'native diff rejected',
    } as StrategyResult);

    const result = await invoke(applier, proposal, {
      gitApplyAvailable: true,
      fallbackToNative: true,
      strategies: { git: gitStrategy, native: nativeStrategy },
    });

    expect(gitStrategy).toHaveBeenCalledTimes(1);
    expect(nativeStrategy).toHaveBeenCalledTimes(1);
    expect(result.success, '双策略都失败时应返回失败').toBe(false);
    expect(result.errorMessage ?? '', '需包含来自回退失败的上下文').toMatch(
      /native|失败|fallback/i
    );
  });

  it('请求回退但未提供 native 策略时应标记 usedFallback 并提示缺少策略', async () => {
    const applier = new PatchApplier();
    const proposal = buildProposal({ id: 'patch_no_native' });
    const gitStrategy = vi.fn<StrategyFn>().mockResolvedValue({
      success: false,
      strategy: 'git',
      errorMessage: 'git apply rejected',
    } as StrategyResult);

    const result = await invoke(applier, proposal, {
      gitApplyAvailable: true,
      fallbackToNative: true,
      strategies: { git: gitStrategy },
    });

    expect(gitStrategy).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
    expect(result.strategy).toBe('git');
    expect(result.usedFallback).toBe(true);
    expect(
      result.errorMessage ?? '',
      '应提示 native fallback 不可用（未提供 native 策略）'
    ).toMatch(/native fallback 不可用（未提供 native 策略）/);
  });
});
