import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, rm } from 'node:fs/promises';

import { CLIParser } from '../parser.js';
import {
  registerOrchestrateCommand,
  registerOrchestrateReportCommand,
} from '../commands/orchestrate-command.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const manualTasksPath = join(__dirname, 'fixtures', 'manual.tasks.json');

const runCommand = async (
  parser: CLIParser,
  argv: string[],
  { expectExitCode }: { expectExitCode: number }
): Promise<{ stdout: string[]; stderr: string[]; exitError: Error | null }> => {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`process.exit:${code ?? 0}`);
  }) as any);
  const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);
  const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined as any);
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined as any);

  let thrown: Error | null = null;
  try {
    await parser.parse(['node', 'codex-father', ...argv]);
  } catch (error) {
    thrown = error as Error;
  }

  expect(thrown?.message).toBe(`process.exit:${expectExitCode}`);

  const stdout = [
    ...writeSpy.mock.calls.map((call) => String(call[0]).trim()),
    ...logSpy.mock.calls
      .map((call) => call.map((item) => String(item)).join(' '))
      .map((line) => line.trim()),
  ].filter(Boolean);
  const stderr = errorSpy.mock.calls
    .map((call) =>
      call
        .map((item) => String(item))
        .join(' ')
        .trim()
    )
    .filter(Boolean);

  exitSpy.mockRestore();
  writeSpy.mockRestore();
  logSpy.mockRestore();
  errorSpy.mockRestore();

  return { stdout, stderr, exitError: thrown };
};

