import { afterEach, describe, expect, it, vi } from 'vitest';

// 说明：当前实现中，prepareWorkspace 的 mkdir 失败会导致 applyPatch 抛出异常并中断 drainQueue。
// 本用例以跳过（it.skip）形式标注期望行为：将来应在 mkdir 失败时发出 patch_failed 并不中断后续补丁处理。

describe('SWW workspace error does not break queue (expected behavior - pending)', () => {
  const modulePath: string = '../sww-coordinator.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.skip('should emit task_failed/patch_failed for workspace mkdir error and continue processing', async () => {
    const { SWWCoordinator } = await import(modulePath);

    const events: Array<Record<string, any>> = [];
    const stateManager = { emitEvent: vi.fn(async (p: any) => void events.push(p)) };

    const c = new SWWCoordinator({ stateManager } as any);

    // 注入 workspace 创建失败
    const mod = await import('../sww-coordinator.js');
    vi.spyOn(mod as any, 'prepareWorkspace').mockRejectedValue(new Error('EACCES'));

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
    // 期望仍然处理 next 补丁
    const hasNext = events.some((e) => (e as any).data?.patchId === 'next');
    expect(hasNext).toBe(true);
  });
});
