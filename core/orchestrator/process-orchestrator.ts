import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { spawn } from 'node:child_process';
import * as fsp from 'node:fs/promises';
import { createDefaultOrchestratorConfig } from './types.js';
import { TaskScheduler } from './task-scheduler.js';
import { TaskDecomposer } from './task-decomposer.js';
import { UnderstandingCheck } from './understanding-check.js';
import type { UnderstandingCheckOptions } from './understanding-check.js';
import type {
  Agent,
  OrchestratorConfig,
  OrchestratorContext,
  OrchestratorStateSnapshot,
  RoleConfiguration,
  TaskDefinition,
} from './types.js';

const MAX_POOL_SIZE = 10;
const HEALTH_INACTIVE_THRESHOLD_MS = 60_000;

type StateManagerLike = {
  emitEvent?: (payload: {
    event: string;
    taskId?: string;
    role?: string;
    data?: unknown;
  }) => unknown | Promise<unknown>;
  update?: (payload: Partial<OrchestratorStateSnapshot>) => OrchestratorStateSnapshot;
};

type ResourceMonitorLike = {
  captureSnapshot: () => { cpuUsage?: number; memoryUsage?: number; timestamp?: number };
};

type ProcessOrchestratorOptions = Partial<OrchestratorConfig> & {
  stateManager?: StateManagerLike;
  resourceMonitor?: ResourceMonitorLike;
  taskTimeoutMs?: number;
  resourceThresholds?: { cpuHighWatermark?: number };
  manualIntervention?: { enabled?: boolean; requireAck?: boolean; ack?: boolean };
  /**
   * 可选的理解一致性评估函数注入点（用于测试或外部实现）。
   * 若未提供且 orchestrate 未传入 requirement/restatement，将跳过理解检查。
   */
  understandingEvaluator?: (input: {
    requirement: string;
    restatement: string;
  }) => Promise<{ consistent: boolean; issues: string[] }>;
  /**
   * 可选的理解门控（集中式配置）：当提供 requirement + restatement + evaluateConsistency 时，
   * orchestrate() 会在任务分解之前先执行理解一致性校验。
   */
  understanding?: {
    requirement: string;
    restatement: string;
    evaluateConsistency: UnderstandingCheckOptions['evaluateConsistency'];
  };
  /**
   * 可选：会话根目录（.codex-father/sessions/<id>）。若提供，将在 orchestrate() 起始阶段
   * 预创建 `<sessionDir>/patches/` 与 `<sessionDir>/workspaces/`，并在创建 Agent 时将
   * workDir 指向 `<sessionDir>/workspaces/agent_<n>`。
   */
  sessionDir?: string;
};

/** 定义 spawnAgent 结果。 */
export interface SpawnAgentResult {
  readonly agent: Agent;
  readonly reused: boolean;
}

/**
 * ProcessOrchestrator 负责管理 Agent 子进程池喵。
 */
export class ProcessOrchestrator {
  /** 当前编排器配置。 */
  public readonly config: OrchestratorConfig;

  /** Agent 进程池。 */
  private readonly agentPool: Map<string, Agent> = new Map();

  /** 池容量上限（不超过 10）。 */
  private readonly maxPoolSize: number;
  /** 当前可用并发池大小（可随资源压力动态调整）。 */
  private currentPoolSize: number;

  /** 状态管理器事件发射器。 */
  private readonly stateManager: StateManagerLike | undefined;

  /** 自增进程号，模拟 codex exec 的 PID。 */
  private processIdCounter = 1000;
  private cancelled = false;
  private cancelledAt: number | undefined;
  private lastFailureReason: string | undefined;
  /** 资源监控器（可注入）。 */
  public readonly resourceMonitor: ResourceMonitorLike;
  /** 任务超时时间（毫秒，可注入）。 */
  private readonly taskTimeoutMs?: number;

