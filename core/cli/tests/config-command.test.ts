import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

import { CLIParser } from '../parser.js';
import type { CommandContext, CommandResult } from '../../lib/types.js';

describe('Config Command Interface (T003)', () => {
  let command: Command;
  let parser: CLIParser;
  let handledContexts: CommandContext[];

  beforeEach(() => {
    command = new Command();
    parser = new CLIParser(command);
    handledContexts = [];

    parser.registerCommand(
      'config',
      'Configuration management operations',
      async (context: CommandContext): Promise<CommandResult> => {
        handledContexts.push(context);
        const [action, identifier] = context.args;

        const baseData = {
          action,
          identifier,
          options: { ...context.options },
        };

        switch (action) {
          case 'get':
            return {
              success: true,
              message: `Config value for ${identifier}`,
              data: {
                ...baseData,
                value: '30000',
                source: 'profiles/testing.conf',
              },
              executionTime: 7,
            };
          case 'set':
            return {
              success: true,
              message: `Updated ${identifier}`,
              data: {
                ...baseData,
                applied: true,
              },
              executionTime: 9,
            };
          case 'list':
            return {
              success: true,
              message: 'Config entries',
              data: {
                ...baseData,
                entries: [
                  { key: 'core.timeout', value: '30000' },
                  { key: 'logging.level', value: 'info' },
                ],
              },
              executionTime: 6,
            };
          case 'validate':
            return {
              success: true,
              message: 'Configuration valid',
              data: {
                ...baseData,
                rulesChecked: 12,
                warnings: [],
              },
              executionTime: 5,
            };
          case 'init':
            return {
              success: true,
              message: 'Configuration initialized',
              data: {
                ...baseData,
                filesCreated: ['config/defaults.yml'],
              },
              executionTime: 11,
            };
          default:
            return {
              success: false,
              message: `Unsupported config action: ${action}`,
              errors: [`Invalid config action: ${action}`],
              executionTime: 3,
            };
        }
      },
      {
        arguments: [
          { name: 'action', description: 'Config action (get|set|list|validate|init)', required: true },
          { name: 'key', description: 'Configuration key (for get/set)', required: false },
        ],
        options: [
          { flags: '--value <value>', description: 'Configuration value for set action' },
          { flags: '--environment <env>', description: 'Target environment name' },
          { flags: '--profile <profile>', description: 'Profile identifier for resolving values' },
          { flags: '--format <format>', description: 'Output format (table|json|yaml)' },
          { flags: '--filter <expression>', description: 'Filter expression when listing configs' },
          { flags: '--schema <path>', description: 'Schema file for validation' },
          { flags: '--output <path>', description: 'Path to write validation report' },
          { flags: '--template <name>', description: 'Template to use when initializing configs' },
          { flags: '--path <path>', description: 'Destination directory for init' },
          { flags: '--force', description: 'Force overwrite existing configuration files' },
        ],
      }
    );
  });

  afterEach(() => {
    handledContexts = [];
    vi.restoreAllMocks();
  });

  it('registers config command with expected arguments and options', () => {
    const configCommand = command.commands.find(cmd => cmd.name() === 'config');

    expect(configCommand).toBeDefined();
    expect(configCommand?.description()).toContain('Configuration management');

    const argNames = ((configCommand as any)?._args ?? []).map((arg: any) =>
      typeof arg.name === 'function' ? arg.name() : arg.name
    );
    expect(argNames).toEqual(['action', 'key']);

    const optionFlags = configCommand?.options.map(opt => opt.flags) ?? [];
    expect(optionFlags).toEqual(
      expect.arrayContaining([
        '--value <value>',
        '--environment <env>',
        '--schema <path>',
        '--force',
      ])
    );
  });

  it('retrieves configuration values for a key and environment', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse([
      'node',
      'codex-father',
      '--json',
      'config',
      'get',
      'core.timeout',
      '--environment',
      'production',
      '--profile',
      'default',
    ]);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('get');
    expect(context?.args?.[1]).toBe('core.timeout');
    expect(context?.options.environment).toBe('production');
    expect(context?.options.profile).toBe('default');

    const payload = logSpy.mock.calls.at(-1)?.[0] ?? '{}';
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'get',
        value: '30000',
        source: expect.stringContaining('profiles'),
      },
    });
  });

  it('updates configuration values with explicit value and environment', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse([
      'node',
      'codex-father',
      '--json',
      'config',
      'set',
      'logging.level',
      '--value',
      'debug',
      '--environment',
      'development',
    ]);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('set');
    expect(context?.args?.[1]).toBe('logging.level');
    expect(context?.options.value).toBe('debug');
    expect(context?.options.environment).toBe('development');

    const payload = logSpy.mock.calls.at(-1)?.[0] ?? '{}';
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'set',
        applied: true,
      },
    });
  });

  it('lists configuration entries with filters and formatting', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse([
      'node',
      'codex-father',
      '--json',
      'config',
      'list',
      '--environment',
      'staging',
      '--format',
      'json',
      '--filter',
      'core.*',
    ]);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('list');
    expect(context?.options.environment).toBe('staging');
    expect(context?.options.format).toBe('json');
    expect(context?.options.filter).toBe('core.*');

    const payload = logSpy.mock.calls.at(-1)?.[0] ?? '{}';
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'list',
        entries: expect.any(Array),
      },
    });
  });

  it('validates configuration using schema and emits report paths', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse([
      'node',
      'codex-father',
      '--json',
      'config',
      'validate',
      '--schema',
      './schemas/config-schema.json',
      '--output',
      './reports/validation.json',
    ]);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('validate');
    expect(context?.options.schema).toBe('./schemas/config-schema.json');
    expect(context?.options.output).toBe('./reports/validation.json');

    const payload = logSpy.mock.calls.at(-1)?.[0] ?? '{}';
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'validate',
        rulesChecked: 12,
      },
    });
  });

  it('initializes configuration templates with destination path controls', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse([
      'node',
      'codex-father',
      '--json',
      'config',
      'init',
      '--template',
      'advanced',
      '--path',
      './config/bootstrap',
      '--force',
    ]);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('init');
    expect(context?.options.template).toBe('advanced');
    expect(context?.options.path).toBe('./config/bootstrap');
    expect(context?.options.force).toBe(true);

    const payload = logSpy.mock.calls.at(-1)?.[0] ?? '{}';
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'init',
        filesCreated: expect.arrayContaining(['config/defaults.yml']),
      },
    });
  });
});
