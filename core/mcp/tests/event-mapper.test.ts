/**
 * Event Mapper Unit Tests - 事件映射器单元测试
 *
 * 测试覆盖:
 * - 事件类型映射 (所有 EventType → MCPProgressEventType)
 * - 事件数据提取
 * - 批量事件映射
 * - 配置管理 (includeRawEvent, debug)
 * - 工厂函数
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { EventMapper, createEventMapper, mapEvent } from '../event-mapper.js';
import { Event, EventType } from '../../lib/types.js';
import { MCPProgressEventType } from '../protocol/types.js';

describe('EventMapper', () => {
  let mapper: EventMapper;

  beforeEach(() => {
    // 创建默认映射器
    mapper = createEventMapper();
  });

  describe('基本功能', () => {
    it('应该创建 EventMapper 实例', () => {
      expect(mapper).toBeInstanceOf(EventMapper);
    });

    it('应该使用默认配置', () => {
      const config = mapper.getConfig();

      expect(config.includeRawEvent).toBe(false);
      expect(config.debug).toBe(false);
    });

    it('应该使用自定义配置', () => {
      const customMapper = createEventMapper({
        includeRawEvent: true,
        debug: true,
      });

      const config = customMapper.getConfig();
      expect(config.includeRawEvent).toBe(true);
      expect(config.debug).toBe(true);
    });
  });

  describe('Job 事件映射', () => {
    it('应该映射 JOB_CREATED → TASK_STARTED', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_CREATED,
        timestamp: new Date('2025-01-01T10:00:00Z'),
        jobId: uuidv4(),
        data: {
          prompt: 'Test prompt',
        },
      };

      const notification = mapper.mapEvent(event, event.jobId);

      expect(notification.jsonrpc).toBe('2.0');
      expect(notification.method).toBe('codex-father/progress');
      expect(notification.params.jobId).toBe(event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_STARTED);
      expect(notification.params.eventData.eventId).toBe(event.eventId);
      expect(notification.params.timestamp).toBe('2025-01-01T10:00:00.000Z');
    });

    it('应该映射 JOB_STARTED → TASK_STARTED', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_STARTED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_STARTED);
    });

    it('应该映射 JOB_COMPLETED → TASK_COMPLETE', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_COMPLETED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {
          result: 'Success',
        },
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_COMPLETE);
    });

    it('应该映射 JOB_FAILED → TASK_ERROR', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_FAILED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {
          error: 'Test error',
        },
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_ERROR);
    });

    it('应该映射 JOB_TIMEOUT → TASK_ERROR', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_TIMEOUT,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_ERROR);
    });

    it('应该映射 JOB_CANCELLED → TASK_COMPLETE', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_CANCELLED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_COMPLETE);
    });
  });

  describe('Session 事件映射', () => {
    it('应该映射 SESSION_CREATED → TASK_STARTED', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.SESSION_CREATED,
        timestamp: new Date(),
        jobId: uuidv4(),
        sessionId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_STARTED);
    });

    it('应该映射 SESSION_ACTIVE → TASK_STARTED', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.SESSION_ACTIVE,
        timestamp: new Date(),
        jobId: uuidv4(),
        sessionId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_STARTED);
    });

    it('应该映射 SESSION_IDLE → AGENT_MESSAGE', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.SESSION_IDLE,
        timestamp: new Date(),
        jobId: uuidv4(),
        sessionId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.AGENT_MESSAGE);
    });

    it('应该映射 SESSION_RECOVERING → AGENT_MESSAGE', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.SESSION_RECOVERING,
        timestamp: new Date(),
        jobId: uuidv4(),
        sessionId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.AGENT_MESSAGE);
    });

    it('应该映射 SESSION_TERMINATED → TASK_COMPLETE', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.SESSION_TERMINATED,
        timestamp: new Date(),
        jobId: uuidv4(),
        sessionId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_COMPLETE);
    });
  });

  describe('Process 事件映射', () => {
    it('应该映射 PROCESS_STARTED → TASK_STARTED', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.PROCESS_STARTED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {
          processId: 12345,
        },
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_STARTED);
    });

    it('应该映射 PROCESS_RESTARTED → TASK_STARTED', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.PROCESS_RESTARTED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_STARTED);
    });

    it('应该映射 PROCESS_CRASHED → TASK_ERROR', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.PROCESS_CRASHED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {
          error: 'Segmentation fault',
        },
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_ERROR);
    });
  });

  describe('Approval 事件映射', () => {
    it('应该映射 APPROVAL_REQUESTED → APPROVAL_REQUIRED', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.APPROVAL_REQUESTED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {
          requestId: uuidv4(),
        },
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.APPROVAL_REQUIRED);
    });

    it('应该映射 APPROVAL_APPROVED → AGENT_MESSAGE', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.APPROVAL_APPROVED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.AGENT_MESSAGE);
    });

    it('应该映射 APPROVAL_DENIED → AGENT_MESSAGE', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.APPROVAL_DENIED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.AGENT_MESSAGE);
    });

    it('应该映射 APPROVAL_AUTO_APPROVED → AGENT_MESSAGE', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.APPROVAL_AUTO_APPROVED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.AGENT_MESSAGE);
    });
  });

  describe('Codex 转发事件映射', () => {
    it('应该映射 CODEX_TASK_STARTED → TASK_STARTED', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.CODEX_TASK_STARTED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_STARTED);
    });

    it('应该映射 CODEX_AGENT_MESSAGE → AGENT_MESSAGE', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.CODEX_AGENT_MESSAGE,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {
          message: 'Agent message',
        },
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.AGENT_MESSAGE);
    });

    it('应该映射 CODEX_TASK_COMPLETE → TASK_COMPLETE', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.CODEX_TASK_COMPLETE,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_COMPLETE);
    });

    it('应该映射 CODEX_TASK_ERROR → TASK_ERROR', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.CODEX_TASK_ERROR,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {
          error: 'Task error',
        },
      };

      const notification = mapper.mapEvent(event, event.jobId);
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_ERROR);
    });
  });

  describe('事件数据提取', () => {
    it('应该提取基础事件字段', () => {
      const jobId = uuidv4();
      const eventId = uuidv4();
      const sessionId = uuidv4();

      const event: Event = {
        eventId,
        type: EventType.JOB_STARTED,
        timestamp: new Date('2025-01-01T12:00:00Z'),
        jobId,
        sessionId,
        data: {},
      };

      const notification = mapper.mapEvent(event, jobId);

      expect(notification.params.eventData.eventId).toBe(eventId);
      expect(notification.params.eventData.eventType).toBe(EventType.JOB_STARTED);
      expect(notification.params.eventData.timestamp).toBe('2025-01-01T12:00:00.000Z');
      expect(notification.params.eventData.jobId).toBe(jobId);
      expect(notification.params.eventData.sessionId).toBe(sessionId);
    });

    it('应该合并事件的 data 字段', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_COMPLETED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {
          result: 'Success',
          duration: 5000,
          output: 'Task completed',
        },
      };

      const notification = mapper.mapEvent(event, event.jobId);

      expect(notification.params.eventData.result).toBe('Success');
      expect(notification.params.eventData.duration).toBe(5000);
      expect(notification.params.eventData.output).toBe('Task completed');
    });

    it('应该处理没有 data 字段的事件', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_STARTED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);

      // 应该仍然包含基础字段
      expect(notification.params.eventData.eventId).toBeDefined();
      expect(notification.params.eventData.eventType).toBe(EventType.JOB_STARTED);
    });

    it('应该处理嵌套的复杂数据', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_FAILED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {
          error: {
            message: 'Test error',
            code: 500,
            stack: 'Error stack trace',
          },
          metadata: {
            retry: 3,
            timeout: true,
          },
        },
      };

      const notification = mapper.mapEvent(event, event.jobId);

      expect(notification.params.eventData.error).toEqual({
        message: 'Test error',
        code: 500,
        stack: 'Error stack trace',
      });
      expect(notification.params.eventData.metadata).toEqual({
        retry: 3,
        timeout: true,
      });
    });
  });

  describe('批量映射', () => {
    it('应该批量映射多个事件', () => {
      const jobId = uuidv4();

      const events: Event[] = [
        {
          eventId: uuidv4(),
          type: EventType.JOB_CREATED,
          timestamp: new Date(),
          jobId,
          data: {},
        },
        {
          eventId: uuidv4(),
          type: EventType.JOB_STARTED,
          timestamp: new Date(),
          jobId,
          data: {},
        },
        {
          eventId: uuidv4(),
          type: EventType.JOB_COMPLETED,
          timestamp: new Date(),
          jobId,
          data: {},
        },
      ];

      const notifications = mapper.mapEvents(events, jobId);

      expect(notifications).toHaveLength(3);
      expect(notifications[0].params.eventType).toBe(MCPProgressEventType.TASK_STARTED);
      expect(notifications[1].params.eventType).toBe(MCPProgressEventType.TASK_STARTED);
      expect(notifications[2].params.eventType).toBe(MCPProgressEventType.TASK_COMPLETE);

      // 验证所有通知都有相同的 jobId
      notifications.forEach((notification) => {
        expect(notification.params.jobId).toBe(jobId);
      });
    });

    it('应该处理空事件数组', () => {
      const notifications = mapper.mapEvents([], uuidv4());
      expect(notifications).toEqual([]);
    });

    it('应该处理大量事件', () => {
      const jobId = uuidv4();
      const events: Event[] = Array.from({ length: 100 }, (_, i) => ({
        eventId: uuidv4(),
        type: EventType.CODEX_AGENT_MESSAGE,
        timestamp: new Date(),
        jobId,
        data: { index: i },
      }));

      const notifications = mapper.mapEvents(events, jobId);

      expect(notifications).toHaveLength(100);
      notifications.forEach((notification, i) => {
        expect(notification.params.eventData.index).toBe(i);
      });
    });
  });

  describe('配置: includeRawEvent', () => {
    it('应该在启用时包含原始事件', () => {
      const rawEventMapper = createEventMapper({ includeRawEvent: true });

      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_STARTED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {
          test: 'data',
        },
      };

      const notification = rawEventMapper.mapEvent(event, event.jobId);

      // 验证包含 _raw 字段
      expect(notification.params.eventData._raw).toBeDefined();
      expect(notification.params.eventData._raw).toEqual(event);
    });

    it('应该在禁用时不包含原始事件', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_STARTED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);

      // 验证不包含 _raw 字段
      expect(notification.params.eventData._raw).toBeUndefined();
    });
  });

  describe('配置: debug', () => {
    it('应该在启用 debug 时输出日志', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const debugMapper = createEventMapper({ debug: true });

      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_STARTED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {},
      };

      debugMapper.mapEvent(event, event.jobId);

      // 验证输出了日志
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('[EventMapper] Mapping event type')
      );

      consoleLogSpy.mockRestore();
    });

    it('应该在禁用 debug 时不输出日志', () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_STARTED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {},
      };

      mapper.mapEvent(event, event.jobId);

      // 验证没有输出日志
      expect(consoleLogSpy).not.toHaveBeenCalled();

      consoleLogSpy.mockRestore();
    });

    it('应该在遇到未知事件类型时输出警告', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const debugMapper = createEventMapper({ debug: true });

      const event: Event = {
        eventId: uuidv4(),
        type: 'UNKNOWN_EVENT' as EventType,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {},
      };

      debugMapper.mapEvent(event, event.jobId);

      // 验证输出了警告
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[EventMapper] Unknown event type')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('配置管理', () => {
    it('应该更新配置', () => {
      mapper.updateConfig({
        includeRawEvent: true,
        debug: true,
      });

      const config = mapper.getConfig();

      expect(config.includeRawEvent).toBe(true);
      expect(config.debug).toBe(true);
    });

    it('应该部分更新配置', () => {
      mapper.updateConfig({
        debug: true,
      });

      const config = mapper.getConfig();

      expect(config.includeRawEvent).toBe(false); // 未修改
      expect(config.debug).toBe(true);
    });

    it('应该返回配置的副本 (不影响内部状态)', () => {
      const config1 = mapper.getConfig();
      config1.includeRawEvent = true; // 修改副本

      const config2 = mapper.getConfig();

      // 内部配置不应该被修改
      expect(config2.includeRawEvent).toBe(false);
    });
  });

  describe('工厂函数', () => {
    it('应该通过 createEventMapper 创建实例', () => {
      const mapper = createEventMapper();
      expect(mapper).toBeInstanceOf(EventMapper);
    });

    it('应该通过 mapEvent 简化单次映射', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_STARTED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {},
      };

      const notification = mapEvent(event, event.jobId);

      expect(notification.jsonrpc).toBe('2.0');
      expect(notification.method).toBe('codex-father/progress');
      expect(notification.params.eventType).toBe(MCPProgressEventType.TASK_STARTED);
    });
  });

  describe('边缘情况', () => {
    it('应该处理 data 为 null 的事件', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_STARTED,
        timestamp: new Date(),
        jobId: uuidv4(),
        // @ts-expect-error - 故意测试 null data
        data: null,
      };

      const notification = mapper.mapEvent(event, event.jobId);

      // 应该仍然包含基础字段
      expect(notification.params.eventData.eventId).toBeDefined();
    });

    it('应该处理包含特殊字符的数据', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_FAILED,
        timestamp: new Date(),
        jobId: uuidv4(),
        data: {
          error: 'Line 1\nLine 2\tTabbed',
          message: '测试中文 🎉',
          path: '/path/with spaces/file.txt',
        },
      };

      const notification = mapper.mapEvent(event, event.jobId);

      expect(notification.params.eventData.error).toBe('Line 1\nLine 2\tTabbed');
      expect(notification.params.eventData.message).toBe('测试中文 🎉');
      expect(notification.params.eventData.path).toBe('/path/with spaces/file.txt');
    });

    it('应该处理未定义的 sessionId', () => {
      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_STARTED,
        timestamp: new Date(),
        jobId: uuidv4(),
        // sessionId 未定义
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);

      expect(notification.params.eventData.sessionId).toBeUndefined();
    });

    it('应该正确序列化 Date 对象', () => {
      const timestamp = new Date('2025-06-15T08:30:45.123Z');

      const event: Event = {
        eventId: uuidv4(),
        type: EventType.JOB_COMPLETED,
        timestamp,
        jobId: uuidv4(),
        data: {},
      };

      const notification = mapper.mapEvent(event, event.jobId);

      // 验证 ISO 字符串格式
      expect(notification.params.timestamp).toBe('2025-06-15T08:30:45.123Z');
      expect(notification.params.eventData.timestamp).toBe('2025-06-15T08:30:45.123Z');
    });
  });
});
