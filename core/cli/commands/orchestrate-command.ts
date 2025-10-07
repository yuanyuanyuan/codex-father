import type { CLIParser } from '../parser.js';
import type { CommandResult } from '../../lib/types.js';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getConfig } from '../config-loader.js';
import { ProcessOrchestrator } from '../../orchestrator/process-orchestrator.js';
import { TaskDecomposer } from '../../orchestrator/task-decomposer.js';
import { EventLogger } from '../../session/event-logger.js';
import { StateManager } from '../../orchestrator/state-manager.js';
import { DEFAULT_REDACTION_PATTERNS } from '../../lib/security/redaction.js';
import type {
  OrchestrationRunStats,
  OrchestratorContext,
  TaskDefinition,
} from '../../orchestrator/types.js';

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

interface ManualTaskInput {
  id: string;
  title?: string;
  description?: string;
  role?: string;
  dependencies?: string[];
  priority?: number;
  mutation?: boolean;
  timeout?: number;
  timeoutMs?: number;
  roleMatchDetails?: string;
  command?: string;
  logSnippet?: string;
  simulateFailure?: boolean;
}

const ensureNonEmptyString = (value: unknown, message: string): string => {
  const str = typeof value === 'string' ? value.trim() : '';
  if (!str) {
    throw new Error(message);
  }
  return str;
};

const coerceDependencyList = (input: unknown): string[] => {
  if (!Array.isArray(input)) {
    return [];
  }
  const unique = new Set<string>();
  for (const item of input) {
    if (typeof item === 'string' && item.trim()) {
      unique.add(item.trim());
    }
  }
  return Array.from(unique);
};

