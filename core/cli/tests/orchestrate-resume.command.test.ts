import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Command } from 'commander';
import { CLIParser } from '../parser.js';
import { registerOrchestrateCommand } from '../commands/orchestrate-command.js';

describe('orchestrate --resume 触发会话恢复 (T001/T004)', () => {
  let command: Command;
  let parser: CLIParser;

  beforeEach(() => {
    vi.resetModules();
    command = new Command();
    parser = new CLIParser(command);
    registerOrchestrateCommand(parser);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns exit code 0 and prints confirmation', async () => {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as any);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined as any);

    let thrown: Error | null = null;
    try {
      await parser.parse([
        'node',
        'codex-father',
        'orchestrate',
        '恢复测试',
        '--resume',
        '/tmp/fake-rollout.json',
      ]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown?.message).toBe('process.exit:0');
    const entries = logSpy.mock.calls.map((c) => String(c[0])).join('\n');
    expect(entries).toContain('已触发会话恢复');

    exitSpy.mockRestore();
    logSpy.mockRestore();
  });
});
