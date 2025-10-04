import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';

import { CLIParser } from '../parser.js';
import type { CLIParser as CLIParserType } from '../parser.js';
import type { Command as CommanderCommand } from 'commander';

describe('Orchestrate Command Interface (T001)', () => {
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

  it('registers orchestrate command with required argument and options', () => {
    const orchestrateCommand = command.commands.find((cmd) => cmd.name() === 'orchestrate');

    expect(orchestrateCommand).toBeDefined();
    expect(orchestrateCommand?.description()).toContain('编排');

    const args = ((orchestrateCommand as any)?._args ?? []).map((arg: any) =>
      typeof arg.name === 'function' ? arg.name() : arg.name
    );
    expect(args).toContain('requirement');

    const optionFlags = orchestrateCommand?.options.map((opt) => opt.flags) ?? [];
    expect(optionFlags).toEqual(
      expect.arrayContaining([
        '--mode <mode>',
        '--tasks-file <path>',
        '--max-concurrency <count>',
        '--task-timeout <minutes>',
        '--success-threshold <ratio>',
        '--output-format <format>',
        '--config <path>',
      ])
    );
  });

  it('applies default values aligned with orchestrate contract', () => {
    const orchestrateCommand = command.commands.find((cmd) => cmd.name() === 'orchestrate');
    expect(orchestrateCommand).toBeDefined();

    const defaults = orchestrateCommand?.optsWithGlobals?.() ?? {};
    expect(defaults.mode).toBe('llm');
    expect(defaults.maxConcurrency).toBe(10);
    expect(defaults.taskTimeout).toBe(30);
    expect(defaults.successThreshold).toBeCloseTo(0.9);
    expect(defaults.outputFormat).toBe('stream-json');
  });
});

describe('CLI integration for orchestrate command', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('registers orchestrate command during CLI startup', async () => {
    vi.resetModules();

    const registerSpy = vi.fn();
    const parseSpy = vi.fn().mockResolvedValue(undefined);

    vi.doMock('../commands/orchestrate-command.js', () => ({
      registerOrchestrateCommand: registerSpy,
    }));

    const mockedParser = {
      registerCommand: vi.fn(),
      parse: parseSpy,
    } as const;

    vi.doMock('../parser.js', () => ({
      parser: mockedParser,
      CLIParser: class {},
      registerCommand: mockedParser.registerCommand,
    }));

    vi.doMock('../config-loader.js', () => ({
      getConfig: vi.fn(async () => ({ logging: { level: 'info' } })),
    }));

    vi.doMock('../logger-setup.js', () => ({
      LoggerManager: {
        initialize: vi.fn(async () => {}),
        isInitialized: vi.fn(() => true),
      },
      setupDevelopmentLogging: vi.fn(),
    }));

    vi.doMock('../legacy-compatibility.js', () => ({
      LegacyCommandHandler: {
        handleStart: vi.fn(),
        handleJob: vi.fn(),
        handleTest: vi.fn(),
      },
      validateLegacyScripts: vi.fn(async () => ({ valid: true, missing: [], issues: [] })),
    }));

    const { default: startCLI } = await import('../start.js');

    await startCLI(['node', 'codex-father', '--help']);

    expect(registerSpy).toHaveBeenCalledWith(mockedParser);
    expect(parseSpy).toHaveBeenCalled();
  });
});
