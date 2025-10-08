import { describe, it, expect } from 'vitest';
import { SWWCoordinator } from '../../orchestrator/sww-coordinator.js';

function makePatch(
  overrides: Partial<import('../types.js').Patch> = {}
): import('../types.js').Patch {
  const base: import('../types.js').Patch = {
    id: `p_${Math.random().toString(36).slice(2)}`,
    taskId: 'task-1',
    sequence: 1,
    filePath: 'dummy.diff',
    targetFiles: ['a.txt'],
    createdAt: new Date().toISOString(),
    status: 'pending',
  } as any;
  return { ...base, ...overrides };
}

describe('SWW window releases on early error (preCheck) and allows next patch', () => {
  it('failing patch (preCheck) does not block subsequent patch application', async () => {
    const sww = new SWWCoordinator();

    // 第一个补丁：制造 preCheck 失败（没有 targetFiles）
    const badPatch = makePatch({ targetFiles: [] });
    const goodPatch = makePatch({ id: 'p_ok', sequence: 2, targetFiles: ['b.txt'] });

    let failedCount = 0;
    let appliedCount = 0;
    sww.on('patch_failed', () => void (failedCount += 1));
    sww.on('patch_applied', () => void (appliedCount += 1));

    sww.enqueuePatch(badPatch);
    sww.enqueuePatch(goodPatch);
    await sww.processQueue();

    expect(failedCount).toBeGreaterThanOrEqual(1);
    expect(appliedCount).toBe(1);
  });
});
