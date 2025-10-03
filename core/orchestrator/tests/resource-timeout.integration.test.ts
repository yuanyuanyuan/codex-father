import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Resource exhaustion & timeout integration (T041)', () => {
  const modulePath: string = '../process-orchestrator.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downscales concurrency and marks tasks as timeout when thresholds exceeded', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const resourceMonitor = {
      captureSnapshot: vi.fn().mockReturnValue({
        cpuUsage: 0.95,
        memoryUsage: 8 * 1024 * 1024 * 1024,
        timestamp: Date.now(),
      }),
    };

    const stateManager = { emitEvent: vi.fn() };

    const orchestrator = new ProcessOrchestrator({
      maxConcurrency: 5,
      resourceThresholds: { cpuHighWatermark: 0.8 },
      resourceMonitor,
      stateManager,
      taskTimeoutMs: 30 * 60 * 1000,
    } as any);

    await orchestrator.handleResourcePressure({
      activeTasks: [
        {
          id: 't-timeout',
          role: 'developer',
          startedAt: Date.now() - 45 * 60 * 1000,
        },
      ],
    } as any);

    expect(resourceMonitor.captureSnapshot).toHaveBeenCalled();
    expect(stateManager.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'concurrency_reduced',
        data: expect.objectContaining({ reason: 'resource_exhausted' }),
      })
    );
    expect(stateManager.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'task_failed',
        taskId: 't-timeout',
        data: expect.objectContaining({ reason: 'timeout' }),
      })
    );
  });
});
