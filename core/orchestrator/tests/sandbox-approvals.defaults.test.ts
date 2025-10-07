import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('ProcessOrchestrator sandbox/approval defaults (T024)', () => {
  const modulePath = '../process-orchestrator.js';
  let ProcessOrchestrator: any;

  beforeEach(async () => {
    vi.resetModules();
    // mock child_process.spawn to capture args
    vi.doMock('node:child_process', () => {
      const spawn = vi.fn((_cmd: string, _args: string[]) => ({
        stdout: new PassThrough(),
        stderr: new PassThrough(),
        on: vi.fn(),
      }));
      return { spawn };
    });
    ({ ProcessOrchestrator } = await import(modulePath));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses default approval=never and sandbox=workspace-write when not overridden', async () => {
    const { spawn } = await import('node:child_process');
    const orchestrator = new ProcessOrchestrator();

    // developer role has default permissionMode 'never' and sandbox 'workspace-write'
    const task = {
      id: 't-defaults-1',
      title: 'defaults',
      description: 'check defaults',
      role: 'developer',
      roleMatchMethod: 'rule',
      roleMatchDetails: 'default',
      status: 'pending',
      dependencies: [],
      priority: 0,
      timeout: 30_000,
      createdAt: new Date().toISOString(),
    } as any;

    await orchestrator.spawnAgent(task);

    expect((spawn as any).mock.calls.length).toBe(1);
    const args: string[] = (spawn as any).mock.calls[0][1];
    const approvalIdx = args.indexOf('--ask-for-approval');
    const sandboxIdx = args.indexOf('--sandbox');
    expect(approvalIdx).toBeGreaterThanOrEqual(0);
    expect(args[approvalIdx + 1]).toBe('never');
    expect(sandboxIdx).toBeGreaterThanOrEqual(0);
    expect(args[sandboxIdx + 1]).toBe('workspace-write');
  });

  it('honors overridden approval and sandbox from role configuration', async () => {
    const { spawn } = await import('node:child_process');
    const orchestrator = new ProcessOrchestrator({
      roles: {
        developer: {
          allowedTools: ['read_file'],
          permissionMode: 'on-failure',
          sandbox: 'read-only',
        },
      },
    } as any);

    const task = {
      id: 't-override-1',
      title: 'override',
      description: 'override defaults',
      role: 'developer',
      roleMatchMethod: 'rule',
      roleMatchDetails: 'default',
      status: 'pending',
      dependencies: [],
      priority: 0,
      timeout: 30_000,
      createdAt: new Date().toISOString(),
    } as any;

    await orchestrator.spawnAgent(task);

    const args: string[] = (spawn as any).mock.calls[0][1];
    const approvalIdx = args.indexOf('--ask-for-approval');
    const sandboxIdx = args.indexOf('--sandbox');
    expect(args[approvalIdx + 1]).toBe('on-failure');
    expect(args[sandboxIdx + 1]).toBe('read-only');
  });
});
