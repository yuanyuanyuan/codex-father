import { describe, expect, it, vi } from 'vitest';

describe('task_retry_scheduled event contract (T021)', () => {
  const modulePath: string = '../process-orchestrator.js';

  const mkTask = (id: string) => ({
    id,
    title: id,
    description: 'retry scheduling demo',
    role: 'developer',
    roleMatchMethod: 'rule',
    roleMatchDetails: 'default',
    status: 'pending',
    dependencies: [],
    priority: 0,
    timeout: 60_000,
    createdAt: new Date().toISOString(),
  });

  it('emits task_retry_scheduled with nextAttempt and delayMs before second attempt', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const events: Array<Record<string, any>> = [];
    const stateManager = {
      emitEvent: vi.fn(async (payload: Record<string, unknown>) => {
        events.push(payload as Record<string, any>);
      }),
    };

    const orchestrator = new ProcessOrchestrator({
      maxConcurrency: 1,
      retryPolicy: { maxAttempts: 2, backoff: 'exponential', initialDelayMs: 10, maxDelayMs: 100 },
      stateManager,
    } as any);

    // First attempt fails, second succeeds
    vi.spyOn(orchestrator as any, 'executeTask')
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const task = mkTask('t-retry-schedule-1') as any;
    await orchestrator.orchestrate([task]);

    const names = events.map((e) => e.event);
    const retryEvt = events.find((e) => e.event === 'task_retry_scheduled');

    expect(names).toContain('task_failed');
    expect(names).toContain('task_retry_scheduled');
    expect(retryEvt?.taskId).toBe('t-retry-schedule-1');
    expect(retryEvt?.data?.nextAttempt).toBe(2);
    // exponential intent: first retry delay equals initialDelayMs
    expect(retryEvt?.data?.delayMs).toBe(10);
  });
});
