/**
 * 遗留兼容性层
 * 确保新的 TypeScript CLI 与现有 Shell 脚本的完全兼容
 */

import { LegacyScriptRunner, type ScriptResult } from './scripts.js';
import { AppError, createError } from './error-boundary.js';
import type { CommandContext, CommandResult } from '../lib/types.js';
import { prepareStructuredInstructions, type PreparedInstructions } from './instructions/index.js';

/**
 * 将 Shell 脚本结果转换为 CLI 命令结果
 */
export function adaptScriptResult(scriptResult: ScriptResult): CommandResult {
  return {
    success: scriptResult.success,
    message: scriptResult.success ? 'Command executed successfully' : 'Command failed',
    data: {
      stdout: scriptResult.stdout,
      stderr: scriptResult.stderr,
      duration: scriptResult.duration,
    },
    errors: scriptResult.success ? [] : [scriptResult.stderr || 'Unknown error'],
    warnings: scriptResult.stderr && scriptResult.success ? [scriptResult.stderr] : [],
    executionTime: scriptResult.duration,
  };
}

/**
 * 遗留命令处理器
 * 将 CLI 命令路由到对应的 Shell 脚本
 */
export class LegacyCommandHandler {
  /**
   * 处理 start 命令
   */
  static async handleStart(context: CommandContext): Promise<CommandResult> {
    const rawInstructions = context.options.instructions;
    const instructionsPath = typeof rawInstructions === 'string' ? rawInstructions.trim() : '';
    const rawTaskId = context.options.task;
    const taskId = typeof rawTaskId === 'string' ? rawTaskId.trim() : '';
    let prepared: PreparedInstructions | undefined;

    try {
      if (taskId && !instructionsPath) {
        throw createError.validation('--task 选项需要同时指定 --instructions 文件');
      }

      if (instructionsPath) {
        const prepareOptions = {
          cwd: context.workingDirectory,
          ...(taskId ? { expectedTaskId: taskId } : {}),
        };
        prepared = await prepareStructuredInstructions(instructionsPath, prepareOptions);
      }

      const env: NodeJS.ProcessEnv = {
        ...process.env,
      };

      if (prepared) {
        env.CODEX_STRUCTURED_INSTRUCTIONS_FILE = prepared.normalizedPath;
        env.CODEX_STRUCTURED_INSTRUCTIONS_SOURCE = prepared.sourcePath;
        env.CODEX_STRUCTURED_INSTRUCTIONS_FORMAT = prepared.format;
        env.CODEX_STRUCTURED_INSTRUCTIONS_ID = prepared.data.id;
        env.CODEX_STRUCTURED_INSTRUCTIONS_VERSION = prepared.data.version;
      }

      if (taskId) {
        env.CODEX_STRUCTURED_TASK_ID = taskId;
      }

      const result = await LegacyScriptRunner.start(context.args, {
        workingDirectory: context.workingDirectory,
        captureOutput: !context.verbose,
        env,
      });

      const commandResult = adaptScriptResult(result);
      if (prepared) {
        commandResult.data = {
          ...(commandResult.data as Record<string, unknown> | undefined),
          structuredInstructions: {
            source: prepared.sourcePath,
            normalized: prepared.normalizedPath,
            format: prepared.format,
            id: prepared.data.id,
            version: prepared.data.version,
            taskId: taskId || undefined,
          },
        };
      }

      return commandResult;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      return {
        success: false,
        message: 'Failed to execute start command',
        errors: [error instanceof Error ? error.message : String(error)],
        executionTime: 0,
      };
    }
  }

  /**
   * 处理 job 命令
   */
  static async handleJob(context: CommandContext): Promise<CommandResult> {
    try {
      const result = await LegacyScriptRunner.job(context.args, {
        workingDirectory: context.workingDirectory,
        captureOutput: !context.verbose,
      });

      return adaptScriptResult(result);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      return {
        success: false,
        message: 'Failed to execute job command',
        errors: [error instanceof Error ? error.message : String(error)],
        executionTime: 0,
      };
    }
  }

  /**
   * 处理 test 命令
   */
  static async handleTest(context: CommandContext): Promise<CommandResult> {
    try {
      const result = await LegacyScriptRunner.runTests(context.args, {
        workingDirectory: context.workingDirectory,
        captureOutput: !context.verbose,
      });

      return adaptScriptResult(result);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      return {
        success: false,
        message: 'Failed to execute test command',
        errors: [error instanceof Error ? error.message : String(error)],
        executionTime: 0,
      };
    }
  }
}

/**
 * 检查是否应该使用遗留脚本处理命令
 */
export function shouldUseLegacyHandler(command: string): boolean {
  const legacyCommands = new Set(['start', 'job', 'test', 'run-tests']);

  return legacyCommands.has(command);
}

/**
 * 遗留命令路由器
 */
export async function routeLegacyCommand(
  command: string,
  context: CommandContext
): Promise<CommandResult | null> {
  if (!shouldUseLegacyHandler(command)) {
    return null;
  }

  switch (command) {
    case 'start':
      return LegacyCommandHandler.handleStart(context);

    case 'job':
      return LegacyCommandHandler.handleJob(context);

    case 'test':
    case 'run-tests':
      return LegacyCommandHandler.handleTest(context);

    default:
      return null;
  }
}

/**
 * 创建遗留脚本的符号链接（如果需要）
 */
export async function createLegacyLinks(): Promise<void> {
  // 暂时不创建符号链接，保持现有脚本在原位置
  // 未来如果需要可以在这里添加链接逻辑
  console.log('Legacy scripts maintained in original locations for compatibility');
}

/**
 * 验证遗留脚本完整性
 */
export async function validateLegacyScripts(): Promise<{
  valid: boolean;
  missing: string[];
  issues: string[];
}> {
  const { getScriptStatus } = await import('./scripts.js');
  const status = await getScriptStatus();

  const missing: string[] = [];
  const issues: string[] = [];

  for (const [name, info] of Object.entries(status)) {
    if (!info.exists) {
      missing.push(name);
      if (info.envVar) {
        issues.push(`Script ${name} not found at ${info.path} (configured via ${info.envVar})`);
      } else {
        issues.push(`Script ${name} not found at ${info.path}`);
      }
    } else if (!info.executable) {
      issues.push(`Script ${name} exists but is not executable`);
    }
  }

  return {
    valid: missing.length === 0 && issues.length === 0,
    missing,
    issues,
  };
}
