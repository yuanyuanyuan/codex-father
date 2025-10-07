import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Patch } from '../types.js';

describe('SWW queue sequence consistency and mapping (long queue, partial failures)', () => {
  const modulePath: string = '../sww-coordinator.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mkPatch = (n: number, ok: boolean): Patch => ({
    id: `p_${n}`,
    taskId: 't_sww_seq',
    sequence: n,
    filePath: ok ? `/tmp/ok_${n}.diff` : `/tmp/bad_${n}.diff`,
    targetFiles: ok ? [`/repo/file_${n}.ts`] : [],
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  it('emits events in enqueue order and preserves patchId mapping in data', async () => {
    const { SWWCoordinator } = await import(modulePath);

    const events: Array<Record<string, any>> = [];
    const stateManager = { emitEvent: vi.fn(async (p: any) => void events.push(p)) };

    const c = new SWWCoordinator({ stateManager } as any);

    // 构造 10 个补丁：每 3 个失败一个
    const patches: Patch[] = [];
    for (let i = 1; i <= 10; i += 1) {
      const ok = i % 3 !== 0; // 3,6,9 失败
      patches.push(mkPatch(i, ok));
    }
    patches.forEach((p) => c.enqueuePatch(p));
    await c.processQueue();

    // 事件按补丁顺序产生（每个补丁 2 条）：
    //  ok: tool_use → patch_applied
    //  bad: task_failed → patch_failed
    const pairs = [] as Array<{ first: string; second: string; patchId: string }>;
    for (let i = 0; i < events.length; i += 2) {
      const a = events[i] as any;
      const b = events[i + 1] as any;
      pairs.push({
        first: a.event,
        second: b.event,
        patchId: (a.data?.patchId ?? a.data?.patch?.id) as string,
      });
    }

    // 校验每对事件是预期组合且 patchId 与顺序一致
    patches.forEach((p, idx) => {
      const pair = pairs[idx];
      expect(pair.patchId).toBe(p.id);
      if (p.targetFiles.length > 0) {
        expect([pair.first, pair.second]).toEqual(['tool_use', 'patch_applied']);
      } else {
        expect([pair.first, pair.second]).toEqual(['task_failed', 'patch_failed']);
      }
    });

    // 任意失败不应影响后续补丁顺序
    const orderByPatchId = pairs.map((p) => p.patchId);
    expect(orderByPatchId).toEqual(patches.map((p) => p.id));
  });
});
