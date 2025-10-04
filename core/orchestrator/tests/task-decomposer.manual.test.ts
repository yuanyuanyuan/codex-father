import { describe, expect, it } from 'vitest';

describe('TaskDecomposer manual mode contract (T031)', () => {
  const modulePath: string = '../task-decomposer.js';

  it('returns validated manual tasks with dependency map when IDs are unique', async () => {
    const { TaskDecomposer } = await import(modulePath);

    const manualTasks = [
      {
        id: 't-plan',
        title: '任务拆解规划',
        description: '细化需求，识别可并行工作项',
        role: 'planner',
        dependencies: [],
        priority: 0,
      },
      {
        id: 't-impl',
        title: '功能实现',
        description: '编码实现核心逻辑',
        role: 'developer',
        dependencies: ['t-plan'],
        priority: 1,
      },
    ];

    const decomposer = new TaskDecomposer();

    const result = await decomposer.decompose({
      requirement: '实现多 Agent 并行编排',
      mode: 'manual',
      manualTasks,
    });

    expect(Array.isArray(result.tasks)).toBe(true);
    expect(result.tasks.map((task: { id: string }) => task.id)).toEqual(['t-plan', 't-impl']);
    expect(result.dependencies instanceof Map).toBe(true);
    expect(result.dependencies.get('t-impl')).toEqual(['t-plan']);
  });

  it('rejects manual definitions that contain dependency cycles', async () => {
    const { TaskDecomposer } = await import(modulePath);

    const cyclicTasks = [
      {
        id: 'loop-a',
        title: '循环 A',
        description: '依赖 loop-b',
        role: 'developer',
        dependencies: ['loop-b'],
        priority: 0,
      },
      {
        id: 'loop-b',
        title: '循环 B',
        description: '依赖 loop-a',
        role: 'tester',
        dependencies: ['loop-a'],
        priority: 0,
      },
    ];

    const decomposer = new TaskDecomposer();

    await expect(
      decomposer.decompose({
        requirement: '检测循环依赖',
        mode: 'manual',
        manualTasks: cyclicTasks,
      })
    ).rejects.toThrow(/cycle|循环|依赖/i);
  });
});
