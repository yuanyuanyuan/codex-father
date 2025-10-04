import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

import { CLIParser } from '../parser.js';
import type { CLIParser as CLIParserType } from '../parser.js';
import type { Command as CommanderCommand } from 'commander';

describe('Logs command contract (T043)', () => {
  const modulePath: string = '../commands/logs-command.js';
  let command: CommanderCommand;
  let parser: CLIParserType;
  let registerLogsCommand: (parser: CLIParserType) => void;

  beforeEach(async () => {
    vi.resetModules();
    ({ registerLogsCommand } = await import(modulePath));
    command = new Command();
    parser = new CLIParser(command);
    registerLogsCommand(parser);
  });

  it('registers logs command with expected usage and arguments', () => {
    const logsCommand = command.commands.find((cmd) => cmd.name() === 'logs');
    expect(logsCommand).toBeDefined();
    expect(logsCommand?.usage()).toBe('<sessionId> [options]');

    const optionFlags = logsCommand?.options.map((opt) => opt.flags) ?? [];
    expect(optionFlags).toEqual(
      expect.arrayContaining([
        '--follow',
        '--format <text|json>',
        '--output <path>',
        '--limit <lines>',
      ])
    );
  });

  it('exposes help output describing session log export', () => {
    const logsCommand = command.commands.find((cmd) => cmd.name() === 'logs');
    expect(logsCommand).toBeDefined();

    const help = logsCommand?.helpInformation() ?? '';
    expect(help).toContain('codex-father logs <sessionId> [options]');
    expect(help).toContain('--follow');
    expect(help).toContain('--format <text|json>');
    expect(help).toContain('--output <path>');
  });
});
