import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Patch } from '../types.js';

describe('SWW events stream mapping (T014)', () => {
  const modulePath: string = '../sww-coordinator.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mkPatch = (overrides: Partial<Patch> = {}): Patch => ({
    id: overrides.id ?? 'patch_1',
    taskId: overrides.taskId ?? 't-sww-1',
    sequence: overrides.sequence ?? 1,
    filePath: overrides.filePath ?? '/tmp/ok.diff',
    targetFiles: overrides.targetFiles ?? ['/tmp/ok.diff'],
    status: overrides.status ?? 'pending',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    appliedAt: overrides.appliedAt,
    error: overrides.error,
  });

  it('emits tool_use + patch_applied on success; task_failed + patch_failed on failure', async () => {
    const { SWWCoordinator } = await import(modulePath);

    const events: Array<Record<string, unknown>> = [];
    const stateManager = {
      emitEvent: vi.fn(async (payload: Record<string, unknown>) => {
        events.push(payload);
      }),
    };

    const c = new SWWCoordinator({ stateManager } as any);

    // 成功补丁
    c.enqueuePatch(mkPatch({ id: 'ok_1' }));
    // 失败补丁（目标文件为空）
    c.enqueuePatch(mkPatch({ id: 'bad_1', targetFiles: [] }));

    await c.processQueue();

    const names = events.map((e) => e.event);
    expect(names).toContain('tool_use');
    expect(names).toContain('patch_applied');
    expect(names).toContain('task_failed');
    expect(names).toContain('patch_failed');

    const toolUse = events.find((e) => e.event === 'tool_use') as any;
    expect(toolUse?.data?.tool).toBe('patch_applier');
    const tf = events.find((e) => e.event === 'task_failed') as any;
    expect(tf?.data?.reason).toBe('patch_failed');
  });
});
