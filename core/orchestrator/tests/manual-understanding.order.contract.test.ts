import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Gate order with manualIntervention (no ack) blocks understanding gate', () => {
  const modulePath: string = '../process-orchestrator.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits manual_intervention_requested → orchestration_failed and does not run understanding', async () => {
    const { ProcessOrchestrator } = await import(modulePath);

    const events: Array<Record<string, any>> = [];
    const stateManager = { emitEvent: vi.fn(async (p: any) => void events.push(p)) };

    const orchestrator = new ProcessOrchestrator({
      stateManager,
      manualIntervention: { enabled: true, requireAck: true, ack: false },
      understanding: {
        requirement: 'A + B + C',
        restatement: 'A + B + C',
        evaluateConsistency: vi.fn().mockResolvedValue({ consistent: true, issues: [] }),
      },
    } as any);

    await expect(orchestrator.orchestrate([] as any)).rejects.toThrowError();

    const names = events.map((e) => e.event);
    expect(names).toEqual(['manual_intervention_requested', 'orchestration_failed']);
    expect(names.includes('understanding_validated')).toBe(false);
    expect(names.includes('understanding_failed')).toBe(false);
  });
});