async function loadManualTasksFromFile(
  filePath: string,
  options: { defaultTimeoutMs: number }
): Promise<TaskDefinition[]> {
  const absolutePath = path.resolve(filePath);
  let rawContent: string;
  try {
    rawContent = await fs.readFile(absolutePath, 'utf-8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`无法读取任务文件 ${absolutePath}: ${reason}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch (error) {
    throw new Error(
      `任务文件 ${absolutePath} 不是有效的 JSON：${error instanceof Error ? error.message : error}`
    );
  }

  const arrayCandidate = Array.isArray(parsed)
    ? (parsed as ManualTaskInput[])
    : Array.isArray((parsed as { tasks?: ManualTaskInput[] })?.tasks)
      ? (parsed as { tasks: ManualTaskInput[] }).tasks
      : null;

  if (!arrayCandidate || arrayCandidate.length === 0) {
    throw new Error('任务文件需提供非空任务数组，格式为 [ {...} ] 或 { "tasks": [ ... ] }');
  }

  const decomposer = new TaskDecomposer();
  decomposer.validate(
    arrayCandidate.map((task) => ({
      id: ensureNonEmptyString(task.id, '任务缺少 id'),
      dependencies: coerceDependencyList(task.dependencies),
    }))
  );

  const now = Date.now();
  const defaultTimeoutMs = Math.max(1, Math.round(options.defaultTimeoutMs));

  const tasks: TaskDefinition[] = arrayCandidate.map((task, index) => {
    const id = ensureNonEmptyString(task.id, `任务索引 ${index} 缺少 id`);
    const description = ensureNonEmptyString(task.description, `任务 ${id} 需提供 description`);
    const role = typeof task.role === 'string' && task.role.trim() ? task.role.trim() : 'developer';
    const dependencies = coerceDependencyList(task.dependencies);
    const priority = Number.isFinite(task.priority) ? Math.trunc(task.priority as number) : 0;
    const mutation = task.mutation === true;
    let timeoutMs = defaultTimeoutMs;
    if (typeof task.timeoutMs === 'number' && Number.isFinite(task.timeoutMs)) {
      timeoutMs = Math.max(1, Math.trunc(task.timeoutMs));
    } else if (typeof task.timeout === 'number' && Number.isFinite(task.timeout)) {
      timeoutMs = Math.max(1, Math.trunc(task.timeout * 60_000));
    }

    const executionMeta = {
      source: 'manual',
      command:
        typeof task.command === 'string' && task.command.trim() ? task.command.trim() : undefined,
      logSnippet:
        typeof task.logSnippet === 'string' && task.logSnippet.trim()
          ? task.logSnippet.trim()
          : undefined,
      simulateFailure: task.simulateFailure === true,
    };

    const createdAt = new Date(now + index).toISOString();

    const normalized: TaskDefinition = {
      id,
      title: typeof task.title === 'string' ? task.title : undefined,
      description,
      role,
      mutation,
      roleMatchMethod: 'rule',
      roleMatchDetails:
        typeof task.roleMatchDetails === 'string' && task.roleMatchDetails.trim()
          ? task.roleMatchDetails.trim()
          : JSON.stringify(executionMeta),
      status: 'pending',
      dependencies,
      priority,
      timeout: timeoutMs,
      createdAt,
      outputs: [],
    } as TaskDefinition;

    return normalized;
  });

  decomposer.validate(tasks.map((task) => ({ id: task.id, dependencies: task.dependencies })));

  return tasks;
}

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
      let projectConfig: import('../../lib/types.js').ProjectConfig | undefined;
      try {
        const configOptions = configFile ? { configFile } : undefined;
        projectConfig = await getConfig(configOptions);
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

      // 2) resume 模式：若提供 --resume <rolloutPath>，调用 orchestrator.resumeSession 并快速返回成功结果
      const rolloutPath = typeof options.resume === 'string' ? options.resume.trim() : '';
      if (rolloutPath) {
        try {
          const orchestrator = new ProcessOrchestrator({});
          await orchestrator.resumeSession({ rolloutPath, requirement });
          const executionTime = Date.now() - startTime;
          const result: CommandResult = {
            success: true,
            message: `已触发会话恢复: ${rolloutPath}`,
            executionTime,
            exitCode: 0,
          };
          return result;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          const result: CommandResult = {
            success: false,
            message: `会话恢复触发失败: ${msg}`,
            errors: [msg],
            executionTime: Date.now() - startTime,
            exitCode: 4,
          };
          return result;
        }
      }

      // 3) 准备任务并执行编排
      const orchestrationId = `orc_${uuidv4()}`;
      const sessionDir = path.resolve('.codex-father', 'sessions', orchestrationId);
      const eventsFile = path.join(sessionDir, 'events.jsonl');

      // 使用 StateManager + EventLogger 统一写入 JSONL（0600）并保留脱敏管线
      const redactionEnabled = projectConfig?.security?.redactSensitiveData !== false;
      const redactionPatterns = redactionEnabled ? DEFAULT_REDACTION_PATTERNS : [];
      const eventLogger = new EventLogger({
        logDir: sessionDir,
        asyncWrite: false,
        validateEvents: false, // 记录器为通用 JSONL；结构校验由上层契约测试覆盖
        redactionPatterns,
        redactSensitiveData: redactionEnabled,
      });
      // 根据配置启用默认脱敏模式集合（T052）：覆盖常见密钥/口令/令牌与 OpenAI sk- 格式
      // 通过轻量桥接适配 StateManager 的事件记录器接口，避免 any
      const bridgeLogger = {
        logEvent: (record: Record<string, unknown>): Promise<unknown> => {
          // 将通用记录转为应用事件模型的最小子集，跳过二次校验以提升性能
          // 使用 unknown 再断言为 Event 子集，避免显式 any
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          return eventLogger.logEvent(
            record as unknown as import('../../lib/types.js').Event,
            {
              skipValidation: true,
            } as import('../../session/event-logger.js').LogEventOptions
          ) as Promise<unknown>;
        },
      } satisfies {
        logEvent: (record: Record<string, unknown>) => unknown | Promise<unknown>;
      };

      const stateManager = new StateManager({
        orchestrationId,
        eventLogger: bridgeLogger,
        redactionPatterns: Array.from(redactionPatterns),
      });

      const taskTimeoutMs = taskTimeout * 60_000;

      let tasks: TaskDefinition[] = [];
      try {
        if (mode === 'manual') {
          const tasksFile = typeof options.tasksFile === 'string' ? options.tasksFile.trim() : '';
          if (!tasksFile) {
            throw new Error('manual 模式需要提供 --tasks-file <path>');
          }
          tasks = await loadManualTasksFromFile(tasksFile, { defaultTimeoutMs: taskTimeoutMs });
        } else {
          throw new Error('LLM 模式尚未实现，请使用 --mode manual 并提供 --tasks-file');
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        const result: CommandResult = {
          success: false,
          message: `任务准备失败：${msg}`,
          errors: [msg],
          executionTime: Date.now() - startTime,
          exitCode: 5,
        };
        return result;
      }

      const tasksTotal = tasks.length;

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

      await stateManager.emitEvent({ event: startEvent.event, data: startEvent.data });

      const orchestrator = new ProcessOrchestrator({
        maxConcurrency,
        taskTimeout: taskTimeoutMs,
        outputFormat,
        successRateThreshold: successThreshold,
        mode,
        stateManager,
        sessionDir,
      });

      let ctx: OrchestratorContext | undefined;
      let orchestrationError: string | null = null;
      try {
        ctx = await orchestrator.orchestrate(tasks);
      } catch (error) {
        orchestrationError = error instanceof Error ? error.message : String(error);
      }

      const executionTime = Date.now() - startTime;

      const fallbackStats = {
        totalTasks: tasksTotal,
        completedTasks: orchestrationError ? 0 : tasksTotal,
        failedTasks: orchestrationError ? tasksTotal : 0,
        successRate: orchestrationError
          ? 0
          : tasksTotal === 0
            ? 1
            : (ctx?.tasks?.length ?? tasksTotal) / tasksTotal,
        failedTaskIds: orchestrationError ? tasks.map((task) => task.id) : [],
      } satisfies OrchestrationRunStats;

      const stats = ctx?.stats ?? fallbackStats;
      const successRate = stats.successRate;
      const failedTaskIds = Array.isArray(stats.failedTaskIds) ? stats.failedTaskIds : [];
      const meetsThreshold = successRate >= successThreshold;
      const isSuccess = !orchestrationError && meetsThreshold;

      const taskMap = new Map(tasks.map((task) => [task.id, task] as const));
      const failedTaskDetails = failedTaskIds.map((taskId) => {
        const task = taskMap.get(taskId);
        const meta = decodeExecutionMeta(task?.roleMatchDetails);
        return {
          id: taskId,
          role: task?.role,
          description: task?.description,
          command: meta.command,
          logSnippet: meta.logSnippet,
        };
      });

      const remediationSuggestions = failedTaskDetails.length
        ? failedTaskDetails.map(
            ({ id, role, command, logSnippet }) =>
              `复查任务 ${id}${role ? `（角色 ${role}）` : ''}，重跑命令 ${
                command ?? 'codex exec'
              } 并根据日志 ${logSnippet ?? '（无日志）'} 修复。`
          )
        : [];

      const reportPath = path.join(sessionDir, 'report.json');
      const reportPayload: Record<string, unknown> = {
        orchestrationId,
        requirement,
        mode,
        maxConcurrency,
        taskTimeoutMinutes: taskTimeout,
        successRate,
        successThreshold,
        status: isSuccess ? 'succeeded' : 'failed',
        totalTasks: stats.totalTasks,
        completedTasks: stats.completedTasks,
        failedTasks: stats.failedTasks,
        failedTaskIds,
        failedTaskDetails,
        remediationSuggestions,
        eventsFile,
        generatedAt: new Date().toISOString(),
        executionTimeMs: executionTime,
      };
      if (orchestrationError) {
        reportPayload.error = orchestrationError;
      }
      const failureReason = orchestrationError
        ? 'orchestration-error'
        : 'success-rate-below-threshold';
      if (!isSuccess) {
        reportPayload.failureReason = failureReason;
      }

      let reportWriteError: string | null = null;
      try {
        await fs.mkdir(sessionDir, { recursive: true, mode: 0o700 });
        await fs.writeFile(reportPath, JSON.stringify(reportPayload, null, 2), {
          encoding: 'utf-8',
          mode: 0o600,
        });
        await stateManager.emitEvent({ event: 'report_written', data: { reportPath } });
      } catch (error) {
        reportWriteError = error instanceof Error ? error.message : String(error);
        await stateManager.emitEvent({
          event: 'report_write_failed',
          data: { reportPath, error: reportWriteError },
        });
      }

      const completedEventData: Record<string, unknown> = {
        status: isSuccess ? 'succeeded' : 'failed',
        successRate,
        completedTasks: stats.completedTasks,
        failedTasks: stats.failedTasks,
      };
      if (failedTaskIds.length > 0) {
        completedEventData.failedTaskIds = failedTaskIds;
      }
      if (orchestrationError) {
        completedEventData.error = orchestrationError;
      }
      if (!reportWriteError) {
        completedEventData.reportPath = reportPath;
      }
      if (reportWriteError) {
        completedEventData.reportWriteError = reportWriteError;
      }

      await stateManager.emitEvent({ event: 'orchestration_completed', data: completedEventData });

      const completedEvent: StreamEvent = {
        event: 'orchestration_completed',
        timestamp: makeTimestamp(),
        orchestrationId,
        seq: seq++,
        data: completedEventData,
      };

      if (outputFormat === 'stream-json') {
        process.stdout.write(JSON.stringify(startEvent) + '\n');
        process.stdout.write(JSON.stringify(completedEvent) + '\n');
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
          outputFormat,
          orchestrationId,
          eventsFile,
          reportPath,
          reportWriteError,
          completedTasks: stats.completedTasks,
          failedTaskIds,
          failedTaskDetails,
          remediationSuggestions,
          ...details,
        });

      const baseData = {
        requirement,
        mode,
        maxConcurrency,
        taskTimeout,
        successRate,
        successThreshold,
        outputFormat,
        orchestrationId,
        eventsFile,
        eventLogPath: eventsFile,
        reportPath,
        reportWriteError,
        totalTasks: stats.totalTasks,
        completedTasks: stats.completedTasks,
        failedTaskIds,
        failedTaskDetails,
        remediationSuggestions,
      } as const;

      if (isSuccess) {
        const summary = [
          '编排成功 ✅',
          `需求: ${requirement}`,
          `模式: ${mode}，最大并发: ${maxConcurrency}`,
          `成功率: ${(successRate * 100).toFixed(1)}% (阈值 ${(successThreshold * 100).toFixed(1)}%)`,
          `任务: 已完成 ${stats.completedTasks}/${stats.totalTasks}`,
          `事件文件: ${eventsFile}`,
          `报告: ${reportPath}${reportWriteError ? ' (写入失败)' : ''}`,
        ].join('\n');

        const message = buildJsonSummary('success', {
          completedAt: new Date().toISOString(),
          reportWriteError,
        });

        const result: CommandResult = {
          success: true,
          message: outputFormat === 'json' ? message : summary,
          data: baseData,
          executionTime,
          exitCode: 0,
        };
        return result;
      }

      const failureLines = [
        '编排失败 ❌',
        `需求: ${requirement}`,
        orchestrationError
          ? `原因: ${orchestrationError}`
          : `成功率 ${(successRate * 100).toFixed(1)}% 低于阈值 ${(successThreshold * 100).toFixed(1)}%`,
        `任务: 已完成 ${stats.completedTasks}/${stats.totalTasks}`,
        `事件文件: ${eventsFile}`,
        `报告: ${reportPath}${reportWriteError ? ' (写入失败)' : ''}`,
      ];
      if (!orchestrationError && failedTaskIds.length > 0) {
        failureLines.splice(3, 0, `失败任务: ${failedTaskIds.join(', ')}`);
      }
      if (remediationSuggestions.length > 0) {
        failureLines.push('建议:');
        remediationSuggestions.forEach((suggestion) => failureLines.push(`- ${suggestion}`));
      }

      const failureDetails: Record<string, unknown> = {
        failureReason,
        completedAt: new Date().toISOString(),
        reportPath,
        reportWriteError,
        remediationSuggestions,
      };
      if (orchestrationError) {
        failureDetails.error = orchestrationError;
      }
      if (failedTaskIds.length > 0) {
        failureDetails.failedTaskIds = failedTaskIds;
      }

      const failureMessage =
        outputFormat === 'json'
          ? buildJsonSummary('failure', failureDetails)
          : failureLines.join('\n');

      const result: CommandResult = {
        success: false,
        message: failureMessage,
        errors:
          outputFormat === 'json'
            ? orchestrationError
              ? [orchestrationError]
              : []
            : orchestrationError
              ? [orchestrationError]
              : failedTaskIds.length > 0
                ? [`失败任务: ${failedTaskIds.join(', ')}`]
                : [
                    `成功率 ${(successRate * 100).toFixed(1)}% 低于阈值 ${(successThreshold * 100).toFixed(1)}%`,
                  ],
        data: {
          ...baseData,
          failureReason,
        },
        executionTime,
        exitCode: orchestrationError ? 3 : 1,
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
        {
          flags: '--resume <path>',
          description: '恢复 Codex 会话：rollout/state 路径',
        },
      ],
    }
  );
}

