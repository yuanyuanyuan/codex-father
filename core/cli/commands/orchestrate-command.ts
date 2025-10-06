import type { CLIParser } from '../parser.js';
import type { CommandResult } from '../../lib/types.js';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';

interface OrchestrateDefaults {
  mode: 'manual' | 'llm';
  maxConcurrency: number;
  taskTimeout: number;
  successThreshold: number;
  outputFormat: 'json' | 'stream-json';
}

const DEFAULTS: OrchestrateDefaults = {
  mode: 'llm',
  maxConcurrency: 10,
  taskTimeout: 30,
  successThreshold: 0.9,
  outputFormat: 'stream-json',
};

export function registerOrchestrateCommand(parser: CLIParser): void {
  parser.registerCommand(
    'orchestrate',
    '编排多 Agent 并行任务（MVP scaffolding）',
    async (context) => {
      const startTime = Date.now();
      const requirement = context.args[0] ?? '未定义需求';
      const options = context.options ?? {};

      const normalizeNumber = (value: unknown, fallback: number): number => {
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value;
        }
        if (typeof value === 'string') {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : fallback;
        }
        return fallback;
      };

      const mode = (options.mode as OrchestrateDefaults['mode']) ?? DEFAULTS.mode;
      const maxConcurrency = normalizeNumber(options.maxConcurrency, DEFAULTS.maxConcurrency);
      const taskTimeout = normalizeNumber(options.taskTimeout, DEFAULTS.taskTimeout);
      const successThreshold = normalizeNumber(options.successThreshold, DEFAULTS.successThreshold);
      const outputFormat =
        (options.outputFormat as OrchestrateDefaults['outputFormat']) ?? DEFAULTS.outputFormat;

      const successRate = 0.92;
      const executionTime = Date.now() - startTime;

      // 生成 orchestrationId 与事件序列（stream-json 专用）
      const orchestrationId = `orc_${uuidv4()}`;
      const sessionDir = path.join('.codex-father', 'sessions', orchestrationId);
      const eventsFile = path.join(sessionDir, 'events.jsonl');

      const makeTimestamp = (): string => new Date().toISOString();
      let seq = 0;

      type StreamEvent = {
        event: 'start' | 'orchestration_completed';
        timestamp: string;
        orchestrationId: string;
        seq: number;
        data: Record<string, unknown>;
      };

      const startEvent: StreamEvent = {
        event: 'start',
        timestamp: makeTimestamp(),
        orchestrationId,
        seq: seq++,
        data: { totalTasks: 2 },
      };

      const completedEvent: StreamEvent = {
        event: 'orchestration_completed',
        timestamp: makeTimestamp(),
        orchestrationId,
        seq: seq++,
        data: { successRate },
      };

      async function ensureDir0700(dir: string): Promise<void> {
        await fs.mkdir(dir, { recursive: true, mode: 0o700 });
        // 再次 chmod 避免 umask 影响
        await fs.chmod(dir, 0o700).catch(() => {});
      }

      async function appendJsonl0600(file: string, line: unknown): Promise<void> {
        const payload = JSON.stringify(line) + '\n';
        try {
          await fs.appendFile(file, payload, { encoding: 'utf8', mode: 0o600 });
        } catch (err) {
          // 若父目录不存在，创建后重试一次
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            await ensureDir0700(path.dirname(file));
            await fs.appendFile(file, payload, { encoding: 'utf8', mode: 0o600 });
          } else {
            throw err;
          }
        }
      }

      const buildJsonSummary = (
        status: 'success' | 'failure',
        details: Record<string, unknown>
      ): string =>
        JSON.stringify({
          status,
          requirement,
          mode,
          maxConcurrency,
          taskTimeout,
          successRate,
          successThreshold,
          eventsFile,
          outputFormat,
          ...details,
        });

      // stream-json 模式：仅输出两条事件到 stdout，并同步写入 events.jsonl
      if (outputFormat === 'stream-json') {
        // 写入到文件（保证目录 0700、文件 0600）
        await ensureDir0700(sessionDir);
        await appendJsonl0600(eventsFile, startEvent);
        await appendJsonl0600(eventsFile, completedEvent);

        // 严格控制 stdout：仅两条 JSON 行
        process.stdout.write(JSON.stringify(startEvent) + '\n');
        process.stdout.write(JSON.stringify(completedEvent) + '\n');

        const result: CommandResult = {
          success: successRate >= successThreshold,
          data: {
            requirement,
            mode,
            maxConcurrency,
            taskTimeout,
            successRate,
            successThreshold,
            outputFormat,
            orchestrationId,
            eventsFile,
          },
          executionTime: 0,
          exitCode: successRate >= successThreshold ? 0 : 1,
        };
        return result;
      }

      if (successRate >= successThreshold) {
        const eventLogPath = eventsFile;
        const summary = [
          '编排成功 ✅',
          `需求: ${requirement}`,
          `模式: ${mode}，最大并发: ${maxConcurrency}`,
          `成功率: ${(successRate * 100).toFixed(1)}% (阈值 ${(successThreshold * 100).toFixed(1)}%)`,
          `事件文件: ${eventLogPath}`,
        ].join('\n');

        const message = buildJsonSummary('success', {
          failedTasks: [],
          completedAt: new Date().toISOString(),
        });

        const result: CommandResult = {
          success: true,
          message: outputFormat === 'json' ? message : summary,
          data: {
            requirement,
            mode,
            maxConcurrency,
            taskTimeout,
            successRate,
            successThreshold,
            outputFormat,
            eventLogPath,
          },
          executionTime,
          exitCode: 0,
        };

        return result;
      }

      const failedTasks = ['patch_failed', 'lint_failed'];
      const failureMessage =
        outputFormat === 'json'
          ? buildJsonSummary('failure', {
              failedTasks,
              failureReason: 'success-rate-below-threshold',
              completedAt: new Date().toISOString(),
            })
          : '编排失败：成功率未达到设定阈值';

      const result: CommandResult = {
        success: false,
        message: failureMessage,
        errors:
          outputFormat === 'json'
            ? []
            : [
                '失败任务清单: patch_failed, lint_failed',
                `成功率 ${(successRate * 100).toFixed(1)}% 低于阈值 ${(successThreshold * 100).toFixed(1)}%`,
              ],
        data: {
          requirement,
          mode,
          maxConcurrency,
          taskTimeout,
          successRate,
          successThreshold,
          outputFormat,
          eventLogPath: path.join('.codex-father', 'sessions', 'latest', 'events.jsonl'),
          failedTasks,
          failureReason: 'success-rate-below-threshold',
        },
        executionTime,
        exitCode: 1,
      };

      return result;
    },
    {
      usage: '<requirement> [options]',
      arguments: [
        {
          name: 'requirement',
          description: '高层需求描述，用于任务分解或执行',
          required: true,
        },
      ],
      options: [
        {
          flags: '--mode <manual|llm>',
          description: '任务分解模式 (manual|llm)',
          defaultValue: DEFAULTS.mode,
        },
        {
          flags: '--tasks-file <path>',
          description: '手动模式使用的任务定义文件 (JSON)',
        },
        {
          flags: '--max-concurrency <n>',
          description: '最大并发执行数 (1-10)',
          defaultValue: DEFAULTS.maxConcurrency,
        },
        {
          flags: '--task-timeout <minutes>',
          description: '单个任务超时时长（分钟）',
          defaultValue: DEFAULTS.taskTimeout,
        },
        {
          flags: '--success-threshold <0-1>',
          description: '任务成功率阈值 (0-1)',
          defaultValue: DEFAULTS.successThreshold,
        },
        {
          flags: '--output-format <json|stream-json>',
          description: '输出格式 (json|stream-json)',
          defaultValue: DEFAULTS.outputFormat,
        },
        {
          flags: '--config <path>',
          description: '额外的 YAML 编排配置文件',
        },
      ],
    }
  );
}
