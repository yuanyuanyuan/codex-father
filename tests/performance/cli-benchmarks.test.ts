import { beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

interface CLIExecutionResult {
  status: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  signal: NodeJS.Signals | null;
  error?: Error;
}

const CLI_PATH = resolve(process.cwd(), 'bin/codex-father');

function runCLI(args: string[], options: { timeoutMs?: number } = {}): CLIExecutionResult {
  const startedAt = performance.now();
  const result = spawnSync('node', [CLI_PATH, ...args], {
    encoding: 'utf-8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      CODEX_TEST_MODE: 'true',
    },
    timeout: options.timeoutMs ?? 5000,
  });

  const durationMs = performance.now() - startedAt;

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    durationMs,
    signal: result.signal ?? null,
    error: result.error,
  };
}

describe('CLI Performance Benchmarks (T098)', () => {
  beforeAll(() => {
    if (!existsSync(CLI_PATH)) {
      throw new Error(`CLI executable not found at ${CLI_PATH}`);
    }
  });

  it('launches the CLI version command within 1 second', () => {
    const execution = runCLI(['--version']);

    expect(execution.error).toBeUndefined();
    expect(execution.status).toBe(0);
    expect(execution.durationMs).toBeLessThan(1000);
    expect(execution.stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
  });

  it('executes the status command quickly and reports execution metrics', () => {
    const execution = runCLI(['status', '--json']);

    expect(execution.error).toBeUndefined();
    expect(execution.status).toBe(0);
    expect(execution.durationMs).toBeLessThan(1200);

    const parsed = JSON.parse(execution.stdout || '{}');

    expect(parsed.success).toBe(true);
    expect(typeof parsed.executionTime).toBe('number');
    expect(parsed.executionTime).toBeLessThan(1000);
    expect(parsed.data?.performance?.executionTimeMs).toBe(parsed.executionTime);
  });

  it('keeps memory usage within the baseline threshold', () => {
    const execution = runCLI(['status', '--json']);

    expect(execution.status).toBe(0);

    const parsed = JSON.parse(execution.stdout || '{}');
    const memoryUsage = parsed.data?.performance?.memoryUsage;

    expect(memoryUsage).toBeDefined();
    expect(memoryUsage.initial.rssMB).toBeLessThan(100);
    expect(memoryUsage.final.rssMB).toBeLessThan(100);
    expect(memoryUsage.peak.rssMB).toBeLessThan(100);
  });
});