export function registerOrchestrateReportCommand(parser: CLIParser): void {
  parser.registerCommand(
    'orchestrate:report',
    '查看或导出编排报告摘要',
    async (context) => {
      const executionStart = Date.now();
      const options = context.options ?? {};
      const explicitPath = typeof options.path === 'string' ? options.path.trim() : '';
      const sessionId = typeof options.sessionId === 'string' ? options.sessionId.trim() : '';

      let reportPath = explicitPath ? path.resolve(explicitPath) : '';
      if (!reportPath && sessionId) {
        reportPath = path.resolve('.codex-father', 'sessions', sessionId, 'report.json');
      }

      if (!reportPath) {
        const message = '请通过 --path <report.json> 或 --session-id <id> 指定报告位置';
        return {
          success: false,
          message,
          errors: [message],
          executionTime: Date.now() - executionStart,
          exitCode: 2,
        } satisfies CommandResult;
      }

      let reportRaw: string;
      try {
        reportRaw = await fs.readFile(reportPath, 'utf-8');
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const message = `无法读取报告文件: ${reason}`;
        return {
          success: false,
          message,
          errors: [message],
          executionTime: Date.now() - executionStart,
          exitCode: 3,
        } satisfies CommandResult;
      }

      let report: Record<string, unknown>;
      try {
        const parsed = JSON.parse(reportRaw);
        report = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const message = `报告文件不是有效的 JSON：${reason}`;
        return {
          success: false,
          message,
          errors: [message],
          executionTime: Date.now() - executionStart,
          exitCode: 4,
        } satisfies CommandResult;
      }

      const status = String(report.status ?? 'unknown');
      const successRate = typeof report.successRate === 'number' ? report.successRate : undefined;
      const completed =
        typeof report.completedTasks === 'number' ? report.completedTasks : undefined;
      const total = typeof report.totalTasks === 'number' ? report.totalTasks : undefined;
      const failedTasks = Array.isArray(report.failedTaskIds)
        ? (report.failedTaskIds as string[])
        : [];
      const remediation = Array.isArray(report.remediationSuggestions)
        ? (report.remediationSuggestions as string[])
        : [];
      const eventsFile = typeof report.eventsFile === 'string' ? report.eventsFile : undefined;

      const summaryLines = [
        `报告: ${reportPath}`,
        `状态: ${status}`,
        typeof successRate === 'number'
          ? `成功率: ${(successRate * 100).toFixed(1)}%`
          : '成功率: 未提供',
        total !== undefined && completed !== undefined
          ? `任务: 已完成 ${completed}/${total}`
          : '任务: 未提供',
      ];
      summaryLines.push(eventsFile ? `事件日志: ${eventsFile}` : '事件日志: 未提供');
      if (failedTasks.length > 0) {
        summaryLines.push(`失败任务: ${failedTasks.join(', ')}`);
      }
      if (remediation.length > 0) {
        summaryLines.push('整改建议:');
        remediation.forEach((item) => summaryLines.push(`- ${item}`));
      }

      const summary = summaryLines.join('\n');

      const result: CommandResult = {
        success: true,
        data: {
          report,
          reportPath,
          eventsFile,
        },
        executionTime: Date.now() - executionStart,
        exitCode: 0,
      };

      if (!context.json) {
        result.message = summary;
      }

      return result;
    },
    {
      options: [
        { flags: '--path <path>', description: '报告文件路径，默认读取生成的 report.json' },
        {
          flags: '--session-id <id>',
          description: '使用会话 ID 推导报告路径（.codex-father/sessions/<id>/report.json）',
        },
      ],
    }
  );
}
const decodeExecutionMeta = (
  details?: string
): { command?: string; logSnippet?: string; simulateFailure?: boolean } => {
  if (!details || typeof details !== 'string') {
    return {};
  }
  try {
    const parsed = JSON.parse(details);
    if (parsed && typeof parsed === 'object' && parsed.source === 'manual') {
      return {
        command: typeof parsed.command === 'string' ? parsed.command : undefined,
        logSnippet: typeof parsed.logSnippet === 'string' ? parsed.logSnippet : undefined,
        simulateFailure: parsed.simulateFailure === true,
      };
    }
  } catch {}
  return {};
};
