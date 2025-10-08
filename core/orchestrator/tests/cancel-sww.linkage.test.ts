import { describe, it, expect, vi } from 'vitest';

describe('ProcessOrchestrator cancel links to SWW (T004)', () => {
  it('calls sww.requestAbort() when requestCancel() is invoked', async () => {
    const modulePath: string = '../process-orchestrator.js';
    const { ProcessOrchestrator } = await import(modulePath);

    const events: Array<Record<string, unknown>> = [];
    const stateManager = {
      emitEvent: vi.fn(async (payload: Record<string, unknown>) => {
        events.push(payload);
      }),
      update: vi.fn(() => ({ updatedAt: Date.now() }) as any),
    };

    const sww = { requestAbort: vi.fn(() => 1) };

    const orchestrator = new ProcessOrchestrator({
      maxConcurrency: 1,
      stateManager,
      sww,
    } as any);

    await (orchestrator as any).requestCancel(0);

    expect(sww.requestAbort).toHaveBeenCalledTimes(1);
    const names = events.map((e) => e.event);
    expect(names[0]).toBe('cancel_requested');
    expect(names.at(-1)).toBe('orchestration_failed');
  });
});
