import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const orchestratorExcluded =
  process.env.ORCHESTRATOR_TESTS === '1' ? [] : ['core/orchestrator/tests/**'];

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

    // Test execution
    testTimeout: 30000,
    hookTimeout: 10000,
    threads: true,
    maxThreads: 4,
    minThreads: 1,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
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
      // Quality gates - 符合plan.md要求
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
        // 关键路径要求100%覆盖率
        './core/lib/**': {
          branches: 100,
          functions: 100,
          lines: 100,
          statements: 100,
        },
        './core/cli/**': {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90,
        },
      },
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

    // Pool options for better performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      },
    },
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
