import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:child_process', () => {
  const spawn = vi.fn(() => ({
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    on: vi.fn(),
    kill: vi.fn(),
  }));
  return { spawn };
});

describe('Cancel then Resume chain integration (T004)', () => {
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

  it('emits cancel then triggers resume via rollout path', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const events: Array<Record<string, unknown>> = [];
    let snapshot = {
      status: 'pending',
      completedTasks: 0,
      failedTasks: 0,
      updatedAt: Date.now(),
    };
    const stateManager = {
      emitEvent: vi.fn(async (payload: Record<string, unknown>) => {
        events.push(payload);
      }),
      update: vi.fn((delta: Partial<any>) => {
        snapshot = { ...snapshot, ...delta, updatedAt: Date.now() };
        return snapshot;
      }),
    };

    const orchestrator = new ProcessOrchestrator({
      maxConcurrency: 2,
      stateManager,
      codexCommand: 'codex',
    } as any);

    const mkTask = (id: string) => ({
      id,
      title: id,
      description: 'demo',
      role: 'developer',
      roleMatchMethod: 'rule',
      roleMatchDetails: 'default',
      status: 'pending',
      dependencies: [],
      priority: 0,
      timeout: 60_000,
      createdAt: new Date().toISOString(),
    });

    await orchestrator.spawnAgent(mkTask('t-1') as any);
    await orchestrator.spawnAgent(mkTask('t-2') as any);

    await (orchestrator as any).requestCancel(10);

    const names = events.map((e) => e.event);
    expect(names[0]).toBe('cancel_requested');
    expect(names.at(-1)).toBe('orchestration_failed');
    expect(stateManager.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'cancelled' })
    );

    // chain resume
    await orchestrator.resumeSession({
      rolloutPath: '/tmp/rollout.jsonl',
      requirement: '恢复',
    } as any);
    expect(spawnMock).toHaveBeenCalled();
    const resumeCall = spawnMock.mock.calls.find(
      (c) => Array.isArray(c?.[1]) && c[1].includes('resume')
    );
    expect(resumeCall).toBeTruthy();
    const args = (resumeCall?.[1] ?? []) as string[];
    expect(args.slice(0, 3)).toEqual(['exec', 'resume', '/tmp/rollout.jsonl']);
  });
});
