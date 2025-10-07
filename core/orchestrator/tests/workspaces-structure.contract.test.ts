import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('Workspaces and patches structure (T022)', () => {
  const modulePath: string = '../process-orchestrator.js';
  let tempRoot: string;
  let restoreCwd: (() => void) | null = null;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), 'orc-ws-'));
    const originalCwd = process.cwd();
    // mock process.cwd() to ensure dirs created under tempRoot
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tempRoot);
    restoreCwd = () => cwdSpy.mockReturnValue(originalCwd);
  });

  afterEach(async () => {
    if (restoreCwd) {
      restoreCwd();
    }
    await rm(tempRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('prepares <sessionDir>/patches and <sessionDir>/workspaces/agent_1 on first spawn', async () => {
    const { ProcessOrchestrator } = await import(modulePath);
    const orchestrator = new ProcessOrchestrator({ maxConcurrency: 1 } as any);

    const result = await orchestrator.spawnAgent({
      id: 't-iso-1',
      description: 'workspace structure',
      role: 'developer',
      roleMatchMethod: 'rule',
      roleMatchDetails: 'default',
      status: 'pending',
      dependencies: [],
      priority: 0,
      timeout: 60_000,
      createdAt: new Date().toISOString(),
    } as any);

    const agent = result.agent as any;
    const patchesDir = join(agent.sessionDir, 'patches');
    const agentWsDir = join(agent.sessionDir, 'workspaces', 'agent_1');

    // give microtask to async mkdir runner
    await Promise.resolve();

    const s1 = await stat(patchesDir);
    const s2 = await stat(agentWsDir);
    expect(s1.isDirectory()).toBe(true);
    expect(s2.isDirectory()).toBe(true);
    expect(agent.workDir).toBe(agentWsDir);
  });
});
