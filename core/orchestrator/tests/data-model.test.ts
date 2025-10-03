import { describe, expect, it } from 'vitest';

import * as orchestratorTypes from '../types.js';

describe('Orchestrator data model contract (T008)', () => {
  it('exports zod schemas for core orchestration entities', () => {
    expect(orchestratorTypes).toHaveProperty('OrchestrationSchema');
    expect(orchestratorTypes).toHaveProperty('TaskSchema');
    expect(orchestratorTypes).toHaveProperty('AgentSchema');
    expect(orchestratorTypes).toHaveProperty('PatchSchema');
  });

  it('provides default orchestration config aligned with data-model.md', () => {
    const createDefault = (orchestratorTypes as Record<string, unknown>)
      .createDefaultOrchestratorConfig as (() => Record<string, unknown>) | undefined;

    expect(createDefault).toBeDefined();

    const config = createDefault?.() ?? {};

    expect(config).toHaveProperty('maxConcurrency', 10);
    expect(config).toHaveProperty('taskTimeout', 30 * 60 * 1000);
    expect(config).toHaveProperty('outputFormat', 'stream-json');
    expect(config).toHaveProperty('successRateThreshold');
    expect(config.successRateThreshold).toBeCloseTo(0.9, 5);
  });

  it('validates task status, dependencies, and timestamps through zod schemas', () => {
    const taskSchema = (orchestratorTypes as Record<string, unknown>).TaskSchema as {
      safeParse?: (value: unknown) => { success: boolean };
    };

    expect(taskSchema).toBeDefined();
    expect(typeof taskSchema?.safeParse).toBe('function');

    const validResult = taskSchema?.safeParse?.({
      id: 't-001',
      description: '拆分子任务',
      role: 'developer',
      mutation: true,
      roleMatchMethod: 'rule',
      roleMatchDetails: '默认规则',
      status: 'pending',
      dependencies: [],
      priority: 0,
      timeout: 30 * 60 * 1000,
      createdAt: new Date().toISOString(),
      outputs: [],
    });

    expect(validResult?.success).toBe(true);
  });
});
