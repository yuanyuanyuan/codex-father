import { afterEach, describe, expect, it, vi } from 'vitest';

describe('RoleAssigner rules & fallback contract (T033)', () => {
  const modulePath: string = '../role-assigner.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prioritises longer keyword matches even when a shorter rule appears first', async () => {
    const { RoleAssigner } = await import(modulePath);

    const fallback = vi.fn();
    const assigner = new RoleAssigner({
      rules: [
        { role: 'developer', keywords: ['审查'] },
        { role: 'reviewer', keywords: ['代码审查'] },
      ],
      fallback: { type: 'llm', invoke: fallback },
    });

    const task = {
      id: 't-review',
      title: '代码审查任务',
      description: '进行代码审查，重点关注核心逻辑',
    };

    const result = await assigner.assign(task);

    expect(result.role).toBe('reviewer');
    expect(result.matchMethod).toBe('rule');
    expect(result.matchDetails).toContain('代码审查');
    expect(fallback).not.toHaveBeenCalled();
  });

  it('falls back to LLM when no rules match and records reasoning', async () => {
    const fallback = vi.fn().mockResolvedValue({ role: 'tester', reasoning: '任务强调测试覆盖' });
    const { RoleAssigner } = await import(modulePath);

    const assigner = new RoleAssigner({
      rules: [],
      fallback: { type: 'llm', invoke: fallback },
    });

    const task = {
      id: 't-e2e',
      title: '扩展端到端测试',
      description: '为登录流程补充 E2E 测试用例',
    };

    const result = await assigner.assign(task);

    expect(fallback).toHaveBeenCalledWith(task);
    expect(result.role).toBe('tester');
    expect(result.matchMethod).toBe('llm');
    expect(result.matchDetails).toContain('任务强调测试覆盖');
  });
});
