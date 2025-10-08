import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ProcessOrchestrator understanding gate (T049)', () => {
  const modulePath: string = '../process-orchestrator.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('emits understanding_failed then orchestration_failed when restatement inconsistent', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const events: Array<Record<string, unknown>> = [];
    const stateManager = {
      emitEvent: vi.fn(async (payload: Record<string, unknown>) => {
        events.push(payload);
      }),
    };

    const understandingEvaluator = vi
      .fn()
      .mockResolvedValue({ consistent: false, issues: ['遗漏验收条件'] });

    const orchestrator = new ProcessOrchestrator({
      maxConcurrency: 2,
      stateManager,
      understandingEvaluator,
    } as any);

    const task = mkTask('t-understand-1') as any;
    await orchestrator.orchestrate([task], {
      requirement: '实现登录并补充测试，确保 30 分钟超时逻辑',
      restatement: '我会实现登录功能',
    });

    // Expect sequence includes decomposition_completed → understanding_failed → orchestration_failed
    const names = events.map((e) => e.event);
    expect(names).toContain('decomposition_completed');
    const idxUF = names.indexOf('understanding_failed');
    const idxOF = names.lastIndexOf('orchestration_failed');
    expect(idxUF).toBeGreaterThanOrEqual(0);
    expect(idxOF).toBeGreaterThan(idxUF);

    // Should not start scheduling when understanding fails
    expect(names).not.toContain('start');

    // Evaluator invoked once with provided inputs
    expect(understandingEvaluator).toHaveBeenCalledTimes(1);
  });

  it('passes understanding gate and proceeds to scheduling when consistent', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const events: Array<Record<string, unknown>> = [];
    const stateManager = {
      emitEvent: vi.fn(async (payload: Record<string, unknown>) => {
        events.push(payload);
      }),
    };

    const understandingEvaluator = vi.fn().mockResolvedValue({ consistent: true, issues: [] });

    const orchestrator = new ProcessOrchestrator({
      maxConcurrency: 1,
      stateManager,
      understandingEvaluator,
    } as any);

    const task = mkTask('t-understand-2') as any;
    await orchestrator.orchestrate([task], {
      requirement: '实现多 Agent 并行编排，包含任务分解与权限控制',
      restatement: '我会实现多 Agent 并行编排，包含任务分解与权限控制',
    });

    const names = events.map((e) => e.event);
    // Should have wave start event and no understanding_failed
    expect(names).toContain('start');
    expect(names).not.toContain('understanding_failed');
    expect(understandingEvaluator).toHaveBeenCalledTimes(1);
  });
});
