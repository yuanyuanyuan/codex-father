import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { SWWCoordinator } from '../sww-coordinator.js';
import type { Patch } from '../types.js';

describe('SWW Isolation Workspace (T022)', () => {
  let root: string;
  let coordinator: SWWCoordinator;

  const buildPatch = (id: string, taskId: string, seq: number): Patch => ({
    id,
    taskId,
    sequence: seq,
    filePath: `/patches/${id}.diff`,
    targetFiles: [`/patches/${id}.diff`],
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'sww-iso-'));
    coordinator = new SWWCoordinator({ workRoot: root });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('creates unique per-patch workspace dir and emits it in events', async () => {
    const events: Array<Record<string, unknown>> = [];
    coordinator.on('patch_applied', (payload) => events.push(payload));
    coordinator.on('patch_failed', (payload) => events.push(payload));

    const p1 = buildPatch('patch_a', 'tA', 1);
    const p2 = buildPatch('patch_b', 'tA', 2);
    const p3 = buildPatch('patch_c', 'tB', 1);

    coordinator.enqueuePatch(p1);
    coordinator.enqueuePatch(p2);
    coordinator.enqueuePatch(p3);
    await coordinator.processQueue();

    // 仅 patch_applied 会在 apply 内部直接派发；失败会在 drain 阶段统一派发
    const applied = events.filter((e) => e.event === 'patch_applied');
    expect(applied.length).toBeGreaterThanOrEqual(2);

    const workDirs = applied.map((e) => String((e as any).workDir || ''));
    for (const d of workDirs) {
      expect(d.startsWith(root)).toBe(true);
      expect(d.includes('/.sww/')).toBe(true);
    }

    // 不同补丁应使用不同目录
    expect(new Set(workDirs).size).toBe(workDirs.length);
  });
});
