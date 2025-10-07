import { describe, expect, it, vi } from 'vitest';
import { PatchApplier } from '../patch-applier';
import type { PatchApplyResult, PatchProposal } from '../types';

type StrategyResult = PatchApplyResult & { strategy?: 'git' | 'native'; usedFallback?: boolean };

describe('PatchApplier edge cases (T027)', () => {
  const buildProposal = (overrides: Partial<PatchProposal> = {}): PatchProposal => ({
    id: overrides.id ?? 'patch_edge',
    targetFiles: overrides.targetFiles ?? ['src/app.ts'],
    summary: overrides.summary,
  });

  it('when git not available → run native directly and succeed', async () => {
    const applier = new PatchApplier();
    const proposal = buildProposal({ id: 'p_native_only' });
    const native = vi.fn(async () => ({ success: true, strategy: 'native' }));

    const res = await (applier as any).apply(proposal, {
      gitApplyAvailable: false,
      strategies: { native },
    });

    expect(native).toHaveBeenCalledTimes(1);
    expect(res.success).toBe(true);
    expect(res.strategy).toBe('native');
  });

  it('git rejects and native throws → overall failure with fallback context', async () => {
    const applier = new PatchApplier();
    const proposal = buildProposal({ id: 'p_native_throw' });
    const git = vi.fn(async () => {
      throw new Error('git exploded');
    });
    const native = vi.fn(async () => {
      throw new Error('native threw');
    });

    const res = await (applier as any).apply(proposal, {
      gitApplyAvailable: true,
      fallbackToNative: true,
      strategies: { git, native },
    });

    expect(git).toHaveBeenCalledTimes(1);
    expect(native).toHaveBeenCalledTimes(1);
    expect(res.success).toBe(false);
    expect(res.errorMessage ?? '').toMatch(/native|fallback|失败|throw/i);
  });

  it('no strategies provided → fail with clear message', async () => {
    const applier = new PatchApplier();
    const proposal = buildProposal({ id: 'p_no_strategies' });
    const res = await (applier as any).apply(proposal, {});
    expect(res.success).toBe(false);
    expect(res.errorMessage ?? '').toMatch(/未提供可用策略|fallback/i);
  });
});
