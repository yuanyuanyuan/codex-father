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

describe('ProcessOrchestrator resumeSession links to sww.resetAbort (T004)', () => {
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

  it('calls sww.resetAbort() if provided', async () => {
    const { ProcessOrchestrator } = await import('../process-orchestrator.js');

    const sww = {
      requestAbort: vi.fn(() => 0),
      resetAbort: vi.fn(() => void 0),
    };

    const orchestrator = new ProcessOrchestrator({ codexCommand: 'codex', sww } as any);

    await orchestrator.resumeSession({ rolloutPath: '/tmp/rollout.jsonl' } as any);

    expect(sww.resetAbort).toHaveBeenCalledTimes(1);
    expect(spawnMock).toHaveBeenCalled();
  });
});
