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

describe('Cancel → Resume → Conflict → Replay (integration, T004)', () => {
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

  it('stale patch conflicts, then replay succeeds after resume', async () => {
    const { ProcessOrchestrator } = await import(modulePath);
    const { SWWCoordinator } = await import('../sww-coordinator.js');

    const sww = new SWWCoordinator();
    const orchestrator = new ProcessOrchestrator({ sww, codexCommand: 'codex' } as any);

    // 取消：丢弃队列
    await (orchestrator as any).requestCancel(0);
    await sww.processQueue();

    // 恢复：resetAbort 生效
    await orchestrator.resumeSession({ rolloutPath: '/tmp/rollout.jsonl' } as any);

    // 先应用一个补丁，更新 a.ts
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

    // 再入队一个“过期”的补丁命中同一文件，触发冲突
    sww.enqueuePatch({
      id: 'stale',
      taskId: 't',
      sequence: 2,
      filePath: 'a2.diff',
      targetFiles: ['a.ts'],
      status: 'pending',
      createdAt: new Date(Date.now() - 120_000).toISOString(),
    } as any);
    await sww.processQueue();
    const last1 = sww.events.at(-1);
    expect(last1?.event).toBe('patch_failed');
    expect((last1 as any)?.errorMessage ?? '').toContain('PATCH_CONFLICT');

    // 重放：更新创建时间，期望成功
    sww.enqueuePatch({
      id: 'replay',
      taskId: 't',
      sequence: 3,
      filePath: 'a3.diff',
      targetFiles: ['a.ts'],
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as any);
    await sww.processQueue();
    const last2 = sww.events.at(-1);
    expect(last2?.event).toBe('patch_applied');
    expect(last2?.patch.id).toBe('replay');
  });
});
