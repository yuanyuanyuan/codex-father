import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Manual intervention ACK happy path (T055)', () => {
  const modulePath: string = '../process-orchestrator.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('proceeds to scheduling when ack=true and does not emit manual_intervention_requested', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const events: Array<Record<string, unknown>> = [];
    const stateManager = {
      emitEvent: vi.fn(async (payload: Record<string, unknown>) => {
        events.push(payload);
      }),
    };

    const orchestrator = new ProcessOrchestrator({
      manualIntervention: { enabled: true, requireAck: true, ack: true },
      stateManager,
    } as any);

    const task = {
      id: 't-ack-1',
      title: '任务 t-ack-1',
      description: '确认 ack 后应进入调度',
      role: 'developer',
      roleMatchMethod: 'rule',
      roleMatchDetails: '默认规则',
      status: 'pending',
      dependencies: [],
      priority: 0,
      timeout: 30_000,
      createdAt: new Date().toISOString(),
    } as const;

    const ctx = await orchestrator.orchestrate([task] as any);
    expect(Array.isArray(ctx?.tasks)).toBe(true);

    const names = events.map((e) => e.event);
    expect(names.includes('manual_intervention_requested')).toBe(false);
    // 应该至少进入调度：有 wave start 或 task_completed
    expect(names.some((n) => n === 'start' || n === 'task_completed')).toBe(true);
  });
});
