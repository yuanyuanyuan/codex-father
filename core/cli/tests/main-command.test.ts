import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

import { CLIParser } from '../parser.js';
import type { CommandResult } from '../../lib/types.js';

describe('Main Command Interface (T001)', () => {
  let command: Command;
  let parser: CLIParser;

  beforeEach(() => {
    command = new Command();
    parser = new CLIParser(command);

    parser.registerCommand('status', 'Show system status', async () => {
      const result: CommandResult = {
        success: true,
        message: 'System status: OK',
        data: { status: 'ok' },
        executionTime: 15,
      };
      return result;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('configures main command with required global options', () => {
    const optionFlags = command.options.map((opt) => opt.long ?? opt.short);

    expect(command.name()).toBe('codex-father');
    expect(optionFlags).toEqual(
      expect.arrayContaining(['--verbose', '--dry-run', '--json', '--config', '--log-level'])
    );
  });

  it('provides comprehensive help output', () => {
    const help = command.helpInformation();

    expect(help).toContain('Usage:');
    expect(help).toContain('Options:');
    expect(help).toContain('Commands:');
  });

  it('exposes CLI version information', () => {
    expect(command.version()).toBe('1.0.0');
  });

  it('outputs JSON when global json flag is provided', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse(['node', 'codex-father', '--json', 'status']);

    expect(logSpy).toHaveBeenCalled();
    const [output] = logSpy.mock.calls.at(-1) ?? [''];

    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed).toMatchObject({
      success: true,
      data: { status: 'ok' },
      executionTime: 15,
    });
  });

  it('executes command within performance threshold', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as any);

    const startTime = Date.now();
    await parser.parse(['node', 'codex-father', 'status']);
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(1000);
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
