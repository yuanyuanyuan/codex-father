import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Patch, PatchApplyResult } from './types.js';

type PatchEventType = 'patch_applied' | 'patch_failed';

interface PatchEventPayload {
  readonly event: PatchEventType;
  readonly patch: Patch;
  readonly timestamp: string;
  readonly errorMessage?: string;
  readonly workDir?: string | undefined;
}

/**
 * SWWCoordinator 实现单写窗口与补丁排队喵。
 */
type StateManagerLike = {
  emitEvent?: (payload: {
    event: string;
    taskId?: string;
    role?: string;
    data?: unknown;
  }) => unknown | Promise<unknown>;
};

type SWWOptions = {
  /** 基础工作根目录；若未提供，则使用 process.cwd() */
  readonly workRoot?: string;
  /** 可选：状态事件发射器，用于写入 JSONL/stream 事件 */
  readonly stateManager?: StateManagerLike;
};

export class SWWCoordinator {
  /** 当前写窗口由哪一个任务持有。 */
  private currentWriter: string | null = null;

  /** 待处理补丁队列。 */
  private readonly patchQueue: Patch[] = [];

  /** 队列处理中的 promise，避免并发 drain。 */
  private processingPromise: Promise<void> | null = null;

  /** 补丁事件回调。 */
  private readonly listeners: Record<PatchEventType, Set<(event: PatchEventPayload) => void>> = {
    patch_applied: new Set(),
    patch_failed: new Set(),
  };

  /** 补丁事件历史记录。 */
  private readonly eventHistory: PatchEventPayload[] = [];

  /** 工作根目录（隔离目录的基底）。 */
  private readonly workRoot: string;
  /** 可选的状态事件发射器。 */
  private readonly stateManager?: StateManagerLike;

  public constructor(options?: SWWOptions) {
    this.workRoot = options?.workRoot ?? process.cwd();
    if (options && options.stateManager) {
      this.stateManager = options.stateManager;
    }
  }

  /** 暴露事件历史，方便测试与诊断。 */
  public get events(): readonly PatchEventPayload[] {
    return this.eventHistory;
  }

  /** 订阅补丁事件。 */
  public on(event: PatchEventType, listener: (payload: PatchEventPayload) => void): void {
    this.listeners[event].add(listener);
  }

  /** 取消订阅补丁事件。 */
  public off(event: PatchEventType, listener: (payload: PatchEventPayload) => void): void {
    this.listeners[event].delete(listener);
  }

  /** 添加补丁到队列并触发处理。 */
  public enqueuePatch(patch: Patch): void {
    const queuedPatch: Patch = { ...patch };
    this.patchQueue.push(queuedPatch);
    void this.processQueue();
  }

  /** 处理补丁队列，保证串行执行。 */
  public async processQueue(): Promise<void> {
    if (this.processingPromise) {
      return this.processingPromise;
    }

    this.processingPromise = this.drainQueue();
    try {
      await this.processingPromise;
    } finally {
      this.processingPromise = null;
    }
  }

  /**
   * 两阶段写（预检 + 应用补丁）。
   */
  public async applyPatch(patch: Patch): Promise<PatchApplyResult> {
    const ownsWindow = this.acquireWindow(patch.taskId);
    try {
      const validationError = this.preCheck(patch);
      if (validationError) {
        patch.status = 'failed';
        patch.error = validationError;
        return { success: false, errorMessage: validationError };
      }

      // 准备隔离工作目录（每个补丁唯一）
      let workDir: string | undefined;
      try {
        workDir = await this.prepareWorkspace(patch);
      } catch (err) {
        const reason =
          err instanceof Error ? err.message : String(err ?? 'workspace_prepare_failed');
        patch.status = 'failed';
        patch.error = reason;
        // 返回失败结果，交由上层 drainQueue() 统一发出 patch_failed 及映射事件，避免重复
        return { success: false, errorMessage: reason };
      }

      patch.status = 'applying';
      await Promise.resolve();

      patch.status = 'applied';
      patch.appliedAt = new Date().toISOString();
      delete patch.error;
      // 应用成功，记录事件
      this.emitPatchEvent('patch_applied', patch, undefined, workDir);
      return { success: true };
    } finally {
      if (ownsWindow) {
        this.releaseWindow();
      }
    }
  }

