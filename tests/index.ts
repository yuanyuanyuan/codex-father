/**
 * 测试套件入口文件
 * 导出所有测试相关的工具和配置
 */

// E2E 测试工具
export * from './helpers/mcp-client.js';
export * from './helpers/test-utils.js';
export * from './e2e/setup.e2e.js';

// 测试配置
export { default as e2eConfig } from './config/vitest.e2e.config.js';

// 测试脚本（仅用于类型导出）
export type { TestOptions } from './scripts/run-e2e-tests.js';

/**
 * 测试套件元数据
 */
export const TEST_METADATA = {
  version: '1.0.0',
  name: 'Codex Father 2.0 Test Suite',
  description: 'Comprehensive test suite for Codex Father 2.0',
  author: 'Codex Father Test Team',
  supported: {
    unit: true,
    integration: true,
    e2e: true,
    performance: true,
    contract: true,
  },
  requirements: {
    node: '>=18.0.0',
    npm: '>=8.0.0',
    memory: '1GB minimum',
    disk: '100MB free space',
  },
  features: {
    parallel: false, // E2E tests run sequentially
    coverage: true,
    reporting: true,
    cleanup: true,
    isolation: true,
  },
} as const;

/**
 * 测试环境信息
 */
export const TEST_ENVIRONMENT = {
  tempDir: '/tmp/codex-father-e2e',
  logDir: '/tmp/codex-father-logs',
  dataDir: '/tmp/codex-father-data',
  timeout: {
    default: 120000, // 2 minutes
    short: 30000, // 30 seconds
    long: 300000, // 5 minutes
  },
  concurrency: {
    default: 10,
    max: 50,
    test: 1, // E2E tests run with single concurrency
  },
} as const;

/**
 * 默认测试配置
 */
export const DEFAULT_TEST_CONFIG = {
  timeout: TEST_ENVIRONMENT.timeout.default,
  retries: 2,
  parallel: false,
  coverage: false,
  verbose: false,
  watch: false,
  reporter: 'dot',
} as const;

/**
 * 导出便捷函数
 */
export const TestUtils = {
  /**
   * 检查测试环境是否就绪
   */
  async isEnvironmentReady(): Promise<boolean> {
    const fs = await import('fs/promises');

    try {
      // 检查临时目录
      await fs.access(TEST_ENVIRONMENT.tempDir);

      // 检查Node版本
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

      return majorVersion >= 18;
    } catch {
      return false;
    }
  },

  /**
   * 获取测试统计信息
   */
  async getTestStats(): Promise<{
    totalTests: number;
    testTypes: string[];
    estimatedDuration: number;
  }> {
    // 这里可以扫描测试文件获取统计信息
    return {
      totalTests: 50, // 估算值
      testTypes: ['unit', 'integration', 'e2e', 'contract', 'performance'],
      estimatedDuration: 300, // 5分钟
    };
  },

  /**
   * 生成测试报告摘要
   */
  generateReportSummary(results: {
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  }): string {
    const total = results.passed + results.failed + results.skipped;
    const successRate = total > 0 ? ((results.passed / total) * 100).toFixed(2) : '0';

    return `
Test Summary:
- Total: ${total}
- Passed: ${results.passed}
- Failed: ${results.failed}
- Skipped: ${results.skipped}
- Success Rate: ${successRate}%
- Duration: ${results.duration}ms
    `.trim();
  },
};
