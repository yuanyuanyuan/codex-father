/**
 * Event Mapper - 事件映射器
 *
 * 负责将 Codex 事件映射为 MCP 进度通知
 * 参考: specs/005-docs-prd-draft/data-model.md:269-322
 *
 * 设计原则:
 * - 单一职责: 仅负责事件格式转换
 * - 开闭原则: 可扩展新的事件类型映射
 * - 类型安全: 使用严格的类型检查
 *
 * 映射规则:
 * - Codex Event → MCP Progress Notification
 * - 保留 jobId 关联
 * - 转换事件类型和数据格式
 */

import { Event, EventType } from '../lib/types.js';
import {
  MCPProgressNotification,
  MCPProgressEventType,
  MCPProgressNotificationParams,
  createJSONRPCNotification,
} from './protocol/types.js';

/**
 * 事件映射器配置
 */
export interface EventMapperConfig {
  includeRawEvent?: boolean; // 是否在 eventData 中包含原始事件 (默认: false)
  debug?: boolean; // 是否输出调试日志 (默认: false)
}

/**
 * 事件映射器
 *
 * 职责 (Single Responsibility):
 * - 将 Codex 内部事件转换为 MCP 标准通知格式
 * - 提取和转换事件数据
 * - 保持 jobId 关联
 */
export class EventMapper {
  private config: Required<EventMapperConfig>;

  constructor(config?: EventMapperConfig) {
    this.config = {
      includeRawEvent: config?.includeRawEvent ?? false,
      debug: config?.debug ?? false,
    };
  }

  /**
   * 映射事件到 MCP 进度通知
   *
   * @param event Codex 事件
   * @param jobId 关联的作业 ID
   * @returns MCP 进度通知
   */
  mapEvent(event: Event, jobId: string): MCPProgressNotification {
    if (this.config.debug) {
      console.log(`[EventMapper] Mapping event type: ${event.type}`);
    }

    // 根据事件类型进行映射
    const params = this.createProgressParams(event, jobId);

    // 创建 JSON-RPC 通知
    return createJSONRPCNotification('codex-father/progress', params);
  }

  /**
   * 批量映射多个事件
   *
   * @param events Codex 事件数组
   * @param jobId 关联的作业 ID
   * @returns MCP 进度通知数组
   */
  mapEvents(events: Event[], jobId: string): MCPProgressNotification[] {
    return events.map((event) => this.mapEvent(event, jobId));
  }

  /**
   * 创建进度通知参数
   *
   * @param event Codex 事件
   * @param jobId 关联的作业 ID
   * @returns MCP 进度通知参数
   */
  private createProgressParams(event: Event, jobId: string): MCPProgressNotificationParams {
    // 基础参数
    const baseParams: MCPProgressNotificationParams = {
      jobId,
      eventType: this.mapEventType(event.type),
      eventData: this.extractEventData(event),
      timestamp: event.timestamp.toISOString(),
    };

    // 如果启用,包含原始事件
    if (this.config.includeRawEvent) {
      baseParams.eventData._raw = event;
    }

    return baseParams;
  }

  /**
   * 映射事件类型
   *
   * @param eventType Codex 事件类型
   * @returns MCP 事件类型
   */
  private mapEventType(eventType: EventType): MCPProgressEventType {
    // 映射 Codex 事件到 MCP 进度事件
    switch (eventType) {
      // Job 事件
      case EventType.JOB_CREATED:
      case EventType.JOB_STARTED:
        return MCPProgressEventType.TASK_STARTED;

      case EventType.JOB_COMPLETED:
        return MCPProgressEventType.TASK_COMPLETE;

      case EventType.JOB_FAILED:
      case EventType.JOB_TIMEOUT:
        return MCPProgressEventType.TASK_ERROR;

      case EventType.JOB_CANCELLED:
        return MCPProgressEventType.TASK_COMPLETE;

      // Session 事件
      case EventType.SESSION_CREATED:
      case EventType.SESSION_ACTIVE:
        return MCPProgressEventType.TASK_STARTED;

      case EventType.SESSION_IDLE:
      case EventType.SESSION_RECOVERING:
        return MCPProgressEventType.AGENT_MESSAGE;

      case EventType.SESSION_TERMINATED:
        return MCPProgressEventType.TASK_COMPLETE;

      // Process 事件
      case EventType.PROCESS_STARTED:
      case EventType.PROCESS_RESTARTED:
        return MCPProgressEventType.TASK_STARTED;

      case EventType.PROCESS_CRASHED:
        return MCPProgressEventType.TASK_ERROR;

      // Approval 事件
      case EventType.APPROVAL_REQUESTED:
        return MCPProgressEventType.APPROVAL_REQUIRED;

      case EventType.APPROVAL_APPROVED:
      case EventType.APPROVAL_DENIED:
      case EventType.APPROVAL_AUTO_APPROVED:
        return MCPProgressEventType.AGENT_MESSAGE;

      // Codex 转发事件
      case EventType.CODEX_TASK_STARTED:
        return MCPProgressEventType.TASK_STARTED;

      case EventType.CODEX_AGENT_MESSAGE:
        return MCPProgressEventType.AGENT_MESSAGE;

      case EventType.CODEX_TASK_COMPLETE:
        return MCPProgressEventType.TASK_COMPLETE;

      case EventType.CODEX_TASK_ERROR:
        return MCPProgressEventType.TASK_ERROR;

      // 默认映射为 agent-message
      default:
        if (this.config.debug) {
          console.warn(
            `[EventMapper] Unknown event type: ${eventType}, defaulting to agent-message`
          );
        }
        return MCPProgressEventType.AGENT_MESSAGE;
    }
  }

  /**
   * 提取事件数据
   *
   * @param event Codex 事件
   * @returns 事件数据对象
   */
  private extractEventData(event: Event): Record<string, unknown> {
    // 提取所有事件的通用字段
    const baseData: Record<string, unknown> = {
      eventId: event.eventId,
      eventType: event.type,
      timestamp: event.timestamp.toISOString(),
      jobId: event.jobId,
      sessionId: event.sessionId,
    };

    // 合并事件的 data 字段
    if (event.data && typeof event.data === 'object') {
      Object.assign(baseData, event.data);
    }

    return baseData;
  }

  /**
   * 更新配置
   *
   * @param config 新配置
   */
  updateConfig(config: Partial<EventMapperConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * 获取当前配置
   */
  getConfig(): EventMapperConfig {
    return { ...this.config };
  }
}

/**
 * 创建事件映射器的工厂函数
 *
 * @param config 映射器配置
 * @returns EventMapper 实例
 */
export function createEventMapper(config?: EventMapperConfig): EventMapper {
  return new EventMapper(config);
}

/**
 * 简单的事件映射函数（无配置）
 *
 * @param event Codex 事件
 * @param jobId 关联的作业 ID
 * @returns MCP 进度通知
 */
export function mapEvent(event: Event, jobId: string): MCPProgressNotification {
  const mapper = createEventMapper();
  return mapper.mapEvent(event, jobId);
}
