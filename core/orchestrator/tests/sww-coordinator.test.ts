import { beforeEach, describe, expect, it } from 'vitest';
import { SWWCoordinator } from '../sww-coordinator';
import type { Patch } from '../types';

describe('SWWCoordinator 单写窗口协调', () => {
  let coordinator: SWWCoordinator;
  let patchCounter = 0;

  const buildPatch = (overrides: Partial<Patch> = {}): Patch => {
    patchCounter += 1;
    return {
      id: overrides.id ?? `patch_${patchCounter}`,
      taskId: overrides.taskId ?? `t-task-${patchCounter}`,
      sequence: overrides.sequence ?? patchCounter,
      filePath: overrides.filePath ?? `/tmp/demo-${patchCounter}.diff`,
      targetFiles: overrides.targetFiles ?? [`/tmp/demo-${patchCounter}.diff`],
      status: overrides.status ?? 'pending',
      createdAt: overrides.createdAt ?? '2025-01-01T00:00:00.000Z',
      appliedAt: overrides.appliedAt,
      error: overrides.error,
    };
  };

  beforeEach(() => {
    coordinator = new SWWCoordinator();
    patchCounter = 0;
  });

  it('非当前写者抢占窗口时抛错 "Single writer window is busy"', async () => {
    (coordinator as unknown as { currentWriter: string }).currentWriter = 't-task-keeper';
    const competingPatch = buildPatch({ id: 'patch_conflict', taskId: 't-task-other' });

    await expect(coordinator.applyPatch(competingPatch)).rejects.toThrowError(
      /Single writer window is busy/
    );
  });

  it('preCheck 失败会触发 patch_failed 事件并将补丁标记为 failed', async () => {
    const recordedFailed: Array<{ event: string; errorMessage?: string; patch: Patch }> = [];
    coordinator.on('patch_failed', (payload) => {
      recordedFailed.push(payload);
    });

    const invalidPatch = buildPatch({
      id: 'patch_precheck_failed',
      taskId: 't-task-precheck',
      targetFiles: [],
    });

    coordinator.enqueuePatch(invalidPatch);
    await coordinator.processQueue();

    expect(recordedFailed.length, '应捕获到一次 patch_failed 事件').toBe(1);
    const failedEvent = recordedFailed[0];
    expect(failedEvent.event, '事件类型应为 patch_failed').toBe('patch_failed');
    expect(failedEvent.patch.status, '补丁状态应更新为 failed').toBe('failed');
    expect(failedEvent.errorMessage ?? '', '失败消息需提示 targetFiles 问题').toContain(
      'targetFiles'
    );
    expect(failedEvent.patch.error ?? '', '事件载荷应携带错误详情').toContain('targetFiles');
  });

  it('补丁队列严格串行，后续事件晚于先前补丁完成', async () => {
    const timeline: string[] = [];
    coordinator.on('patch_applied', (payload) => {
      timeline.push(`applied:${payload.patch.id}`);
    });
    coordinator.on('patch_failed', (payload) => {
      timeline.push(`failed:${payload.patch.id}`);
    });

    const firstPatch = buildPatch({ id: 'patch_first', taskId: 't-task-first', sequence: 1 });
    const secondPatch = buildPatch({ id: 'patch_second', taskId: 't-task-second', sequence: 2 });

    coordinator.enqueuePatch(firstPatch);
    coordinator.enqueuePatch(secondPatch);
    await coordinator.processQueue();

    expect(timeline, '事件顺序应严格按照队列顺序串行').toEqual([
      'applied:patch_first',
      'applied:patch_second',
    ]);
    expect(
      coordinator.events.map((evt) => evt.patch.id),
      '事件历史中的补丁顺序应与时间线一致'
    ).toEqual(['patch_first', 'patch_second']);
    expect(
      coordinator.events.every((evt) => evt.patch.status === 'applied'),
      '串行执行完成后事件载荷中的补丁应处于 applied 状态'
    ).toBe(true);
  });

  it('回滚路径：第二个补丁失败时不影响已完成的第一个补丁', async () => {
    const timeline: string[] = [];
    coordinator.on('patch_applied', (payload) => {
      timeline.push(`applied:${payload.patch.id}`);
    });
    coordinator.on('patch_failed', (payload) => {
      timeline.push(`failed:${payload.patch.id}`);
    });

    const successfulPatch = buildPatch({
      id: 'patch_success',
      taskId: 't-task-success',
      sequence: 1,
    });
    const rollbackPatch = buildPatch({
      id: 'patch_rollback',
      taskId: 't-task-rollback',
      sequence: 2,
      targetFiles: [],
    });

    coordinator.enqueuePatch(successfulPatch);
    coordinator.enqueuePatch(rollbackPatch);
    await coordinator.processQueue();

    expect(timeline, '应先成功第一个补丁，再记录第二个失败').toEqual([
      'applied:patch_success',
      'failed:patch_rollback',
    ]);
    const history = coordinator.events;
    expect(history[0]?.patch.status, '首个补丁状态必须保持 applied').toBe('applied');
    expect(history[0]?.patch.error, '首个补丁不应残留错误信息').toBeUndefined();
    expect(history[1]?.event, '第二个补丁需记录失败事件').toBe('patch_failed');
    expect(history[1]?.patch.error ?? '', '失败补丁应记录具体错误').toContain('targetFiles');
  });
});
