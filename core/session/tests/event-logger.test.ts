/**
 * Event Logger Unit Tests - 事件日志记录器单元测试
 *
 * 测试覆盖:
 * - JSONL 写入
 * - 事件验证
 * - 流式写入 (并发安全)
 * - 读取和过滤功能
 * - 错误处理
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { EventLogger, createEventLogger } from '../event-logger.js';
import { EventType } from '../../lib/types.js';

describe('EventLogger', () => {
  const testLogDir = path.join(process.cwd(), '.test-logs');
  let logger: EventLogger;

  beforeEach(async () => {
    // 创建测试日志目录
    await fs.mkdir(testLogDir, { recursive: true });

    // 创建事件日志记录器
    logger = createEventLogger({
      logDir: testLogDir,
      logFileName: 'test-events.jsonl',
      autoFlush: true,
      validateEvents: true,
    });
  });

  afterEach(async () => {
    // 清理测试日志
    try {
      await fs.rm(testLogDir, { recursive: true, force: true });
    } catch (error) {
      // 忽略清理错误
    }
  });

  describe('基本功能', () => {
    it('应该成功记录单个事件', async () => {
      const testJobId = uuidv4();
      const eventId = await logger.logEvent({
        type: EventType.JOB_CREATED,
        jobId: testJobId,
        data: {
          prompt: 'Test prompt',
        },
      });

      // 验证返回了事件 ID
      expect(eventId).toMatch(/^[0-9a-f-]{36}$/);

      // 验证事件已写入文件
      const events = await logger.readAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventId).toBe(eventId);
      expect(events[0].type).toBe(EventType.JOB_CREATED);
      expect(events[0].jobId).toBe(testJobId);
    });

    it('应该自动生成 eventId 和 timestamp', async () => {
      const beforeLog = new Date();
      const testJobId = uuidv4();

      const eventId = await logger.logEvent({
        type: EventType.JOB_STARTED,
        jobId: testJobId,
        data: {},
      });

      const afterLog = new Date();

      const events = await logger.readAllEvents();
      const event = events[0];

      // 验证自动生成的字段
      expect(event.eventId).toBe(eventId);
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(beforeLog.getTime());
      expect(event.timestamp.getTime()).toBeLessThanOrEqual(afterLog.getTime());
    });

    it('应该支持批量记录事件', async () => {
      const events = [
        {
          type: EventType.JOB_CREATED,
          jobId: uuidv4(),
          data: { prompt: 'Prompt 1' },
        },
        {
          type: EventType.JOB_STARTED,
          jobId: uuidv4(),
          data: { prompt: 'Prompt 2' },
        },
        {
          type: EventType.JOB_COMPLETED,
          jobId: uuidv4(),
          data: { result: 'Done' },
        },
      ];

      const eventIds = await logger.logEvents(events);

      // 验证返回了所有事件 ID
      expect(eventIds).toHaveLength(3);
      eventIds.forEach((id) => {
        expect(id).toMatch(/^[0-9a-f-]{36}$/);
      });

      // 验证所有事件已写入
      const loggedEvents = await logger.readAllEvents();
      expect(loggedEvents).toHaveLength(3);
    });
  });

  describe('JSONL 格式', () => {
    it('应该以 JSONL 格式写入事件 (每行一个 JSON 对象)', async () => {
      // 记录多个事件
      await logger.logEvent({
        type: EventType.JOB_CREATED,
        jobId: uuidv4(),
        data: {},
      });

      await logger.logEvent({
        type: EventType.JOB_STARTED,
        jobId: uuidv4(),
        data: {},
      });

      // 直接读取文件内容
      const logFilePath = logger.getLogFilePath();
      const content = await fs.readFile(logFilePath, 'utf-8');
      const lines = content.trim().split('\n');

      // 验证格式
      expect(lines).toHaveLength(2);

      // 每行都应该是有效的 JSON
      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
        const parsed = JSON.parse(line);
        expect(parsed).toHaveProperty('eventId');
        expect(parsed).toHaveProperty('timestamp');
        expect(parsed).toHaveProperty('type');
        expect(parsed).toHaveProperty('jobId');
      });
    });

    it('应该正确序列化 Date 对象为 ISO 字符串', async () => {
      await logger.logEvent({
        type: EventType.JOB_CREATED,
        jobId: uuidv4(),
        data: {
          customDate: new Date('2025-01-01T00:00:00Z'),
        },
      });

      // 读取原始文件内容
      const logFilePath = logger.getLogFilePath();
      const content = await fs.readFile(logFilePath, 'utf-8');
      const parsed = JSON.parse(content.trim());

      // 验证 timestamp 是 ISO 字符串
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      // 验证嵌套的 Date 对象也被序列化
      expect(parsed.data.customDate).toBe('2025-01-01T00:00:00.000Z');
    });
  });

  describe('事件验证', () => {
    it('应该拒绝无效的事件格式', async () => {
      // jobId 不是有效的 UUID 格式
      await expect(
        logger.logEvent({
          type: EventType.JOB_CREATED,
          jobId: 'invalid-job-id-not-uuid',
          data: {},
        })
      ).rejects.toThrow('Invalid event format');
    });

    it('应该允许跳过验证以提高性能', async () => {
      // 创建不验证的 logger
      const noValidateLogger = createEventLogger({
        logDir: testLogDir,
        logFileName: 'no-validate.jsonl',
        validateEvents: false,
      });

      // 即使格式无效也应该成功 (不验证)
      await expect(
        noValidateLogger.logEvent(
          {
            type: EventType.JOB_CREATED,
            // @ts-expect-error - 故意缺少 jobId
            data: {},
          },
          { skipValidation: true }
        )
      ).resolves.toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('并发写入 (流式写入)', () => {
    it('应该正确处理并发写入,不出现竞态条件', async () => {
      // 生成 10 个不同的 jobId
      const jobIds = Array.from({ length: 10 }, () => uuidv4());

      // 并发写入 10 个事件
      const promises = jobIds.map((jobId, i) =>
        logger.logEvent({
          type: EventType.JOB_CREATED,
          jobId,
          data: { index: i },
        })
      );

      const eventIds = await Promise.all(promises);

      // 验证所有事件都已写入
      expect(eventIds).toHaveLength(10);

      const events = await logger.readAllEvents();
      expect(events).toHaveLength(10);

      // 验证所有事件 ID 唯一
      const uniqueIds = new Set(events.map((e) => e.eventId));
      expect(uniqueIds.size).toBe(10);

      // 验证所有 jobId 都存在
      const loggedJobIds = events.map((e) => e.jobId).sort();
      const expectedJobIds = [...jobIds].sort();
      expect(loggedJobIds).toEqual(expectedJobIds);
    });

    it('应该保持写入顺序 (串行化)', async () => {
      // 快速连续写入多个事件
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          logger.logEvent({
            type: EventType.JOB_CREATED,
            jobId: uuidv4(),
            data: { index: i },
          })
        );
      }

      await Promise.all(promises);

      // 读取事件并验证顺序
      const events = await logger.readAllEvents();
      expect(events).toHaveLength(5);

      // 事件应该按 timestamp 升序
      const timestamps = events.map((e) => e.timestamp.getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });

  describe('读取和过滤', () => {
    let job1Id: string;
    let job2Id: string;

    beforeEach(async () => {
      // 使用固定的 jobId 进行测试
      job1Id = uuidv4();
      job2Id = uuidv4();

      // 准备测试数据
      await logger.logEvents([
        {
          type: EventType.JOB_CREATED,
          jobId: job1Id,
          data: {},
        },
        {
          type: EventType.JOB_STARTED,
          jobId: job1Id,
          data: {},
        },
        {
          type: EventType.JOB_COMPLETED,
          jobId: job1Id,
          data: {},
        },
        {
          type: EventType.JOB_CREATED,
          jobId: job2Id,
          data: {},
        },
        {
          type: EventType.JOB_FAILED,
          jobId: job2Id,
          data: {},
        },
      ]);
    });

    it('应该读取所有事件', async () => {
      const events = await logger.readAllEvents();
      expect(events).toHaveLength(5);
    });

    it('应该按事件类型过滤', async () => {
      const createdEvents = await logger.filterEventsByType(EventType.JOB_CREATED);
      expect(createdEvents).toHaveLength(2);
      createdEvents.forEach((event) => {
        expect(event.type).toBe(EventType.JOB_CREATED);
      });

      const completedEvents = await logger.filterEventsByType(EventType.JOB_COMPLETED);
      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].jobId).toBe(job1Id);
    });

    it('应该按 jobId 过滤', async () => {
      const job1Events = await logger.filterEventsByJobId(job1Id);
      expect(job1Events).toHaveLength(3);
      job1Events.forEach((event) => {
        expect(event.jobId).toBe(job1Id);
      });

      const job2Events = await logger.filterEventsByJobId(job2Id);
      expect(job2Events).toHaveLength(2);
      job2Events.forEach((event) => {
        expect(event.jobId).toBe(job2Id);
      });
    });

    it('应该正确获取事件数量', async () => {
      const count = await logger.getEventCount();
      expect(count).toBe(5);
    });
  });

  describe('敏感信息脱敏', () => {
    it('应该在写入前掩盖敏感内容', async () => {
      const jobId = uuidv4();
      await logger.logEvent({
        type: EventType.JOB_CREATED,
        jobId,
        data: {
          apiKey: 'sk-XYZ123456789',
          notes: 'Authorization: Bearer sk-secret token=abc',
          processEnv: { OPENAI_API_KEY: 'sk-987654321', SAFE_FLAG: 'ok' },
          env: ['PASSWORD=topsecret'],
        },
      });

      const events = await logger.readAllEvents();
      expect(events).toHaveLength(1);
      const event = events[0];
      expect(event.data.apiKey).toBe('[REDACTED]');
      expect(typeof event.data.notes).toBe('string');
      expect((event.data.notes as string).includes('[REDACTED]')).toBe(true);
      expect(event.data.processEnv).toBe('[REDACTED]');
      expect(event.data.env).toEqual(['[REDACTED]']);

      const raw = await fs.readFile(logger.getLogFilePath(), 'utf-8');
      expect(raw).not.toContain('sk-XYZ123456789');
      expect(raw).not.toContain('topsecret');
    });
  });

  describe('边缘情况', () => {
    it('应该处理空日志文件 (返回空数组)', async () => {
      const events = await logger.readAllEvents();
      expect(events).toEqual([]);

      const count = await logger.getEventCount();
      expect(count).toBe(0);
    });

    it('应该处理不存在的日志文件', async () => {
      const newLogger = createEventLogger({
        logDir: path.join(testLogDir, 'nonexistent'),
        logFileName: 'does-not-exist.jsonl',
      });

      const events = await newLogger.readAllEvents();
      expect(events).toEqual([]);

      const count = await newLogger.getEventCount();
      expect(count).toBe(0);
    });

    it('应该正确清空日志文件', async () => {
      // 写入一些事件
      await logger.logEvents([
        { type: EventType.JOB_CREATED, jobId: uuidv4(), data: {} },
        { type: EventType.JOB_STARTED, jobId: uuidv4(), data: {} },
      ]);

      expect(await logger.getEventCount()).toBe(2);

      // 清空日志
      await logger.clearLogs();

      // 验证日志已清空
      expect(await logger.getEventCount()).toBe(0);
      expect(await logger.readAllEvents()).toEqual([]);
    });

    it('应该处理包含特殊字符的数据', async () => {
      await logger.logEvent({
        type: EventType.JOB_CREATED,
        jobId: uuidv4(),
        data: {
          message: 'Line 1\nLine 2\tTabbed',
          unicode: '中文测试 🎉',
          quotes: 'He said "Hello"',
        },
      });

      const events = await logger.readAllEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data).toEqual({
        message: 'Line 1\nLine 2\tTabbed',
        unicode: '中文测试 🎉',
        quotes: 'He said "Hello"',
      });
    });
  });

  describe('工厂函数', () => {
    it('应该通过工厂函数创建 EventLogger', () => {
      const logger = createEventLogger({
        logDir: testLogDir,
        logFileName: 'factory-test.jsonl',
      });

      expect(logger).toBeInstanceOf(EventLogger);
      expect(logger.getLogFilePath()).toContain('factory-test.jsonl');
    });
  });
});
