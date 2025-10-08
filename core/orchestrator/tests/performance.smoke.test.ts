import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Performance smoke — 10 parallel tasks (T029)', () => {
  const modulePath: string = '../process-orchestrator.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('schedules and completes 10 tasks with maxConcurrency=10', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const events: Array<{ event: string } & Record<string, unknown>> = [];
    const stateManager = {
      emitEvent: vi.fn(async (payload: Record<string, unknown>) => {
        events.push(payload as any);
      }),
    };

    const orchestrator = new ProcessOrchestrator({
      maxConcurrency: 10,
      stateManager,
    } as any);

    const mkTask = (id: number) => ({
      id: `p-${id}`,
      title: `Task ${id}`,
      description: `Perf task ${id}`,
      role: 'developer',
      roleMatchMethod: 'rule',
      roleMatchDetails: '默认规则',
      status: 'pending',
      dependencies: [],
      priority: 0,
      timeout: 10_000,
      createdAt: new Date().toISOString(),
    });

    const tasks = Array.from({ length: 10 }, (_, i) => mkTask(i + 1));
    const ctx = await orchestrator.orchestrate(tasks as any);

    expect(Array.isArray(ctx?.tasks)).toBe(true);

    const names = events.map((e) => e.event);
    const starts = names.filter((n) => n === 'start').length;
    const completed = names.filter((n) => n === 'task_completed').length;

    expect(starts).toBeGreaterThanOrEqual(1);
    expect(completed).toBe(10);
    expect(names.includes('manual_intervention_requested')).toBe(false);
  });
});
