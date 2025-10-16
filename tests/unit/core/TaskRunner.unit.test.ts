/**
 * TaskRunner 核心类单元测试
 * 测试任务执行引擎的所有核心功能
 *
 * 测试覆盖:
 * - 任务执行流程
 * - 并发管理
 * - 错误处理
 * - 状态查询
 * - 任务取消
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TaskRunner } from '../../../src/core/TaskRunner.js';
import { TaskConfig, TaskResult, RunnerStatus } from '../../../src/core/types.js';
import { JsonStorage } from '../../../src/core/storage.js';
import { ConcurrencyManager } from '../../../src/core/concurrency.js';
import { TaskQueue } from '../../../src/core/queue.js';

// Mock 依赖模块
vi.mock('../../../src/core/storage.js');
vi.mock('../../../src/core/concurrency.js');
vi.mock('../../../src/core/queue.js');

describe('TaskRunner Unit Tests', () => {
  let taskRunner: TaskRunner;
  let mockStorage: any;
  let mockConcurrencyManager: any;
  let mockTaskQueue: any;

  beforeEach(() => {
    // 创建 Mock 实例
    mockStorage = {
      getResult: vi.fn(),
      saveResult: vi.fn(),
      getCompletedCount: vi.fn().mockReturnValue(0),
    };

    mockConcurrencyManager = {
      getRunningCount: vi.fn().mockReturnValue(0),
      canAcquireSlot: vi.fn().mockReturnValue(true),
      acquireSlot: vi.fn(),
      releaseSlot: vi.fn(),
      cancelTask: vi.fn().mockResolvedValue(true),
    };

    mockTaskQueue = {
      enqueue: vi.fn(),
      dequeue: vi.fn(),
      hasNext: vi.fn().mockReturnValue(false),
      getPendingCount: vi.fn().mockReturnValue(0),
    };

    // 设置 Mock 返回值
    (JsonStorage as any).mockImplementation(() => mockStorage);
    (ConcurrencyManager as any).mockImplementation(() => mockConcurrencyManager);
    (TaskQueue as any).mockImplementation(() => mockTaskQueue);

    taskRunner = new TaskRunner(10);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('应该使用默认并发数初始化', () => {
      const defaultRunner = new TaskRunner();
      expect(defaultRunner).toBeDefined();
    });

    it('应该使用指定并发数初始化', () => {
      const customRunner = new TaskRunner(20);
      expect(customRunner).toBeDefined();
    });

    it('应该正确初始化所有依赖组件', () => {
      expect(ConcurrencyManager).toHaveBeenCalledWith(10);
      expect(TaskQueue).toHaveBeenCalled();
      expect(JsonStorage).toHaveBeenCalled();
    });
  });

  describe('run method', () => {
    let validTask: TaskConfig;

    beforeEach(() => {
      validTask = {
        id: 'test-task-1',
        command: 'echo "Hello World"',
        timeout: 5000,
        execute: vi.fn().mockResolvedValue('Task completed'),
      };
    });

    it('应该成功提交有效任务', async () => {
      mockTaskQueue.hasNext.mockReturnValue(false);

      const taskId = await taskRunner.run(validTask);

      expect(taskId).toBe('test-task-1');
      expect(mockTaskQueue.enqueue).toHaveBeenCalledWith(validTask);
    });

    it('应该验证任务配置', async () => {
      const invalidTask = {
        id: '', // 无效ID
        command: 'echo test',
        timeout: 5000,
        execute: vi.fn(),
      } as TaskConfig;

      await expect(taskRunner.run(invalidTask)).rejects.toThrow();
    });

    it('应该检查任务依赖', async () => {
      const taskWithDeps: TaskConfig = {
        id: 'task-with-deps',
        command: 'echo test',
        dependencies: ['dep-1', 'dep-2'],
        timeout: 5000,
        execute: vi.fn(),
      };

      mockStorage.getResult
        .mockReturnValueOnce({ success: true })
        .mockReturnValueOnce({ success: true });

      await taskRunner.run(taskWithDeps);

      expect(mockStorage.getResult).toHaveBeenCalledWith('dep-1');
      expect(mockStorage.getResult).toHaveBeenCalledWith('dep-2');
    });

    it('应该拒绝依赖失败的任务', async () => {
      const taskWithFailedDep: TaskConfig = {
        id: 'task-with-failed-dep',
        command: 'echo test',
        dependencies: ['failed-dep'],
        timeout: 5000,
        execute: vi.fn(),
      };

      mockStorage.getResult.mockReturnValue({ success: false });

      await expect(taskRunner.run(taskWithFailedDep)).rejects.toThrow(
        'Dependency failed: failed-dep'
      );
    });

    it('应该处理未找到的依赖', async () => {
      const taskWithMissingDep: TaskConfig = {
        id: 'task-with-missing-dep',
        command: 'echo test',
        dependencies: ['missing-dep'],
        timeout: 5000,
        execute: vi.fn(),
      };

      mockStorage.getResult.mockReturnValue(undefined);

      await expect(taskRunner.run(taskWithMissingDep)).rejects.toThrow(
        'Dependency failed: missing-dep'
      );
    });

    it('应该启动队列处理', async () => {
      const processQueueSpy = vi.spyOn(taskRunner as any, 'processQueue');
      mockTaskQueue.hasNext.mockReturnValue(true);
      mockTaskQueue.dequeue.mockReturnValue(validTask);
      mockConcurrencyManager.canAcquireSlot.mockReturnValue(true);

      await taskRunner.run(validTask);

      // 由于 processQueue 是异步调用的，我们需要等待一下
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(processQueueSpy).toHaveBeenCalled();
    });
  });

  describe('getResult method', () => {
    it('应该返回任务结果', () => {
      const mockResult: TaskResult = {
        id: 'test-task',
        success: true,
        result: 'Task completed',
        startTime: new Date(),
        endTime: new Date(),
        duration: 1000,
      };

      mockStorage.getResult.mockReturnValue(mockResult);

      const result = taskRunner.getResult('test-task');

      expect(result).toBe(mockResult);
      expect(mockStorage.getResult).toHaveBeenCalledWith('test-task');
    });

    it('应该返回 undefined 对于不存在的任务', () => {
      mockStorage.getResult.mockReturnValue(undefined);

      const result = taskRunner.getResult('non-existent-task');

      expect(result).toBeUndefined();
    });
  });

  describe('getStatus method', () => {
    it('应该返回正确的运行状态', () => {
      mockConcurrencyManager.getRunningCount.mockReturnValue(5);
      mockTaskQueue.getPendingCount.mockReturnValue(3);
      mockStorage.getCompletedCount.mockReturnValue(10);

      const status = taskRunner.getStatus();

      expect(status).toEqual({
        running: 5,
        maxConcurrency: 10,
        pending: 3,
        completed: 10,
      });
    });

    it('应该返回零状态对于新实例', () => {
      mockConcurrencyManager.getRunningCount.mockReturnValue(0);
      mockTaskQueue.getPendingCount.mockReturnValue(0);
      mockStorage.getCompletedCount.mockReturnValue(0);

      const status = taskRunner.getStatus();

      expect(status.running).toBe(0);
      expect(status.pending).toBe(0);
      expect(status.completed).toBe(0);
      expect(status.maxConcurrency).toBe(10);
    });
  });

  describe('cancel method', () => {
    it('应该成功取消任务', async () => {
      mockConcurrencyManager.cancelTask.mockResolvedValue(true);

      const result = await taskRunner.cancel('test-task');

      expect(result).toBe(true);
      expect(mockConcurrencyManager.cancelTask).toHaveBeenCalledWith('test-task');
    });

    it('应该处理取消失败', async () => {
      mockConcurrencyManager.cancelTask.mockResolvedValue(false);

      const result = await taskRunner.cancel('test-task');

      expect(result).toBe(false);
    });

    it('应该处理取消异常', async () => {
      mockConcurrencyManager.cancelTask.mockRejectedValue(new Error('Cancel failed'));

      await expect(taskRunner.cancel('test-task')).rejects.toThrow('Cancel failed');
    });
  });

  describe('私有方法测试', () => {
    describe('processQueue', () => {
      it('应该处理队列中的所有任务', async () => {
        const task1: TaskConfig = {
          id: 'task-1',
          command: 'echo task1',
          timeout: 5000,
          execute: vi.fn().mockResolvedValue('Task 1 done'),
        };

        const task2: TaskConfig = {
          id: 'task-2',
          command: 'echo task2',
          timeout: 5000,
          execute: vi.fn().mockResolvedValue('Task 2 done'),
        };

        mockTaskQueue.hasNext
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(true)
          .mockReturnValueOnce(false);
        mockTaskQueue.dequeue.mockReturnValueOnce(task1).mockReturnValueOnce(task2);
        mockConcurrencyManager.canAcquireSlot.mockReturnValue(true);

        const executeTaskSpy = vi.spyOn(taskRunner as any, 'executeTask');

        await (taskRunner as any).processQueue();

        expect(executeTaskSpy).toHaveBeenCalledTimes(2);
        expect(executeTaskSpy).toHaveBeenCalledWith(task1);
        expect(executeTaskSpy).toHaveBeenCalledWith(task2);
      });

      it('应该在没有可用槽位时停止处理', async () => {
        mockTaskQueue.hasNext.mockReturnValue(true);
        mockConcurrencyManager.canAcquireSlot.mockReturnValue(false);

        const executeTaskSpy = vi.spyOn(taskRunner as any, 'executeTask');

        await (taskRunner as any).processQueue();

        expect(executeTaskSpy).not.toHaveBeenCalled();
      });

      it('应该在队列为空时停止处理', async () => {
        mockTaskQueue.hasNext.mockReturnValue(false);
        mockConcurrencyManager.canAcquireSlot.mockReturnValue(true);

        const executeTaskSpy = vi.spyOn(taskRunner as any, 'executeTask');

        await (taskRunner as any).processQueue();

        expect(executeTaskSpy).not.toHaveBeenCalled();
      });
    });

    describe('executeTask', () => {
      let testTask: TaskConfig;

      beforeEach(() => {
        testTask = {
          id: 'execute-test-task',
          command: 'echo test',
          timeout: 5000,
          execute: vi.fn().mockResolvedValue('Test result'),
        };
      });

      it('应该成功执行任务', async () => {
        const startTime = new Date();
        vi.setSystemTime(startTime);

        await (taskRunner as any).executeTask(testTask);

        expect(mockConcurrencyManager.acquireSlot).toHaveBeenCalledWith('execute-test-task');
        expect(testTask.execute).toHaveBeenCalled();
        expect(mockStorage.saveResult).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'execute-test-task',
            success: true,
            result: 'Test result',
            startTime: startTime,
            endTime: expect.any(Date),
            duration: expect.any(Number),
          })
        );
        expect(mockConcurrencyManager.releaseSlot).toHaveBeenCalledWith('execute-test-task');
      });

      it('应该处理任务执行失败', async () => {
        const error = new Error('Task execution failed');
        testTask.execute.mockRejectedValue(error);

        const startTime = new Date();
        vi.setSystemTime(startTime);

        await (taskRunner as any).executeTask(testTask);

        expect(mockStorage.saveResult).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'execute-test-task',
            success: false,
            error: 'Task execution failed',
            startTime: startTime,
            endTime: expect.any(Date),
            duration: expect.any(Number),
          })
        );
      });

      it('应该处理字符串错误', async () => {
        testTask.execute.mockRejectedValue('String error');

        await (taskRunner as any).executeTask(testTask);

        expect(mockStorage.saveResult).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: 'String error',
          })
        );
      });

      it('应该处理未知错误类型', async () => {
        testTask.execute.mockRejectedValue(null);

        await (taskRunner as any).executeTask(testTask);

        expect(mockStorage.saveResult).toHaveBeenCalledWith(
          expect.objectContaining({
            success: false,
            error: 'null',
          })
        );
      });

      it('应该触发后续队列处理', async () => {
        const processQueueSpy = vi.spyOn(taskRunner as any, 'processQueue');
        testTask.execute.mockResolvedValue('Done');

        await (taskRunner as any).executeTask(testTask);

        // 由于 processQueue 是在 finally 中异步调用的
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(processQueueSpy).toHaveBeenCalled();
      });
    });

    describe('checkDependencies', () => {
      it('应该跳过没有依赖的任务', async () => {
        const taskWithoutDeps: TaskConfig = {
          id: 'no-deps-task',
          command: 'echo test',
          timeout: 5000,
          execute: vi.fn(),
        };

        await expect(
          (taskRunner as any).checkDependencies(taskWithoutDeps)
        ).resolves.toBeUndefined();
        expect(mockStorage.getResult).not.toHaveBeenCalled();
      });

      it('应该验证所有依赖都成功', async () => {
        const taskWithDeps: TaskConfig = {
          id: 'deps-task',
          command: 'echo test',
          dependencies: ['dep-1', 'dep-2'],
          timeout: 5000,
          execute: vi.fn(),
        };

        mockStorage.getResult
          .mockReturnValueOnce({ success: true, result: 'dep 1 done' })
          .mockReturnValueOnce({ success: true, result: 'dep 2 done' });

        await expect((taskRunner as any).checkDependencies(taskWithDeps)).resolves.toBeUndefined();
        expect(mockStorage.getResult).toHaveBeenCalledTimes(2);
      });

      it('应该抛出错误对于失败的依赖', async () => {
        const taskWithFailedDep: TaskConfig = {
          id: 'failed-deps-task',
          command: 'echo test',
          dependencies: ['failed-dep'],
          timeout: 5000,
          execute: vi.fn(),
        };

        mockStorage.getResult.mockReturnValue({ success: false, error: 'Dep failed' });

        await expect((taskRunner as any).checkDependencies(taskWithFailedDep)).rejects.toThrow(
          'Dependency failed: failed-dep'
        );
      });
    });
  });

  describe('边界情况和错误处理', () => {
    it('应该处理空任务ID', async () => {
      const invalidTask: TaskConfig = {
        id: '',
        command: 'echo test',
        timeout: 5000,
        execute: vi.fn(),
      };

      await expect(taskRunner.run(invalidTask)).rejects.toThrow();
    });

    it('应该处理超时为0的任务', async () => {
      const immediateTask: TaskConfig = {
        id: 'immediate-task',
        command: 'echo immediate',
        timeout: 0,
        execute: vi.fn(),
      };

      mockTaskQueue.hasNext.mockReturnValue(false);

      const taskId = await taskRunner.run(immediateTask);
      expect(taskId).toBe('immediate-task');
    });

    it('应该处理负数超时', async () => {
      const negativeTimeoutTask: TaskConfig = {
        id: 'negative-timeout-task',
        command: 'echo negative',
        timeout: -1000,
        execute: vi.fn(),
      };

      mockTaskQueue.hasNext.mockReturnValue(false);

      // 应该使用默认超时时间
      const taskId = await taskRunner.run(negativeTimeoutTask);
      expect(taskId).toBe('negative-timeout-task');
    });

    it('应该处理非常大并发数', () => {
      const largeConcurrencyRunner = new TaskRunner(1000);
      expect(largeConcurrencyRunner).toBeDefined();
    });

    it('应该处理零并发数', () => {
      const zeroConcurrencyRunner = new TaskRunner(0);
      expect(zeroConcurrencyRunner).toBeDefined();
    });
  });

  describe('性能测试', () => {
    it('应该快速处理简单状态查询', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        taskRunner.getStatus();
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(100); // 100ms内完成1000次状态查询
    });

    it('应该快速处理结果查询', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        taskRunner.getResult(`task-${i}`);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(50); // 50ms内完成1000次结果查询
    });
  });
});