describe('orchestrate:report command', () => {
  let command: Command;
  let parser: CLIParser;
  let reportPath: string;
  let eventsPath: string;
  let failureReportPath: string;

  beforeEach(async () => {
    vi.resetModules();
    command = new Command();
    parser = new CLIParser(command);
    registerOrchestrateCommand(parser);
    registerOrchestrateReportCommand(parser);

    const { stdout } = await runCommand(
      parser,
      [
        'orchestrate',
        '测试报告 FR-123 NFR-7',
        '--mode',
        'manual',
        '--tasks-file',
        manualTasksPath,
        '--output-format',
        'stream-json',
      ],
      {
        expectExitCode: 0,
      }
    );

    const completedEvent = JSON.parse(stdout[1]);
    reportPath = completedEvent.data.reportPath as string;
    eventsPath = join(dirname(reportPath), 'events.jsonl');
  });

  afterEach(async () => {
    await rm(join(process.cwd(), '.codex-father', 'sessions'), { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('prints human readable summary by path', async () => {
    const { stdout } = await runCommand(parser, ['orchestrate:report', '--path', reportPath], {
      expectExitCode: 0,
    });

    const merged = stdout.join('\n');
    expect(merged).toContain('状态: succeeded');
    expect(merged).toContain(reportPath);
    expect(merged).toContain(`事件日志: ${eventsPath}`);
    expect(merged).toMatch(/指标: .*执行时长|指标: .*平均任务时长|指标: .*平均尝试次数/);
    expect(merged).toContain('引用: ');
    expect(merged).toContain('FR-123');
    expect(merged).toContain('NFR-7');
  });

  it('supports duration precision for seconds format', async () => {
    // precision 0 → 无小数
    const r0 = await runCommand(
      parser,
      [
        'orchestrate:report',
        '--path',
        reportPath,
        '--duration-format',
        's',
        '--duration-precision',
        '0',
      ],
      { expectExitCode: 0 }
    );
    const merged0 = r0.stdout.join('\n');
    // 形如 “总执行时长: 0s”
    expect(merged0).toMatch(/总执行时长: \d+s/);

    // precision 2 → 两位小数
    const r2 = await runCommand(
      parser,
      [
        'orchestrate:report',
        '--path',
        reportPath,
        '--duration-format',
        's',
        '--duration-precision',
        '2',
      ],
      { expectExitCode: 0 }
    );
    const merged2 = r2.stdout.join('\n');
    // 形如 “总执行时长: 0.00s”
    expect(merged2).toMatch(/总执行时长: \d+\.\d{2}s/);
  });

  it('supports duration precision for minutes format', async () => {
    const r = await runCommand(
      parser,
      [
        'orchestrate:report',
        '--path',
        reportPath,
        '--duration-format',
        'm',
        '--duration-precision',
        '2',
      ],
      { expectExitCode: 0 }
    );
    const merged = r.stdout.join('\n');
    // 形如 “总执行时长: 0.00m”
    expect(merged).toMatch(/总执行时长: \d+\.\d{2}m/);
  });

  it('returns JSON summary when使用 session-id', async () => {
    const sessionDir = dirname(reportPath);
    const sessionId = sessionDir.replace(/\\/g, '/').split('/').pop()!;
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as any);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined as any);

    let thrown: Error | null = null;
    try {
      await parser.parse([
        'node',
        'codex-father',
        '--json',
        'orchestrate:report',
        '--session-id',
        sessionId,
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toBe('process.exit:0');
    const entries = logSpy.mock.calls
      .map((call) => {
        try {
          return JSON.parse(String(call[0]));
        } catch {
          return null;
        }
      })
      .filter((item): item is Record<string, unknown> => item !== null && 'data' in item);

    expect(entries.length).toBeGreaterThan(0);
    const data = entries[0].data as Record<string, unknown>;
    expect(data.reportPath).toBe(reportPath);
    expect(data.eventsFile).toBe(eventsPath);
    const report = data.report as Record<string, unknown>;
    expect(report.status).toBe('succeeded');
    // metrics 字段应存在且包含数值
    const metrics = report.metrics as Record<string, unknown>;
    expect(metrics).toBeDefined();
    expect(
      typeof metrics.totalExecutionMs === 'number' || metrics.totalExecutionMs === undefined
    ).toBe(true);
    expect(
      typeof metrics.avgTaskDurationMs === 'number' || metrics.avgTaskDurationMs === undefined
    ).toBe(true);
    expect(typeof metrics.avgAttempts === 'number' || metrics.avgAttempts === undefined).toBe(true);
    expect(typeof metrics.totalRetries === 'number' || metrics.totalRetries === undefined).toBe(
      true
    );
    expect(
      typeof metrics.avgRetryDelayMs === 'number' || metrics.avgRetryDelayMs === undefined
    ).toBe(true);
    expect(typeof metrics.failureRate === 'number').toBe(true);
    const refs = report.references as { fr?: string[]; nfr?: string[] };
    expect(Array.isArray(refs.fr)).toBe(true);
    expect(Array.isArray(refs.nfr)).toBe(true);
    expect(refs.fr ?? []).toContain('FR-123');
    expect(refs.nfr ?? []).toContain('NFR-7');

    // referencesByTask 应存在且包含每个任务的 FR/NFR（至少包括来自 requirement 的 FR-123/NFR-7）
    const refsByTask = report.referencesByTask as Record<string, { fr?: string[]; nfr?: string[] }>;
    expect(refsByTask && typeof refsByTask === 'object').toBe(true);
    const keys = Object.keys(refsByTask ?? {});
    expect(keys.length).toBeGreaterThanOrEqual(2);
    for (const k of keys) {
      const entry = refsByTask[k] ?? {};
      expect(Array.isArray(entry.fr)).toBe(true);
      expect(Array.isArray(entry.nfr)).toBe(true);
      expect(entry.fr ?? []).toContain('FR-123');
      expect(entry.nfr ?? []).toContain('NFR-7');
    }

    // referencesCoverage 应存在且映射到任务列表
    const coverage = report.referencesCoverage as {
      fr?: Record<string, { coveredByTasks: string[] }>;
      nfr?: Record<string, { coveredByTasks: string[] }>;
    };
    expect(coverage && typeof coverage === 'object').toBe(true);
    expect(coverage.fr?.['FR-123']?.coveredByTasks?.length).toBeGreaterThanOrEqual(2);
    expect(coverage.nfr?.['NFR-7']?.coveredByTasks?.length).toBeGreaterThanOrEqual(2);

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('metrics 落在合理范围且计数一致', async () => {
    const sessionDir = dirname(reportPath);
    const sessionId = sessionDir.replace(/\\/g, '/').split('/').pop()!;
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as any);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined as any);

    let thrown: Error | null = null;
    try {
      await parser.parse([
        'node',
        'codex-father',
        '--json',
        'orchestrate:report',
        '--session-id',
        sessionId,
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toBe('process.exit:0');
    const entries = logSpy.mock.calls
      .map((call) => {
        try {
          return JSON.parse(String(call[0]));
        } catch {
          return null;
        }
      })
      .filter((item): item is Record<string, unknown> => item !== null && 'data' in item);

    const data = entries[0].data as Record<string, unknown>;
    const report = data.report as Record<string, unknown>;
    const successRate = report.successRate as number;
    const total = report.totalTasks as number;
    const completed = report.completedTasks as number;
    const failed = report.failedTasks as number;
    const metrics = (report.metrics ?? {}) as Record<string, unknown>;

    expect(successRate).toBeGreaterThanOrEqual(0);
    expect(successRate).toBeLessThanOrEqual(1);

    const failureRate = metrics.failureRate as number;
    expect(failureRate).toBeGreaterThanOrEqual(0);
    expect(failureRate).toBeLessThanOrEqual(1);

    if (typeof total === 'number' && typeof completed === 'number' && typeof failed === 'number') {
      expect(completed + failed).toBe(total);
      if (total > 0) {
        // 容忍浮点误差
        expect(Math.abs(1 - successRate - failureRate)).toBeLessThan(1e-6);
      }
    }

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });

  it('fails gracefully when报告不存在', async () => {
    const nonExist = join(process.cwd(), 'missing-report.json');
    const { stdout, stderr } = await runCommand(
      parser,
      ['orchestrate:report', '--path', nonExist],
      { expectExitCode: 3 }
    );
    expect(stdout.join('\n') + stderr.join('\n')).toContain('无法读取报告文件');
  });

  it('returns exit code 2 when neither --path nor --session-id is provided', async () => {
    const { stdout, stderr } = await runCommand(parser, ['orchestrate:report'], {
      expectExitCode: 2,
    });
    const joined = stdout.concat(stderr).join('\n');
    expect(joined).toContain('请通过 --path <report.json> 或 --session-id <id> 指定报告位置');
  });

  it('includes avgRetryDelayMs in metrics for failed report', async () => {
    const { stdout } = await runCommand(
      parser,
      [
        'orchestrate',
        '失败用例 FR-9',
        '--mode',
        'manual',
        '--tasks-file',
        join(__dirname, 'fixtures', 'manual.failure.tasks.json'),
        '--output-format',
        'stream-json',
        '--success-threshold',
        '0.9',
      ],
      { expectExitCode: 1 }
    );
    const failedEvent = JSON.parse(stdout[1]);
    failureReportPath = failedEvent.data.reportPath as string;

    const json = await readFile(failureReportPath, 'utf-8');
    const report = JSON.parse(json) as Record<string, unknown>;
    const metrics = (report.metrics ?? {}) as Record<string, unknown>;
    expect(typeof metrics.avgRetryDelayMs).toBe('number');

    // failureBreakdown 应存在且各项计数和为 failedTasks（排除 orchestration_error）
    const failedTasks = Number(report.failedTasks ?? 0);
    const fb = (report.failureBreakdown ?? {}) as Record<string, number>;
    expect(fb).toBeDefined();
    const sum = Object.entries(fb)
      .filter(([k]) => k !== 'orchestration_error')
      .reduce((acc, [, v]) => acc + (typeof v === 'number' ? v : 0), 0);
    expect(sum).toBe(failedTasks);

    // remediationByCategory 应存在；当存在某个分类>0时，对应建议非空
    const remByCat = (report.remediationByCategory ?? {}) as Record<string, string[]>;
    expect(remByCat).toBeDefined();
    const anyCat = Object.entries(fb).find(
      ([k, v]) => k !== 'orchestration_error' && (v ?? 0) > 0
    )?.[0];
    if (anyCat) {
      const list = remByCat[anyCat] ?? [];
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
    }
  });

  it('prints failure breakdown and suggestions for failed report (human summary)', async () => {
    // 先生成失败报告
    const { stdout } = await runCommand(
      parser,
      [
        'orchestrate',
        '失败用例 FR-9',
        '--mode',
        'manual',
        '--tasks-file',
        join(__dirname, 'fixtures', 'manual.failure.tasks.json'),
        '--output-format',
        'stream-json',
        '--success-threshold',
        '0.95',
      ],
      { expectExitCode: 1 }
    );
    const failedEvent = JSON.parse(stdout[1]);
    const failureReportPath = failedEvent.data.reportPath as string;

    // 再读取人类摘要
    const result = await runCommand(parser, ['orchestrate:report', '--path', failureReportPath], {
      expectExitCode: 0,
    });
    const merged = result.stdout.join('\n');
    expect(merged).toContain('失败分类:');
    expect(merged).toContain('建议摘要:');
    // 别名映射应生效（例如 other → 其他）
    expect(merged).toMatch(/失败分类: .*其他: \d+/);
  });
});
