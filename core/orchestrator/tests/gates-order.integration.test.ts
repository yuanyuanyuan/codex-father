import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Gate order: manualIntervention → understanding → scheduling (integration)', () => {
  const modulePath: string = '../process-orchestrator.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mkTask = (id: string) => ({
    id,
    title: id,
    description: 'gate-order',
    role: 'developer',
    roleMatchMethod: 'rule',
    roleMatchDetails: 'default',
    status: 'pending',
    dependencies: [],
    priority: 0,
    timeout: 10_000,
    createdAt: new Date().toISOString(),
  });

  it('ACK=true skips manual_intervention_requested, validates understanding, then schedules', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const events: Array<Record<string, any>> = [];
    const stateManager = {
      emitEvent: vi.fn(async (payload: Record<string, unknown>) => {
        events.push(payload as Record<string, any>);
      }),
    };

    const orchestrator = new ProcessOrchestrator({
      stateManager,
      manualIntervention: { enabled: true, requireAck: true, ack: true },
      understanding: {
        requirement: '实现 A，包含 B 与 C',
        restatement: '我会实现 A，包含 B 与 C',
        evaluateConsistency: vi.fn().mockResolvedValue({ consistent: true, issues: [] }),
      },
    } as any);

    await orchestrator.orchestrate([mkTask('t1')] as any);

    const names = events.map((e) => e.event);
    expect(names.includes('manual_intervention_requested')).toBe(false);

    // 应包含理解通过与波次开始/任务事件
    expect(names).toContain('understanding_validated');
    expect(names.some((n) => n === 'start' || n === 'task_started' || n === 'task_completed')).toBe(
      true
    );

    // 顺序：understanding_validated 先于首个调度相关事件（start/task_started）
    const idxUV = names.indexOf('understanding_validated');
    const idxFirstSched = names.findIndex((n) => n === 'start' || n === 'task_started');
    expect(idxUV).toBeGreaterThanOrEqual(0);
    expect(idxFirstSched).toBeGreaterThan(idxUV);
  });
});
