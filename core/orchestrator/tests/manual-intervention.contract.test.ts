import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Manual intervention gating contract (T042)', () => {
  const modulePath: string = '../process-orchestrator.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('blocks orchestration until manual confirmation is granted', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const stateManager = { emitEvent: vi.fn() };

    const orchestrator = new ProcessOrchestrator({
      manualIntervention: { enabled: true, requireAck: true },
      stateManager,
    } as any);

    await expect(
      orchestrator.orchestrate([
        {
          id: 't-manual',
          description: '高风险变更任务',
          role: 'developer',
          dependencies: [],
        },
      ])
    ).rejects.toThrow(/manual intervention/i);

    expect(stateManager.emitEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'manual_intervention_requested' })
    );
  });
});
