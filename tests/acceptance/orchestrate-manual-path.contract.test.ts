import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, rm, access } from 'node:fs/promises';
import { constants as FS } from 'node:fs';

import { CLIParser } from '../../core/cli/parser.js';
import { registerOrchestrateCommand } from '../../core/cli/commands/orchestrate-command.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesDir = join(__dirname, '..', '..', 'core', 'cli', 'tests', 'fixtures');
const tasksPath = join(fixturesDir, 'manual.tasks.json');

describe('Acceptance: orchestrate manual main path (T001)', () => {
  let command: Command;
  let parser: CLIParser;

  beforeEach(async () => {
    vi.resetModules();
    command = new Command();
    parser = new CLIParser(command);
    registerOrchestrateCommand(parser);
  });

  afterEach(async () => {
    await rm(join(process.cwd(), '.codex-father', 'sessions'), { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('emits two stream-json lines and writes report + events.jsonl', async () => {
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
        '演练主路径',
        '--mode',
        'manual',
        '--tasks-file',
        tasksPath,
        '--output-format',
        'stream-json',
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toBe('process.exit:0');

    const lines = writeSpy.mock.calls.map((c) => String(c[0]).trim()).filter(Boolean);
    expect(lines).toHaveLength(2);

    const startEvt = JSON.parse(lines[0]);
    const doneEvt = JSON.parse(lines[1]);
    expect(startEvt.event).toBe('start');
    expect(doneEvt.event).toBe('orchestration_completed');
    expect(doneEvt.data.status).toBe('succeeded');

    const reportPath = String(doneEvt.data.reportPath);
    await access(reportPath, FS.F_OK | FS.R_OK);
    const report = JSON.parse(await readFile(reportPath, 'utf-8')) as Record<string, unknown>;
    expect(report.status).toBe('succeeded');
    const eventsFile = String(report.eventsFile ?? '');
    expect(eventsFile.endsWith('events.jsonl')).toBe(true);
    await access(eventsFile, FS.F_OK | FS.R_OK);

    exitSpy.mockRestore();
    writeSpy.mockRestore();
  });

  it('emits two lines on failure and writes failed report', async () => {
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
        '失败分支验收 FR-9',
        '--mode',
        'manual',
        '--tasks-file',
        join(fixturesDir, 'manual.failure.tasks.json'),
        '--output-format',
        'stream-json',
        '--success-threshold',
        '0.95',
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toBe('process.exit:1');

    const lines = writeSpy.mock.calls.map((c) => String(c[0]).trim()).filter(Boolean);
    expect(lines).toHaveLength(2);

    const startEvt = JSON.parse(lines[0]);
    const doneEvt = JSON.parse(lines[1]);
    expect(startEvt.event).toBe('start');
    expect(doneEvt.event).toBe('orchestration_completed');
    expect(doneEvt.data.status).toBe('failed');
    expect(typeof doneEvt.data.reportPath).toBe('string');

    const reportPath = String(doneEvt.data.reportPath);
    await access(reportPath, FS.F_OK | FS.R_OK);
    const report = JSON.parse(await readFile(reportPath, 'utf-8')) as Record<string, unknown>;
    expect(report.status).toBe('failed');

    exitSpy.mockRestore();
    writeSpy.mockRestore();
  });
});
