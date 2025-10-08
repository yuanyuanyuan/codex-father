import { describe, it, expect } from 'vitest';
import { SWWCoordinator } from '../../orchestrator/sww-coordinator.js';
import type { Patch } from '../../orchestrator/types.js';

/**
 * 多轮交错重放 × 顺序扰动：
 * - 两个目标文件 A/B，先各自应用基准补丁→产生冲突补丁（过期）→重放成功（第1轮）
 * - 再次产生过期补丁→以“打乱顺序”的方式入队两条重放补丁（第2轮）
 * - 断言：所有重放应用顺序严格等于全局入队顺序；每轮的过期补丁均失败
 */
describe('SWWCoordinator - multi-round interleaved replays with perturbed enqueue order', () => {
  it('applies replays in global enqueue order across rounds, stale patches fail', async () => {
    const sww = new SWWCoordinator();
    const base = Date.now();

    const A = 'apps/a/A.ts';
    const B = 'apps/b/B.ts';
    const mk = (id: string, seq: number, file: string, createdOffsetMs: number): Patch =>
      ({
        id,
        taskId: 't_multi',
        sequence: seq,
        filePath: `${id}.diff`,
        targetFiles: [file],
        status: 'pending',
        createdAt: new Date(base + createdOffsetMs).toISOString(),
      }) as Patch;

    // Round 0: 基准补丁先各自成功
    const A0 = mk('A0_base', 1, A, -4000);
    const B0 = mk('B0_base', 2, B, -3900);
    sww.enqueuePatch(A0);
    sww.enqueuePatch(B0);
    await sww.processQueue();
    const applied0 = sww.events.filter((e) => e.event === 'patch_applied').map((e) => e.patch.id);
    expect(applied0).toEqual(['A0_base', 'B0_base']);

    // Round 1: 过期（stale）→ 重放
    const A1s = mk('A1_stale', 3, A, -3500); // 创建时间早于 A0 应用 → 冲突
    const B1s = mk('B1_stale', 4, B, -3400);
    sww.enqueuePatch(A1s);
    sww.enqueuePatch(B1s);
    await sww.processQueue();
    const failed1 = sww.events.filter((e) => e.event === 'patch_failed').map((e) => e.patch.id);
    expect(failed1.slice(-2)).toEqual(['A1_stale', 'B1_stale']);

    const A1r = mk('A1_replay', 5, A, +100); // 创建时间晚于 A0/B0 的 appliedAt
    const B1r = mk('B1_replay', 6, B, +120);
    sww.enqueuePatch(A1r);
    sww.enqueuePatch(B1r);
    await sww.processQueue();
    const applied1 = sww.events.filter((e) => e.event === 'patch_applied').map((e) => e.patch.id);
    expect(applied1.slice(-2)).toEqual(['A1_replay', 'B1_replay']);

    // Round 2: 再次制造 stale，然后“打乱顺序”入队重放（先 B 再 A）
    const A2s = mk('A2_stale', 7, A, -50);
    const B2s = mk('B2_stale', 8, B, -40);
    sww.enqueuePatch(A2s);
    sww.enqueuePatch(B2s);
    await sww.processQueue();
    const failed2 = sww.events.filter((e) => e.event === 'patch_failed').map((e) => e.patch.id);
    expect(failed2.slice(-2)).toEqual(['A2_stale', 'B2_stale']);

    const B2r = mk('B2_replay', 9, B, +300);
    const A2r = mk('A2_replay', 10, A, +320);
    // 顺序扰动：先 B2_replay 后 A2_replay
    sww.enqueuePatch(B2r);
    sww.enqueuePatch(A2r);
    await sww.processQueue();

    const appliedAll = sww.events.filter((e) => e.event === 'patch_applied').map((e) => e.patch.id);
    // 最后两条应严格等于按入队顺序的 [B2_replay, A2_replay]
    expect(appliedAll.slice(-2)).toEqual(['B2_replay', 'A2_replay']);

    // 失败事件总计应包含四个 stale（A1/B1/A2/B2）
    const allFailed = sww.events.filter((e) => e.event === 'patch_failed').map((e) => e.patch.id);
    expect(allFailed).toEqual(['A1_stale', 'B1_stale', 'A2_stale', 'B2_stale']);
  });
});
