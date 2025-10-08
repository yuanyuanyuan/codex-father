import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readFile, rm } from 'node:fs/promises';

import { CLIParser } from '../parser.js';
import type { CLIParser as CLIParserType } from '../parser.js';
import type { Command as CommanderCommand } from 'commander';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const manualTasksPath = join(__dirname, 'fixtures', 'manual.tasks.json');
const manualFailureTasksPath = join(__dirname, 'fixtures', 'manual.failure.tasks.json');

describe('Orchestrate CLI exit codes and summary (T006)', () => {
  let command: CommanderCommand;
  let parser: CLIParserType;
  let registerOrchestrateCommand: (parser: CLIParserType) => void;

  beforeEach(async () => {
    vi.resetModules();
    ({ registerOrchestrateCommand } = await import('../commands/orchestrate-command.js'));
    command = new Command();
    parser = new CLIParser(command);
    registerOrchestrateCommand(parser);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(join(process.cwd(), '.codex-father', 'sessions'), { recursive: true, force: true });
  });

  it('exits with code 0 and emits exactly two stream-json lines (start, orchestration_completed)', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as any);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);

    let thrown: Error | null = null;
    try {
      await parser.parse([
        'node',
        'codex-father',
        'orchestrate',
        '实现用户管理模块',
        '--mode',
        'manual',
        '--tasks-file',
        manualTasksPath,
        '--output-format',
        'stream-json',
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toBe('process.exit:0');
    const lines = writeSpy.mock.calls.map((call) => String(call[0]).trim()).filter(Boolean);
    expect(lines).toHaveLength(2);

    const first = JSON.parse(lines[0]);
    const second = JSON.parse(lines[1]);

    expect(first.event).toBe('start');
    expect(typeof first.orchestrationId).toBe('string');
    expect(typeof first.seq).toBe('number');
    expect(first.data && first.data.totalTasks).toBe(2);

    expect(second.event).toBe('orchestration_completed');
    expect(second.orchestrationId).toBe(first.orchestrationId);
    expect(typeof second.seq).toBe('number');
    expect(second.seq).toBeGreaterThan(first.seq);
    expect(second.data && second.data.successRate).toBe(1);
    expect(second.data && second.data.status).toBe('succeeded');
    expect(second.data && second.data.reportPath).toBeDefined();

    const reportPath = second.data.reportPath as string;
    const reportContent = JSON.parse(await readFile(reportPath, 'utf-8')) as Record<
      string,
      unknown
    >;
    expect(reportContent.status).toBe('succeeded');
    expect(reportContent.successRate).toBe(1);
    expect(reportContent.totalTasks).toBe(2);

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('returns exit code 5 when manual tasks file is missing and does not emit stream events', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as any);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);

    let thrown: Error | null = null;
    try {
      await parser.parse([
        'node',
        'codex-father',
        'orchestrate',
        '并发编排演练',
        '--mode',
        'manual',
        '--tasks-file',
        join(__dirname, 'fixtures', 'not-exists.json'),
        '--output-format',
        'stream-json',
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toBe('process.exit:5');
    expect(writeSpy).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(5);
  });

  it('supports --resume to trigger session recovery without altering stdout contract', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as any);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined as any);

    let thrown: Error | null = null;
    try {
      await parser.parse([
        'node',
        'codex-father',
        'orchestrate',
        '占位需求',
        '--mode',
        'manual',
        '--tasks-file',
        manualTasksPath,
        '--resume',
        '/tmp/codex-rollout.json',
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toBe('process.exit:0');
    const combinedLogs = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(combinedLogs.includes('/tmp/codex-rollout.json')).toBe(true);
  });

  it('supports --save-stream to persist two stream-json lines into a file', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as any);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);

    const savePath = join(__dirname, 'fixtures', `stream-${Date.now()}.jsonl`);

    let thrown: Error | null = null;
    try {
      await parser.parse([
        'node',
        'codex-father',
        'orchestrate',
        '保存流事件',
        '--mode',
        'manual',
        '--tasks-file',
        manualTasksPath,
        '--output-format',
        'stream-json',
        '--save-stream',
        savePath,
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toBe('process.exit:0');
    const file = await readFile(savePath, 'utf-8');
    const lines = file
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    expect(lines).toHaveLength(2);
    const first = JSON.parse(lines[0]);
    const second = JSON.parse(lines[1]);
    expect(first.event).toBe('start');
    expect(second.event).toBe('orchestration_completed');

    await rm(savePath, { force: true });
    exitSpy.mockRestore();
    writeSpy.mockRestore();
  });

  it('produces failure report with remediation suggestions when任务失败', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as any);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);

    let thrown: Error | null = null;
    try {
      await parser.parse([
        'node',
        'codex-father',
        'orchestrate',
        '失败用例',
        '--mode',
        'manual',
        '--tasks-file',
        manualFailureTasksPath,
        '--output-format',
        'stream-json',
        '--success-threshold',
        '0.9',
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toBe('process.exit:1');
    const lines = writeSpy.mock.calls.map((call) => String(call[0]).trim()).filter(Boolean);
    expect(lines).toHaveLength(2);
    const resultEvent = JSON.parse(lines[1]);
    expect(resultEvent.event).toBe('orchestration_completed');
    expect(resultEvent.data.status).toBe('failed');
    expect(Array.isArray(resultEvent.data.failedTaskIds)).toBe(true);

    const reportPath = resultEvent.data.reportPath as string;
    const report = JSON.parse(await readFile(reportPath, 'utf-8')) as Record<string, unknown>;
    expect(report.status).toBe('failed');
    expect(report.failureReason).toBe('success-rate-below-threshold');
    expect(Array.isArray(report.failedTaskIds) && report.failedTaskIds).toContain('t_fail');
    expect(Array.isArray(report.remediationSuggestions)).toBe(true);
    expect((report.remediationSuggestions as string[])[0]).toContain('npm test');

    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('returns exit code 5 when tasks JSON is invalid and emits no stream events', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as any);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);

    // 准备一个无效 JSON 文件
    const tmpInvalid = join(__dirname, 'fixtures', `invalid-${Date.now()}.json`);
    await import('node:fs/promises').then(async (fs) => {
      await fs.writeFile(tmpInvalid, '{ invalid json', 'utf-8');
    });

    let thrown: Error | null = null;
    try {
      await parser.parse([
        'node',
        'codex-father',
        'orchestrate',
        '无效任务',
        '--mode',
        'manual',
        '--tasks-file',
        tmpInvalid,
        '--output-format',
        'stream-json',
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toBe('process.exit:5');
    // 不应输出 stream-json 事件
    const lines = writeSpy.mock.calls.map((call) => String(call[0]).trim()).filter(Boolean);
    expect(lines).toHaveLength(0);

    exitSpy.mockRestore();
    writeSpy.mockRestore();
  });
});
