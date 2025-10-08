import { afterEach, describe, expect, it, vi } from 'vitest';

// 说明：当前实现中，prepareWorkspace 的 mkdir 失败会导致 applyPatch 抛出异常并中断 drainQueue。
// 本用例以跳过（it.skip）形式标注期望行为：将来应在 mkdir 失败时发出 patch_failed 并不中断后续补丁处理。

import type { Patch } from '../types.js';

describe('SWW workspace error does not break queue (expected behavior now)', () => {
  const modulePath: string = '../sww-coordinator.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should emit task_failed/patch_failed for workspace mkdir error and continue processing', async () => {
    const { SWWCoordinator } = await import(modulePath);

    const events: Array<Record<string, any>> = [];
    const stateManager = { emitEvent: vi.fn(async (p: any) => void events.push(p)) };

    const c = new SWWCoordinator({ stateManager } as any);

    // 注入 workspace 创建失败（仅首次），其后恢复为成功
    let calls = 0;
    (c as any).prepareWorkspace = vi.fn(async (_patch: Patch) => {
      calls += 1;
      if (calls === 1) {
        throw new Error('EACCES');
      }
      return `/tmp/.sww/${_patch.taskId}/${_patch.sequence}-${_patch.id}`;
    });

    const ok = {
      id: 'ok',
      taskId: 't1',
      sequence: 1,
      filePath: '/tmp/ok.diff',
      targetFiles: ['/repo/a.ts'],
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as any;

    const next = {
      id: 'next',
      taskId: 't1',
      sequence: 2,
      filePath: '/tmp/next.diff',
      targetFiles: ['/repo/b.ts'],
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as any;

    c.enqueuePatch(ok);
    c.enqueuePatch(next);

    await c.processQueue();

    const names = events.map((e) => e.event);
    expect(names).toContain('task_failed');
    expect(names).toContain('patch_failed');
    // 期望仍然处理 next 补丁并产生 patch_applied
    const appliedForNext = events.find(
      (e) => (e as any).event === 'patch_applied' && (e as any).data?.patchId === 'next'
    );
    expect(!!appliedForNext).toBe(true);
  });
});
