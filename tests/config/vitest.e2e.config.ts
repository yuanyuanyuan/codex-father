/**
 * E2E 测试 Vitest 配置
 * 专门为端到端测试优化的配置
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // 测试环境
    environment: 'node',
    globals: true,

    // 文件模式
    include: ['tests/e2e/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/unit/**',
      'tests/benchmark/**',
      'tests/smoke/**',
    ],

    // 测试执行配置
    testTimeout: 120000, // 2分钟超时，E2E测试需要更长时间
    hookTimeout: 30000, // 30秒钩子超时
    threads: false, // E2E测试不使用线程，避免端口冲突
    maxThreads: 1,
    minThreads: 1,
    isolate: false, // 共享环境，减少启动开销

    // 报告器
    reporter: [
      'verbose',
      'json',
      {
        name: 'html',
        outputFile: './coverage/e2e-report.html',
      },
    ],

    // 设置文件
    setupFiles: ['./tests/e2e/setup.e2e.ts'],

    // 监视模式
    watch: false,

    // 全局设置
    logHeapUsage: true,
    allowOnly: true,

    // 重试配置
    retry: 2,
    sequence: {
      concurrent: false, // E2E测试串行执行，避免资源冲突
      shuffle: false,
      seed: 42,
    },

    // 输出配置
    outputDiffLines: 50,
    outputTruncateLength: 200,
    outputFile: './test-results/e2e-results.txt',
  },

  // 路径解析
  resolve: {
    alias: {
      '@core': resolve(__dirname, '../../src/core'),
      '@interfaces': resolve(__dirname, '../../src/interfaces'),
      '@helpers': resolve(__dirname, '../helpers'),
      '@e2e': resolve(__dirname, '../e2e'),
      '@tests': resolve(__dirname, '..'),
    },
  },

  // 定义全局常量
  define: {
    __E2E__: true,
    __TEST__: true,
    'process.env.NODE_ENV': '"test"',
  },

  // 覆盖率配置（E2E测试不强制要求覆盖率）
  coverage: {
    enabled: false,
    provider: 'v8',
    reporter: ['text', 'json'],
    reportsDirectory: './coverage/e2e',
    exclude: [
      'node_modules/**',
      'dist/**',
      'tests/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      '**/*.config.ts',
      '**/helpers/**',
    ],
  },
});
