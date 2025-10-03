import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

import { CLIParser } from '../parser.js';
import type { CommandContext, CommandResult } from '../../lib/types.js';

describe('CLI Output Formatting (T006)', () => {
  let command: Command;
  let parser: CLIParser;

  beforeEach(() => {
    command = new Command();
    parser = new CLIParser(command);

    parser.registerCommand(
      'report',
      'Render formatted output in human-readable and JSON modes',
      async (context: CommandContext): Promise<CommandResult> => {
        const sections = [
          '┌──────┬────────┐',
          '│ Task │ Status │',
          '├──────┼────────┤',
          '│ T001 │ ✅ Done │',
          '└──────┴────────┘',
          '',
          '• Pending items:',
          '  - T002: in progress',
          '  - T003: blocked',
          '',
          '```bash',
          './start.sh --task "demo" --dry-run',
          '```',
        ].join('\n');

        return {
          success: true,
          message: sections,
          data: {
            format: 'human-readable',
            sections: ['table', 'list', 'code'],
          },
          warnings: context.json ? [] : ['Review pending tasks'],
          errors: context.json ? [] : ['No execution configured'],
          executionTime: 21,
        };
      }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders human-readable output with tables, lists, and code blocks', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await parser.parse(['node', 'codex-father', 'report']);

    expect(logSpy).toHaveBeenCalled();
    const message = logSpy.mock.calls.at(-1)?.[0] ?? '';
    expect(message).toContain('┌──────┬────────┐');
    expect(message).toContain('• Pending items:');
    expect(message).toContain('```bash');

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️'));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('❌'));
  });

  it('produces structured JSON output when json flag is used', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await parser.parse(['node', 'codex-father', '--json', 'report']);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    const output = logSpy.mock.calls.at(-1)?.[0] ?? '';
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      success: true,
      data: {
        format: 'human-readable',
        sections: ['table', 'list', 'code'],
      },
      executionTime: 21,
    });
    expect(parsed).toMatchObject({ warnings: [], errors: [] });
  });
});
