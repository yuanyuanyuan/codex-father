import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SWWCoordinator } from '../../orchestrator/sww-coordinator.js';
import type { Patch } from '../../orchestrator/types.js';

describe('SWWCoordinator - cross directory single-writer order', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'sww-cross-dir-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('serializes patches across different target directories (single writer window)', async () => {
    const sww = new SWWCoordinator({ workRoot: root });

    const now = new Date();
    const p1: Patch = {
      id: 'p1',
      taskId: 'tA',
      sequence: 1,
      filePath: 'a.diff',
      targetFiles: ['src/a/fileA.ts'],
      createdAt: new Date(now.getTime() - 1000).toISOString(),
      status: 'pending',
    } as Patch;
    const p2: Patch = {
      id: 'p2',
      taskId: 'tB',
      sequence: 1,
      filePath: 'b.diff',
      targetFiles: ['lib/b/fileB.ts'],
      createdAt: new Date(now.getTime() - 500).toISOString(),
      status: 'pending',
    } as Patch;

    // 入队后处理；要求不抛错，并按队列顺序应用
    sww.enqueuePatch(p1);
    sww.enqueuePatch(p2);
    await sww.processQueue();

    // 事件应记录两个 patch_applied
    const applied = sww.events.filter((e) => e.event === 'patch_applied');
    expect(applied.length).toBe(2);
    expect(applied[0].patch.id).toBe('p1');
    expect(applied[1].patch.id).toBe('p2');

    // 两个补丁的工作目录应各自独立且位于 .sww 下
    for (const evt of applied) {
      expect(evt.workDir).toBeDefined();
      expect(String(evt.workDir)).toContain('/.sww/');
    }

    // 不应产生冲突：目标文件不同目录
    const failures = sww.events.filter((e) => e.event === 'patch_failed');
    expect(failures.length).toBe(0);
  });
});
