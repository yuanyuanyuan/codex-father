export interface RoleRule {
  role: string;
  keywords: string[];
}

export interface RoleAssignerOptions {
  rules: RoleRule[];
  fallback?: {
    type: 'llm';
    invoke: (task: {
      id?: string;
      title?: string;
      description?: string;
    }) => Promise<{ role: string; reasoning?: string }>;
  };
}

export class RoleAssigner {
  private readonly rules: RoleRule[];
  private readonly fallback?: RoleAssignerOptions['fallback'];

  public constructor(options: RoleAssignerOptions) {
    this.rules = options.rules ?? [];
    this.fallback = options.fallback;
  }

  public async assign(task: {
    id?: string;
    title?: string;
    description?: string;
  }): Promise<{ role: string; matchMethod: 'rule' | 'llm'; matchDetails: string }> {
    const text = `${task.title ?? ''} ${task.description ?? ''}`;
    let best: { role: string; keyword: string; length: number } | undefined;
    for (const rule of this.rules) {
      for (const kw of rule.keywords) {
        if (!kw) {
          continue;
        }
        if (text.includes(kw)) {
          const candidate = { role: rule.role, keyword: kw, length: kw.length };
          if (!best || candidate.length > best.length) {
            best = candidate;
          }
        }
      }
    }
    if (best) {
      return {
        role: best.role,
        matchMethod: 'rule',
        matchDetails: `matched keyword: ${best.keyword}`,
      };
    }
    if (this.fallback && this.fallback.type === 'llm') {
      const res = await this.fallback.invoke(task);
      return {
        role: res.role,
        matchMethod: 'llm',
        matchDetails: res.reasoning ?? 'llm fallback',
      };
    }
    return { role: 'developer', matchMethod: 'rule', matchDetails: 'default role' };
  }
}
