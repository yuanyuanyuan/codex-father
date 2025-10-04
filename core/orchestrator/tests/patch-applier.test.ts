import { describe, expect, it } from 'vitest';
import { PatchApplier } from '../patch-applier';

describe('patch-applier', () => {
  it('导出 PatchApplier 类', () => {
    expect(typeof PatchApplier).toBe('function');
  });

  it('可以实例化 PatchApplier', () => {
    const applier = new PatchApplier();
    expect(applier).toBeInstanceOf(PatchApplier);
  });
});