  /** 资源阈值（可注入）。 */
  private readonly resourceThresholds?: { cpuHighWatermark?: number };
  /** 人工干预配置（可注入）。 */
  private readonly manualIntervention?: { enabled?: boolean; requireAck?: boolean; ack?: boolean };
  /** 理解检查评估器（可注入）。 */
  private readonly understandingEvaluator?: (input: {
    requirement: string;
    restatement: string;
  }) => Promise<{ consistent: boolean; issues: string[] }>;
  /** 理解门控（集中式配置）。 */
  private readonly understanding?: {
    requirement: string;
    restatement: string;
    evaluateConsistency: UnderstandingCheckOptions['evaluateConsistency'];
  };
  /** 会话根目录（若提供则在创建 Agent 时使用）。 */
  private readonly sessionDir?: string;
  /** 递增的 agent 下标，用于构造 workspaces/agent_<n> 目录。 */
  private agentSequence = 0;
  /** 当前编排运行统计，用于计算成功率与失败清单。 */
  private runStats: {
    total: number;
    completed: number;
    failed: number;
    failedTaskIds: string[];
  } = {
    total: 0,
    completed: 0,
    failed: 0,
    failedTaskIds: [],
  };

  public constructor(config?: ProcessOrchestratorOptions) {
    const baseConfig = createDefaultOrchestratorConfig();
    const {
      stateManager,
      resourceMonitor,
      taskTimeoutMs,
      resourceThresholds,
      manualIntervention,
      understandingEvaluator,
      understanding,
      sessionDir,
      ...configOverrides
    } = config ?? {};

    this.config = {
      ...baseConfig,
      ...configOverrides,
      roles: {
        ...baseConfig.roles,
        ...(configOverrides.roles ?? {}),
      },
      codexCommand: configOverrides.codexCommand ?? baseConfig.codexCommand,
    } satisfies OrchestratorConfig;
    this.maxPoolSize = Math.max(1, Math.min(this.config.maxConcurrency, MAX_POOL_SIZE));
    this.currentPoolSize = this.maxPoolSize;
    this.stateManager = stateManager;
    this.resourceMonitor =
      resourceMonitor ??
      ({
        captureSnapshot: () => ({ cpuUsage: 0, memoryUsage: 0, timestamp: Date.now() }),
      } as ResourceMonitorLike);
    if (typeof taskTimeoutMs === 'number') {
      this.taskTimeoutMs = taskTimeoutMs;
    }
    if (resourceThresholds) {
      this.resourceThresholds = resourceThresholds;
    }
    if (manualIntervention) {
      this.manualIntervention = manualIntervention;
    }
    if (understandingEvaluator) {
      this.understandingEvaluator = understandingEvaluator;
    }
    if (understanding) {
      this.understanding = understanding;
    }
    if (typeof sessionDir === 'string' && sessionDir.trim()) {
      this.sessionDir = sessionDir.trim();
    }
  }

  /**
   * 兼容旧流程，构建最小上下文。
   */
  public createContext(tasks: readonly TaskDefinition[]): OrchestratorContext {
    return {
      config: this.config,
      tasks: [...tasks],
    } satisfies OrchestratorContext;
  }

