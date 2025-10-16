/**
 * 并发任务执行引擎 E2E 测试
 * 测试 TaskRunner 的并发控制、队列管理、依赖处理等核心功能
 *
 * 测试覆盖:
 * - 50个并发任务执行
 * - 任务队列和优先级调度
 * - 依赖关系管理
 * - 超时和错误处理
 * - 资源限制和动态调整
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskRunner } from '../../src/core/TaskRunner.js';
import { TaskConfig, TaskResult } from '../../src/core/types.js';

describe('Concurrency Engine E2E Tests', () => {
  let taskRunner: TaskRunner;

  beforeEach(() => {
    taskRunner = new TaskRunner(10); // 默认10个并发槽位
  });

  afterEach(async () => {
    if (taskRunner && typeof taskRunner.cleanup === 'function') {
      await taskRunner.cleanup();
    }
  });

  describe('并发任务执行', () => {
    it('应该支持多个任务并发执行', async () => {
      const taskCount = 20;
      const tasks: TaskConfig[] = [];
      const results: TaskResult[] = [];

      // 创建多个任务
      for (let i = 0; i < taskCount; i++) {
        const task: TaskConfig = {
          id: `concurrent-task-${i}`,
          command: `echo "Task ${i} completed" && sleep ${Math.random() * 2}`,
          timeout: 10000,
          execute: async () => {
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000));
            return `Task ${i} result`;
          },
        };
        tasks.push(task);
      }

      // 提交所有任务
      const startTime = Date.now();
      const taskIds = await Promise.all(tasks.map((task) => taskRunner.run(task)));

      // 等待所有任务完成
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const status = taskRunner.getStatus();
          if (status.running === 0) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 验证并发效果（总时间应远小于串行执行时间）
      expect(totalTime).toBeLessThan(taskCount * 1000); // 串行执行需要20秒以上
      expect(taskIds).toHaveLength(taskCount);
    });

    it('应该达到最大并发数限制', async () => {
      const maxConcurrency = 10;
      taskRunner = new TaskRunner(maxConcurrency);

      // 创建20个长时间运行的任务
      const longRunningTasks: TaskConfig[] = [];
      for (let i = 0; i < 20; i++) {
        longRunningTasks.push({
          id: `long-task-${i}`,
          command: 'sleep 5',
          timeout: 10000,
          execute: async () => {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            return `Long task ${i} done`;
          },
        });
      }

      // 提交所有任务
      await Promise.all(longRunningTasks.map((task) => taskRunner.run(task)));

      // 检查运行中的任务数应该达到最大并发数
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 等待任务开始
      const status = taskRunner.getStatus();
      expect(status.running).toBeLessThanOrEqual(maxConcurrency);
    });

    it('应该在槽位满时将任务加入队列', async () => {
      const maxConcurrency = 3;
      taskRunner = new TaskRunner(maxConcurrency);

      // 创建超过并发数的任务
      const tasks: TaskConfig[] = [];
      for (let i = 0; i < 8; i++) {
        tasks.push({
          id: `queue-test-${i}`,
          command: `sleep ${3 + (i % 2)}`, // 3-4秒的任务
          timeout: 10000,
          execute: async () => {
            await new Promise((resolve) => setTimeout(resolve, (3 + (i % 2)) * 1000));
            return `Queue test ${i} done`;
          },
        });
      }

      // 快速提交所有任务
      const taskIds = await Promise.all(tasks.map((task) => taskRunner.run(task)));

      // 检查状态
      const status = taskRunner.getStatus();
      expect(status.running).toBeLessThanOrEqual(maxConcurrency);
      expect(status.pending).toBeGreaterThan(0);
      expect(taskIds).toHaveLength(8);
    });
  });

  describe('任务优先级和队列', () => {
    it('应该按照优先级调度任务', async () => {
      const executionOrder: string[] = [];

      // 创建不同优先级的任务
      const tasks: TaskConfig[] = [
        {
          id: 'low-priority-1',
          command: 'echo "Low 1"',
          priority: 'low',
          timeout: 5000,
          execute: async () => {
            executionOrder.push('low-1');
            return 'Low 1 done';
          },
        },
        {
          id: 'high-priority-1',
          command: 'echo "High 1"',
          priority: 'high',
          timeout: 5000,
          execute: async () => {
            executionOrder.push('high-1');
            return 'High 1 done';
          },
        },
        {
          id: 'normal-priority-1',
          command: 'echo "Normal 1"',
          priority: 'normal',
          timeout: 5000,
          execute: async () => {
            executionOrder.push('normal-1');
            return 'Normal 1 done';
          },
        },
        {
          id: 'high-priority-2',
          command: 'echo "High 2"',
          priority: 'high',
          timeout: 5000,
          execute: async () => {
            executionOrder.push('high-2');
            return 'High 2 done';
          },
        },
      ];

      // 按顺序提交（测试队列重排）
      for (const task of tasks) {
        await taskRunner.run(task);
      }

      // 等待所有任务完成
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const status = taskRunner.getStatus();
          if (status.running === 0 && status.pending === 0) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
      });

      // 验证高优先级任务先执行
      const highPriorityIndex = executionOrder.findIndex((id) => id.startsWith('high'));
      const normalPriorityIndex = executionOrder.findIndex((id) => id.startsWith('normal'));
      const lowPriorityIndex = executionOrder.findIndex((id) => id.startsWith('low'));

      expect(highPriorityIndex).toBeLessThan(normalPriorityIndex);
      expect(highPriorityIndex).toBeLessThan(lowPriorityIndex);
    });

    it('应该公平调度同优先级任务', async () => {
      const executionTimes: { [key: string]: number } = {};

      // 创建多个同优先级任务
      const tasks: TaskConfig[] = [];
      for (let i = 0; i < 5; i++) {
        tasks.push({
          id: `fairness-test-${i}`,
          command: `echo "Fairness test ${i}"`,
          priority: 'normal',
          timeout: 5000,
          execute: async () => {
            executionTimes[`fairness-test-${i}`] = Date.now();
            await new Promise((resolve) => setTimeout(resolve, 500));
            return `Fairness test ${i} done`;
          },
        });
      }

      // 同时提交所有任务
      await Promise.all(tasks.map((task) => taskRunner.run(task)));

      // 等待完成
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const status = taskRunner.getStatus();
          if (status.running === 0) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
      });

      // 验证执行时间差异不大（公平调度）
      const times = Object.values(executionTimes).sort();
      const timeSpread = times[times.length - 1] - times[0];
      expect(timeSpread).toBeLessThan(2000); // 2秒内的差异
    });
  });

  describe('依赖关系管理', () => {
    it('应该正确处理任务依赖关系', async () => {
      const executionOrder: string[] = [];

      // 创建有依赖关系的任务
      const dependencyTask: TaskConfig = {
        id: 'dependency-task',
        command: 'echo "Dependency completed"',
        timeout: 5000,
        execute: async () => {
          executionOrder.push('dependency');
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return 'Dependency done';
        },
      };

      const mainTask: TaskConfig = {
        id: 'main-task',
        command: 'echo "Main task executing"',
        dependencies: ['dependency-task'],
        timeout: 5000,
        execute: async () => {
          executionOrder.push('main');
          return 'Main task done';
        },
      };

      // 同时提交两个任务
      await Promise.all([taskRunner.run(dependencyTask), taskRunner.run(mainTask)]);

      // 等待完成
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const status = taskRunner.getStatus();
          if (status.running === 0) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
      });

      // 验证执行顺序
      expect(executionOrder).toEqual(['dependency', 'main']);
    });

    it('应该拒绝依赖失败的任务', async () => {
      const failedTask: TaskConfig = {
        id: 'failed-dependency',
        command: 'exit 1',
        timeout: 5000,
        execute: async () => {
          throw new Error('Simulated failure');
        },
      };

      const dependentTask: TaskConfig = {
        id: 'dependent-on-failed',
        command: 'echo "Should not execute"',
        dependencies: ['failed-dependency'],
        timeout: 5000,
        execute: async () => {
          return 'Should not reach here';
        },
      };

      // 提交任务
      await taskRunner.run(failedTask);

      // 等待失败任务完成
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // 尝试运行依赖任务（应该失败）
      await expect(taskRunner.run(dependentTask)).rejects.toThrow('Dependency failed');

      // 验证依赖任务没有执行
      const result = taskRunner.getResult('dependent-on-failed');
      expect(result).toBeUndefined();
    });

    it('应该支持复杂的依赖链', async () => {
      const executionOrder: string[] = [];

      // 创建依赖链：A -> B -> C -> D
      const taskA: TaskConfig = {
        id: 'task-a',
        command: 'echo "Task A"',
        timeout: 5000,
        execute: async () => {
          executionOrder.push('A');
          return 'A done';
        },
      };

      const taskB: TaskConfig = {
        id: 'task-b',
        command: 'echo "Task B"',
        dependencies: ['task-a'],
        timeout: 5000,
        execute: async () => {
          executionOrder.push('B');
          return 'B done';
        },
      };

      const taskC: TaskConfig = {
        id: 'task-c',
        command: 'echo "Task C"',
        dependencies: ['task-b'],
        timeout: 5000,
        execute: async () => {
          executionOrder.push('C');
          return 'C done';
        },
      };

      const taskD: TaskConfig = {
        id: 'task-d',
        command: 'echo "Task D"',
        dependencies: ['task-c'],
        timeout: 5000,
        execute: async () => {
          executionOrder.push('D');
          return 'D done';
        },
      };

      // 同时提交所有任务
      await Promise.all([
        taskRunner.run(taskA),
        taskRunner.run(taskB),
        taskRunner.run(taskC),
        taskRunner.run(taskD),
      ]);

      // 等待完成
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const status = taskRunner.getStatus();
          if (status.running === 0) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 100);
      });

      // 验证依赖链执行顺序
      expect(executionOrder).toEqual(['A', 'B', 'C', 'D']);
    });
  });

  describe('超时和错误处理', () => {
    it('应该处理任务超时', async () => {
      const timeoutTask: TaskConfig = {
        id: 'timeout-task',
        command: 'sleep 10',
        timeout: 2000, // 2秒超时
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10000)); // 10秒执行
          return 'Should not complete';
        },
      };

      await taskRunner.run(timeoutTask);

      // 等待超时处理
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const result = taskRunner.getResult('timeout-task');
      expect(result).toBeDefined();
      expect(result!.success).toBe(false);
      expect(result!.error?.toLowerCase()).toContain('timeout');
    });

    it('应该处理任务执行错误', async () => {
      const errorTask: TaskConfig = {
        id: 'error-task',
        command: 'invalid-command-that-does-not-exist',
        timeout: 5000,
        execute: async () => {
          throw new Error('Task execution failed');
        },
      };

      await taskRunner.run(errorTask);

      // 等待错误处理
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result = taskRunner.getResult('error-task');
      expect(result).toBeDefined();
      expect(result!.success).toBe(false);
      expect(result!.error).toBeDefined();
    });

    it('应该记录详细的错误信息', async () => {
      const detailedErrorTask: TaskConfig = {
        id: 'detailed-error-task',
        command: 'node -e "throw new Error(\'Detailed error message\')"',
        timeout: 5000,
        execute: async () => {
          throw new Error('Detailed error message with context');
        },
      };

      await taskRunner.run(detailedErrorTask);

      // 等待错误处理
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result = taskRunner.getResult('detailed-error-task');
      expect(result).toBeDefined();
      expect(result!.success).toBe(false);
      expect(result!.error).toContain('Detailed error message');
      expect(result!.startTime).toBeDefined();
      expect(result!.endTime).toBeDefined();
      expect(result!.duration).toBeGreaterThan(0);
    });

    it('应该正确释放槽位即使任务失败', async () => {
      const maxConcurrency = 2;
      taskRunner = new TaskRunner(maxConcurrency);

      // 创建会失败的任务
      const failedTask: TaskConfig = {
        id: 'failed-task-for-slot',
        command: 'exit 1',
        timeout: 2000,
        execute: async () => {
          throw new Error('Task failed');
        },
      };

      // 创建正常的任务
      const normalTask: TaskConfig = {
        id: 'normal-task-after-failure',
        command: 'echo "Normal task"',
        timeout: 5000,
        execute: async () => {
          return 'Normal task completed';
        },
      };

      // 先运行失败任务
      await taskRunner.run(failedTask);

      // 等待失败处理
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // 运行正常任务（应该能获得槽位）
      await taskRunner.run(normalTask);

      // 等待正常任务完成
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result = taskRunner.getResult('normal-task-after-failure');
      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
    });
  });

  describe('性能和资源管理', () => {
    it('应该在大负载下保持稳定', async () => {
      const largeTaskCount = 50;
      const tasks: TaskConfig[] = [];

      // 创建50个任务
      for (let i = 0; i < largeTaskCount; i++) {
        tasks.push({
          id: `load-test-${i}`,
          command: `echo "Load test task ${i}"`,
          timeout: 15000,
          execute: async () => {
            await new Promise((resolve) => setTimeout(resolve, Math.random() * 2000));
            return `Load test ${i} completed`;
          },
        });
      }

      const startTime = Date.now();

      // 提交所有任务
      const taskIds = await Promise.all(tasks.map((task) => taskRunner.run(task)));

      // 等待所有任务完成
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const status = taskRunner.getStatus();
          if (status.running === 0) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 500);
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // 性能验证
      expect(totalTime).toBeLessThan(30000); // 30秒内完成50个任务
      expect(taskIds).toHaveLength(largeTaskCount);

      // 验证所有任务都有结果
      let completedTasks = 0;
      for (const taskId of taskIds) {
        const result = taskRunner.getResult(taskId);
        if (result) {
          completedTasks++;
        }
      }
      expect(completedTasks).toBe(largeTaskCount);
    });

    it('应该正确报告系统状态', async () => {
      // 创建一些任务
      const tasks: TaskConfig[] = [];
      for (let i = 0; i < 5; i++) {
        tasks.push({
          id: `status-test-${i}`,
          command: `sleep ${2 + i}`,
          timeout: 10000,
          execute: async () => {
            await new Promise((resolve) => setTimeout(resolve, (2 + i) * 1000));
            return `Status test ${i} done`;
          },
        });
      }

      // 提交任务前检查状态
      let status = taskRunner.getStatus();
      expect(status.running).toBe(0);
      expect(status.pending).toBe(0);
      expect(status.completed).toBe(0);
      expect(status.maxConcurrency).toBe(10);

      // 提交任务
      await Promise.all(tasks.map((task) => taskRunner.run(task)));

      // 等待任务开始
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 检查运行中状态
      status = taskRunner.getStatus();
      expect(status.running).toBeGreaterThan(0);
      expect(status.pending).toBeGreaterThanOrEqual(0);

      // 等待所有任务完成
      await new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          const status = taskRunner.getStatus();
          if (status.running === 0) {
            clearInterval(checkInterval);
            resolve(undefined);
          }
        }, 500);
      });

      // 检查最终状态
      status = taskRunner.getStatus();
      expect(status.running).toBe(0);
      expect(status.pending).toBe(0);
      expect(status.completed).toBe(5);
    });

    it('应该支持任务取消', async () => {
      const longTask: TaskConfig = {
        id: 'cancelable-long-task',
        command: 'sleep 30',
        timeout: 35000,
        execute: async () => {
          await new Promise((resolve) => setTimeout(resolve, 30000));
          return 'Should not complete';
        },
      };

      // 启动任务
      const taskId = await taskRunner.run(longTask);

      // 等待任务开始
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 取消任务
      const cancelled = await taskRunner.cancel(taskId);
      expect(cancelled).toBe(true);

      // 验证任务被取消
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const status = taskRunner.getStatus();
      expect(status.running).toBe(0);

      const result = taskRunner.getResult(taskId);
      expect(result).toBeDefined();
      // 取消的任务可能不会有结果，或者结果会标记为取消
    });
  });
});
