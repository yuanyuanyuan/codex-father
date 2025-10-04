import { describe, expect, it } from 'vitest';

import { TaskScheduler } from '../task-scheduler.js';

describe('task-scheduler', () => {
  it('导出 TaskScheduler 类', () => {
    expect(typeof TaskScheduler).toBe('function');
  });

  it('可以实例化 TaskScheduler', () => {
    const scheduler = new TaskScheduler();
    expect(scheduler).toBeInstanceOf(TaskScheduler);
  });
});

describe('TaskScheduler contract (T010)', () => {
  const baseTask = (id: string, dependencies: string[] = []) => ({
    id,
    title: `Task ${id}`,
    description: `执行 ${id}`,
    role: 'developer',
    roleMatchMethod: 'rule',
    roleMatchDetails: '默认规则',
    status: 'pending',
    dependencies,
    priority: 0,
  });

  it('performs topological scheduling into dependency waves', () => {
    const scheduler = new TaskScheduler({ maxConcurrency: 3 } as any);
    const tasks = [
      baseTask('t1'),
      baseTask('t2', ['t1']),
      baseTask('t3', ['t1']),
      baseTask('t4', ['t2', 't3']),
    ];
    const dependencies = new Map<string, string[]>([
      ['t2', ['t1']],
      ['t3', ['t1']],
      ['t4', ['t2', 't3']],
    ]);

    const result = (scheduler as any).schedule({ tasks, dependencies });

    expect(result).toHaveProperty('executionPlan');
    const executionPlan = (result as Record<string, any>).executionPlan as Array<{
      tasks: Array<{ id: string }>;
    }>;

    expect(Array.isArray(executionPlan)).toBe(true);
    expect(executionPlan.length).toBe(3);
    expect(executionPlan[0]?.tasks.map((task) => task.id)).toEqual(['t1']);
    expect(executionPlan[1]?.tasks.map((task) => task.id)).toEqual(
      expect.arrayContaining(['t2', 't3'])
    );
    expect(executionPlan[2]?.tasks.map((task) => task.id)).toEqual(['t4']);
  });

  it('detects circular dependencies and aborts scheduling', () => {
    const scheduler = new TaskScheduler({ maxConcurrency: 2 } as any);
    const tasks = [baseTask('t1', ['t2']), baseTask('t2', ['t1'])];
    const dependencies = new Map<string, string[]>([
      ['t1', ['t2']],
      ['t2', ['t1']],
    ]);

    expect(() => (scheduler as any).schedule({ tasks, dependencies })).toThrow(/circular/i);
  });

  it('applies default timeout to tasks lacking explicit timeout', () => {
    const scheduler = new TaskScheduler({ taskTimeout: 30 * 60 * 1000 } as any);
    const tasks = [baseTask('t1')];

    const result = (scheduler as any).schedule({ tasks, dependencies: new Map() });
    expect(result).toHaveProperty('executionPlan');

    const plan = (result as Record<string, any>).executionPlan as Array<{
      tasks: Array<Record<string, unknown>>;
    }>;
    const scheduledTasks = plan.flatMap((wave) => wave.tasks);

    expect(scheduledTasks[0]).toHaveProperty('timeout', 30 * 60 * 1000);
  });
});
