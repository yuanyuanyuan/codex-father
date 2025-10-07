import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Resource pressure linkage reduces scheduling concurrency (T054)', () => {
  const modulePath: string = '../process-orchestrator.js';
  let ProcessOrchestrator: any;

  beforeEach(async () => {
    vi.resetModules();
    ({ ProcessOrchestrator } = await import(modulePath));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createTask = (id: string, deps: string[] = []) => ({
    id,
    title: id,
    description: 'demo',
    role: 'developer',
    roleMatchMethod: 'rule',
    roleMatchDetails: 'default',
    status: 'pending',
    dependencies: deps,
    priority: 0,
    timeout: 60_000,
    createdAt: new Date().toISOString(),
  });

  it('chunks waves using dynamically downscaled pool size', async () => {
    const resourceMonitor = {
      captureSnapshot: vi.fn().mockReturnValue({ cpuUsage: 0.95, timestamp: Date.now() }),
    };
    const stateManager = { emitEvent: vi.fn() };

    const orchestrator = new ProcessOrchestrator({
      maxConcurrency: 4,
      resourceThresholds: { cpuHighWatermark: 0.8 },
      resourceMonitor,
      stateManager,
    } as any);

    // 先触发降级（currentPoolSize 从 4 -> 3）
    await orchestrator.handleResourcePressure({ activeTasks: [] } as any);

    // 记录实际并发度
    let inFlight = 0;
    const samples: number[] = [];
    const originalSpawn = orchestrator.spawnAgent.bind(orchestrator);
    vi.spyOn(orchestrator, 'spawnAgent').mockImplementation(async (task: any) => {
      inFlight += 1;
      samples.push(inFlight);
      try {
        return await originalSpawn(task);
      } finally {
        inFlight -= 1;
      }
    });

    const tasks = [createTask('t1'), createTask('t2'), createTask('t3'), createTask('t4')];
    await orchestrator.orchestrate(tasks as any);

    // 最大并发不应超过降级后的 3
    expect(Math.max(...samples)).toBeLessThanOrEqual(3);
  });
});
