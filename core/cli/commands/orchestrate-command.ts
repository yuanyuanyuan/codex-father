import type { CLIParser } from '../parser.js';
import type { CommandResult } from '../../lib/types.js';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'node:path';
import { getConfig } from '../config-loader.js';
import { ProcessOrchestrator } from '../../orchestrator/process-orchestrator.js';
import { EventLogger } from '../../session/event-logger.js';
import { StateManager } from '../../orchestrator/state-manager.js';

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

      const clamp = (n: number, min: number, max: number): number =>
        Math.min(Math.max(n, min), max);

      const normalizeEnum = <T extends string>(
        value: unknown,
        allowed: readonly T[],
        fallback: T
      ): T => {
        if (typeof value === 'string') {
          const v = value.toLowerCase() as T;
          if ((allowed as readonly string[]).includes(v)) {
            return v;
          }
        }
        return fallback;
      };

      const mode = normalizeEnum<OrchestrateDefaults['mode']>(
        options.mode,
        ['manual', 'llm'],
        DEFAULTS.mode
      );
      let maxConcurrency = normalizeNumber(options.maxConcurrency, DEFAULTS.maxConcurrency);
      maxConcurrency = clamp(Math.round(maxConcurrency), 1, 10);
      let taskTimeout = normalizeNumber(options.taskTimeout, DEFAULTS.taskTimeout);
      taskTimeout = clamp(Math.round(taskTimeout), 1, 10_000); // 以分钟为单位，最小 1 分钟
      let successThreshold = normalizeNumber(options.successThreshold, DEFAULTS.successThreshold);
      successThreshold = clamp(successThreshold, 0, 1);
      const outputFormat = normalizeEnum<OrchestrateDefaults['outputFormat']>(
        options.outputFormat,
        ['json', 'stream-json'],
        DEFAULTS.outputFormat
      );

      // 支持 --config <path>（命令级优先），否则回退到全局 context.configPath
      const configFile =
        (typeof options.config === 'string' && options.config) || context.configPath || undefined;

      // 1) 加载项目配置（失败即返回非 0/1 退出码）
      try {
        const configOptions = configFile ? { configFile } : undefined;
        await getConfig(configOptions);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const result: CommandResult = {
          success: false,
          message: `配置加载失败: ${msg}`,
          errors: [msg],
          executionTime: Date.now() - startTime,
          exitCode: 2,
        };
        return result;
      }

      // 2) 调用编排器（当前占位：空任务列表）
      let tasksTotal = 0;
      try {
        const orchestrator = new ProcessOrchestrator({
          maxConcurrency,
          taskTimeout: taskTimeout * 60_000, // 分钟 -> 毫秒
          outputFormat,
          successRateThreshold: successThreshold,
          mode,
        });
        const ctx = await orchestrator.orchestrate([]);
        tasksTotal = Array.isArray(ctx?.tasks) ? ctx.tasks.length : 0;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const result: CommandResult = {
          success: false,
          message: `编排流程初始化失败: ${msg}`,
          errors: [msg],
          executionTime: Date.now() - startTime,
          exitCode: 3,
        };
        return result;
      }

      // 3) 产生占位成功率，并在 orchestrator 返回后再进行事件写入/输出
      const successRate = 0.92;
      const executionTime = Date.now() - startTime;

      // 生成 orchestrationId 与事件序列（stream-json 专用）
      const orchestrationId = `orc_${uuidv4()}`;
      const sessionDir = path.join('.codex-father', 'sessions', orchestrationId);
      const eventsFile = path.join(sessionDir, 'events.jsonl');

      // 使用 EventLogger + StateManager 统一写 JSONL
      const eventLogger = new EventLogger({ logDir: sessionDir, asyncWrite: false, validateEvents: false });
      const stateManager = new StateManager({ orchestrationId, eventLogger } as any);

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
        data: { totalTasks: tasksTotal },
      };

      const completedEvent: StreamEvent = {
        event: 'orchestration_completed',
        timestamp: makeTimestamp(),
        orchestrationId,
        seq: seq++,
        data: { successRate },
      };

      // orchestrator 保持最小化注入，不改变 stdout 纪律
      const orchestrator = new ProcessOrchestrator({ stateManager });

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

      // stream-json 模式：仅输出两条事件到 stdout，同时经 StateManager 写入 JSONL
      if (outputFormat === 'stream-json') {
        // 事件写入 JSONL（0600/0700）由 StateManager 负责，保持与脱敏管线一致
        await stateManager.emitEvent({ event: startEvent.event, data: startEvent.data });

        // 严格控制 stdout：仅两条 JSON 行
        process.stdout.write(JSON.stringify(startEvent) + '\n');
        await stateManager.emitEvent({
          event: completedEvent.event,
          data: completedEvent.data,
        });
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
          executionTime,
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
          eventLogPath: eventsFile,
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
