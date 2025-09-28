import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

import { CLIParser } from '../parser.js';
import type { CommandContext, CommandResult } from '../../lib/types.js';

describe('MCP Command Interface (T004)', () => {
  let command: Command;
  let parser: CLIParser;
  let handledContexts: CommandContext[];

  beforeEach(() => {
    command = new Command();
    parser = new CLIParser(command);
    handledContexts = [];

    parser.registerCommand(
      'mcp',
      'MCP server management operations',
      async (context: CommandContext): Promise<CommandResult> => {
        handledContexts.push(context);

        const [action, identifier] = context.args;
        const baseData = {
          action,
          identifier,
          options: { ...context.options },
        };

        switch (action) {
          case 'start':
            return {
              success: true,
              message: 'MCP server starting',
              data: {
                ...baseData,
                pid: 4321,
                port: Number(context.options.port ?? 7007),
                status: 'starting',
                endpoint: 'http://localhost:7007',
              },
              executionTime: 14,
            };
          case 'stop':
            return {
              success: true,
              message: `Stopped MCP instance ${identifier ?? 'default'}`,
              data: {
                ...baseData,
                stopped: true,
              },
              executionTime: 6,
            };
          case 'status':
            return {
              success: true,
              message: 'MCP status information',
              data: {
                ...baseData,
                instances: [
                  { name: 'default', status: 'running', port: 7007 },
                  { name: 'preview', status: 'stopped', port: 7010 },
                ],
              },
              executionTime: 8,
            };
          case 'logs':
            return {
              success: true,
              message: 'Streaming MCP logs',
              data: {
                ...baseData,
                entries: ['mcp log 1', 'mcp log 2'],
              },
              executionTime: 9,
            };
          case 'tools':
            return {
              success: true,
              message: 'Available MCP tools',
              data: {
                ...baseData,
                tools: [
                  { name: 'codex.exec', description: 'Exec command in sandbox' },
                  { name: 'codex.review', description: 'Review pull request' },
                ],
              },
              executionTime: 5,
            };
          default:
            return {
              success: false,
              message: `Unsupported MCP action: ${action}`,
              errors: [`Invalid MCP action: ${action}`],
              executionTime: 3,
            };
        }
      },
      {
        arguments: [
          {
            name: 'action',
            description: 'MCP action (start|stop|status|logs|tools)',
            required: true,
          },
          { name: 'name', description: 'Instance name or identifier', required: false },
        ],
        options: [
          { flags: '--port <port>', description: 'Port number for MCP server' },
          { flags: '--config <path>', description: 'Path to MCP configuration file' },
          { flags: '--detached', description: 'Start server in detached mode' },
          { flags: '--profile <profile>', description: 'Profile name for MCP instance' },
          { flags: '--tail <lines>', description: 'Tail size when streaming logs' },
          { flags: '--follow', description: 'Follow MCP log output' },
          { flags: '--since <timestamp>', description: 'Filter logs since timestamp' },
          { flags: '--format <format>', description: 'Output format for tools listing' },
          { flags: '--filter <pattern>', description: 'Filter tools by pattern' },
        ],
      }
    );
  });

  afterEach(() => {
    handledContexts = [];
    vi.restoreAllMocks();
  });

  it('registers MCP command with expected arguments and options', () => {
    const mcpCommand = command.commands.find((cmd) => cmd.name() === 'mcp');

    expect(mcpCommand).toBeDefined();
    expect(mcpCommand?.description()).toContain('MCP server management');

    const argNames = ((mcpCommand as any)?._args ?? []).map((arg: any) =>
      typeof arg.name === 'function' ? arg.name() : arg.name
    );
    expect(argNames).toEqual(['action', 'name']);

    const optionFlags = mcpCommand?.options.map((opt) => opt.flags) ?? [];
    expect(optionFlags).toEqual(
      expect.arrayContaining(['--port <port>', '--detached', '--tail <lines>', '--follow'])
    );
  });

  it('starts MCP server with port, config, and detached options', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse([
      'node',
      'codex-father',
      '--json',
      'mcp',
      'start',
      '--port',
      '7010',
      '--config',
      './mcp/config.json',
      '--profile',
      'preview',
      '--detached',
    ]);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('start');
    expect(context?.options.port).toBe('7010');
    expect(context?.options.config).toBe('./mcp/config.json');
    expect(context?.options.profile).toBe('preview');
    expect(context?.options.detached).toBe(true);

    const payload = logSpy.mock.calls.at(-1)?.[0] ?? '{}';
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'start',
        pid: 4321,
        status: 'starting',
      },
    });
  });

  it('stops MCP server by instance name', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse(['node', 'codex-father', '--json', 'mcp', 'stop', 'preview']);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('stop');
    expect(context?.args?.[1]).toBe('preview');

    const payload = logSpy.mock.calls.at(-1)?.[0] ?? '{}';
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'stop',
        stopped: true,
      },
    });
  });

  it('reports MCP status across instances', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse(['node', 'codex-father', '--json', 'mcp', 'status', '--format', 'json']);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('status');
    expect(context?.options.format).toBe('json');

    const payload = logSpy.mock.calls.at(-1)?.[0] ?? '{}';
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'status',
        instances: expect.any(Array),
      },
    });
  });

  it('streams MCP logs with tail, follow, and since filters', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse([
      'node',
      'codex-father',
      '--json',
      'mcp',
      'logs',
      'default',
      '--tail',
      '200',
      '--follow',
      '--since',
      '2024-02-01T12:00:00Z',
    ]);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('logs');
    expect(context?.args?.[1]).toBe('default');
    expect(context?.options.tail).toBe('200');
    expect(context?.options.follow).toBe(true);
    expect(context?.options.since).toBe('2024-02-01T12:00:00Z');

    const payload = logSpy.mock.calls.at(-1)?.[0] ?? '{}';
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'logs',
        entries: expect.arrayContaining(['mcp log 1']),
      },
    });
  });

  it('lists available MCP tools with filters and format options', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse([
      'node',
      'codex-father',
      '--json',
      'mcp',
      'tools',
      '--format',
      'table',
      '--filter',
      'codex.*',
    ]);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('tools');
    expect(context?.options.format).toBe('table');
    expect(context?.options.filter).toBe('codex.*');

    const payload = logSpy.mock.calls.at(-1)?.[0] ?? '{}';
    const parsed = JSON.parse(payload);
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'tools',
        tools: expect.any(Array),
      },
    });
  });
});
