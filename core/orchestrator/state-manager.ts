import type { OrchestratorStateSnapshot } from './types.js';

/**
 * StateManager 维护编排执行过程中的状态快照喵。
 */
type EventLoggerLike = {
  logEvent: (record: Record<string, unknown>) => unknown | Promise<unknown>;
};

type StateManagerBootstrap = {
  orchestrationId?: string;
  eventLogger?: EventLoggerLike;
  redactionPatterns?: (RegExp | string)[];
};

type StateManagerInit = OrchestratorStateSnapshot | StateManagerBootstrap;

export class StateManager {
  /** 当前的状态快照。 */
  private snapshot: OrchestratorStateSnapshot;
  private orchestrationId?: string;
  private eventLogger?: EventLoggerLike;
  private seq: number = 0;
  private redactionPatterns?: (RegExp | string)[];

  /**
   * 使用可选初始状态创建管理器。
   *
   * @param initialSnapshot 初始状态。
   */
  public constructor(initial?: StateManagerInit) {
    if (
      initial &&
      typeof initial === 'object' &&
      ('orchestrationId' in initial || 'eventLogger' in initial)
    ) {
      const bootstrap = initial as StateManagerBootstrap;
      if (typeof bootstrap.orchestrationId === 'string') {
        this.orchestrationId = bootstrap.orchestrationId;
      }
      if (bootstrap.eventLogger) {
        this.eventLogger = bootstrap.eventLogger;
      }
      if (bootstrap.redactionPatterns) {
        this.redactionPatterns = bootstrap.redactionPatterns;
      }
      this.snapshot = {
        completedTasks: 0,
        failedTasks: 0,
        updatedAt: Date.now(),
      };
      return;
    }
    const initialSnapshot: OrchestratorStateSnapshot | undefined = initial as
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
          const escapeRegExp = (str: string): string =>
            str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          // 1) 先进行键值掩码：匹配 key[=:]value 形式，若 key 命中，则仅替换 value
          const src = pat instanceof RegExp ? pat.source : escapeRegExp(pat);
          const flags = 'g' + (pat instanceof RegExp ? pat.flags.replace(/g/g, '') : '');
          // 捕获顺序：...(key by pattern)(sep)(value)
          // 我们只将最后两个捕获组作为 sep 与 value；key 本身不需要单独捕获
          const kvRegex = new RegExp(
            `(?:${src})(?<sep>\\s*[=:]\\s*)(?<val>"[^"]*"|'[^']*'|[^\\s,;]+)`,
            flags
          );
          out = out.replace(kvRegex, (...m: string[]) => {
            // m: [match, sep, value, offset, input]
            const matched: string = (m[0] ?? '') as string;
            const sep: string = (m[1] ?? '') as string;
            const value: string = (m[2] ?? '') as string;
            const prefix = matched.slice(
              0,
              Math.max(0, matched.length - sep.length - value.length)
            );
            // 保留原有引号样式
            if (
              (value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))
            ) {
              const quote = value[0];
              return `${prefix}${sep}${quote}[REDACTED]${quote}`;
            }
            return `${prefix}${sep}[REDACTED]`;
          });

          // 2) 再进行直接替换：
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
