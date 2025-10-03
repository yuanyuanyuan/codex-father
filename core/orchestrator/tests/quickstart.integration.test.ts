import { describe, expect, it } from 'vitest';

import { ProcessOrchestrator } from '../process-orchestrator.js';
import { validateStreamEvent } from '../../lib/utils/stream-event-validator.js';

describe('Quickstart integration scenario (T009)', () => {
  it('runs the quickstart flow and emits stream events that satisfy the contract', async () => {
    const orchestrator = new ProcessOrchestrator({
      maxConcurrency: 2,
      successRateThreshold: 0.9,
      taskTimeout: 30 * 60 * 1000,
      outputFormat: 'stream-json',
    } as any);

    const run = (orchestrator as Record<string, unknown>).run as
      | ((input: Record<string, unknown>) => Promise<Record<string, unknown>>)
      | undefined;

    expect(typeof run).toBe('function');

    const output = await run?.({
      requirement: '将需求拆分为10个并行子任务并执行',
      tasks: [
        {
          id: 't-setup',
          description: '初始化项目结构',
          role: 'developer',
          roleMatchMethod: 'rule',
          roleMatchDetails: '默认',
          dependencies: [],
          timeout: 30 * 60 * 1000,
          priority: 0,
        },
        {
          id: 't-impl',
          description: '实现核心逻辑',
          role: 'developer',
          roleMatchMethod: 'rule',
          roleMatchDetails: '默认',
          dependencies: ['t-setup'],
          timeout: 30 * 60 * 1000,
          priority: 0,
        },
      ],
      mode: 'llm',
      outputFormat: 'stream-json',
      successRateThreshold: 0.9,
    });

    const events = (output as Record<string, unknown>)?.events as unknown[];
    expect(Array.isArray(events)).toBe(true);
    expect(events?.length).toBeGreaterThan(0);

    const eventNames = events?.map((event) => (event as { event?: string }).event);
    expect(eventNames).toEqual(
      expect.arrayContaining([
        'start',
        'task_scheduled',
        'task_started',
        'task_completed',
        'orchestration_completed',
      ])
    );

    events?.forEach((event) => {
      const validation = validateStreamEvent(event);
      expect(validation.valid).toBe(true);
    });

    const summary = (output as Record<string, unknown>)?.summary as
      | Record<string, unknown>
      | undefined;
    expect(summary).toBeDefined();
    expect(summary).toHaveProperty('successRate');
    expect(summary?.successRate).toBeGreaterThanOrEqual(0.9);
  });
});
