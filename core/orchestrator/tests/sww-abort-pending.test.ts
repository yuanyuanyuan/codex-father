import { beforeEach, describe, expect, it } from 'vitest';
import { SWWCoordinator } from '../sww-coordinator.js';
import type { Patch } from '../types.js';

describe('SWWCoordinator 请求中止丢弃待处理补丁 (T004)', () => {
  let c: SWWCoordinator;
  let seq = 0;

  const mkPatch = (overrides: Partial<Patch> = {}): Patch => {
    seq += 1;
    return {
      id: overrides.id ?? `patch_${seq}`,
      taskId: overrides.taskId ?? `t-task-${seq}`,
      sequence: overrides.sequence ?? seq,
      filePath: overrides.filePath ?? `/tmp/demo-${seq}.diff`,
      targetFiles: overrides.targetFiles ?? [`/repo/f${seq}.ts`],
      status: overrides.status ?? 'pending',
      createdAt: overrides.createdAt ?? new Date().toISOString(),
      appliedAt: overrides.appliedAt,
      error: overrides.error,
    } as Patch;
  };

  beforeEach(() => {
    c = new SWWCoordinator();
    seq = 0;
  });

  it('requestAbort() 之后不再处理队列中的补丁', async () => {
    const a = mkPatch({ id: 'a' });
    const b = mkPatch({ id: 'b' });
    c.enqueuePatch(a);
    c.enqueuePatch(b);

    // 中止：由于 enqueuePatch 会触发异步 drain，可能已开始处理首个补丁
    const dropped = c.requestAbort();
    expect(dropped).toBeGreaterThanOrEqual(1);
    await c.processQueue();
    // 断言：不会处理第二个补丁（b）
    const ids = c.events.map((e) => e.patch.id);
    expect(ids).not.toContain('b');

    // 复位后可继续入队与处理
    c.resetAbort();
    c.enqueuePatch(a);
    await c.processQueue();
    expect(c.events.at(-1)?.event).toBe('patch_applied');
  });
});
