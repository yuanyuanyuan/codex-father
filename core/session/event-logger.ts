/**
 * Event Logger - 事件日志记录器
 *
 * 负责将系统事件追加写入 JSONL 格式日志文件
 * 参考: specs/005-docs-prd-draft/data-model.md:461-527
 *
 * 设计原则:
 * - 不可变性: 日志仅追加,不可修改 (append-only)
 * - 可追溯性: 所有事件包含时间戳和关联 ID
 * - 类型安全: 使用 TypeScript + Zod 验证
 *
 * 用途: 监控、审计、调试 (不用于会话恢复)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Event, EventType, EventSchema } from '../lib/types.js';

/**
 * 事件日志记录器配置
 */
export interface EventLoggerConfig {
  logDir: string; // 日志目录路径
  logFileName?: string; // 日志文件名 (默认: events.jsonl)
  autoFlush?: boolean; // 是否自动刷新到磁盘 (默认: true)
  validateEvents?: boolean; // 是否验证事件格式 (默认: true)
}

/**
 * 日志写入选项
 */
export interface LogEventOptions {
  skipValidation?: boolean; // 跳过验证 (用于性能优化)
}

/**
 * 事件日志记录器
 *
 * 职责 (Single Responsibility):
 * - 将事件追加写入 JSONL 文件
 * - 验证事件格式
 * - 确保目录存在
 */
export class EventLogger {
  private logFilePath: string;
  private config: Required<EventLoggerConfig>;
  private writeLock: Promise<void> = Promise.resolve();

  constructor(config: EventLoggerConfig) {
    this.config = {
      logDir: config.logDir,
      logFileName: config.logFileName || 'events.jsonl',
      autoFlush: config.autoFlush ?? true,
      validateEvents: config.validateEvents ?? true,
    };

    this.logFilePath = path.join(this.config.logDir, this.config.logFileName);
  }

  /**
   * 记录事件到日志文件
   *
   * @param event 事件对象 (不包含 eventId 和 timestamp,将自动生成)
   * @param options 日志写入选项
   */
  async logEvent(
    event: Omit<Event, 'eventId' | 'timestamp'>,
    options?: LogEventOptions
  ): Promise<string> {
    // 生成完整的事件对象
    const fullEvent: Event = {
      eventId: uuidv4(),
      timestamp: new Date(),
      ...event,
    };

    // 验证事件格式 (如果启用)
    if (this.config.validateEvents && !options?.skipValidation) {
      const result = EventSchema.safeParse(fullEvent);
      if (!result.success) {
        throw new Error(
          `Invalid event format: ${JSON.stringify(result.error.errors)}`
        );
      }
    }

    // 使用锁确保写入操作串行化 (避免竞态条件)
    this.writeLock = this.writeLock.then(async () => {
      await this.writeEventToFile(fullEvent);
    });

    await this.writeLock;

    return fullEvent.eventId;
  }

  /**
   * 批量记录多个事件
   *
   * @param events 事件对象数组
   */
  async logEvents(events: Omit<Event, 'eventId' | 'timestamp'>[]): Promise<string[]> {
    const eventIds: string[] = [];

    for (const event of events) {
      const eventId = await this.logEvent(event, { skipValidation: false });
      eventIds.push(eventId);
    }

    return eventIds;
  }

  /**
   * 读取所有事件 (用于调试和审计)
   *
   * @returns 事件数组
   */
  async readAllEvents(): Promise<Event[]> {
    try {
      const content = await fs.readFile(this.logFilePath, 'utf-8');
      const lines = content.trim().split('\n').filter((line) => line.length > 0);

      return lines.map((line) => {
        const parsed = JSON.parse(line);
        // 将 ISO 字符串转换为 Date 对象
        return {
          ...parsed,
          timestamp: new Date(parsed.timestamp),
          ...(parsed.createdAt && { createdAt: new Date(parsed.createdAt) }),
          ...(parsed.resolvedAt && { resolvedAt: new Date(parsed.resolvedAt) }),
        };
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // 文件不存在,返回空数组
        return [];
      }
      throw error;
    }
  }

  /**
   * 按类型过滤事件
   *
   * @param eventType 事件类型
   * @returns 匹配的事件数组
   */
  async filterEventsByType(eventType: EventType): Promise<Event[]> {
    const allEvents = await this.readAllEvents();
    return allEvents.filter((event) => event.type === eventType);
  }

  /**
   * 按 jobId 过滤事件
   *
   * @param jobId 作业 ID
   * @returns 匹配的事件数组
   */
  async filterEventsByJobId(jobId: string): Promise<Event[]> {
    const allEvents = await this.readAllEvents();
    return allEvents.filter((event) => event.jobId === jobId);
  }

  /**
   * 获取事件数量
   */
  async getEventCount(): Promise<number> {
    try {
      const content = await fs.readFile(this.logFilePath, 'utf-8');
      const lines = content.trim().split('\n').filter((line) => line.length > 0);
      return lines.length;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return 0;
      }
      throw error;
    }
  }

  /**
   * 清空日志文件 (危险操作,仅用于测试)
   */
  async clearLogs(): Promise<void> {
    try {
      await fs.unlink(this.logFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * 将事件写入文件 (私有方法)
   */
  private async writeEventToFile(event: Event): Promise<void> {
    // 确保目录存在
    await this.ensureLogDirExists();

    // 序列化为 JSON 字符串 (日期对象转换为 ISO 字符串)
    const jsonLine = JSON.stringify(event, (key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      return value;
    });

    // 追加写入文件 (append mode)
    await fs.appendFile(this.logFilePath, jsonLine + '\n', 'utf-8');
  }

  /**
   * 确保日志目录存在
   */
  private async ensureLogDirExists(): Promise<void> {
    try {
      await fs.mkdir(this.config.logDir, { recursive: true });
    } catch (error) {
      // 目录已存在,忽略错误
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * 获取日志文件路径
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }
}

/**
 * 创建事件日志记录器的工厂函数
 *
 * @param config 配置对象
 * @returns EventLogger 实例
 */
export function createEventLogger(config: EventLoggerConfig): EventLogger {
  return new EventLogger(config);
}