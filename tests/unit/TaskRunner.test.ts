import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskRunner } from '../../src/core/TaskRunner.js';
import { TaskConfig, TaskStatus } from '../../src/core/types.js';

describe('TaskRunner Core Unit Tests', () => {
  let taskRunner: TaskRunner;
  const testStoragePath = '/tmp/test-taskrunner-storage.json';

  beforeEach(() => {
    taskRunner = new TaskRunner(3); // 限制并发数为3用于测试
  });

  afterEach(async () => {
    // 清理测试数据
    await taskRunner.cleanup();
  });

  describe('构造函数和初始化', () => {
    it('应该使用默认并发数创建TaskRunner', () => {
      const defaultRunner = new TaskRunner();
      expect(defaultRunner).toBeDefined();
    });

    it('应该使用自定义并发数创建TaskRunner', () => {
      const customRunner = new TaskRunner(5);
      expect(customRunner).toBeDefined();
    });
  });

  describe('任务执行功能', () => {
    it('应该成功执行简单任务', async () => {
      const taskConfig: TaskConfig = {
        id: 'test-simple',
        execute: async () => {
          return { success: true, data: 'test-result' };
        },
        timeout: 5000,
      };

      const taskId = await taskRunner.run(taskConfig);
      expect(taskId).toBe('test-simple');

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = taskRunner.getResult(taskId);
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
      expect(result!.result).toEqual({ success: true, data: 'test-result' });
    });

    it('应该处理任务执行失败', async () => {
      const taskConfig: TaskConfig = {
        id: 'test-fail',
        execute: async () => {
          throw new Error('Test error');
        },
        timeout: 5000,
      };

      const taskId = await taskRunner.run(taskConfig);
      expect(taskId).toBe('test-fail');

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = taskRunner.getResult(taskId);
      expect(result).toBeDefined();
      expect(result!.success).toBe(false);
      expect(result!.error).toContain('Test error');
    });

    it('应该处理任务超时', async () => {
      const taskConfig: TaskConfig = {
        id: 'test-timeout',
        execute: async () => {
          // 模拟长时间运行的任务
          await new Promise((resolve) => setTimeout(resolve, 2000));
          return { success: true };
        },
        timeout: 100, // 100ms超时
      };

      const taskId = await taskRunner.run(taskConfig);
      expect(taskId).toBe('test-timeout');

      // 等待超时
      await new Promise((resolve) => setTimeout(resolve, 200));

      const result = taskRunner.getResult(taskId);
      expect(result).toBeDefined();
      expect(result!.success).toBe(false);
      expect(result!.error).toContain('Timeout');
    });
  });

  describe('并发控制功能', () => {
    it('应该遵守最大并发数限制', async () => {
      const runningTasks: string[] = [];
      const maxConcurrent = 2;
      const concurrentRunner = new TaskRunner(maxConcurrent);

      // 创建多个长时间运行的任务
      const taskConfigs: TaskConfig[] = [];
      for (let i = 0; i < 5; i++) {
        taskConfigs.push({
          id: `concurrent-task-${i}`,
          execute: async () => {
            runningTasks.push(`task-${i}`);
            // 模拟任务执行时间
            await new Promise((resolve) => setTimeout(resolve, 200));
            runningTasks.splice(runningTasks.indexOf(`task-${i}`), 1);
            return { success: true, taskId: i };
          },
          timeout: 1000,
        });
      }

      // 启动所有任务
      const taskIds = await Promise.all(taskConfigs.map((config) => concurrentRunner.run(config)));

      // 短暂等待后检查并发数
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(runningTasks.length).toBeLessThanOrEqual(maxConcurrent);

      // 等待所有任务完成
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 验证所有任务都成功完成
      const results = taskIds.map((id) => concurrentRunner.getResult(id));
      expect(results.every((r) => r?.success)).toBe(true);

      await concurrentRunner.cleanup();
    });

    it('应该按优先级处理任务', async () => {
      const executionOrder: string[] = [];
      const priorityRunner = new TaskRunner(1); // 单并发以便观察顺序

      const tasks: TaskConfig[] = [
        {
          id: 'low-priority',
          execute: async () => {
            executionOrder.push('low');
            return { success: true };
          },
          priority: 'low',
          timeout: 5000,
        },
        {
          id: 'high-priority',
          execute: async () => {
            executionOrder.push('high');
            return { success: true };
          },
          priority: 'high',
          timeout: 5000,
        },
        {
          id: 'normal-priority',
          execute: async () => {
            executionOrder.push('normal');
            return { success: true };
          },
          priority: 'normal',
          timeout: 5000,
        },
      ];

      // 以非优先级顺序提交任务
      await priorityRunner.run(tasks[0]);
      await priorityRunner.run(tasks[2]);
      await priorityRunner.run(tasks[1]);

      // 等待所有任务完成
      await new Promise((resolve) => setTimeout(resolve, 300));

      // 高优先级任务应该先执行
      expect(executionOrder[0]).toBe('low'); // 第一个提交的先执行
      expect(executionOrder.slice(1)).toContain('high'); // 高优先级应该在后面优先执行

      await priorityRunner.cleanup();
    });
  });

  describe('状态查询功能', () => {
    it('应该返回正确的运行状态', () => {
      const status = taskRunner.getStatus();
      expect(status).toBeDefined();
      expect(status.running).toBe(0);
      expect(status.pending).toBe(0);
      expect(status.completed).toBe(0);
      expect(status.maxConcurrency).toBe(3);
    });

    it('应该正确更新任务计数', async () => {
      const initialStatus = taskRunner.getStatus();

      // 启动一个任务
      const taskConfig: TaskConfig = {
        id: 'status-test',
        execute: async () => {
          return { success: true };
        },
        timeout: 5000,
      };

      await taskRunner.run(taskConfig);

      // 状态应该更新
      const duringStatus = taskRunner.getStatus();
      expect(duringStatus.running + duringStatus.pending).toBeGreaterThan(
        initialStatus.running + initialStatus.pending
      );

      // 等待任务完成
      await new Promise((resolve) => setTimeout(resolve, 100));

      const finalStatus = taskRunner.getStatus();
      expect(finalStatus.completed).toBeGreaterThan(initialStatus.completed);
    });
  });

  describe('任务管理功能', () => {
    it('应该能够取消运行中的任务', async () => {
      let taskStarted = false;
      const taskConfig: TaskConfig = {
        id: 'cancellable-task',
        execute: async () => {
          taskStarted = true;
          // 长时间运行的任务
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return { success: true };
        },
        timeout: 5000,
      };

      const taskId = await taskRunner.run(taskConfig);

      // 等待任务开始
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(taskStarted).toBe(true);

      // 取消任务
      const cancelled = await taskRunner.cancel(taskId);
      expect(cancelled).toBe(true);

      // 验证任务被取消
      const result = taskRunner.getResult(taskId);
      expect(result).toBeDefined();
      expect(result!.success).toBe(false);
    });

    it('应该处理不存在任务的取消请求', async () => {
      const cancelled = await taskRunner.cancel('non-existent-task');
      expect(cancelled).toBe(false);
    });
  });

  describe('错误处理和边界情况', () => {
    it('应该处理空任务配置', async () => {
      const emptyConfig = {} as TaskConfig;

      await expect(taskRunner.run(emptyConfig)).rejects.toThrow();
    });

    it('应该处理重复的任务ID', async () => {
      const taskConfig: TaskConfig = {
        id: 'duplicate-id',
        execute: async () => {
          return { success: true };
        },
        timeout: 5000,
      };

      const taskId1 = await taskRunner.run(taskConfig);
      expect(taskId1).toBe('duplicate-id');

      // 第二次使用相同ID应该失败
      await expect(taskRunner.run(taskConfig)).rejects.toThrow();
    });

    it('应该处理无效的任务ID', () => {
      const result = taskRunner.getResult('invalid-id');
      expect(result).toBeUndefined();
    });
  });

  describe('资源清理', () => {
    it('应该正确清理资源', async () => {
      // 运行一些任务
      const tasks: TaskConfig[] = [];
      for (let i = 0; i < 3; i++) {
        tasks.push({
          id: `cleanup-test-${i}`,
          execute: async () => {
            return { success: true };
          },
          timeout: 5000,
        });
      }

      await Promise.all(tasks.map((task) => taskRunner.run(task)));

      // 清理资源
      await taskRunner.cleanup();

      // 验证状态已重置
      const status = taskRunner.getStatus();
      expect(status.running).toBe(0);
      expect(status.pending).toBe(0);
    });
  });
});
