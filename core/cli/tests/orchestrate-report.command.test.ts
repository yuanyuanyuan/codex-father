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
        '测试报告',
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
    expect((data.report as Record<string, unknown>).status).toBe('succeeded');

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
});