  /**
   * 编排入口：集成 TaskScheduler，按拓扑波次顺序执行任务。
   *
   * - 每一波的并发量不超过进程池上限；
   * - 每个任务都会调用 spawnAgent（同角色空闲可复用）；
   * - 模拟任务执行完成后将 Agent 状态复位为 idle；
   * - 在 start/task_started/task_completed 波次阶段触发占位事件。
   */
  public async orchestrate(
    tasks: readonly TaskDefinition[],
    opts?: { requirement?: string; restatement?: string }
  ): Promise<OrchestratorContext> {
    const context = this.createContext(tasks);
    this.cancelled = false;
    this.cancelledAt = undefined;
    this.lastFailureReason = undefined;
    this.runStats = {
      total: tasks.length,
      completed: 0,
      failed: 0,
      failedTaskIds: [],
    };

    if (typeof this.stateManager?.update === 'function') {
      try {
        this.stateManager.update({
          status: 'running',
          startedAt: Date.now(),
          completedTasks: 0,
          failedTasks: 0,
        });
      } catch {
        // ignore state update failure
      }
    }

    // 人工干预门控：在任何理解/分解/调度动作之前执行
    if (this.manualIntervention?.enabled) {
      const needAck = !!this.manualIntervention.requireAck;
      const ack = !!this.manualIntervention.ack;
      if (needAck && !ack) {
        await this.emitEvent({
          event: 'manual_intervention_requested',
          data: { reason: 'manual_gate', requireAck: true },
        });
        await this.emitEvent({
          event: 'orchestration_failed',
          data: { reason: 'manual_cancelled' },
        });
        throw new Error('manual intervention required');
      }
    }

    // 在任务分解前进行「理解一致性」门控（集中式配置 understanding）
    if (
      this.understanding &&
      typeof this.understanding.requirement === 'string' &&
      this.understanding.requirement.trim() &&
      typeof this.understanding.restatement === 'string' &&
      this.understanding.restatement.trim() &&
      typeof this.understanding.evaluateConsistency === 'function'
    ) {
      try {
        const checker = new UnderstandingCheck({
          evaluateConsistency: this.understanding.evaluateConsistency,
        });
        await checker.validate({
          requirement: this.understanding.requirement.trim(),
          restatement: this.understanding.restatement.trim(),
        });
        await this.emitEvent({ event: 'understanding_validated' });
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'understanding_inconsistent';
        await this.emitEvent({
          event: 'understanding_failed',
          data: { reason: 'understanding_invalid', detail },
        });
        await this.emitEvent({
          event: 'orchestration_failed',
          data: { reason: 'understanding_invalid', detail },
        });
        return this.finalizeContext(context);
      }
    }

    // 在调度前进行任务分解有效性校验（T045 最小集成）
    try {
      const decomposer = new TaskDecomposer();
      // 最小实现：视为已分解，仅进行拓扑/重复校验
      decomposer.validate(tasks as ReadonlyArray<{ id: string; dependencies?: string[] }>);
      // 成功时发出分解完成事件，供上层观测
      await this.emitEvent({
        event: 'decomposition_completed',
        data: { tasksCount: tasks.length },
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'decomposition_failed';
      // 仅写入 JSONL 审计：分解失败 + 终止
      await this.emitEvent({
        event: 'decomposition_failed',
        data: { reason: 'decomposition_invalid', detail: reason },
      });
      await this.emitEvent({
        event: 'orchestration_failed',
        data: { reason: 'decomposition_invalid', detail: reason },
      });
      return this.finalizeContext(context);
    }

    if (tasks.length === 0) {
      return this.finalizeContext(context);
    }

    // 在调度前新增「理解一致性」门（T049） - 兼容旧签名（opts + understandingEvaluator）
    if (
      opts &&
      typeof opts.requirement === 'string' &&
      opts.requirement.trim() &&
      typeof opts.restatement === 'string' &&
      opts.restatement.trim() &&
      typeof this.understandingEvaluator === 'function'
    ) {
      try {
        const checker = new UnderstandingCheck({
          evaluateConsistency: this.understandingEvaluator,
        });
        await checker.validate({
          requirement: opts.requirement.trim(),
          restatement: opts.restatement.trim(),
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : 'understanding_inconsistent';
        await this.emitEvent({
          event: 'understanding_failed',
          data: { reason, stage: 'pre_scheduling' },
        });
        await this.emitEvent({
          event: 'orchestration_failed',
          data: { reason: 'understanding_invalid', detail: reason },
        });
        return this.finalizeContext(context);
      }
    }

    // 如提供会话目录，预创建 patches 目录与 workspaces 根（0700）
    if (this.sessionDir) {
      try {
        await fsp.mkdir(path.join(this.sessionDir, 'patches'), { recursive: true, mode: 0o700 });
        await fsp.mkdir(path.join(this.sessionDir, 'workspaces'), { recursive: true, mode: 0o700 });
      } catch {
        // 目录创建失败不阻断流程
      }
    }

    const scheduler = new TaskScheduler(this.config);
    const schedule = scheduler.schedule(tasks as TaskDefinition[]);
    const executionPlan = schedule.executionPlan ?? [];

    for (const wavePlan of executionPlan) {
      if (this.cancelled) {
        break;
      }
      const waveIndex = wavePlan.wave;
      const waveTasks = wavePlan.tasks ?? [];
      if (waveTasks.length === 0) {
        continue;
      }

      await this.emitWaveEvent('start', {
        wave: waveIndex,
        tasks: waveTasks,
      });

      const batches = this.chunkByPoolSize(waveTasks, this.currentPoolSize);
      for (const batch of batches) {
        await Promise.all(batch.map((task) => this.runTaskWithRetry(task, waveIndex)));
      }
    }

    return this.finalizeContext(context);
  }

  private async runTaskWithRetry(task: TaskDefinition, waveIndex: number): Promise<void> {
    const configuredMaxAttempts = this.config.retryPolicy?.maxAttempts ?? 2;
    const maxAttempts = Math.max(Math.min(configuredMaxAttempts, 5), 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const spawnResult = await this.spawnAgent(task);

      await this.emitWaveEvent('task_started', {
        wave: waveIndex,
        task,
        agent: spawnResult.agent,
        reused: spawnResult.reused,
        attempt,
      });

      const success = await this.executeTask(task);

      const idleAgent = this.markAgentIdle(spawnResult.agent);

      if (success) {
        this.runStats.completed += 1;
        await this.emitWaveEvent('task_completed', {
          wave: waveIndex,
          task,
          agent: idleAgent,
          reused: spawnResult.reused,
          attempt,
        });
        return;
      }

      await this.emitWaveEvent('task_failed', {
        wave: waveIndex,
        task,
        agent: idleAgent,
        reused: spawnResult.reused,
        attempt,
        willRetry: attempt < maxAttempts,
      });

      // 若仍可重试，则调度下一次尝试（T021）：指数回退，并发出 task_retry_scheduled（仅 JSONL）。
      if (attempt < maxAttempts) {
        const policy = this.config.retryPolicy ?? {
          maxAttempts: 2,
          backoff: 'exponential',
          initialDelayMs: 10,
          maxDelayMs: 1000,
        };
        const initial = Math.max(0, Number(policy.initialDelayMs ?? 10));
        const cap = Math.max(initial, Number(policy.maxDelayMs ?? 1000));
        const exp = Math.max(0, attempt - 1);
        const nextDelay = Math.min(policy.backoff === 'fixed' ? initial : initial * 2 ** exp, cap);

        const retryEvent: { event: string; taskId?: string; role?: string; data?: unknown } = {
          event: 'task_retry_scheduled',
          taskId: task.id,
          data: { nextAttempt: attempt + 1, delayMs: nextDelay },
        };
        if (typeof task.role === 'string') {
          retryEvent.role = task.role;
        }
        await this.emitEvent(retryEvent);

        // 测试环境不进行真实等待，以保证用例快速；否则进行轻量延迟。
        const waitMs = process.env.ORCHESTRATOR_TESTS ? 0 : nextDelay;
        if (waitMs > 0) {
          await new Promise((r) => setTimeout(r, waitMs));
        } else {
          await Promise.resolve();
        }
      }
    }

    this.runStats.failed += 1;
    this.runStats.failedTaskIds.push(task.id);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async executeTask(task: TaskDefinition): Promise<boolean> {
    await Promise.resolve();

    const role = typeof task.role === 'string' ? task.role : 'developer';
    const sequence = this.runStats.completed + this.runStats.failed + 1;
    const patchFileName = `patch_${sequence.toString().padStart(3, '0')}.diff`;

    const meta = this.decodeExecutionMeta(task.roleMatchDetails);
    const command = meta.command ?? `codex exec --task ${task.id}`;
    const logSnippet = meta.logSnippet ?? 'execution completed';
    const simulateFailure = meta.simulateFailure === true;

    const firstWorkspaceAgent = [...this.agentPool.values()].find((agent) =>
      agent.workDir?.includes('/workspaces/agent_')
    );
    const baseDir = firstWorkspaceAgent?.sessionDir || this.sessionDir;
    if (!baseDir) {
      return true;
    }

    const patchesDir = path.join(baseDir, 'patches');
    const patchPath = path.join(patchesDir, patchFileName);
    const sessionDir = baseDir;

    try {
      await fsp.mkdir(patchesDir, { recursive: true, mode: 0o700 });
      const content = `# patch for ${task.id}\n# role: ${role}\n`; // placeholder content
      await fsp.writeFile(patchPath, content, { encoding: 'utf-8', mode: 0o600 });
      await this.emitEvent({
        event: 'patch_generated',
        taskId: task.id,
        role,
        data: { patchPath },
      });
      await this.emitEvent({
        event: 'task_execution_summary',
        taskId: task.id,
        role,
        data: { command, logSnippet },
      });
      await this.emitEvent({
        event: 'quick_validate_passed',
        taskId: task.id,
        role,
        data: { summary: 'synthetic patch placeholder' },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      await this.emitEvent({
        event: 'patch_generation_failed',
        taskId: task.id,
        role,
        data: { error: reason },
      });
      this.runStats.failed += 1;
      this.runStats.failedTaskIds.push(task.id);
      return false;
    }

    if (simulateFailure) {
      return false;
    }

    await this.emitEvent({
      event: 'session_workspace_updated',
      taskId: task.id,
      role,
      data: { sessionDir },
    });

    return true;
  }

  private decodeExecutionMeta(details?: string): {
    command?: string;
    logSnippet?: string;
    simulateFailure?: boolean;
  } {
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
  }

  /**
   * 注册 SIGINT 处理器（可选）。测试可直接调用 requestCancel() 触发相同行为。
   */
  public registerSignalHandlers(graceMs: number = 60_000): void {
    // 避免重复注册
    const handler: () => Promise<void> = async () => {
      await this.requestCancel(graceMs);
    };
    (process as NodeJS.Process).on('SIGINT', handler);
  }

  /**
   * 触发取消：广播 cancel_requested → 等待 grace → 终止活跃 agent → 清空池 → orchestration_failed。
   */
  public async requestCancel(graceMs: number = 60_000): Promise<void> {
    if (this.cancelled) {
      return;
    }
    this.cancelled = true;

    this.cancelledAt = Date.now();
    if (typeof this.stateManager?.update === 'function') {
      try {
        this.stateManager.update({
          status: 'cancelled',
          cancelledAt: this.cancelledAt,
          lastCancellationReason: 'manual',
          completedTasks: this.runStats.completed,
          failedTasks: this.runStats.failed,
        });
      } catch {
        // state update failure should not block cancel flow
      }
    }

    this.lastFailureReason = 'cancelled';

    await this.emitEvent({ event: 'cancel_requested', data: { graceMs } });

    const deadline = Date.now() + Math.max(0, graceMs);
    // 轻量等待：若仍有 busy agent，给出一点时间（最多 graceMs）
    // 这里不强制事件循环占用，测试场景快速通过
    while (this.activeAgents.length > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 10));
      break; // 最小实现：一次 tick 后进入清理
    }

    // 统一将所有 agent 标记为终止并清空池
    for (const agent of this.agentPool.values()) {
      agent.status = 'terminated';
      agent.currentTask = undefined;
      agent.lastActivityAt = new Date().toISOString();
    }
    this.agentPool.clear();

    await this.emitEvent({ event: 'orchestration_failed', data: { reason: 'cancelled' } });
  }

  private markAgentIdle(agent: Agent): Agent {
    const tracked = this.agentPool.get(agent.id) ?? agent;
    const updated: Agent = {
      ...tracked,
      status: 'idle',
      currentTask: undefined,
      lastActivityAt: new Date().toISOString(),
    };
    this.agentPool.set(updated.id, updated);
    return updated;
  }

  private chunkByPoolSize<T>(items: readonly T[], size: number): T[][] {
    const limit = Math.max(1, size);
    const batches: T[][] = [];
    for (let index = 0; index < items.length; index += limit) {
      batches.push(items.slice(index, index + limit));
    }
    return batches;
  }

  /** removed duplicate emitWaveEvent definition (see below) */
  /** 当前空闲 Agent 数量。 */
  public get idleAgents(): Agent[] {
    return [...this.agentPool.values()].filter((agent) => agent.status === 'idle');
  }

  /** 当前活跃 Agent 数量。 */
  public get activeAgents(): Agent[] {
    return [...this.agentPool.values()].filter((agent) => agent.status === 'busy');
  }

  /**
   * 启动或重用 Agent 处理任务，超出池容量时抛错。
   */
  public async spawnAgent(task: TaskDefinition): Promise<SpawnAgentResult> {
    const roleName = typeof task.role === 'string' ? task.role : '';
    const roleConfig = this.resolveRoleConfiguration(roleName);

    const reusableAgent = this.findReusableAgent(roleName);
    if (reusableAgent) {
      const assigned = this.assignTask(reusableAgent, task.id);
      return { agent: assigned, reused: true };
    }

    if (this.agentPool.size >= this.maxPoolSize) {
      throw new Error(`Agent pool exhausted (max ${this.maxPoolSize})`);
    }

    const agent = this.createAgent(task);
    try {
      await fsp.mkdir(agent.sessionDir, { recursive: true, mode: 0o700 });
      await fsp.mkdir(path.join(agent.sessionDir, 'patches'), { recursive: true, mode: 0o700 });
      await fsp.mkdir(agent.workDir, { recursive: true, mode: 0o700 });
    } catch {
      // 忽略目录创建错误以避免影响主流程
    }
    this.agentPool.set(agent.id, agent);

    this.launchCodexAgent(agent, roleConfig);
    return { agent, reused: false };
  }

  /**
   * 手动释放 Agent，将其置为 idle（用于模拟任务完成与测试）。
   */
  public releaseAgent(agentId: string): void {
    const agent = this.agentPool.get(agentId);
    if (!agent) {
      return;
    }
    this.markAgentIdle(agent);
  }

  /**
   * 对 Agent 进行轻量健康检查。
   */
  public async healthCheck(agent: Agent): Promise<boolean> {
    const tracked = this.agentPool.get(agent.id);
    if (!tracked) {
      return false;
    }

    if (tracked.status === 'terminated' || tracked.status === 'crashed') {
      return false;
    }

    const lastActivity = Date.parse(tracked.lastActivityAt);
    if (Number.isNaN(lastActivity)) {
      tracked.status = 'crashed';
      return false;
    }

    const isResponsive = Date.now() - lastActivity <= HEALTH_INACTIVE_THRESHOLD_MS;
    if (!isResponsive) {
      tracked.status = 'crashed';
    }

    return isResponsive;
  }

  /**
   * 优雅关闭所有 Agent，等待至多 gracePeriodMs。
   */
  public async shutdown(gracePeriodMs: number = 60_000): Promise<void> {
    const deadline = Date.now() + Math.max(gracePeriodMs, 0);

    for (const agent of this.agentPool.values()) {
      if (agent.status === 'terminated') {
        continue;
      }

      if (agent.status === 'busy') {
        const remaining = deadline - Date.now();
        if (remaining > 0) {
          await new Promise((resolve) => setTimeout(resolve, Math.min(remaining, 50)));
        }
      }

      agent.status = 'terminated';
      agent.currentTask = undefined;
      agent.lastActivityAt = new Date().toISOString();
    }

    this.agentPool.clear();
  }

  private findReusableAgent(role: string): Agent | undefined {
    for (const agent of this.agentPool.values()) {
      if (agent.status === 'idle' && agent.role === role) {
        return agent;
      }
    }
    return undefined;
  }

  private assignTask(agent: Agent, taskId: string): Agent {
    const now = new Date().toISOString();
    const updated: Agent = {
      ...agent,
      status: 'busy',
      currentTask: taskId,
      lastActivityAt: now,
    };
    this.agentPool.set(updated.id, updated);
    return updated;
  }

  private createAgent(task: TaskDefinition): Agent {
    const agentId = `agent_${randomUUID()}`;
    const nowIso = new Date().toISOString();
    const cwd = process.cwd();
    // 会话目录采用优先注入的 sessionDir；否则回退到每 agent 独立目录
    const sessionDir = this.sessionDir ?? path.join(cwd, '.codex-father', 'sessions', agentId);
    // 为该 Agent 准备独立工作目录：<sessionDir>/workspaces/agent_<n>
    this.agentSequence += 1;
    const workDir = path.join(sessionDir, 'workspaces', `agent_${this.agentSequence}`);
    // 尝试创建必要目录（不抛出阻断异常）
    const ensureDirs = async (): Promise<void> => {
      try {
        await fsp.mkdir(sessionDir, { recursive: true, mode: 0o700 });
        await fsp.mkdir(path.join(sessionDir, 'patches'), { recursive: true, mode: 0o700 });
        await fsp.mkdir(workDir, { recursive: true, mode: 0o700 });
      } catch {
        // 忽略
      }
    };
    void ensureDirs();

    return {
      id: agentId,
      role: task.role,
      status: 'busy',
      processId: this.allocateProcessId(),
      currentTask: task.id,
      startedAt: nowIso,
      lastActivityAt: nowIso,
      workDir,
      sessionDir,
    } satisfies Agent;
  }

  private allocateProcessId(): number {
    this.processIdCounter += 1;
    return this.processIdCounter;
  }

  private resolveRoleConfiguration(role: string): RoleConfiguration {
    if (!role) {
      throw new Error('Task role is required to spawn agent');
    }

    const roleConfig = this.config.roles?.[role];
    if (!roleConfig) {
      throw new Error(`Role configuration missing for "${role}"`);
    }

    if (!Array.isArray(roleConfig.allowedTools) || roleConfig.allowedTools.length === 0) {
      throw new Error(`Role "${role}" must define at least one allowed tool`);
    }

    if (!roleConfig.permissionMode) {
      throw new Error(`Role "${role}" must define a permission mode`);
    }

    if (!roleConfig.sandbox) {
      throw new Error(`Role "${role}" must define a sandbox mode`);
    }

    return roleConfig;
  }

  private launchCodexAgent(agent: Agent, roleConfig: RoleConfiguration): void {
    const args: string[] = [
      'exec',
      '--session-dir',
      agent.sessionDir,
      '--ask-for-approval',
      roleConfig.permissionMode,
      '--sandbox',
      roleConfig.sandbox,
      '--allowed-tools',
      roleConfig.allowedTools.join(','),
    ];

    try {
      // 非阻塞启动；测试将通过 vi.mock 拦截 spawn 并断言参数
      spawn(this.config.codexCommand, args, { stdio: 'ignore' }).on('error', () => void 0);
    } catch {
      // 忽略权限参数拼装中的非关键异常，避免影响现有流程
    }
  }

  /**
   * 统一波次事件封装：将与波次相关的任务/代理信息打平到 data 字段。
   */
  private async emitWaveEvent(
    event: 'start' | 'task_started' | 'task_completed' | 'task_failed',
    payload: {
      wave: number;
      task?: TaskDefinition;
      tasks?: readonly TaskDefinition[];
      agent?: Agent;
      reused?: boolean;
      attempt?: number;
      willRetry?: boolean;
    }
  ): Promise<void> {
    if (typeof this.stateManager?.emitEvent !== 'function') {
      return;
    }

    const role = typeof payload.task?.role === 'string' ? payload.task.role : undefined;
    const data: Record<string, unknown> = { wave: payload.wave };
    if (payload.tasks) {
      data.tasks = payload.tasks.map((t) => t.id);
    }
    if (payload.agent) {
      data.agentId = payload.agent.id;
    }
    if (payload.reused !== undefined) {
      data.reused = payload.reused;
    }
    if (payload.attempt !== undefined) {
      data.attempt = payload.attempt;
    }
    if (payload.willRetry !== undefined) {
      data.retry = payload.willRetry;
    }

    const base: { event: string; data?: unknown } = { event, data };
    const eventPayload: { event: string; taskId?: string; role?: string; data?: unknown } = base;
    if (payload.task?.id) {
      eventPayload.taskId = payload.task.id;
    }
    if (role) {
      eventPayload.role = role;
    }
    await Promise.resolve(this.stateManager.emitEvent(eventPayload));
  }

  /** 通用事件发射封装（非波次专用）。 */
  private async emitEvent(payload: {
    event: string;
    taskId?: string;
    role?: string;
    data?: unknown;
  }): Promise<void> {
    if (typeof this.stateManager?.emitEvent === 'function') {
      await Promise.resolve(this.stateManager.emitEvent(payload));
    }
    if (payload.event === 'orchestration_failed') {
      const raw = payload.data as Record<string, unknown> | undefined;
      const reason = raw && typeof raw.reason === 'string' ? raw.reason : undefined;
      this.lastFailureReason = reason ?? 'unknown_failure';
    } else if (payload.event === 'orchestration_completed') {
      this.lastFailureReason = undefined;
    }
  }

  private finalizeContext(base: OrchestratorContext): OrchestratorContext {
    const stats = this.summarizeStats();
    if (typeof this.stateManager?.update === 'function') {
      try {
        const status = this.cancelled
          ? 'cancelled'
          : this.lastFailureReason || stats.failedTasks > 0
            ? 'failed'
            : 'completed';
        const now = Date.now();
        let patch: Partial<OrchestratorStateSnapshot> = {
          status,
          completedTasks: stats.completedTasks,
          failedTasks: stats.failedTasks,
        };
        if (status === 'completed') {
          patch = { ...patch, completedAt: now };
        } else if (status === 'failed') {
          patch = {
            ...patch,
            completedAt: now,
            ...(this.lastFailureReason ? { lastError: this.lastFailureReason } : {}),
          };
        } else if (status === 'cancelled') {
          patch = {
            ...patch,
            cancelledAt: this.cancelledAt ?? now,
            lastCancellationReason: this.lastFailureReason ?? 'cancelled',
          };
        }
        this.stateManager.update(patch);
      } catch {
        // 状态写入失败不影响主流程
      }
    }
    return { ...base, stats } satisfies OrchestratorContext;
  }

  private summarizeStats(): {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    successRate: number;
    failedTaskIds: readonly string[];
  } {
    const { total, completed, failed, failedTaskIds } = this.runStats;
    const successRate = total > 0 ? completed / total : failed > 0 ? 0 : 1;
    return {
      totalTasks: total,
      completedTasks: completed,
      failedTasks: failed,
      successRate,
      failedTaskIds: [...failedTaskIds],
    };
  }

  /**
   * 恢复先前的 Codex 会话（非阻塞）。
   */
  public async resumeSession(opts: { rolloutPath: string; requirement?: string }): Promise<void> {
    const rolloutPath = opts?.rolloutPath?.trim();
    if (!rolloutPath) {
      throw new Error('rolloutPath is required');
    }

    const args: string[] = [
      'exec',
      'resume',
      rolloutPath,
      '--sandbox',
      'workspace-write',
      '--ask-for-approval',
      'never',
    ];

    try {
      spawn(this.config.codexCommand, args, { stdio: 'ignore' }).on('error', () => void 0);
    } catch {
      // 忽略非关键异常（例如环境不支持 spawn），与现有风格一致
    }
  }

  /**
   * 处理资源压力与任务超时。
   */
  public async handleResourcePressure(ctx: {
    activeTasks: Array<{ id: string; startedAt: number }>;
  }): Promise<void> {
    const cpuHighWatermark: number =
      (this as unknown as { config?: { resourceThresholds?: { cpuHighWatermark?: number } } })
        ?.config?.resourceThresholds?.cpuHighWatermark ??
      this.resourceThresholds?.cpuHighWatermark ??
      0.9;

    const taskTimeoutMs: number =
      this.taskTimeoutMs ??
      (this as unknown as { config?: { taskTimeoutMs?: number; taskTimeout?: number } })?.config
        ?.taskTimeoutMs ??
      this.config.taskTimeout ??
      30 * 60 * 1000;

    const snapshot = this.resourceMonitor.captureSnapshot();
    if (typeof snapshot?.cpuUsage === 'number') {
      // 简化滞回策略：高于上限则降一档，低于 (上限-0.2) 则升一档
      const previous = this.currentPoolSize;
      if (snapshot.cpuUsage > cpuHighWatermark && this.currentPoolSize > 1) {
        this.currentPoolSize = Math.max(1, this.currentPoolSize - 1);
        const recordedAt =
          typeof snapshot.timestamp === 'number'
            ? new Date(snapshot.timestamp).toISOString()
            : new Date().toISOString();
        await Promise.resolve(
          this.stateManager?.emitEvent?.({
            event: 'resource_downscale',
            data: {
              from: previous,
              to: this.currentPoolSize,
              metric: 'cpu',
              usage: snapshot.cpuUsage,
              threshold: cpuHighWatermark,
              recordedAt,
            },
          })
        );
        await Promise.resolve(
          this.stateManager?.emitEvent?.({
            event: 'concurrency_reduced',
            data: { reason: 'resource_exhausted', from: previous, to: this.currentPoolSize },
          })
        );
      } else if (
        snapshot.cpuUsage < Math.max(0, cpuHighWatermark - 0.2) &&
        this.currentPoolSize < this.maxPoolSize
      ) {
        this.currentPoolSize = Math.min(this.maxPoolSize, this.currentPoolSize + 1);
        const recordedAt =
          typeof snapshot.timestamp === 'number'
            ? new Date(snapshot.timestamp).toISOString()
            : new Date().toISOString();
        await Promise.resolve(
          this.stateManager?.emitEvent?.({
            event: 'resource_restore',
            data: {
              from: previous,
              to: this.currentPoolSize,
              metric: 'cpu',
              usage: snapshot.cpuUsage,
              threshold: cpuHighWatermark,
              recordedAt,
            },
          })
        );
        await Promise.resolve(
          this.stateManager?.emitEvent?.({
            event: 'concurrency_increased',
            data: { reason: 'recovered', from: previous, to: this.currentPoolSize },
          })
        );
      }
    }

    const now = Date.now();
    for (const t of ctx?.activeTasks ?? []) {
      const startedAt = typeof t.startedAt === 'number' ? t.startedAt : Number.NaN;
      if (Number.isFinite(startedAt) && now - startedAt > taskTimeoutMs) {
        await Promise.resolve(
          this.stateManager?.emitEvent?.({
            event: 'task_failed',
            taskId: t.id,
            data: { reason: 'timeout' },
          })
        );
      }
    }
  }
}
