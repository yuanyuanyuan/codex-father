import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { EventLogger } from '../../session/event-logger.js';

describe('Understanding gate JSONL audit (T049)', () => {
  const modulePath: string = '../process-orchestrator.js';
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'ujsonl-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('writes understanding_failed then orchestration_failed to JSONL on failure', async () => {
    const { ProcessOrchestrator } = await import(modulePath);
    const { StateManager } = await import('../state-manager.js');

    const eventLogger = new EventLogger({
      logDir: tempDir,
      asyncWrite: false,
      validateEvents: false,
    });
    const stateManager = new StateManager({ orchestrationId: 'orc_ujsonl', eventLogger } as any);

    const understandingEvaluator = vi
      .fn()
      .mockResolvedValue({ consistent: false, issues: ['遗漏验收标准'] });

    const orchestrator = new ProcessOrchestrator({
      stateManager,
      understandingEvaluator,
    } as any);

    const task = {
      id: 't-ujsonl-1',
      description: '占位任务',
      role: 'developer',
      roleMatchMethod: 'rule',
      roleMatchDetails: '默认规则',
      status: 'pending',
      dependencies: [],
      priority: 0,
      timeout: 60_000,
      createdAt: new Date().toISOString(),
    } as const;

    await orchestrator.orchestrate([task] as any, {
      requirement: '实现登录并补充测试',
      restatement: '只实现登录',
    });

    const content = await readFile(join(tempDir, 'events.jsonl'), 'utf8');
    const lines = content
      .trim()
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l));

    // 最后两条为 understanding_failed → orchestration_failed
    expect(lines.at(-2)?.event).toBe('understanding_failed');
    expect(lines.at(-1)?.event).toBe('orchestration_failed');
  });
});
