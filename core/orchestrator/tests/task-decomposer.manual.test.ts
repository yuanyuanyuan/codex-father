import { describe, it, expect } from 'vitest';
import { TaskDecomposer } from '../task-decomposer.js';

describe('TaskDecomposer manual mode', () => {
  it('returns tasks and dependency map while filtering unknown dependencies', async () => {
    const decomposer = new TaskDecomposer();
    const manualTasks = [
      { id: 't1', title: 'task 1', dependencies: ['t2', 'missing'] },
      { id: 't2', title: 'task 2' },
    ];

    const result = await decomposer.decompose({
      requirement: 'manual mode test',
      mode: 'manual',
      manualTasks,
    });

    expect(result.tasks).toEqual([
      { id: 't1', title: 'task 1', dependencies: ['t2', 'missing'] },
      { id: 't2', title: 'task 2', dependencies: [] },
    ]);
    expect(result.dependencies.get('t1')).toEqual(['t2']);
    expect(result.dependencies.get('t2')).toEqual([]);
    expect(result.dependencies.get('missing')).toBeUndefined();
  });

  it('throws when detecting circular dependencies', async () => {
    const decomposer = new TaskDecomposer();
    const promise = decomposer.decompose({
      requirement: 'cycle',
      mode: 'manual',
      manualTasks: [
        { id: 't1', dependencies: ['t2'] },
        { id: 't2', dependencies: ['t1'] },
      ],
    });

    await expect(promise).rejects.toThrow('dependency cycle detected');
  });

  it('throws when duplicate task ids exist', async () => {
    const decomposer = new TaskDecomposer();
    const promise = decomposer.decompose({
      requirement: 'duplicates',
      mode: 'manual',
      manualTasks: [{ id: 't1' }, { id: 't1' }],
    });

    await expect(promise).rejects.toThrow('duplicate id: t1');
  });
});
