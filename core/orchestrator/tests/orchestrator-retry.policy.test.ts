import { describe, expect, it, vi } from 'vitest';

describe('ProcessOrchestrator retry policy (T021)', () => {
  it('retries failed task up to maxAttempts with exponential intent (no real delay)', async () => {
    const { ProcessOrchestrator } = await import('../process-orchestrator.js');
    const orchestrator = new ProcessOrchestrator({
      maxConcurrency: 2,
      retryPolicy: { maxAttempts: 2, backoff: 'exponential', initialDelayMs: 10, maxDelayMs: 20 },
    } as any);

    // 1 个任务，第一次失败，第二次成功
    const task = {
      id: 't-retry-1',
      title: 'retry demo',
      description: 'demo',
      role: 'developer',
      roleMatchMethod: 'rule',
      roleMatchDetails: 'default',
      status: 'pending',
      dependencies: [],
      priority: 0,
      timeout: 60_000,
      createdAt: new Date().toISOString(),
    } as any;

    const execSpy = vi
      .spyOn(orchestrator as any, 'executeTask')
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const spawnSpy = vi.spyOn(orchestrator as any, 'spawnAgent');

    await orchestrator.orchestrate([task]);

    expect(execSpy).toHaveBeenCalledTimes(2);
    expect(spawnSpy).toHaveBeenCalledTimes(2);
  });
});
