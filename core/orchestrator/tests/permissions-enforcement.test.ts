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

describe('ProcessOrchestrator permissions enforcement (T034)', () => {
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

  it('applies role security parameters when spawning Codex agent', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const orchestrator = new ProcessOrchestrator({
      roles: {
        developer: {
          allowedTools: ['write_file', 'run_tests'],
          permissionMode: 'never',
          sandbox: 'workspace-write',
        },
      },
      codexCommand: 'codex',
    } as any);

    await orchestrator.spawnAgent({
      orchestrationId: 'orc_permissions',
      taskId: 't-secure',
      role: 'developer',
      sessionDir: '/tmp/.codex-father/sessions/orc_permissions',
    } as any);

    expect(spawnMock).toHaveBeenCalled();
    const args = spawnMock.mock.calls[0]?.[1] ?? [];

    expect(args).toEqual(
      expect.arrayContaining([
        '--ask-for-approval',
        'never',
        '--sandbox',
        'workspace-write',
        '--allowed-tools',
        'write_file,run_tests',
      ])
    );
  });
});
