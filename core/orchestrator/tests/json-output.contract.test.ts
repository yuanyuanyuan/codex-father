import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

import { CLIParser } from '../../cli/parser.js';
import type { CLIParser as CLIParserType } from '../../cli/parser.js';
import type { Command as CommanderCommand } from 'commander';

describe('Orchestrate JSON output contract (T037)', () => {
  const modulePath: string = '../../cli/commands/orchestrate-command.js';
  let parser: CLIParserType;
  let command: CommanderCommand;
  let register: (parser: CLIParserType) => void;

  beforeEach(async () => {
    vi.resetModules();
    ({ registerOrchestrateCommand: register } = await import(modulePath));
    command = new Command();
    parser = new CLIParser(command);
    register(parser);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints machine-readable summary when output format is json', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as any);

    let thrown: Error | null = null;
    try {
      await parser.parse([
        'node',
        'codex-father',
        'orchestrate',
        '编排测试契约',
        '--output-format',
        'json',
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toBe('process.exit:0');

    const lastCall = logSpy.mock.calls.at(-1) ?? [];
    const output = lastCall.join(' ');

    expect(() => JSON.parse(output)).not.toThrow();

    const summary = JSON.parse(output);
    expect(summary).toHaveProperty('successRate');
    expect(summary).toHaveProperty('failedTasks');
    expect(Array.isArray(summary.failedTasks)).toBe(true);
    expect(summary).toHaveProperty('eventsFile');
    expect(summary.eventsFile).toMatch(/\.codex-father\/sessions\//);

    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
