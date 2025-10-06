import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { spawn } from 'node:child_process';
import { createDefaultOrchestratorConfig } from './types.js';
import { TaskScheduler } from './task-scheduler.js';
import type {
  Agent,
  OrchestratorConfig,
  OrchestratorContext,
  RoleConfiguration,
  TaskDefinition,
  Task,
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

type ProcessOrchestratorOptions = Partial<OrchestratorConfig> & {
  stateManager?: StateManagerLike;
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

  public constructor(config?: ProcessOrchestratorOptions) {
    const baseConfig = createDefaultOrchestratorConfig();
    const { stateManager, ...configOverrides } = config ?? {};

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
   * 编排入口：集成 TaskScheduler，按拓扑波次（waves）执行任务。
   * - 每一波内的并发数不超过 maxPoolSize；
   * - 为每个任务启动或复用 Agent；
   * - 任务“模拟完成”后将 Agent 状态还原为 idle；
   * - 在 start/task_started/task_completed 波次级别触发占位事件。
   */
  public async orchestrate(tasks: readonly TaskDefinition[]): Promise<OrchestratorContext> {
    // 使用 TaskScheduler 进行拓扑分波，并按波次顺序调度执行。
    const scheduler = new TaskScheduler(this.config);

    // 构造依赖关系（按任务上声明的 dependencies）
    const deps = new Map<string, string[]>();
    for (const t of tasks) {
      deps.set(t.id, Array.isArray(t.dependencies) ? [...t.dependencies] : []);
    }

    const waves = scheduler.scheduleInWaves(tasks.map((t) => ({ ...t })) as Task[], deps);

    for (let waveIndex = 0; waveIndex < waves.length; waveIndex += 1) {
      // 每个波次开始事件
      await this.emitEvent({ event: 'start', data: { wave: waveIndex } });
      const wave = { tasks: waves[waveIndex]! };
      // 分块执行，确保单波并发不超过 maxPoolSize
      for (let i = 0; i < wave.tasks.length; i += this.maxPoolSize) {
        const batch = wave.tasks.slice(i, i + this.maxPoolSize);

        // 启动一批任务，内含最小重试逻辑；保持每波并发不超过上限
        await Promise.all(batch.map(async (t) => this.runWithRetry(t, waveIndex)));
      }
    }

    return this.createContext(tasks);
  }

  /**
   * 运行单个任务，包含最小重试；每次尝试都会 spawn + 执行 + release。
   */
  private async runWithRetry(task: TaskDefinition, waveIndex: number): Promise<void> {
    const maxAttempts = Math.max(Math.min(this.config.retryPolicy?.maxAttempts ?? 2, 5), 1);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const res = await this.spawnAgent(task);
      await this.emitEvent({
        event: 'task_started',
        taskId: task.id,
        role: String(task.role),
        data: { wave: waveIndex, reused: res.reused, attempt },
      });

      // 占位执行：允许测试通过 spy executeTask 控制成功/失败
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const ok = await this.executeTask(task);

      this.releaseAgent(res.agent.id);
      if (ok) {
        await this.emitEvent({
          event: 'task_completed',
          taskId: task.id,
          role: String(task.role),
          data: { wave: waveIndex, agentId: res.agent.id, attempt },
        });
        return;
      }

      await this.emitEvent({
        event: 'task_failed',
        taskId: task.id,
        role: String(task.role),
        data: { wave: waveIndex, agentId: res.agent.id, attempt, retry: attempt < maxAttempts },
      });
      // 简化：不引入真实 backoff 延迟，保证测试快速
    }
  }

  /**
   * 任务执行占位实现：默认成功。测试可通过 (orchestrator as any).executeTask = vi.fn(...)
   * 覆盖以模拟失败与重试。
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async executeTask(_task: TaskDefinition): Promise<boolean> {
    return true;
  }

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
    this.agentPool.set(agentId, {
      ...agent,
      status: 'idle',
      currentTask: undefined,
      lastActivityAt: new Date().toISOString(),
    });
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
   * 统一占位事件发射器：若构造参数中提供了 stateManager，则调用其 emitEvent；否则 no-op。
   */
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
}
