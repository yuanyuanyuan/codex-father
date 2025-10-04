import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';

import { CLIParser } from '../parser.js';
import type { CLIParser as CLIParserType } from '../parser.js';
import type { Command as CommanderCommand } from 'commander';

describe('Orchestrate CLI exit codes and summary (T006)', () => {
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

  it('exits with code 0 and prints success summary when success rate meets threshold', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as any);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    let thrown: Error | null = null;
    try {
      await parser.parse(['node', 'codex-father', 'orchestrate', '实现用户管理模块']);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toBe('process.exit:0');
    const joinedLogs = logSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(joinedLogs).toContain('成功率');
    expect(joinedLogs).toContain('事件文件');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('reports failure summary and exits with code 1 when success rate is below threshold', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as any);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    let thrown: Error | null = null;
    try {
      await parser.parse([
        'node',
        'codex-father',
        'orchestrate',
        '并发编排演练',
        '--success-threshold',
        '0.95',
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toBe('process.exit:1');
    const joinedErrors = errorSpy.mock.calls.map((call) => call.join(' ')).join('\n');
    expect(joinedErrors).toContain('失败任务清单');
    expect(joinedErrors).toContain('patch_failed');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
