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

describe('Session recovery integration (T040)', () => {
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

  it('resumes previous Codex session using rollout file path', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const orchestrator = new ProcessOrchestrator({ codexCommand: 'codex' } as any);

    await orchestrator.resumeSession({
      rolloutPath: '/home/user/.codex/sessions/1234.jsonl',
      requirement: '恢复会话继续执行',
    } as any);

    expect(spawnMock).toHaveBeenCalled();
    const args = spawnMock.mock.calls[0]?.[1] ?? [];

    expect(args.slice(0, 3)).toEqual(['exec', 'resume', '/home/user/.codex/sessions/1234.jsonl']);
    expect(args).toEqual(expect.arrayContaining(['--sandbox', 'workspace-write']));
    expect(args).toEqual(expect.arrayContaining(['--ask-for-approval', 'never']));
  });
});