  /** 派发补丁事件。 */
  public emitPatchEvent(
    event: PatchEventType,
    patch: Patch,
    errorMessage?: string,
    workDir?: string
  ): void {
    const basePayload: Omit<PatchEventPayload, 'errorMessage'> = {
      event,
      patch: { ...patch },
      timestamp: new Date().toISOString(),
      workDir,
    };

    const payload: PatchEventPayload =
      errorMessage !== undefined ? { ...basePayload, errorMessage } : basePayload;

    this.eventHistory.push(payload);
    for (const listener of this.listeners[event]) {
      listener(payload);
    }

    // 将补丁事件映射到 JSONL/stream 事件：
    // - 成功：tool_use（工具=patch_applier），并补充 patch_applied 审计事件
    // - 失败：task_failed（reason=patch_failed），并补充 patch_failed 审计事件
    const sm = this.stateManager;
    if (sm && typeof sm.emitEvent === 'function') {
      if (event === 'patch_applied') {
        void Promise.resolve(
          sm.emitEvent?.({
            event: 'tool_use',
            taskId: patch.taskId,
            data: {
              tool: 'patch_applier',
              patchId: patch.id,
              sequence: patch.sequence,
              filePath: patch.filePath,
              workDir,
              result: 'applied',
            },
          })
        );
        void Promise.resolve(
          sm.emitEvent?.({
            event: 'patch_applied',
            taskId: patch.taskId,
            data: { patchId: patch.id, filePath: patch.filePath, workDir },
          })
        );
      } else if (event === 'patch_failed') {
        void Promise.resolve(
          sm.emitEvent?.({
            event: 'task_failed',
            taskId: patch.taskId,
            data: {
              reason: 'patch_failed',
              patchId: patch.id,
              filePath: patch.filePath,
              errorMessage,
            },
          })
        );
        void Promise.resolve(
          sm.emitEvent?.({
            event: 'patch_failed',
            taskId: patch.taskId,
            data: { patchId: patch.id, filePath: patch.filePath, errorMessage },
          })
        );
      }
    }
  }

  private async drainQueue(): Promise<void> {
    while (this.patchQueue.length > 0) {
      const patch = this.patchQueue.shift()!;
      const result = await this.applyPatch(patch);
      if (!result.success) {
        this.emitPatchEvent('patch_failed', patch, result.errorMessage);
      }
    }
  }

  /**
   * 为补丁创建隔离工作目录：<workRoot>/.sww/<taskId>/<seq>-<patchId>
   */
  private async prepareWorkspace(patch: Patch): Promise<string> {
    const seq = String(patch.sequence).padStart(4, '0');
    const dir = path.join(this.workRoot, '.sww', patch.taskId, `${seq}-${patch.id}`);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    return dir;
  }

  private acquireWindow(taskId: string): boolean {
    if (this.currentWriter === taskId) {
      return false;
    }
    if (this.currentWriter !== null && this.currentWriter !== taskId) {
      throw new Error('Single writer window is busy');
    }
    this.currentWriter = taskId;
    return true;
  }

  private releaseWindow(): void {
    this.currentWriter = null;
  }

  private preCheck(patch: Patch): string | undefined {
    if (!patch.filePath || patch.filePath.trim() === '') {
      return 'Patch filePath is required';
    }
    if (!Array.isArray(patch.targetFiles) || patch.targetFiles.length === 0) {
      return 'Patch targetFiles cannot be empty';
    }
    if (patch.status !== 'pending' && patch.status !== 'applying') {
      return `Patch status ${patch.status} is not eligible for apply`;
    }
    return undefined;
  }
}
