import { describe, it, expect } from 'vitest';

describe('Orchestrator metrics edge case: zero tasks (T006)', () => {
  it('returns successRate=1 and totals=0 when no tasks provided', async () => {
    const { ProcessOrchestrator } = await import('../process-orchestrator.js');
    const orchestrator = new ProcessOrchestrator({} as any);
    const ctx = await orchestrator.orchestrate([] as any);

    expect(ctx?.stats).toBeDefined();
    const stats = ctx!.stats! as any;
    expect(stats.totalTasks).toBe(0);
    expect(stats.completedTasks).toBe(0);
    expect(stats.failedTasks).toBe(0);
    // 零任务视为成功（无失败）：successRate=1
    expect(stats.successRate).toBe(1);
  });
});
