import { describe, it, expect } from 'vitest';

import { SWWCoordinator } from '../../orchestrator/sww-coordinator.js';
import type { Patch } from '../../orchestrator/types.js';

describe('SWWCoordinator - same-path conflict then replay succeeds', () => {
  it('detects conflict on same target file and succeeds after replay with newer timestamp', async () => {
    const sww = new SWWCoordinator();

    // 先应用较早创建的补丁 p1（目标文件相同）
    const now = Date.now();
    const target = 'src/shared/file.ts';
    const p1: Patch = {
      id: 'patch_001',
      taskId: 't_same',
      sequence: 1,
      filePath: 'p1.diff',
      targetFiles: [target],
      status: 'pending',
      createdAt: new Date(now - 2000).toISOString(),
    } as Patch;

    sww.enqueuePatch(p1);
    await sww.processQueue();
    const applied1 = sww.events.find(
      (e) => e.event === 'patch_applied' && e.patch.id === 'patch_001'
    );
    expect(applied1).toBeTruthy();

    // 再入队较早创建时间但之后才入队的 p2（相同目标文件），应冲突失败
    const p2: Patch = {
      id: 'patch_002',
      taskId: 't_same',
      sequence: 2,
      filePath: 'p2.diff',
      targetFiles: [target],
      status: 'pending',
      createdAt: new Date(now - 1500).toISOString(), // 仍早于 p1 的 appliedAt（由实现判定）
    } as Patch;

    sww.enqueuePatch(p2);
    await sww.processQueue();
    const failed = sww.events.find((e) => e.event === 'patch_failed' && e.patch.id === 'patch_002');
    expect(failed).toBeTruthy();
    expect(failed && typeof failed.errorMessage === 'string').toBe(true);

    // 重放：更新时间戳为更晚（表示基于最新基线生成的补丁），应成功
    const p2Replay: Patch = {
      ...p2,
      id: 'patch_002_replay',
      sequence: 3,
      status: 'pending',
      createdAt: new Date(now + 1000).toISOString(),
    } as Patch;
    sww.enqueuePatch(p2Replay);
    await sww.processQueue();
    const applied2 = sww.events.find(
      (e) => e.event === 'patch_applied' && e.patch.id === 'patch_002_replay'
    );
    expect(applied2).toBeTruthy();
  });
});
