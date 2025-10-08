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
      id: 't-secure',
      orchestrationId: 'orc_permissions',
      description: 'enforce permissions',
      role: 'developer',
      sessionDir: '/tmp/.codex-father/sessions/orc_permissions',
    } as any);

    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [command, args] = spawnMock.mock.calls[0] ?? [];

    expect(command).toBe('codex');
    expect(args?.[0]).toBe('exec');

    const sessionDirIndex = args?.findIndex((value: string) => value === '--session-dir') ?? -1;
    expect(sessionDirIndex).toBeGreaterThan(-1);
    const sessionDir = args?.[sessionDirIndex + 1];
    expect(sessionDir).toMatch(/\.codex-father[\\/]+sessions[\\/]+agent_/);

    expect(args).toContain('--ask-for-approval');
    expect(args).toContain('never');
    expect(args).toContain('--sandbox');
    expect(args).toContain('workspace-write');
    expect(args).toContain('--allowed-tools');
    expect(args).toContain('write_file,run_tests');
  });

  it('throws when role configuration for the task is missing', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const orchestrator = new ProcessOrchestrator();

    await expect(
      orchestrator.spawnAgent({
        id: 't-missing-role',
        description: 'custom role without config',
        role: 'security-auditor',
      } as any)
    ).rejects.toThrow(/security-auditor/);

    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('throws when role configuration lacks allowed tools', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const orchestrator = new ProcessOrchestrator({
      roles: {
        developer: {
          allowedTools: [],
          permissionMode: 'never',
          sandbox: 'workspace-write',
        },
      },
    } as any);

    await expect(
      orchestrator.spawnAgent({
        id: 't-invalid-role',
        description: 'missing allowed tools',
        role: 'developer',
      } as any)
    ).rejects.toThrow(/allowed tool/);

    expect(spawnMock).not.toHaveBeenCalled();
  });
});
