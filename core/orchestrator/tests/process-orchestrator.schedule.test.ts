import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProcessOrchestrator as ProcessOrchestratorType } from '../process-orchestrator.js';

vi.mock('node:child_process', () => {
  const spawn = vi.fn(() => ({
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    on: vi.fn(),
  }));

  return { spawn };
});

const createTask = (id: string, dependencies: string[] = []) => ({
  id,
  title: `任务 ${id}`,
  description: `描述 ${id}`,
  role: 'developer',
  roleMatchMethod: 'rule',
  roleMatchDetails: '默认规则',
  status: 'pending',
  dependencies,
  priority: 0,
  timeout: 30_000,
  createdAt: '2025-01-01T00:00:00.000Z',
});

describe('ProcessOrchestrator 调度流程 (T013)', () => {
  const modulePath = '../process-orchestrator.js';
  let ProcessOrchestrator: typeof ProcessOrchestratorType;

  beforeEach(async () => {
    vi.resetModules();
    ({ ProcessOrchestrator } = await import(modulePath));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('按拓扑波次执行任务，并限制每波并发不超过池大小', async () => {
    const events: Array<Record<string, unknown>> = [];
    const stateManager = {
      emitEvent: vi.fn(async (payload: Record<string, unknown>) => {
        events.push(payload);
      }),
    };

    const orchestrator = new ProcessOrchestrator({ maxConcurrency: 2, stateManager } as any);

    const tasks = [
      createTask('t1'),
      createTask('t2', ['t1']),
      createTask('t3', ['t1']),
      createTask('t4', ['t2', 't3']),
    ];

    const originalSpawn = orchestrator.spawnAgent.bind(orchestrator);
    let inFlight = 0;
    const concurrencySamples: number[] = [];

    const spawnSpy = vi.spyOn(orchestrator, 'spawnAgent').mockImplementation(async (task: any) => {
      inFlight += 1;
      concurrencySamples.push(inFlight);
      try {
        return await originalSpawn(task);
      } finally {
        inFlight -= 1;
      }
    });

    await orchestrator.orchestrate(tasks as any);

    expect(spawnSpy).toHaveBeenCalledTimes(tasks.length);
    expect(Math.max(...concurrencySamples)).toBeLessThanOrEqual(2);

    const startEvents = events.filter((event) => event.event === 'start');
    expect(startEvents.map((event) => (event.data as any)?.wave)).toEqual([0, 1, 2]);

    const startedTasks = events.filter((event) => event.event === 'task_started');
    expect(startedTasks.map((event) => event.taskId)).toEqual(['t1', 't2', 't3', 't4']);
    expect(startedTasks.map((event) => (event.data as any)?.wave)).toEqual([0, 1, 1, 2]);

    const completedTasks = events.filter((event) => event.event === 'task_completed');
    expect(completedTasks.map((event) => event.taskId)).toEqual(['t1', 't2', 't3', 't4']);
    expect(completedTasks.map((event) => (event.data as any)?.wave)).toEqual([0, 1, 1, 2]);

    spawnSpy.mockRestore();
  });
});
