import { describe, it, expect } from 'vitest';
import { SWWCoordinator } from '../../orchestrator/sww-coordinator.js';
import type { Patch } from '../../orchestrator/types.js';

describe('SWWCoordinator - interleaved conflict and replay across files', () => {
  it('handles conflicts on two files and applies replays in enqueue order', async () => {
    const sww = new SWWCoordinator();
    const base = Date.now();

    const mk = (id: string, seq: number, file: string, offset: number): Patch =>
      ({
        id,
        taskId: 't_inter',
        sequence: seq,
        filePath: `${id}.diff`,
        targetFiles: [file],
        status: 'pending',
        createdAt: new Date(base + offset).toISOString(),
      }) as Patch;

    // First apply two base patches (A1 on A, B1 on B)
    const a = 'apps/x/A.ts';
    const b = 'apps/y/B.ts';
    const A1 = mk('patch_A1', 1, a, -2000);
    const B1 = mk('patch_B1', 2, b, -1900);

    // Conflicting ones generated earlier than appliedAt
    const A_conflict = mk('patch_Ac', 3, a, -1500);
    const B_conflict = mk('patch_Bc', 4, b, -1400);

    // Replays newer than both appliedAt
    const A_replay = mk('patch_Ar', 5, a, +500);
    const B_replay = mk('patch_Br', 6, b, +600);

    for (const p of [A1, B1]) {
      sww.enqueuePatch(p);
    }
    await sww.processQueue();
    const appliedBase = sww.events.filter((e) => e.event === 'patch_applied');
    expect(appliedBase.map((e) => e.patch.id)).toEqual(['patch_A1', 'patch_B1']);

    // Enqueue conflicts and process
    sww.enqueuePatch(A_conflict);
    sww.enqueuePatch(B_conflict);
    await sww.processQueue();
    const failedNow = sww.events.filter((e) => e.event === 'patch_failed');
    expect(failedNow.find((e) => e.patch.id === 'patch_Ac')).toBeTruthy();
    expect(failedNow.find((e) => e.patch.id === 'patch_Bc')).toBeTruthy();

    // Enqueue replays and process in interleaved fashion
    sww.enqueuePatch(A_replay);
    sww.enqueuePatch(B_replay);
    await sww.processQueue();
    const appliedAll = sww.events.filter((e) => e.event === 'patch_applied');
    // Expect last two applied are the replays in the same enqueue order
    const lastTwo = appliedAll.slice(-2).map((e) => e.patch.id);
    expect(lastTwo).toEqual(['patch_Ar', 'patch_Br']);
  });
});
