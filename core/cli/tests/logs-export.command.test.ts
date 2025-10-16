import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';

import { CLIParser } from '../parser.js';
import { registerLogsCommand } from '../commands/logs-command.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sessionId = 'orc-test-session';
const sessionsRoot = join(process.cwd(), '.codex-father', 'sessions');
const sessionDir = join(sessionsRoot, sessionId);
const eventsPath = join(sessionDir, 'events.jsonl');

async function seedSessionLogs(): Promise<void> {
  await mkdir(sessionDir, { recursive: true, mode: 0o750 });
  const content = [
    JSON.stringify({ timestamp: '2025-01-01T00:00:00Z', level: 'info', message: 'start' }),
    JSON.stringify({ timestamp: '2025-01-01T00:00:01Z', level: 'info', message: 'complete' }),
  ].join('\n');
  await writeFile(eventsPath, `${content}\n`, { encoding: 'utf-8', mode: 0o600 });
}

type RunResult = { stdout: string[]; stderr: string[]; exitError: Error | null };

async function runCommand(
  parser: CLIParser,
  argv: string[],
  expectExitCode?: number
): Promise<RunResult> {
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

  if (typeof expectExitCode === 'number') {
    expect(thrown?.message).toBe(`process.exit:${expectExitCode}`);
  } else {
    expect(thrown).toBeNull();
  }

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
}

describe('logs command export behaviour', () => {
  let command: Command;
  let parser: CLIParser;

  beforeEach(async () => {
    vi.resetModules();
    command = new Command();
    parser = new CLIParser(command);
    registerLogsCommand(parser);
    await rm(join(process.cwd(), '.codex-father'), { recursive: true, force: true });
    await seedSessionLogs();
  });

  afterEach(async () => {
    await rm(join(process.cwd(), '.codex-father'), { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('copies session events to default export path', async () => {
    const { stdout } = await runCommand(parser, ['logs', sessionId]);

    const exportPath = join(process.cwd(), '.codex-father', 'logs', `${sessionId}-events.jsonl`);
    const exported = await readFile(exportPath, 'utf-8');
    const original = await readFile(eventsPath, 'utf-8');

    expect(exported).toBe(original);
    expect(stdout.join('\n')).toContain(exportPath);
  });

  it('supports custom output path with JSON output', async () => {
    const customPath = join(__dirname, `${sessionId}-custom.jsonl`);
    const { stdout } = await runCommand(parser, [
      '--json',
      'logs',
      sessionId,
      '--output',
      customPath,
    ]);

    const payloads = stdout
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((item): item is Record<string, unknown> => item !== null && 'data' in item);

    expect(payloads.length).toBeGreaterThan(0);
    const data = payloads[0]?.data as Record<string, unknown>;
    expect(data.outputPath).toBe(customPath);
    expect(await readFile(customPath, 'utf-8')).toBe(await readFile(eventsPath, 'utf-8'));
    await rm(customPath, { force: true });
  });

  it('fails when session logs do not exist', async () => {
    await rm(sessionDir, { recursive: true, force: true });
    const { stdout, stderr } = await runCommand(parser, ['logs', sessionId], 1);
    const output = stdout.concat(stderr).join('\n');
    expect(output).toContain('无法读取日志');
  });
});
