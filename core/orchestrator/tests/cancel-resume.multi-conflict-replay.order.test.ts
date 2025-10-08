import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PassThrough } from 'node:stream';

vi.mock('node:child_process', () => {
  const spawn = vi.fn(() => ({
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    on: vi.fn(),
    kill: vi.fn(),
  }));
  return { spawn };
});

describe('Cancel→Resume 后多补丁冲突→重放顺序校验 (T004)', () => {
  const modulePath: string = '../process-orchestrator.js';
  let spawnMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    const childProcess = await import('node:child_process');
    spawnMock = (childProcess as unknown as { spawn: ReturnType<typeof vi.fn> }).spawn;
    spawnMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('replays two stale patches in FIFO after resume', async () => {
    const { ProcessOrchestrator } = await import(modulePath);
    const { SWWCoordinator } = await import('../sww-coordinator.js');

    const sww = new SWWCoordinator();
    const orchestrator = new ProcessOrchestrator({ sww, codexCommand: 'codex' } as any);

    // cancel → drop any queue
    await (orchestrator as any).requestCancel(0);
    await sww.processQueue();

    // resume → resetAbort
    await orchestrator.resumeSession({ rolloutPath: '/tmp/rollout.jsonl' } as any);

    // apply base on same file
    sww.enqueuePatch({
      id: 'base',
      taskId: 't',
      sequence: 1,
      filePath: 'a.diff',
      targetFiles: ['a.ts'],
      status: 'pending',
      createdAt: new Date(Date.now() - 60_000).toISOString(),
    } as any);
    await sww.processQueue();

    // two stale patches on same file → should conflict
    sww.enqueuePatch({
      id: 'stale1',
      taskId: 't',
      sequence: 2,
      filePath: 'a2.diff',
      targetFiles: ['a.ts'],
      status: 'pending',
      createdAt: new Date(Date.now() - 120_000).toISOString(),
    } as any);
    sww.enqueuePatch({
      id: 'stale2',
      taskId: 't',
      sequence: 3,
      filePath: 'a3.diff',
      targetFiles: ['a.ts'],
      status: 'pending',
      createdAt: new Date(Date.now() - 180_000).toISOString(),
    } as any);
    await sww.processQueue();
    const failed = sww.events.filter((e) => e.event === 'patch_failed');
    expect(failed.length).toBeGreaterThanOrEqual(1);

    // replay two fresh patches → should apply in order
    sww.enqueuePatch({
      id: 'replay1',
      taskId: 't',
      sequence: 4,
      filePath: 'a4.diff',
      targetFiles: ['a.ts'],
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as any);
    sww.enqueuePatch({
      id: 'replay2',
      taskId: 't',
      sequence: 5,
      filePath: 'a5.diff',
      targetFiles: ['a.ts'],
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as any);
    await sww.processQueue();
    const applied = sww.events.filter((e) => e.event === 'patch_applied').map((e) => e.patch.id);
    const i1 = applied.indexOf('replay1');
    const i2 = applied.indexOf('replay2');
    expect(i1).toBeGreaterThanOrEqual(0);
    expect(i2).toBeGreaterThan(i1);
  });
});
