import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SWWCoordinator } from '../../orchestrator/sww-coordinator.js';
import type { Patch } from '../../orchestrator/types.js';

describe('SWWCoordinator - heavy cross-dir order & no-conflict', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'sww-heavy-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('applies 20 interleaved patches across 4 dirs in enqueue order without failures', async () => {
    const sww = new SWWCoordinator({ workRoot: root });
    const dirs = ['pkg/a', 'pkg/b', 'pkg/c', 'pkg/d'];
    const patches: Patch[] = [] as Patch[];
    const base = Date.now();
    let seq = 0;
    for (let i = 0; i < 20; i += 1) {
      const dir = dirs[i % dirs.length];
      const id = `p${String(i + 1).padStart(2, '0')}`;
      patches.push({
        id,
        taskId: `t${(i % 3) + 1}`,
        sequence: ++seq,
        filePath: `${id}.diff`,
        targetFiles: [`${dir}/file${(i % 5) + 1}.ts`],
        createdAt: new Date(base + i).toISOString(),
        status: 'pending',
      } as Patch);
    }

    for (const p of patches) {
      sww.enqueuePatch(p);
    }
    await sww.processQueue();

    const applied = sww.events.filter((e) => e.event === 'patch_applied');
    const failed = sww.events.filter((e) => e.event === 'patch_failed');

    expect(applied.length).toBe(20);
    expect(failed.length).toBe(0);
    // 顺序与入队一致
    for (let i = 0; i < 20; i += 1) {
      expect(applied[i].patch.id).toBe(patches[i].id);
    }
  });
});
