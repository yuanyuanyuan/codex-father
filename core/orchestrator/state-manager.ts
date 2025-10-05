import type { OrchestratorStateSnapshot } from './types.js';

/**
 * StateManager 维护编排执行过程中的状态快照喵。
 */
export class StateManager {
  /** 当前的状态快照。 */
  private snapshot: OrchestratorStateSnapshot;
  private orchestrationId?: string;
  private eventLogger?: { logEvent: Function };
  private seq: number = 0;

  /**
   * 使用可选初始状态创建管理器。
   *
   * @param initialSnapshot 初始状态。
   */
  public constructor(initial?: any) {
    if (initial && ('orchestrationId' in initial || 'eventLogger' in initial)) {
      this.orchestrationId = initial.orchestrationId;
      this.eventLogger = initial.eventLogger;
      this.snapshot = {
        completedTasks: 0,
        failedTasks: 0,
        updatedAt: Date.now(),
      };
      return;
    }
    const initialSnapshot: OrchestratorStateSnapshot | undefined = initial;
    this.snapshot = initialSnapshot ?? {
      completedTasks: 0,
      failedTasks: 0,
      updatedAt: Date.now(),
    };
  }

  /**
   * 合并新的状态并返回最新快照。
   *
   * @param updates 状态增量。
   * @returns 最新的状态快照。
   */
  public update(updates: Partial<OrchestratorStateSnapshot>): OrchestratorStateSnapshot {
    this.snapshot = {
      ...this.snapshot,
      ...updates,
      updatedAt: Date.now(),
    };
    return this.snapshot;
  }

  /**
   * 获取当前状态快照。
   *
   * @returns 当前快照。
   */
  public getSnapshot(): OrchestratorStateSnapshot {
    return this.snapshot;
  }

  public async emitEvent(payload: {
    event: string;
    taskId?: string;
    role?: string;
    data?: any;
  }): Promise<void> {
    this.seq += 1;
    if (!this.eventLogger) {
      return;
    }
    await this.eventLogger.logEvent({
      event: payload.event,
      orchestrationId: this.orchestrationId,
      seq: this.seq,
      taskId: payload.taskId,
      role: payload.role,
      data: payload.data,
    });
  }
}
