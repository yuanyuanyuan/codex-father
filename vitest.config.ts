import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// 当仅跑 orchestrator 测试时，不应排除 core/orchestrator/tests/**
const cliArgs = process.argv.join(' ').toLowerCase();
const orchestratorFlag = (process.env.ORCHESTRATOR_TESTS ?? '').toString().toLowerCase();
const runOnlyOrchestrator =
  cliArgs.includes('core/orchestrator/tests') ||
  orchestratorFlag === '1' ||
  orchestratorFlag === 'true' ||
  orchestratorFlag === 'yes';
const orchestratorExcluded = runOnlyOrchestrator ? [] : ['core/orchestrator/tests/**'];

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    globals: true,

    // File patterns
    include: [
      'core/**/*.{test,spec}.ts',
      'phases/**/*.{test,spec}.ts',
      'tests/**/*.{test,spec}.ts',
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'mcp/codex-mcp-server/**',
      'refer-research/**',
      ...orchestratorExcluded,
      '**/*.bench.ts',
    ],

    // Test execution - 内存优化配置
    testTimeout: 30000,
    hookTimeout: 30000, // 增加hook超时时间
    pool: 'forks', // 使用forks代替threads以避免内存限制问题
    poolOptions: {
      forks: {
        singleFork: true, // 强制单进程
        minForks: 1,
        maxForks: 1,
        execArgv: ['--max-old-space-size=8192', '--expose-gc'], // 显式设置子进程的内存限制
      },
    },
    maxConcurrency: 1, // 限制并发测试数
    sequence: {
      concurrent: false, // 禁用并发测试
    },

    // Coverage configuration - 内存优化
    coverage: {
      enabled: false, // 默认禁用以节省内存
      provider: 'v8',
      reporter: ['text'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.bench.ts',
        'tests/fixtures/**',
        'mcp/codex-mcp-server/**',
        'refer-research/**',
        '**/index.ts', // Re-export files
      ],
    },

    // Reporters
    reporter: 'verbose',

    // Setup files
    setupFiles: ['./tests/setup.ts'],

    // Watch mode
    watch: false,

    // Performance monitoring
    logHeapUsage: true,

    // Mock configuration
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    
    // 隔离测试环境 - 禁用以避免内存溢出
    isolate: false, // 关闭隔离模式以节省内存
  },

  // Benchmark configuration
  benchmark: {
    include: ['**/*.{bench,benchmark}.ts'],
    exclude: ['node_modules/**', 'dist/**'],
    reporter: 'verbose',
  },

  // Path resolution
  resolve: {
    alias: {
      '@core': resolve(__dirname, './core'),
      '@lib': resolve(__dirname, './core/lib'),
      '@cli': resolve(__dirname, './core/cli'),
      '@mcp': resolve(__dirname, './core/mcp'),
      '@phases': resolve(__dirname, './phases'),
      '@tests': resolve(__dirname, './tests'),
      '@config': resolve(__dirname, './config'),
    },
  },

  // Define global constants
  define: {
    __VERSION__: JSON.stringify(process.env.npm_package_version || '1.6.0'),
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    __TEST__: true,
  },
});
