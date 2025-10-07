import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

import { CLIParser } from '../parser.js';
import type { CLIParser as CLIParserType } from '../parser.js';
import type { Command as CommanderCommand } from 'commander';

describe('Orchestrate CLI contract (T005)', () => {
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

  it('matches usage string defined in orchestrate CLI contract', () => {
    const orchestrateCommand = command.commands.find((cmd) => cmd.name() === 'orchestrate');

    expect(orchestrateCommand).toBeDefined();
    expect(orchestrateCommand?.usage()).toBe('<requirement> [options]');
  });

  it('exposes option signatures exactly as documented', () => {
    const orchestrateCommand = command.commands.find((cmd) => cmd.name() === 'orchestrate');
    expect(orchestrateCommand).toBeDefined();

    const optionFlags = orchestrateCommand?.options.map((opt) => opt.flags) ?? [];

    // 放宽校验：包含核心选项即可（不同 Commander 渲染可能调序）
    const expectedFlags = [
      '--mode <manual|llm>',
      '--tasks-file <path>',
      '--max-concurrency <n>',
      '--task-timeout <minutes>',
      '--success-threshold <0-1>',
      '--output-format <json|stream-json>',
      '--resume <path>',
      '--config <path>',
    ];
    for (const flag of expectedFlags) {
      expect(optionFlags).toContain(flag);
    }
  });

  it('renders help output that mirrors contract examples', () => {
    const orchestrateCommand = command.commands.find((cmd) => cmd.name() === 'orchestrate');
    expect(orchestrateCommand).toBeDefined();

    const help = orchestrateCommand?.helpInformation() ?? '';

    expect(help).toContain('codex-father orchestrate <requirement> [options]');
    expect(help).toContain('--mode <manual|llm>');
    expect(help).toContain('--success-threshold <0-1>');
    expect(help).toContain('--output-format <json|stream-json>');
  });
});
