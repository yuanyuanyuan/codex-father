import { describe, it, expect } from 'vitest';
import { SWWCoordinator } from '../../orchestrator/sww-coordinator.js';
import type { Patch } from '../../orchestrator/types.js';

describe('SWWCoordinator - mixed: cross-dir same basename + same-path conflict', () => {
  it('keeps order for cross-dir same basename; conflicts only on identical path; replay fixes', async () => {
    const sww = new SWWCoordinator();
    const base = Date.now();
    const sameName = 'fileX.ts';

    // 1) 不同目录但相同 basename，不应冲突，顺序按入队
    const p1: Patch = {
      id: 'patch_101',
      taskId: 't_mix',
      sequence: 1,
      filePath: 'p1.diff',
      targetFiles: [`apps/a/${sameName}`],
      status: 'pending',
      createdAt: new Date(base - 2000).toISOString(),
    } as Patch;
    const p2: Patch = {
      id: 'patch_102',
      taskId: 't_mix',
      sequence: 2,
      filePath: 'p2.diff',
      targetFiles: [`packages/b/${sameName}`],
      status: 'pending',
      createdAt: new Date(base - 1500).toISOString(),
    } as Patch;

    // 2) 同一路径补丁，创建时间早于前一个应用时刻，触发冲突
    const p3Conflict: Patch = {
      id: 'patch_103',
      taskId: 't_mix',
      sequence: 3,
      filePath: 'p3.diff',
      targetFiles: [`apps/a/${sameName}`],
      status: 'pending',
      createdAt: new Date(base - 1400).toISOString(),
    } as Patch;

    // 3) 重放：同一路径，但创建时间更晚，表示基于最新基线生成，应成功
    const p4Replay: Patch = {
      id: 'patch_104',
      taskId: 't_mix',
      sequence: 4,
      filePath: 'p4.diff',
      targetFiles: [`apps/a/${sameName}`],
      status: 'pending',
      createdAt: new Date(base + 500).toISOString(),
    } as Patch;

    sww.enqueuePatch(p1);
    sww.enqueuePatch(p2);
    await sww.processQueue();

    // 前两者均应用；顺序与入队一致
    const applied = sww.events.filter((e) => e.event === 'patch_applied');
    expect(applied.length).toBe(2);
    expect(applied[0].patch.id).toBe('patch_101');
    expect(applied[1].patch.id).toBe('patch_102');

    // 入队冲突补丁并处理
    sww.enqueuePatch(p3Conflict);
    await sww.processQueue();
    const failed = sww.events.find((e) => e.event === 'patch_failed' && e.patch.id === 'patch_103');
    expect(failed).toBeTruthy();

    // 重放补丁成功
    sww.enqueuePatch(p4Replay);
    await sww.processQueue();
    const appliedReplay = sww.events.find(
      (e) => e.event === 'patch_applied' && e.patch.id === 'patch_104'
    );
    expect(appliedReplay).toBeTruthy();
  });
});
