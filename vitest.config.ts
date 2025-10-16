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
    hookTimeout: 10000,
    threads: true,
    maxThreads: 2, // 减少线程数以节省内存
    minThreads: 1,

    // 内存限制
    poolOptions: {
      threads: {
        memoryLimit: 512, // 每个线程512MB内存限制
        isolate: true,
      },
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
