import { TaskRunner } from '../../core/taskrunner/TaskRunner.js';
import { TaskConfig } from '../../core/taskrunner/types.js';

describe('TaskRunner', () => {
  let runner: TaskRunner;

  beforeEach(() => {
    runner = new TaskRunner(1); // Limit concurrency for testing
  });

  test('should execute simple task successfully', async () => {
    const task: TaskConfig = {
      id: 'test-1',
      execute: async () => 'success',
    };

    const taskId = await runner.run(task);
    expect(taskId).toBe('test-1');

    // Wait for task completion
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = runner.getResult(taskId);
    expect(result?.success).toBe(true);
    expect(result?.result).toBe('success');
  });

  test('should handle task failure', async () => {
    const task: TaskConfig = {
      id: 'test-2',
      execute: async () => {
        throw new Error('Test error');
      },
    };

    await runner.run(task);

    // Wait for task completion
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = runner.getResult('test-2');
    expect(result?.success).toBe(false);
    expect(result?.error).toBe('Test error');
  });

  test('should respect max concurrency', async () => {
    const runner = new TaskRunner(1);
    let runningTasks = 0;
    const maxConcurrentTasks = 0;

    const tasks = Array.from({ length: 5 }, (_, i) => ({
      id: `concurrent-test-${i}`,
      execute: async () => {
        runningTasks++;
        maxConcurrentTasks = Math.max(maxConcurrentTasks, runningTasks);
        await new Promise((resolve) => setTimeout(resolve, 50));
        runningTasks--;
        return `result-${i}`;
      },
    }));

    // Submit all tasks
    const taskIds = await Promise.all(tasks.map((task) => runner.run(task)));

    // Wait for all tasks to complete
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(maxConcurrentTasks).toBeLessThanOrEqual(1);
    expect(taskIds).toHaveLength(5);
  });

  test('should handle task timeout', async () => {
    const task: TaskConfig = {
      id: 'timeout-test',
      timeout: 100,
      execute: async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return 'should not reach';
      },
    };

    await runner.run(task);

    // Wait for task to timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    const result = runner.getResult('timeout-test');
    expect(result?.success).toBe(false);
    expect(result?.error).toBe('Timeout');
  });

  test('should provide correct status', () => {
    const status = runner.getStatus();
    expect(status).toHaveProperty('running');
    expect(status).toHaveProperty('maxConcurrency');
    expect(status).toHaveProperty('pending');
    expect(status).toHaveProperty('completed');
    expect(status.maxConcurrency).toBe(1);
  });
});
