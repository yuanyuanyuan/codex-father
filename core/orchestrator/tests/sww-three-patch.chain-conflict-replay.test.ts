import { describe, it, expect } from 'vitest';
import { SWWCoordinator } from '../../orchestrator/sww-coordinator.js';
import type { Patch } from '../../orchestrator/types.js';

describe('SWWCoordinator - three-patch same-path chain with replays', () => {
  it('applies first, fails next two (stale), then applies both replays in order', async () => {
    const sww = new SWWCoordinator();
    const base = Date.now();
    const path = 'shared/C.ts';

    const mk = (id: string, seq: number, offset: number): Patch =>
      ({
        id,
        taskId: 't_chain',
        sequence: seq,
        filePath: `${id}.diff`,
        targetFiles: [path],
        status: 'pending',
        createdAt: new Date(base + offset).toISOString(),
      }) as Patch;

    const P1 = mk('patch_C1', 1, -2000);
    const P2_stale = mk('patch_C2s', 2, -1500);
    const P3_stale = mk('patch_C3s', 3, -1400);
    const P2_replay = mk('patch_C2r', 4, +300);
    const P3_replay = mk('patch_C3r', 5, +400);

    for (const p of [P1]) {
      sww.enqueuePatch(p);
    }
    await sww.processQueue();
    expect(
      sww.events.find((e) => e.event === 'patch_applied' && e.patch.id === 'patch_C1')
    ).toBeTruthy();

    // stale patches
    sww.enqueuePatch(P2_stale);
    sww.enqueuePatch(P3_stale);
    await sww.processQueue();
    expect(
      sww.events.find((e) => e.event === 'patch_failed' && e.patch.id === 'patch_C2s')
    ).toBeTruthy();
    expect(
      sww.events.find((e) => e.event === 'patch_failed' && e.patch.id === 'patch_C3s')
    ).toBeTruthy();

    // replays newer
    sww.enqueuePatch(P2_replay);
    sww.enqueuePatch(P3_replay);
    await sww.processQueue();
    const applied = sww.events.filter((e) => e.event === 'patch_applied').map((e) => e.patch.id);
    expect(applied.slice(-2)).toEqual(['patch_C2r', 'patch_C3r']);
  });
});
