import { describe, expect, it, vi } from 'vitest';

describe('ProcessOrchestrator cancel handling contract (T023)', () => {
  it('emits cancel_requested then orchestration_failed; terminates agents gracefully', async () => {
    const { ProcessOrchestrator } = await import('../process-orchestrator.js');

    const events: Array<Record<string, unknown>> = [];
    const stateManager = {
      emitEvent: vi.fn(async (payload: Record<string, unknown>) => {
        events.push(payload);
      }),
    };

    const orchestrator = new ProcessOrchestrator({ maxConcurrency: 2, stateManager } as any);

    // Spawn a couple of agents to simulate work-in-progress
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

    await orchestrator.spawnAgent(mkTask('t-cancel-1') as any);
    await orchestrator.spawnAgent(mkTask('t-cancel-2') as any);

    // Request cancel with small grace to keep test fast
    await (orchestrator as any).requestCancel(10);

    // Validate events order and payload
    const names = events.map((e) => e.event);
    expect(names[0]).toBe('cancel_requested');
    expect(names.at(-1)).toBe('orchestration_failed');

    // Agent pool should be cleared
    expect(((orchestrator as any).agentPool as Map<string, unknown>).size).toBe(0);
  });
});
