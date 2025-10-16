/**
 * 测试工具函数
 * 提供测试中常用的工具函数和 Mock 数据生成器
 */

import { TaskConfig, TaskResult } from '../../src/core/types.js';

export class TestUtils {
  /**
   * 生成测试任务配置
   */
  static createTestTask(overrides: Partial<TaskConfig> = {}): TaskConfig {
    const baseTask: TaskConfig = {
      id: `test-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      prompt: 'Test task prompt',
      environment: 'nodejs',
      priority: 'normal',
      timeout: 30000,
      execute: async () => 'Test result',
    };

    return { ...baseTask, ...overrides };
  }

  /**
   * 生成测试任务结果
   */
  static createTestResult(overrides: Partial<TaskResult> = {}): TaskResult {
    const startTime = new Date(Date.now() - 5000);
    const endTime = new Date();

    const baseResult: TaskResult = {
      id: `test-result-${Date.now()}`,
      success: true,
      result: 'Test completed successfully',
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
    };

    return { ...baseResult, ...overrides };
  }

  /**
   * 生成失败的测试任务结果
   */
  static createFailedTestResult(overrides: Partial<TaskResult> = {}): TaskResult {
    const startTime = new Date(Date.now() - 3000);
    const endTime = new Date();

    const baseResult: TaskResult = {
      id: `test-failed-${Date.now()}`,
      success: false,
      error: 'Test task failed',
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
    };

    return { ...baseResult, ...overrides };
  }

  /**
   * 等待指定时间
   */
  static async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 等待条件满足
   */
  static async waitFor(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 10000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await this.sleep(interval);
    }

    throw new Error(`Timeout waiting for condition after ${timeout}ms`);
  }

  /**
   * 等待多个任务完成
   */
  static async waitForTasks(
    taskRunner: any,
    expectedCount: number,
    timeout: number = 30000
  ): Promise<void> {
    await this.waitFor(async () => {
      const status = taskRunner.getStatus();
      return status.running === 0 && status.completed >= expectedCount;
    }, timeout);
  }

  /**
   * 生成随机字符串
   */
  static randomString(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * 生成随机任务ID
   */
  static randomTaskId(): string {
    return `task-${Date.now()}-${this.randomString(8)}`;
  }

  /**
   * 创建模拟的文件系统结构
   */
  static createMockFileSystem(): Record<string, string> {
    return {
      'package.json': JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          test: 'jest',
          build: 'tsc',
        },
      }),
      'src/index.js': 'console.log("Hello World");',
      'src/utils/helper.js': 'export function helper() { return "helper"; }',
      'README.md': '# Test Project\n\nThis is a test project.',
      '.gitignore': 'node_modules/\ndist/\n*.log',
    };
  }

  /**
   * 验证MCP响应格式
   */
  static validateMCPResponse(response: any): boolean {
    if (!response || typeof response !== 'object') {
      return false;
    }

    // 成功响应应该有 content 字段
    if (response.content && !Array.isArray(response.content)) {
      return false;
    }

    // 错误响应应该有 error 字段
    if (response.error && (!response.error.code || !response.error.message)) {
      return false;
    }

    // 不能同时有 content 和 error
    if (response.content && response.error) {
      return false;
    }

    return true;
  }

  /**
   * 验证HTTP响应格式
   */
  static validateHTTPResponse(response: any, expectSuccess: boolean = true): boolean {
    if (!response || typeof response !== 'object') {
      return false;
    }

    if (expectSuccess) {
      // 成功响应应该有 success: true
      if (response.success !== true) {
        return false;
      }
    } else {
      // 错误响应应该有 success: false 和 error 字段
      if (response.success !== false || !response.error) {
        return false;
      }

      // 错误对象应该有 code 和 message
      if (!response.error.code || !response.error.message) {
        return false;
      }
    }

    return true;
  }

  /**
   * 生成测试用的环境变量
   */
  static createTestEnv(): Record<string, string> {
    return {
      NODE_ENV: 'test',
      CI: 'true',
      TESTING: 'true',
    };
  }

  /**
   * 清理测试数据
   */
  static async cleanupTestData(tempDir?: string): Promise<void> {
    // 这里可以添加清理临时文件的逻辑
    if (tempDir) {
      // 在实际实现中，这里会删除临时目录
      console.log(`Cleaning up test data in ${tempDir}`);
    }
  }

  /**
   * 模拟网络延迟
   */
  static async simulateNetworkDelay(minMs: number = 100, maxMs: number = 500): Promise<void> {
    const delay = Math.random() * (maxMs - minMs) + minMs;
    await this.sleep(delay);
  }

  /**
   * 生成大量测试任务
   */
  static generateBulkTasks(count: number): TaskConfig[] {
    const tasks: TaskConfig[] = [];

    for (let i = 0; i < count; i++) {
      tasks.push(
        this.createTestTask({
          id: `bulk-task-${i}`,
          prompt: `Bulk test task ${i}`,
          priority: ['low', 'normal', 'high'][Math.floor(Math.random() * 3)] as any,
          timeout: 10000 + Math.random() * 20000,
        })
      );
    }

    return tasks;
  }

  /**
   * 计算测试统计信息
   */
  static calculateTestStats(results: Array<{ success: boolean; duration?: number }>): {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
    averageDuration?: number;
  } {
    const total = results.length;
    const successful = results.filter((r) => r.success).length;
    const failed = total - successful;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    const resultsWithDuration = results.filter((r) => r.duration !== undefined);
    const averageDuration =
      resultsWithDuration.length > 0
        ? resultsWithDuration.reduce((sum, r) => sum + (r.duration || 0), 0) /
          resultsWithDuration.length
        : undefined;

    return {
      total,
      successful,
      failed,
      successRate,
      averageDuration,
    };
  }

  /**
   * 生成测试报告
   */
  static generateTestReport(
    testName: string,
    stats: ReturnType<typeof TestUtils.calculateTestStats>,
    startTime: Date,
    endTime: Date
  ): string {
    const duration = endTime.getTime() - startTime.getTime();

    return `
# Test Report: ${testName}

## Summary
- **Total Tests**: ${stats.total}
- **Successful**: ${stats.successful}
- **Failed**: ${stats.failed}
- **Success Rate**: ${stats.successRate.toFixed(2)}%
- **Duration**: ${duration}ms
- **Average Task Duration**: ${stats.averageDuration ? stats.averageDuration.toFixed(2) + 'ms' : 'N/A'}

## Timeline
- **Started**: ${startTime.toISOString()}
- **Completed**: ${endTime.toISOString()}

## Results
${stats.successful === stats.total ? '✅ All tests passed!' : `❌ ${stats.failed} tests failed`}
    `.trim();
  }
}

/**
 * 测试数据工厂
 */
export class TestDataFactory {
  /**
   * 创建标准的开发任务
   */
  static createDevTask(type: 'frontend' | 'backend' | 'fullstack' = 'fullstack'): TaskConfig {
    const tasks = {
      frontend: {
        prompt: 'Create a React component for user authentication',
        environment: 'nodejs' as const,
        files: ['src/components/', 'package.json'],
      },
      backend: {
        command: 'npm run build && npm test',
        environment: 'shell' as const,
        files: ['src/', 'tests/'],
      },
      fullstack: {
        prompt: 'Implement a complete CRUD API with frontend interface',
        environment: 'nodejs' as const,
        dependencies: ['setup-db', 'create-models'],
      },
    };

    return TestUtils.createTestTask(tasks[type]);
  }

  /**
   * 创建压力测试任务
   */
  static createStressTask(cpuIntensive: boolean = false): TaskConfig {
    return TestUtils.createTestTask({
      command: cpuIntensive
        ? 'node -e "for(let i=0; i<1000000; i++) Math.sqrt(i)"'
        : 'echo "Light weight task"',
      environment: 'shell',
      timeout: cpuIntensive ? 60000 : 10000,
    });
  }

  /**
   * 创建长时间运行任务
   */
  static createLongRunningTask(durationSeconds: number = 30): TaskConfig {
    return TestUtils.createTestTask({
      command: `sleep ${durationSeconds}`,
      environment: 'shell',
      timeout: (durationSeconds + 10) * 1000,
    });
  }

  /**
   * 创建会失败的任务
   */
  static createFailingTask(errorType: 'timeout' | 'error' | 'dependency' = 'error'): TaskConfig {
    const baseTask = TestUtils.createTestTask();

    switch (errorType) {
      case 'timeout':
        return {
          ...baseTask,
          command: 'sleep 60',
          timeout: 1000,
        };
      case 'error':
        return {
          ...baseTask,
          command: 'exit 1',
          execute: async () => {
            throw new Error('Simulated task failure');
          },
        };
      case 'dependency':
        return {
          ...baseTask,
          dependencies: ['non-existent-dependency'],
        };
      default:
        return baseTask;
    }
  }
}

/**
 * 断言辅助函数
 */
export class AssertUtils {
  /**
   * 断言任务状态
   */
  static assertTaskStatus(result: TaskResult, expectedStatus: 'success' | 'failure'): void {
    if (expectedStatus === 'success') {
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.result).toBeDefined();
    } else {
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    }
  }

  /**
   * 断言MCP错误响应
   */
  static assertMCPError(response: any, expectedCode: number, expectedMessage?: string): void {
    expect(response.error).toBeDefined();
    expect(response.error.code).toBe(expectedCode);
    if (expectedMessage) {
      expect(response.error.message).toContain(expectedMessage);
    }
  }

  /**
   * 断言HTTP错误响应
   */
  static assertHTTPError(response: any, expectedCode: string, expectedStatus: number): void {
    expect(response.success).toBe(false);
    expect(response.error.code).toBe(expectedCode);
    expect(response.error.message).toBeDefined();
  }

  /**
   * 断言时间范围
   */
  static assertTimeRange(actual: number, min: number, max: number): void {
    expect(actual).toBeGreaterThanOrEqual(min);
    expect(actual).toBeLessThanOrEqual(max);
  }
}
