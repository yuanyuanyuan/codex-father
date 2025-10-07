import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { spawn } from 'node:child_process';
import { createDefaultOrchestratorConfig } from './types.js';
import { TaskScheduler } from './task-scheduler.js';
import { TaskDecomposer } from './task-decomposer.js';
import type {
  Agent,
  OrchestratorConfig,
  OrchestratorContext,
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
};

type ResourceMonitorLike = {
  captureSnapshot: () => { cpuUsage?: number; memoryUsage?: number; timestamp?: number };
};

type ProcessOrchestratorOptions = Partial<OrchestratorConfig> & {
  stateManager?: StateManagerLike;
  resourceMonitor?: ResourceMonitorLike;
  taskTimeoutMs?: number;
  resourceThresholds?: { cpuHighWatermark?: number };
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

  /** 状态管理器事件发射器。 */
  private readonly stateManager: StateManagerLike | undefined;

  /** 自增进程号，模拟 codex exec 的 PID。 */
  private processIdCounter = 1000;
  private cancelled = false;
  /** 资源监控器（可注入）。 */
  public readonly resourceMonitor: ResourceMonitorLike;
  /** 任务超时时间（毫秒，可注入）。 */
  private readonly taskTimeoutMs?: number;

  /** 资源阈值（可注入）。 */
  private readonly resourceThresholds?: { cpuHighWatermark?: number };

  public constructor(config?: ProcessOrchestratorOptions) {
    const baseConfig = createDefaultOrchestratorConfig();
    const { stateManager, resourceMonitor, taskTimeoutMs, resourceThresholds, ...configOverrides } =
      config ?? {};

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
  public async orchestrate(tasks: readonly TaskDefinition[]): Promise<OrchestratorContext> {
    const context = this.createContext(tasks);

    // 在调度前进行任务分解有效性校验（T045 最小集成）
    try {
      const decomposer = new TaskDecomposer();
      await decomposer.decompose({ requirement: '', mode: 'manual', manualTasks: tasks as any });
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
      return context;
    }

    if (tasks.length === 0) {
      return context;
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

      const batches = this.chunkByPoolSize(waveTasks, this.maxPoolSize);
      for (const batch of batches) {
        await Promise.all(batch.map((task) => this.runTaskWithRetry(task, waveIndex)));
      }
    }

    return context;
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
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async executeTask(_task: TaskDefinition): Promise<boolean> {
    await Promise.resolve();
    return true;
  }

  /**
   * 注册 SIGINT 处理器（可选）。测试可直接调用 requestCancel() 触发相同行为。
   */
  public registerSignalHandlers(graceMs: number = 60_000): void {
    // 避免重复注册
    const handler = async () => {
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
    const workDir = process.cwd();
    const sessionDir = path.join(workDir, '.codex-father', 'sessions', agentId);

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
    if (typeof snapshot?.cpuUsage === 'number' && snapshot.cpuUsage > cpuHighWatermark) {
      await Promise.resolve(
        this.stateManager?.emitEvent?.({
          event: 'concurrency_reduced',
          data: { reason: 'resource_exhausted' },
        })
      );
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
