import { beforeEach, describe, expect, it } from 'vitest';

import { SWWCoordinator } from '../sww-coordinator.js';
import type { Patch } from '../types.js';

describe('SWWCoordinator 补丁冲突与重放 (T004)', () => {
  let c: SWWCoordinator;
  let seq = 0;

  const mkPatch = (overrides: Partial<Patch> = {}): Patch => {
    seq += 1;
    return {
      id: overrides.id ?? `patch_${seq}`,
      taskId: overrides.taskId ?? `t-task-${seq}`,
      sequence: overrides.sequence ?? seq,
      filePath: overrides.filePath ?? `/tmp/demo-${seq}.diff`,
      targetFiles: overrides.targetFiles ?? ['/repo/a.ts'],
      status: overrides.status ?? 'pending',
      createdAt: overrides.createdAt ?? new Date(Date.now() - 60_000).toISOString(),
      appliedAt: overrides.appliedAt,
      error: overrides.error,
    } as Patch;
  };

  beforeEach(() => {
    c = new SWWCoordinator();
    seq = 0;
  });

  it('同一目标文件在补丁创建后被修改则判定冲突，并可通过重放（更新时间戳）消除冲突', async () => {
    // 先应用一个补丁，更新 /repo/a.ts
    const base = mkPatch({
      id: 'base',
      targetFiles: ['/repo/a.ts'],
      createdAt: new Date(Date.now() - 120_000).toISOString(),
    });
    c.enqueuePatch(base);
    await c.processQueue();
    expect(c.events.at(-1)?.event).toBe('patch_applied');

    // 再来一个老的补丁（创建时间更早），命中同一文件，应触发冲突
    const stale = mkPatch({
      id: 'stale',
      targetFiles: ['/repo/a.ts'],
      createdAt: new Date(Date.now() - 180_000).toISOString(),
    });
    c.enqueuePatch(stale);
    await c.processQueue();

    const last = c.events.at(-1);
    expect(last?.event).toBe('patch_failed');
    expect((last as any)?.errorMessage ?? '').toContain('PATCH_CONFLICT');

    // 重放：更新创建时间（视为基于最新状态生成的补丁），应可成功
    const replay = {
      ...stale,
      id: 'replay',
      createdAt: new Date().toISOString(),
      status: 'pending' as const,
    };
    c.enqueuePatch(replay);
    await c.processQueue();

    const final = c.events.at(-1);
    expect(final?.event).toBe('patch_applied');
    expect(final?.patch.id).toBe('replay');
  });
});
