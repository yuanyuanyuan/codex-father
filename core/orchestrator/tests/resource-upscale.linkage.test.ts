import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Resource pressure recovery increases scheduling concurrency (linkage)', () => {
  const modulePath: string = '../process-orchestrator.js';
  let ProcessOrchestrator: any;

  beforeEach(async () => {
    vi.resetModules();
    ({ ProcessOrchestrator } = await import(modulePath));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits concurrency_reduced then concurrency_increased when pressure drops', async () => {
    const events: Array<Record<string, any>> = [];
    const stateManager = { emitEvent: vi.fn(async (p: any) => void events.push(p)) };

    // 资源监控：先高负载（降 1 档），后低负载（升回 1 档）
    const high = {
      captureSnapshot: vi.fn().mockReturnValue({ cpuUsage: 0.95, timestamp: Date.now() }),
    };
    const low = {
      captureSnapshot: vi.fn().mockReturnValue({ cpuUsage: 0.1, timestamp: Date.now() }),
    };

    const orchestrator = new ProcessOrchestrator({
      maxConcurrency: 3,
      resourceThresholds: { cpuHighWatermark: 0.8 },
      resourceMonitor: high,
      stateManager,
    } as any);

    // 高压 → 降级 3 -> 2
    await orchestrator.handleResourcePressure({ activeTasks: [] } as any);
    // 低压 → 升级 2 -> 3
    (orchestrator as any).resourceMonitor = low;
    await orchestrator.handleResourcePressure({ activeTasks: [] } as any);

    const names = events.map((e) => e.event);
    expect(names).toContain('concurrency_reduced');
    expect(names).toContain('concurrency_increased');

    const red = events.find((e) => e.event === 'concurrency_reduced') as any;
    const inc = events.find((e) => e.event === 'concurrency_increased') as any;
    expect(red?.data?.from).toBe(3);
    expect(red?.data?.to).toBe(2);
    expect(inc?.data?.from).toBe(2);
    expect(inc?.data?.to).toBe(3);
  });
});
