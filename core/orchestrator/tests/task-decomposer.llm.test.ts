import { afterEach, describe, expect, it, vi } from 'vitest';

describe('TaskDecomposer LLM mode contract (T032)', () => {
  const modulePath: string = '../task-decomposer.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses structured Codex response into tasks with dependencies', async () => {
    const codexInvoker = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        tasks: [
          {
            id: 'plan-design',
            title: '规划设计',
            description: '分析需求并输出初始设计',
            role: 'planner',
            dependencies: [],
          },
          {
            id: 'implement-feature',
            title: '实现功能',
            description: '完成核心业务代码',
            role: 'developer',
            dependencies: ['plan-design'],
          },
        ],
        dependencies: {
          'implement-feature': ['plan-design'],
        },
      }),
      usage: { tokens: 1024 },
    });

    const { TaskDecomposer } = await import(modulePath);

    const decomposer = new TaskDecomposer({ codexInvoker } as any);

    const result = await decomposer.decompose({
      requirement: '实现登录流程',
      mode: 'llm',
    });

    expect(codexInvoker).toHaveBeenCalledWith(
      expect.objectContaining({
        requirement: '实现登录流程',
        mode: 'llm',
        structured: true,
      })
    );
    expect(result.tasks).toHaveLength(2);
    expect(result.dependencies.get('implement-feature')).toEqual(['plan-design']);
  });

  it('throws descriptive error when Codex structured output cannot be parsed', async () => {
    const codexInvoker = vi.fn().mockResolvedValue({ content: '<<malformed>>' });

    const { TaskDecomposer } = await import(modulePath);

    const decomposer = new TaskDecomposer({ codexInvoker } as any);

    await expect(
      decomposer.decompose({
        requirement: '验证结构化输出',
        mode: 'llm',
      })
    ).rejects.toThrow(/structured|结构化|JSON/i);
  });
});
