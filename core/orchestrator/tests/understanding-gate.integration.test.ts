import { describe, it, expect, vi, afterEach } from 'vitest';

describe('Understanding gate integration (T049)', () => {
  const modulePath: string = '../process-orchestrator.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createTask = (id: string) => ({
    id,
    title: `任务 ${id}`,
    description: `描述 ${id}`,
    role: 'developer',
    roleMatchMethod: 'rule',
    roleMatchDetails: '默认规则',
    status: 'pending',
    dependencies: [],
    priority: 0,
    timeout: 30_000,
    createdAt: new Date().toISOString(),
  });

  it('emits understanding_failed then orchestration_failed on inconsistency (pre-scheduler)', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const events: Array<Record<string, unknown>> = [];
    const stateManager = {
      emitEvent: vi.fn(async (payload: Record<string, unknown>) => {
        events.push(payload);
      }),
    };

    const understandingEvaluator = vi
      .fn()
      .mockResolvedValue({ consistent: false, issues: ['遗漏超时处理', '缺少测试覆盖'] });

    const orchestrator = new ProcessOrchestrator({
      stateManager,
      understandingEvaluator,
    } as any);

    const task = createTask('t-understand-fail');

    const ctx = await orchestrator.orchestrate([task] as any, {
      requirement: '实现登录并补充测试，含 30 分钟超时',
      restatement: '我会实现登录功能',
    });

    // 验证事件顺序：understanding_failed 在前，orchestration_failed 在后
    const names = events.map((e) => e.event);
    const idxUF = names.indexOf('understanding_failed');
    const idxOF = names.lastIndexOf('orchestration_failed');
    expect(idxUF).toBeGreaterThanOrEqual(0);
    expect(idxOF).toBeGreaterThan(idxUF);

    // 失败前可能已发出分解完成事件，但不得进入任务执行波次
    expect(names.includes('task_started')).toBe(false);
    expect(names.includes('task_completed')).toBe(false);

    // 返回上下文保持结构，不影响 CLI stdout（此处仅断言无异常返回）
    expect(Array.isArray(ctx?.tasks)).toBe(true);
  });

  it('proceeds when restatement is consistent and schedules tasks', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const events: Array<Record<string, unknown>> = [];
    const stateManager = {
      emitEvent: vi.fn(async (payload: Record<string, unknown>) => {
        events.push(payload);
      }),
    };

    const understandingEvaluator = vi.fn().mockResolvedValue({ consistent: true, issues: [] });

    const orchestrator = new ProcessOrchestrator({
      stateManager,
      understandingEvaluator,
    } as any);

    const task = createTask('t-understand-pass');

    const ctx = await orchestrator.orchestrate([task] as any, {
      requirement: '实现多 Agent 并行编排，包含任务分解与权限控制',
      restatement: '我会实现多 Agent 并行编排，包含任务分解与权限控制',
    });

    const names = events.map((e) => e.event);

    // 不应出现理解失败事件
    expect(names.includes('understanding_failed')).toBe(false);
    // 应进入调度与执行，至少包含一次任务完成事件
    expect(names.includes('task_completed')).toBe(true);

    // 返回上下文有效
    expect(Array.isArray(ctx?.tasks)).toBe(true);
  });
});
