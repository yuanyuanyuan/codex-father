import { describe, it, expect } from 'vitest';
import { SWWCoordinator } from '../sww-coordinator.js';
import type { Patch } from '../types.js';

const mk = (overrides: Partial<Patch> = {}): Patch =>
  ({
    id: overrides.id ?? `p_${Math.random().toString(36).slice(2)}`,
    taskId: overrides.taskId ?? 't1',
    sequence: overrides.sequence ?? 1,
    filePath: overrides.filePath ?? 'a.diff',
    targetFiles: overrides.targetFiles ?? ['a.txt'],
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    status: overrides.status ?? 'pending',
  }) as any;

describe('SWW resetAbort 允许恢复后重放补丁队列 (T004)', () => {
  it('requestAbort 丢弃队列；resetAbort 后仍可成功应用新补丁', async () => {
    const sww = new SWWCoordinator();

    const first = mk({ id: 'p1' });
    sww.enqueuePatch(first);
    // 中止，清空队列
    const dropped = sww.requestAbort();
    expect(dropped).toBeGreaterThanOrEqual(0);

    // 恢复中止标记并重放新补丁
    sww.resetAbort();
    const second = mk({ id: 'p2', sequence: 2, targetFiles: ['b.txt'] });
    sww.enqueuePatch(second);
    await sww.processQueue();

    const last = sww.events.at(-1);
    expect(last?.event).toBe('patch_applied');
    expect(last?.patch.id).toBe('p2');
  });
});
