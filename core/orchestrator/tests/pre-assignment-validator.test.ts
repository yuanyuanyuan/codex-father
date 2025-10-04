import { describe, expect, it } from 'vitest';

describe('PreAssignmentValidator context contract (T035)', () => {
  const modulePath: string = '../pre-assignment-validator.js';

  it('rejects tasks when required files or environment values are missing', async () => {
    const { PreAssignmentValidator } = await import(modulePath);

    const validator = new PreAssignmentValidator({
      requiredFiles: ['src/core/config.yaml', 'README.md'],
      requiredEnv: ['DATABASE_URL'],
      requiredConfigKeys: ['features.multiAgent.enabled'],
    });

    const result = await validator.validate({
      task: {
        id: 't-context',
        description: '执行带有数据库依赖的任务',
      },
      availableContext: {
        files: ['src/core/config.yaml'],
        env: {},
        config: { features: { multiAgent: { enabled: false } } },
      },
    });

    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(
      expect.arrayContaining(['README.md', 'DATABASE_URL', 'features.multiAgent.enabled'])
    );
  });

  it('accepts tasks when context is complete', async () => {
    const { PreAssignmentValidator } = await import(modulePath);

    const validator = new PreAssignmentValidator({
      requiredFiles: ['docs/overview.md'],
      requiredEnv: ['CI'],
    });

    const result = await validator.validate({
      task: { id: 't-ready', description: '准备执行任务' },
      availableContext: {
        files: ['docs/overview.md'],
        env: { CI: 'true' },
        config: {},
      },
    });

    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });
});
