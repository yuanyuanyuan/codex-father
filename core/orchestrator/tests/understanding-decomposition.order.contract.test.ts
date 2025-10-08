import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Gate order: understanding + decomposition failure audit (contract)', () => {
  const modulePath: string = '../process-orchestrator.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const cyclicTasks = [
    {
      id: 'a',
      title: 'a',
      description: 'cyclic',
      role: 'developer',
      roleMatchMethod: 'rule',
      roleMatchDetails: 'default',
      status: 'pending',
      dependencies: ['b'],
      priority: 0,
      timeout: 10_000,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'b',
      title: 'b',
      description: 'cyclic',
      role: 'developer',
      roleMatchMethod: 'rule',
      roleMatchDetails: 'default',
      status: 'pending',
      dependencies: ['a'],
      priority: 0,
      timeout: 10_000,
      createdAt: new Date().toISOString(),
    },
  ] as const;

  it('understanding passes, decomposition fails → understanding_validated → decomposition_failed → orchestration_failed', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const events: Array<Record<string, any>> = [];
    const stateManager = { emitEvent: vi.fn(async (p: any) => void events.push(p)) };

    const orchestrator = new ProcessOrchestrator({
      stateManager,
      understanding: {
        requirement: '实现 A，包含 B 与 C',
        restatement: '我会实现 A，包含 B 与 C',
        evaluateConsistency: vi.fn().mockResolvedValue({ consistent: true, issues: [] }),
      },
    } as any);

    await orchestrator.orchestrate(cyclicTasks as any);

    const names = events.map((e) => e.event);
    const idxUV = names.indexOf('understanding_validated');
    const idxDF = names.indexOf('decomposition_failed');
    const idxOF = names.indexOf('orchestration_failed');
    expect(idxUV).toBeGreaterThanOrEqual(0);
    expect(idxDF).toBeGreaterThan(idxUV);
    expect(idxOF).toBeGreaterThan(idxDF);
    // 不应出现调度类事件
    expect(names.includes('start')).toBe(false);
  });

  it('understanding fails → understanding_failed → orchestration_failed（不进入 decomposition）', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const events: Array<Record<string, any>> = [];
    const stateManager = { emitEvent: vi.fn(async (p: any) => void events.push(p)) };

    const orchestrator = new ProcessOrchestrator({
      stateManager,
      understanding: {
        requirement: '实现登录与会话恢复',
        restatement: '我会写一行 hello world',
        evaluateConsistency: vi.fn().mockResolvedValue({ consistent: false, issues: ['不一致'] }),
      },
    } as any);

    await orchestrator.orchestrate([]);

    const names = events.map((e) => e.event);
    // 仅 JSONL 审计语义在 stateManager 上表现为 emitEvent 顺序
    expect(names[0]).toBe('understanding_failed');
    expect(names[1]).toBe('orchestration_failed');
    expect(names.includes('decomposition_failed')).toBe(false);
  });
});
