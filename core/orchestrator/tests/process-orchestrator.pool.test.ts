import { PassThrough } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ProcessOrchestrator as ProcessOrchestratorType } from '../process-orchestrator.js';

vi.mock('node:child_process', () => {
  const spawn = vi.fn(() => ({
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    on: vi.fn(),
  }));

  return { spawn };
});

const createTask = (id: string) => ({
  id,
  title: `任务 ${id}`,
  description: `描述 ${id}`,
  role: 'developer',
  roleMatchMethod: 'rule',
  roleMatchDetails: '默认规则',
  status: 'pending',
  dependencies: [],
  priority: 0,
  timeout: 30_000,
  createdAt: '2025-01-01T00:00:00.000Z',
});

describe('ProcessOrchestrator agent pool (T013)', () => {
  let ProcessOrchestrator: typeof ProcessOrchestratorType;
  let orchestrator: ProcessOrchestratorType;

  beforeEach(async () => {
    vi.resetModules();
    ({ ProcessOrchestrator } = await import('../process-orchestrator.js'));
    orchestrator = new ProcessOrchestrator();
  });

  it('默认 maxConcurrency=10 时，超出 10 个并行 agent 会抛错', async () => {
    const initialTasks = Array.from({ length: 10 }, (_, index) => createTask(`t-${index}`));
    for (const task of initialTasks) {
      await orchestrator.spawnAgent(task as any);
    }

    await expect(orchestrator.spawnAgent(createTask('t-overflow') as any)).rejects.toThrow(
      /agent pool exhausted/i
    );
  });

  it('复用同角色空闲 agent 时不会增长池大小', async () => {
    const { agent } = await orchestrator.spawnAgent(createTask('t-first') as any);
    const pool = (orchestrator as any).agentPool as Map<string, unknown>;
    const tracked = pool.get(agent.id) as Record<string, unknown>;
    pool.set(agent.id, { ...tracked, status: 'idle', currentTask: undefined });

    const result = await orchestrator.spawnAgent(createTask('t-second') as any);

    expect(result.reused).toBe(true);
    expect(result.agent.id).toBe(agent.id);
    expect(pool.size).toBe(1);
  });
});
