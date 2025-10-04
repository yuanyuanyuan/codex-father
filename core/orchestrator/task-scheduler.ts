import { createDefaultOrchestratorConfig } from './types.js';
import type { OrchestratorConfig, Task, TaskDefinition, TaskScheduleResult } from './types.js';

interface ExecutionWave {
  readonly wave: number;
  readonly tasks: readonly Task[];
}

type SchedulerResult = TaskScheduleResult & {
  readonly executionPlan: readonly ExecutionWave[];
};

type ScheduleInputObject = {
  readonly tasks: readonly TaskDefinition[];
  readonly dependencies?: Map<string, readonly string[]>;
};

type ScheduleInput = readonly TaskDefinition[] | ScheduleInputObject;
const isScheduleInputObject = (value: ScheduleInput): value is ScheduleInputObject =>
  !Array.isArray(value);

/**
 * TaskScheduler 负责根据依赖图执行拓扑调度喵。
 */
export class TaskScheduler {
  /** 任务调度使用的配置。 */
  private readonly config: OrchestratorConfig;

  /** 原始任务顺序，用于保持稳定排序。 */
  private readonly orderIndex = new Map<string, number>();

  /**
   * 创建任务调度器。
   *
   * @param config 可选调度配置。
   */
  public constructor(config?: Partial<OrchestratorConfig>) {
    this.config = {
      ...createDefaultOrchestratorConfig(),
      ...config,
    } satisfies OrchestratorConfig;
  }

  /**
   * 构建任务依赖图，并确保任务 id 唯一。
   */
  public buildDependencyGraph(tasks: Task[]): Map<string, Task> {
    const graph = new Map<string, Task>();
    this.orderIndex.clear();

    tasks.forEach((task, index) => {
      if (graph.has(task.id)) {
        throw new Error(`Duplicate task id detected: ${task.id}`);
      }
      graph.set(task.id, task);
      this.orderIndex.set(task.id, index);
    });

    return graph;
  }

  /**
   * 使用深度优先搜索检测循环依赖，返回检测到的环路径。
   */
  public detectCycles(
    graph: Map<string, Task>,
    dependencies?: Map<string, readonly string[]>
  ): string[] | null {
    const visitState = new Map<string, 'visiting' | 'visited'>();
    const parent = new Map<string, string>();

    const traceCycle = (start: string, current: string): string[] => {
      const cycle: string[] = [start];
      let cursor = current;
      while (cursor !== start && parent.has(cursor)) {
        cycle.push(cursor);
        cursor = parent.get(cursor)!;
      }
      cycle.push(start);
      cycle.reverse();
      return cycle;
    };

    const dfs = (taskId: string): string[] | null => {
      visitState.set(taskId, 'visiting');
      const task = graph.get(taskId);
      if (!task) {
        return null;
      }

      const dependencyList = dependencies?.get(taskId) ?? task.dependencies ?? [];

      for (const dependencyId of dependencyList) {
        if (!graph.has(dependencyId)) {
          continue;
        }

        const state = visitState.get(dependencyId);
        if (state === 'visiting') {
          return traceCycle(dependencyId, taskId);
        }

        if (state === 'visited') {
          continue;
        }

        parent.set(dependencyId, taskId);
        const cycle = dfs(dependencyId);
        if (cycle) {
          return cycle;
        }
      }

      visitState.set(taskId, 'visited');
      return null;
    };

    for (const taskId of graph.keys()) {
      if (visitState.has(taskId)) {
        continue;
      }
      const cycle = dfs(taskId);
      if (cycle) {
        return cycle;
      }
    }

    return null;
  }

  /**
   * 基于拓扑排序输出每一波可并行执行的任务列表。
   */
  public scheduleInWaves(tasks: Task[], dependencies?: Map<string, readonly string[]>): Task[][] {
    const graph = this.buildDependencyGraph(tasks);
    const cycle = this.detectCycles(graph, dependencies);
    if (cycle) {
      throw new Error(`Circular dependency detected: ${cycle.join(' -> ')}`);
    }

    const indegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const task of tasks) {
      indegree.set(task.id, 0);
      adjacency.set(task.id, []);
    }

    for (const task of tasks) {
      const deps = dependencies?.get(task.id) ?? task.dependencies ?? [];
      for (const dependencyId of deps) {
        if (!graph.has(dependencyId)) {
          throw new Error(`Unknown dependency "${dependencyId}" for task ${task.id}`);
        }
        indegree.set(task.id, (indegree.get(task.id) ?? 0) + 1);
        adjacency.get(dependencyId)!.push(task.id);
      }
    }

    const remaining = new Set(graph.keys());
    const waves: Task[][] = [];

    while (remaining.size > 0) {
      const readyTaskIds = Array.from(remaining).filter(
        (taskId) => (indegree.get(taskId) ?? 0) === 0
      );

      if (readyTaskIds.length === 0) {
        throw new Error('Circular dependency detected');
      }

      readyTaskIds.sort((left, right) => {
        const leftIndex = this.orderIndex.get(left) ?? 0;
        const rightIndex = this.orderIndex.get(right) ?? 0;
        if (leftIndex !== rightIndex) {
          return leftIndex - rightIndex;
        }
        return left.localeCompare(right);
      });

      const waveTasks = readyTaskIds.map((taskId) => graph.get(taskId)!);
      waves.push(waveTasks);

      for (const task of waveTasks) {
        remaining.delete(task.id);
        for (const successorId of adjacency.get(task.id) ?? []) {
          indegree.set(successorId, (indegree.get(successorId) ?? 1) - 1);
        }
      }
    }

    return waves;
  }

  /**
   * 为缺少超时配置的任务应用默认超时。
   */
  public applyDefaultTimeouts(tasks: Task[], defaultTimeout: number): Task[] {
    return tasks.map((task) => {
      if (typeof task.timeout === 'number' && Number.isFinite(task.timeout)) {
        return task;
      }
      return {
        ...task,
        timeout: defaultTimeout,
      };
    });
  }

  /**
   * 综合调度入口，输出第一波任务及完整执行计划。
   */
  public schedule(input: ScheduleInput): SchedulerResult {
    const normalizedInput: ScheduleInputObject = isScheduleInputObject(input)
      ? {
          tasks: input.tasks,
          ...(input.dependencies !== undefined ? { dependencies: input.dependencies } : {}),
        }
      : { tasks: input };

    const { tasks, dependencies } = normalizedInput;
    const clonedTasks = tasks.map((task) => ({ ...task })) as Task[];
    const normalizedTasks = this.applyDefaultTimeouts(clonedTasks, this.config.taskTimeout);
    const waves = this.scheduleInWaves(normalizedTasks, dependencies);

    const firstWave = waves[0] ?? [];
    const scheduledTasks = firstWave.slice(0, this.config.maxConcurrency);
    const throttled = firstWave.length > scheduledTasks.length || waves.length > 1;

    const executionPlan: ExecutionWave[] = waves.map((waveTasks, index) => ({
      wave: index,
      tasks: waveTasks,
    }));

    return {
      scheduledTasks,
      throttled,
      executionPlan,
    };
  }
}
