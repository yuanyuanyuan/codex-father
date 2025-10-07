import type { OrchestratorStateSnapshot } from './types.js';
import * as fsp from 'node:fs/promises';
import * as nodePath from 'node:path';
import { createSensitiveRedactor, type SensitiveRedactor } from '../lib/security/redaction.js';

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
  private redactor: SensitiveRedactor;
  private sessionDir?: string;
  private persistLock: Promise<void> = Promise.resolve();

  /**
   * 使用可选初始状态创建管理器。
   *
   * @param initialSnapshot 初始状态。
   */
  public constructor(initial?: StateManagerInit) {
    this.redactor = createSensitiveRedactor([]);
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
      if (typeof bootstrap.sessionDir === 'string' && bootstrap.sessionDir) {
        this.sessionDir = bootstrap.sessionDir;
      }
      // 允许通过 sessionDir 启用内置 JSONL 事件记录器（当未显式提供 eventLogger 时）。
      if (!this.eventLogger && typeof bootstrap.sessionDir === 'string' && bootstrap.sessionDir) {
        this.eventLogger = createJsonlEventLogger(bootstrap.sessionDir);
      }
      const patterns = Array.isArray(bootstrap.redactionPatterns)
        ? Array.from(bootstrap.redactionPatterns)
        : [];
      this.redactor = createSensitiveRedactor(patterns);
      const now = Date.now();
      this.snapshot = {
        status: 'pending',
        completedTasks: 0,
        failedTasks: 0,
        updatedAt: now,
      };
      this.schedulePersist();
      return;
    }
    const initialSnapshot: OrchestratorStateSnapshot | undefined = initial as
      | OrchestratorStateSnapshot
      | undefined;
    if (initialSnapshot) {
      this.snapshot = { ...initialSnapshot } as OrchestratorStateSnapshot;
      if (!('status' in this.snapshot) || typeof this.snapshot.status !== 'string') {
        this.snapshot = { ...this.snapshot, status: 'pending' } as OrchestratorStateSnapshot;
      }
    } else {
      const now = Date.now();
      this.snapshot = {
        status: 'pending',
        completedTasks: 0,
        failedTasks: 0,
        updatedAt: now,
      };
    }
    this.schedulePersist();
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
    this.schedulePersist();
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
    const record: Record<string, unknown> = {
      event: payload.event,
      orchestrationId: this.orchestrationId,
      seq: this.seq,
      taskId: payload.taskId,
      role: payload.role,
      data: payload.data,
    };
    const sanitizedRecord = this.redactor(record) as Record<string, unknown>;
    await this.eventLogger.logEvent(sanitizedRecord);
  }
  private schedulePersist(): void {
    if (!this.sessionDir) {
      return;
    }
    const targetDir = this.sessionDir;
    const targetFile = nodePath.join(targetDir, 'state.json');
    const payload = JSON.stringify(this.snapshot, null, 2);
    this.persistLock = this.persistLock
      .then(async () => {
        try {
          await fsp.mkdir(targetDir, { recursive: true, mode: 0o700 });
          await fsp.writeFile(targetFile, payload, { encoding: 'utf-8', mode: 0o600 });
          await fsp.chmod(targetFile, 0o600).catch(() => {});
        } catch {
          // Ignore persistence error, keep runtime alive
        }
      })
      .catch(() => {});
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
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err && 'code' in err
          ? (err as { code?: string }).code
          : undefined;
      if (code === 'ENOENT') {
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
