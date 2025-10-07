import { describe, it, expect, vi, afterEach } from 'vitest';

describe('Understanding gate contract (T049)', () => {
  const modulePath: string = '../process-orchestrator.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits understanding_failed then orchestration_failed when inconsistent (no tasks)', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const events: Array<Record<string, unknown>> = [];
    const stateManager = {
      emitEvent: vi.fn(async (payload: Record<string, unknown>) => {
        events.push(payload);
      }),
    };

    const orchestrator = new ProcessOrchestrator({
      stateManager,
      understanding: {
        requirement: '实现登录并补充测试，确保 30 分钟超时逻辑',
        restatement: '我会实现登录功能',
        evaluateConsistency: vi
          .fn()
          .mockResolvedValue({ consistent: false, issues: ['遗漏验收条件'] }),
      },
    } as any);

    const ctx = await orchestrator.orchestrate([]);
    expect(Array.isArray(ctx?.tasks)).toBe(true);

    const names = events.map((e) => e.event);
    expect(names).toEqual(['understanding_failed', 'orchestration_failed']);
  });

  it('emits understanding_validated and returns context on success (no tasks)', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const events: Array<Record<string, unknown>> = [];
    const stateManager = {
      emitEvent: vi.fn(async (payload: Record<string, unknown>) => {
        events.push(payload);
      }),
    };

    const orchestrator = new ProcessOrchestrator({
      stateManager,
      understanding: {
        requirement: '实现多 Agent 并行编排，包含任务分解与权限控制',
        restatement: '我会实现多 Agent 并行编排，包含任务分解与权限控制',
        evaluateConsistency: vi.fn().mockResolvedValue({ consistent: true, issues: [] }),
      },
    } as any);

    const ctx = await orchestrator.orchestrate([]);
    expect(Array.isArray(ctx?.tasks)).toBe(true);

    const names = events.map((e) => e.event);
    expect(names).toContain('understanding_validated');
    expect(names).not.toContain('understanding_failed');
    expect(names).not.toContain('orchestration_failed');
  });
});
