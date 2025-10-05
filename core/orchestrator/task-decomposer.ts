export interface DecomposeInput {
  requirement: string;
  mode: 'manual' | 'llm';
  manualTasks?: Array<{
    id: string;
    title?: string;
    description?: string;
    role?: string;
    dependencies?: string[];
    priority?: number;
  }>;
}

export interface DecomposeResult {
  readonly tasks: readonly {
    id: string;
    title?: string;
    description?: string;
    role?: string;
    dependencies?: string[];
    priority?: number;
  }[];
  readonly dependencies: ReadonlyMap<string, readonly string[]>;
}

type CodexInvoker = (input: { requirement: string; mode: 'llm'; structured?: boolean }) => Promise<{
  content: string;
  usage?: { tokens?: number };
}>;

export class TaskDecomposer {
  private readonly codexInvoker: CodexInvoker | undefined;

  public constructor(options?: { codexInvoker?: CodexInvoker }) {
    this.codexInvoker = options?.codexInvoker;
  }

  public async decompose(input: DecomposeInput): Promise<DecomposeResult> {
    if (input.mode === 'manual') {
      const tasks = (input.manualTasks ?? []).map((t) => ({
        ...t,
        dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
      }));
      this.assertUniqueIds(tasks.map((t) => t.id));
      const deps = this.buildDependencyMap(tasks);
      this.assertNoCycles(
        tasks.map((t) => t.id),
        deps
      );
      return { tasks, dependencies: deps };
    }

    // LLM mode
    if (!this.codexInvoker) {
      throw new Error('LLM mode requires codexInvoker');
    }
    const res = await this.codexInvoker({
      requirement: input.requirement,
      mode: 'llm',
      structured: true,
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(res.content);
    } catch {
      throw new Error('Failed to parse structured JSON response');
    }
    const obj = parsed as {
      tasks?: Array<{
        id: string;
        title?: string;
        description?: string;
        role?: string;
        dependencies?: string[];
        priority?: number;
      }>;
      dependencies?: Record<string, string[]>;
    };
    if (!obj || !Array.isArray(obj.tasks)) {
      throw new Error('Missing structured tasks in JSON response');
    }
    const tasks = obj.tasks.map((t) => ({
      ...t,
      dependencies: Array.isArray(t.dependencies) ? t.dependencies : [],
    }));
    const map = new Map<string, string[]>();
    if (obj.dependencies && typeof obj.dependencies === 'object') {
      for (const [k, v] of Object.entries(obj.dependencies)) {
        map.set(k, Array.isArray(v) ? v.slice() : []);
      }
    } else {
      // fallback: derive from tasks
      for (const t of tasks) {
        map.set(t.id, t.dependencies ?? []);
      }
    }
    this.assertUniqueIds(tasks.map((t) => t.id));
    this.assertNoCycles(
      tasks.map((t) => t.id),
      map
    );
    return { tasks, dependencies: map };
  }

  private assertUniqueIds(ids: readonly string[]): void {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) {
        throw new Error(`duplicate id: ${id}`);
      }
      seen.add(id);
    }
  }

  private buildDependencyMap(
    tasks: readonly { id: string; dependencies?: string[] }[]
  ): Map<string, string[]> {
    const set = new Set(tasks.map((t) => t.id));
    const map = new Map<string, string[]>();
    for (const t of tasks) {
      const deps = (t.dependencies ?? []).filter((d) => set.has(d));
      map.set(t.id, deps);
    }
    return map;
  }

  private assertNoCycles(
    ids: readonly string[],
    deps: ReadonlyMap<string, readonly string[]>
  ): void {
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const adj = (id: string): readonly string[] => deps.get(id) ?? [];
    const dfs = (u: string): boolean => {
      if (visiting.has(u)) {
        return true;
      }
      if (visited.has(u)) {
        return false;
      }
      visiting.add(u);
      for (const v of adj(u)) {
        if (dfs(v)) {
          return true;
        }
      }
      visiting.delete(u);
      visited.add(u);
      return false;
    };
    for (const id of ids) {
      if (dfs(id)) {
        throw new Error('dependency cycle detected / 发现循环依赖');
      }
    }
  }
}
