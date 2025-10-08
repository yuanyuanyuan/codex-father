import { describe, it, expect } from 'vitest';
import { SWWCoordinator } from '../sww-coordinator.js';

describe('Cancel → Resume → Re-queue patches integration (T004)', () => {
  it('after cancel (abort queue) and resume (resetAbort), new patches can be applied', async () => {
    const { ProcessOrchestrator } = await import('../process-orchestrator.js');

    const sww = new SWWCoordinator();
    const orchestrator = new ProcessOrchestrator({ sww, codexCommand: 'codex' } as any);

    // queue two patches then cancel to abort queue
    sww.enqueuePatch({
      id: 'p-a',
      taskId: 't1',
      sequence: 1,
      filePath: 'a.diff',
      targetFiles: ['a.txt'],
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as any);
    sww.enqueuePatch({
      id: 'p-b',
      taskId: 't1',
      sequence: 2,
      filePath: 'b.diff',
      targetFiles: ['b.txt'],
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as any);

    // Cancel: should call requestAbort and drop queued patches
    await (orchestrator as any).requestCancel(0);
    await sww.processQueue();
    const appliedCountAfterCancel = sww.events.filter((e) => e.event === 'patch_applied').length;
    // 允许当前写窗口内的补丁完成；取消后不得继续应用更多补丁（<=1）
    expect(appliedCountAfterCancel).toBeLessThanOrEqual(1);

    // Resume should reset abort flag
    await orchestrator.resumeSession({ rolloutPath: '/tmp/rollout.jsonl' } as any);

    // Re-queue and ensure can apply
    sww.enqueuePatch({
      id: 'p-c',
      taskId: 't1',
      sequence: 3,
      filePath: 'c.diff',
      targetFiles: ['c.txt'],
      status: 'pending',
      createdAt: new Date().toISOString(),
    } as any);
    await sww.processQueue();
    const final = sww.events.at(-1);
    expect(final?.event).toBe('patch_applied');
    expect(final?.patch.id).toBe('p-c');
  });
});
