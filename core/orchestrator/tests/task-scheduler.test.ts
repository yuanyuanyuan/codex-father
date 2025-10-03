import { describe, expect, it } from 'vitest';
import { TaskScheduler } from '../task-scheduler';

describe('task-scheduler', () => {
  it('导出 TaskScheduler 类', () => {
    expect(typeof TaskScheduler).toBe('function');
  });

  it('可以实例化 TaskScheduler', () => {
    const scheduler = new TaskScheduler();
    expect(scheduler).toBeInstanceOf(TaskScheduler);
  });
});
