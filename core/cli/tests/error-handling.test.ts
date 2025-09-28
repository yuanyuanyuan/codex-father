import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

import { CLIParser } from '../parser.js';
import type { CommandContext, CommandResult } from '../../lib/types.js';

describe('CLI Error Handling (T007)', () => {
  let parser: CLIParser;
  let command: Command;

  beforeEach(() => {
    command = new Command();
    parser = new CLIParser(command);

    parser.registerCommand('explode', 'Command that throws an error', async () => {
      throw new Error('Explosion occurred');
    });

    parser.registerCommand(
      'json-error',
      'Command that fails in JSON mode',
      async (context: CommandContext): Promise<CommandResult> => {
        if (context.json) {
          throw new Error('JSON explosion');
        }
        return { success: true, executionTime: 0, message: 'ok' };
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles unknown commands with suggestions and exits with code 1', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await parser.parse(['node', 'codex-father', 'unknown-cmd']);

    const output = errorSpy.mock.calls.map((call) => call[0]).join('\n');
    expect(output).toContain('Unknown command');
    expect(output).toContain("Run 'codex-father --help' for available commands.");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('reports handler errors in human-readable mode', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await parser.parse(['node', 'codex-father', 'explode']);

    const errors = errorSpy.mock.calls.map((call) => call[0]).join('\n');
    expect(errors).toContain('Explosion occurred');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('reports handler errors in JSON mode without using console.error', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await parser.parse(['node', 'codex-father', '--json', 'json-error']);

    expect(errorSpy).not.toHaveBeenCalled();
    const payload = logSpy.mock.calls.at(-1)?.[0] ?? '';
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({ success: false, error: 'JSON explosion' });
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('includes stack trace when verbose mode is enabled', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);

    await parser.parse(['node', 'codex-father', '--verbose', 'explode']);

    const messages = errorSpy.mock.calls.map((call) => call[0]);
    expect(messages[0]).toContain('Explosion occurred');
    expect(
      messages.some((msg) => typeof msg === 'string' && msg.includes('Error: Explosion occurred'))
    ).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
