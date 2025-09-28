import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

import { CLIParser } from '../parser.js';
import type { CommandContext, CommandResult } from '../../lib/types.js';

describe('Task Command Interface (T002)', () => {
  let command: Command;
  let parser: CLIParser;
  let handledContexts: CommandContext[];
  let handledResults: CommandResult[];

  beforeEach(() => {
    command = new Command();
    parser = new CLIParser(command);
    handledContexts = [];
    handledResults = [];

    parser.registerCommand(
      'task',
      'Task queue management operations',
      async (context: CommandContext): Promise<CommandResult> => {
        handledContexts.push(context);

        const action = context.args[0];
        const targetId = context.args[1] ?? null;

        const baseData = {
          action,
          args: [...context.args],
          options: { ...context.options },
        };

        const record = (result: CommandResult): CommandResult => {
          handledResults.push(result);
          return result;
        };

        switch (action) {
          case 'create':
            return record({
              success: true,
              message: 'Task created successfully',
              data: {
                ...baseData,
                taskId: 'demo-task-id',
                queuePosition: 1,
              },
              executionTime: 12,
            });

          case 'list':
            return record({
              success: true,
              message: 'Listing tasks',
              data: {
                ...baseData,
                tasks: [{ id: 'demo-task-id', type: 'analysis', status: 'pending' }],
                totalCount: 1,
              },
              executionTime: 8,
            });

          case 'status':
            return record({
              success: true,
              message: `Status for ${targetId}`,
              data: {
                ...baseData,
                task: {
                  id: targetId,
                  status: 'processing',
                  createdAt: '2024-01-01T00:00:00.000Z',
                  updatedAt: '2024-01-01T00:05:00.000Z',
                },
              },
              executionTime: 4,
            });

          case 'cancel':
            return record({
              success: true,
              message: `Cancelled ${targetId}`,
              data: {
                ...baseData,
                cancelled: true,
              },
              executionTime: 3,
            });

          case 'retry':
            return record({
              success: true,
              message: `Retry scheduled for ${targetId}`,
              data: {
                ...baseData,
                retryScheduled: true,
                nextAttemptAt: '2024-01-02T08:00:00.000Z',
              },
              executionTime: 5,
            });

          case 'logs':
            return record({
              success: true,
              message: `Logs for ${targetId}`,
              data: {
                ...baseData,
                entries: ['log entry 1', 'log entry 2'],
              },
              executionTime: 6,
            });

          default:
            return record({
              success: false,
              message: `Unknown action: ${action}`,
              errors: [`Unsupported task action: ${action}`],
              executionTime: 1,
            });
        }
      },
      {
        arguments: [
          {
            name: 'action',
            description: 'Task action (create|list|status|cancel|retry|logs)',
            required: true,
          },
          { name: 'id', description: 'Task identifier for targeted actions', required: false },
        ],
        options: [
          { flags: '--type <type>', description: 'Task type when creating a task' },
          { flags: '--priority <priority>', description: 'Task priority level' },
          { flags: '--payload <payload>', description: 'Task payload (JSON string)' },
          { flags: '--execute', description: 'Execute task immediately after creation' },
          { flags: '--wait', description: 'Wait for task completion when executing' },
          { flags: '--timeout <ms>', description: 'Execution timeout in milliseconds' },
          { flags: '--status <status...>', description: 'Filter task list by status' },
          { flags: '--types <types...>', description: 'Filter task list by type' },
          { flags: '--limit <limit>', description: 'Limit number of results when listing' },
          { flags: '--page <page>', description: 'Select result page when listing' },
          { flags: '--sort <field>', description: 'Sort field for listing tasks' },
          { flags: '--order <direction>', description: 'Sort order (asc|desc)' },
          { flags: '--format <format>', description: 'Output format (table|json|list)' },
          { flags: '--force', description: 'Force cancel operation without confirmation' },
          { flags: '--delay <ms>', description: 'Delay before retrying a task' },
          { flags: '--immediate', description: 'Run retry immediately without delay' },
          { flags: '--tail <lines>', description: 'Number of log lines to display' },
          { flags: '--follow', description: 'Follow log output stream' },
          { flags: '--since <timestamp>', description: 'Start time for fetching logs' },
        ],
      }
    );
  });

  afterEach(() => {
    handledContexts = [];
    handledResults = [];
    vi.restoreAllMocks();
  });

  it('registers task command with expected arguments and options', () => {
    const taskCommand = command.commands.find((cmd) => cmd.name() === 'task');

    expect(taskCommand).toBeDefined();
    expect(taskCommand?.description()).toContain('Task queue management');

    const argumentDefs = ((taskCommand as any)?._args ?? []).map((arg: any) =>
      typeof arg.name === 'function' ? arg.name() : arg.name
    );
    expect(argumentDefs).toEqual(['action', 'id']);

    const optionFlags = taskCommand?.options.map((opt) => opt.flags) ?? [];

    expect(optionFlags).toEqual(
      expect.arrayContaining([
        '--type <type>',
        '--status <status...>',
        '--types <types...>',
        '--tail <lines>',
        '--follow',
      ])
    );
  });

  it('supports task creation with payload, priority, and execution flags', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse([
      'node',
      'codex-father',
      '--json',
      'task',
      'create',
      '--type',
      'analysis',
      '--payload',
      '{"target":"docs"}',
      '--priority',
      '3',
      '--execute',
      '--wait',
      '--timeout',
      '60000',
    ]);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('create');
    expect(context?.json).toBe(true);
    expect(context?.options.type).toBe('analysis');
    expect(context?.options.priority).toBe('3');
    expect(context?.options.payload).toBe('{"target":"docs"}');
    expect(context?.options.execute).toBe(true);
    expect(context?.options.wait).toBe(true);
    expect(context?.options.timeout).toBe('60000');

    const output = logSpy.mock.calls.at(-1)?.[0] ?? '';
    expect(() => JSON.parse(output)).not.toThrow();

    const parsed = JSON.parse(output);
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'create',
        taskId: 'demo-task-id',
        options: expect.objectContaining({ type: 'analysis', execute: true }),
      },
    });
  });

  it('lists tasks with filters, pagination, and format selection', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse([
      'node',
      'codex-father',
      '--json',
      'task',
      'list',
      '--status',
      'pending',
      'processing',
      '--types',
      'analysis',
      'build',
      '--limit',
      '10',
      '--page',
      '2',
      '--sort',
      'createdAt',
      '--order',
      'asc',
      '--format',
      'json',
    ]);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('list');
    expect(context?.options.status).toEqual(['pending', 'processing']);
    expect(context?.options.types).toEqual(['analysis', 'build']);
    expect(context?.options.limit).toBe('10');
    expect(context?.options.page).toBe('2');
    expect(context?.options.sort).toBe('createdAt');
    expect(context?.options.order).toBe('asc');
    expect(context?.options.format).toBe('json');

    const parsed = JSON.parse(logSpy.mock.calls.at(-1)?.[0] ?? '{}');
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'list',
        tasks: expect.any(Array),
        totalCount: 1,
      },
    });
  });

  it('returns task status data for a given identifier', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse(['node', 'codex-father', '--json', 'task', 'status', 'task-123']);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('status');
    expect(context?.args?.[1]).toBe('task-123');

    const parsed = JSON.parse(logSpy.mock.calls.at(-1)?.[0] ?? '{}');
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'status',
        task: expect.objectContaining({ id: 'task-123', status: 'processing' }),
      },
    });
  });

  it('cancels a task with optional force flag', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse(['node', 'codex-father', '--json', 'task', 'cancel', 'task-456', '--force']);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('cancel');
    expect(context?.args?.[1]).toBe('task-456');
    expect(context?.options.force).toBe(true);

    const parsed = JSON.parse(logSpy.mock.calls.at(-1)?.[0] ?? '{}');
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'cancel',
        cancelled: true,
      },
    });
  });

  it('retries a failed task with scheduling controls', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse([
      'node',
      'codex-father',
      '--json',
      'task',
      'retry',
      'task-789',
      '--delay',
      '5000',
      '--immediate',
    ]);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('retry');
    expect(context?.args?.[1]).toBe('task-789');
    expect(context?.options.delay).toBe('5000');
    expect(context?.options.immediate).toBe(true);

    const parsed = JSON.parse(logSpy.mock.calls.at(-1)?.[0] ?? '{}');
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'retry',
        retryScheduled: true,
      },
    });
  });

  it('streams task logs with tail, follow, and since parameters', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await parser.parse([
      'node',
      'codex-father',
      '--json',
      'task',
      'logs',
      'task-999',
      '--tail',
      '20',
      '--follow',
      '--since',
      '2024-01-01T00:00:00Z',
    ]);

    const context = handledContexts.at(-1);
    expect(context?.args?.[0]).toBe('logs');
    expect(context?.args?.[1]).toBe('task-999');
    expect(context?.options.tail).toBe('20');
    expect(context?.options.follow).toBe(true);
    expect(context?.options.since).toBe('2024-01-01T00:00:00Z');

    const parsed = JSON.parse(logSpy.mock.calls.at(-1)?.[0] ?? '{}');
    expect(parsed).toMatchObject({
      success: true,
      data: {
        action: 'logs',
        entries: expect.arrayContaining(['log entry 1']),
      },
    });
  });
});
