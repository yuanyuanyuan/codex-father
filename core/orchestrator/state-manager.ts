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
  private redactionPatterns?: (RegExp | string)[];

  /**
   * 使用可选初始状态创建管理器。
   *
   * @param initialSnapshot 初始状态。
   */
  public constructor(initial?: unknown) {
    const initObj =
      initial && typeof initial === 'object' ? (initial as Record<string, unknown>) : undefined;
    if (initObj && ('orchestrationId' in initObj || 'eventLogger' in initObj)) {
      this.orchestrationId = initObj.orchestrationId as string | undefined;
      this.eventLogger =
        (initObj.eventLogger as { logEvent: Function } | undefined) ?? this.eventLogger;
      if ('redactionPatterns' in initObj) {
        this.redactionPatterns = initObj.redactionPatterns as (RegExp | string)[];
      }
      this.snapshot = {
        completedTasks: 0,
        failedTasks: 0,
        updatedAt: Date.now(),
      };
      return;
    }
    const initialSnapshot: OrchestratorStateSnapshot | undefined = initObj as
      | OrchestratorStateSnapshot
      | undefined;
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
    data?: unknown;
  }): Promise<void> {
    this.seq += 1;
    if (!this.eventLogger) {
      return;
    }
    const redact = (val: unknown): unknown => {
      if (!this.redactionPatterns || this.redactionPatterns.length === 0) {
        return val;
      }
      const applyOne = (s: string): string => {
        let out = s;
        for (const pat of this.redactionPatterns!) {
          if (pat instanceof RegExp) {
            out = out.replace(pat, '[REDACTED]');
          } else if (typeof pat === 'string' && pat.length > 0) {
            // 文字子串替换（全部）
            out = out.split(pat).join('[REDACTED]');
          }
        }
        return out;
      };
      if (typeof val === 'string') {
        return applyOne(val);
      }
      if (val && typeof val === 'object') {
        if (Array.isArray(val)) {
          return val.map((v) => redact(v));
        }
        const obj: Record<string, unknown> = {};
        for (const k of Object.keys(val as Record<string, unknown>)) {
          const v = (val as Record<string, unknown>)[k];
          obj[k] = typeof v === 'string' || typeof v === 'object' ? redact(v) : v;
        }
        return obj;
      }
      return val;
    };
    const redactedData = redact(payload.data);
    await this.eventLogger.logEvent({
      event: payload.event,
      orchestrationId: this.orchestrationId,
      seq: this.seq,
      taskId: payload.taskId,
      role: payload.role,
      data: redactedData,
    });
  }
}
