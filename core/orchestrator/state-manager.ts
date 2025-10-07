import type { OrchestratorStateSnapshot } from './types.js';
import * as fsp from 'node:fs/promises';
import * as nodePath from 'node:path';

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
  /**
   * 当提供 sessionDir 且未显式传入 eventLogger 时，StateManager 将创建一个
   * 轻量 JSONL 事件记录器，负责将事件写入 <sessionDir>/events.jsonl。
   * - 目录权限：0700
   * - 文件权限：0600（append-only）
   */
  sessionDir?: string;
};

type StateManagerInit = OrchestratorStateSnapshot | StateManagerBootstrap;

export class StateManager {
  /** 当前的状态快照。 */
  private snapshot: OrchestratorStateSnapshot;
  private orchestrationId?: string;
  private eventLogger?: EventLoggerLike;
  private seq: number = 0;
  private redactionPatterns?: (RegExp | string)[];
  private sessionDir?: string;

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
      // 允许通过 sessionDir 启用内置 JSONL 事件记录器（当未显式提供 eventLogger 时）。
      if (!this.eventLogger && typeof bootstrap.sessionDir === 'string' && bootstrap.sessionDir) {
        this.sessionDir = bootstrap.sessionDir;
        this.eventLogger = createJsonlEventLogger(bootstrap.sessionDir);
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

/**
 * 轻量 JSONL 事件记录器：将记录逐行追加至 <sessionDir>/events.jsonl。
 * - 父目录权限为 0700
 * - 文件权限为 0600（首次创建时）
 * - 不做结构校验，保持与调用侧一致的记录结构
 * - 由 StateManager 负责在调用前完成敏感信息脱敏（redaction）
 */
function createJsonlEventLogger(sessionDir: string): EventLoggerLike {
  const eventsFile = nodePath.join(sessionDir, 'events.jsonl');

  const ensureDir = async (): Promise<void> => {
    await fsp.mkdir(sessionDir, { recursive: true, mode: 0o700 });
    // 受 umask 影响时强制一次权限
    await fsp.chmod(sessionDir, 0o700).catch(() => {});
  };

  const appendLine = async (line: string): Promise<void> => {
    try {
      await fsp.appendFile(eventsFile, line + '\n', { encoding: 'utf-8', mode: 0o600 });
    } catch (err: any) {
      if (err && err.code === 'ENOENT') {
        await ensureDir();
        await fsp.appendFile(eventsFile, line + '\n', { encoding: 'utf-8', mode: 0o600 });
      } else {
        throw err;
      }
    }
    // 再次强制设定文件权限（受 umask 影响时）
    await fsp.chmod(eventsFile, 0o600).catch(() => {});
  };

  return {
    logEvent: async (record: Record<string, unknown>): Promise<void> => {
      await ensureDir();
      const withTimestamp = { timestamp: new Date().toISOString(), ...record };
      await appendLine(JSON.stringify(withTimestamp));
    },
  } satisfies EventLoggerLike;
}
