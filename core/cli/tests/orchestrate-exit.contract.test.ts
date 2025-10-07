import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

import { CLIParser } from '../parser.js';
import type { CLIParser as CLIParserType } from '../parser.js';
import type { Command as CommanderCommand } from 'commander';

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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('exits with code 0 and emits exactly two stream-json lines (start, orchestration_completed)', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as any);
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);

    let thrown: Error | null = null;
    try {
      await parser.parse(['node', 'codex-father', 'orchestrate', '实现用户管理模块']);
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
    expect(first.data && typeof first.data.totalTasks).toBe('number');

    expect(second.event).toBe('orchestration_completed');
    expect(second.orchestrationId).toBe(first.orchestrationId);
    expect(typeof second.seq).toBe('number');
    expect(second.seq).toBeGreaterThan(first.seq);
    expect(second.data && typeof second.data.successRate).toBe('number');

    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('still emits two stream-json lines and exits with code 1 when success rate below threshold', async () => {
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
        '--success-threshold',
        '0.95',
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toBe('process.exit:1');
    const lines = writeSpy.mock.calls.map((call) => String(call[0]).trim()).filter(Boolean);
    expect(lines).toHaveLength(2);
    const [first, second] = lines.map((l) => JSON.parse(l));
    expect(first.event).toBe('start');
    expect(second.event).toBe('orchestration_completed');
    expect(exitSpy).toHaveBeenCalledWith(1);
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
});
