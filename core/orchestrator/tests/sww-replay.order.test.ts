import { describe, it, expect } from 'vitest';
import { SWWCoordinator } from '../sww-coordinator.js';

describe('SWW replay order after resetAbort (T004)', () => {
  it('applies re-queued patches in FIFO order', async () => {
    const c = new SWWCoordinator();

    // 尝试快速中止，避免首批全部应用
    c.enqueuePatch({
      id: 'old1',
      taskId: 't',
      sequence: 1,
      filePath: 'a.diff',
      targetFiles: ['a.txt'],
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as any);
    c.enqueuePatch({
      id: 'old2',
      taskId: 't',
      sequence: 2,
      filePath: 'b.diff',
      targetFiles: ['b.txt'],
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as any);
    c.requestAbort();
    await c.processQueue();

    // 恢复后重放两条新补丁
    c.resetAbort();
    c.enqueuePatch({
      id: 'np1',
      taskId: 't',
      sequence: 3,
      filePath: 'c.diff',
      targetFiles: ['c.txt'],
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as any);
    c.enqueuePatch({
      id: 'np2',
      taskId: 't',
      sequence: 4,
      filePath: 'd.diff',
      targetFiles: ['d.txt'],
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as any);
    await c.processQueue();

    const applied = c.events.filter((e) => e.event === 'patch_applied').map((e) => e.patch.id);
    const idx1 = applied.indexOf('np1');
    const idx2 = applied.indexOf('np2');
    expect(idx1).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeGreaterThan(idx1);
  });
});
