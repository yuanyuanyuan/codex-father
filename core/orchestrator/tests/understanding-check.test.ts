import { afterEach, describe, expect, it, vi } from 'vitest';

describe('UnderstandingCheck restatement contract (T036)', () => {
  const modulePath: string = '../understanding-check.js';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fails when restatement omits critical acceptance criteria', async () => {
    const evaluateConsistency = vi
      .fn()
      .mockResolvedValue({ consistent: false, issues: ['缺少测试覆盖要求', '遗漏超时处理'] });

    const { UnderstandingCheck } = await import(modulePath);

    const check = new UnderstandingCheck({ evaluateConsistency });

    await expect(
      check.validate({
        requirement: '实现登录并补充测试，确保 30 分钟超时逻辑',
        restatement: '我会实现登录功能',
      })
    ).rejects.toThrow(/测试覆盖|超时处理/i);

    expect(evaluateConsistency).toHaveBeenCalled();
  });

  it('passes when evaluation confirms the restatement is consistent', async () => {
    const evaluateConsistency = vi.fn().mockResolvedValue({ consistent: true, issues: [] });
    const { UnderstandingCheck } = await import(modulePath);

    const check = new UnderstandingCheck({ evaluateConsistency });

    const result = await check.validate({
      requirement: '实现多 Agent 并行编排，包含任务分解与权限控制',
      restatement: '我会实现多 Agent 并行编排，包含任务分解与权限控制',
    });

    expect(result.consistent).toBe(true);
  });
});
