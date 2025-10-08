import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['core/orchestrator/tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'dist/**', 'mcp/codex-mcp-server/**', 'refer-research/**', '**/*.bench.ts'],
    reporter: 'dot',
    watch: false,
    logHeapUsage: false,
    pool: 'threads',
  },
});

