/**
 * Codex JSON-RPC Client - Codex JSON-RPC 客户端
 *
 * 负责与 Codex 进程的 JSON-RPC 通信
 * 参考: specs/005-docs-prd-draft/contracts/codex-jsonrpc.yaml
 *
 * 设计原则:
 * - 单一职责: 仅负责与 Codex 的 JSON-RPC 通信
 * - 依赖倒置: 依赖于抽象的通信接口,不依赖具体实现
 * - 开闭原则: 可扩展事件处理器,无需修改核心代码
 *
 * 通信方式:
 * - 传输: stdio (line-delimited JSON)
 * - 协议: JSON-RPC 2.0
 * - 启动: codex mcp (MVP1)
 */

import { EventEmitter } from 'events';
import * as readline from 'readline';
import { Readable, Writable } from 'stream';
import {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCNotification,
  JSONRPCErrorCode,
  isJSONRPCResponse,
  isJSONRPCNotification,
} from './protocol/types.js';

/**
 * Codex 新会话请求参数
 */
export interface CodexNewConversationParams {
  model?: string; // 模型名称
  profile?: string; // 命名配置文件
  cwd?: string; // 工作目录
  approvalPolicy?: 'untrusted' | 'on-request' | 'on-failure' | 'never';
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
  config?: Record<string, unknown>; // 额外配置覆盖
  baseInstructions?: string; // 指令覆盖
  includePlanTool?: boolean;
  includeApplyPatchTool?: boolean;
}

/**
 * Codex 新会话响应结果
 */
export interface CodexNewConversationResult {
  conversationId: string; // UUID
  model: string;
  reasoningEffort?: string | null;
  rolloutPath: string; // Rollout 文件路径
}

/**
 * Codex 用户消息项
 */
export interface CodexUserMessageItem {
  type: 'text' | 'image';
  text?: string;
  imageUrl?: string;
}

/**
 * Codex 发送用户消息请求参数
 */
export interface CodexSendUserMessageParams {
  conversationId: string; // UUID
  items: CodexUserMessageItem[];
}

/**
 * Codex 发送用户消息响应结果
 */
export interface CodexSendUserMessageResult {
  status: string;
}

/**
 * Codex 事件类型
 */
export type CodexEvent = JSONRPCNotification;

/**
 * Codex 客户端配置
 */
export interface CodexClientConfig {
  stdin: Writable; // Codex 进程的 stdin
  stdout: Readable; // Codex 进程的 stdout
  timeout?: number; // 请求超时时间(毫秒,默认: 30000)
  debug?: boolean; // 是否输出调试日志
}

/**
 * Codex JSON-RPC 客户端
 *
 * 职责 (Single Responsibility):
 * - 发送 JSON-RPC 请求到 Codex 进程
 * - 接收并解析 JSON-RPC 响应和通知
 * - 管理请求/响应关联 (通过 id)
 * - 触发事件监听器
 */
export class CodexClient extends EventEmitter {
  private stdin: Writable;
  private stdout: Readable;
  private rl: readline.Interface;
  private pendingRequests: Map<
    string | number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timer: NodeJS.Timeout;
    }
  >;
  private nextId: number;
  private timeout: number;
  private debug: boolean;
  private closed: boolean;

  constructor(config: CodexClientConfig) {
    super();
    this.stdin = config.stdin;
    this.stdout = config.stdout;
    this.timeout = config.timeout ?? 30000;
    this.debug = config.debug ?? false;
    this.pendingRequests = new Map();
    this.nextId = 1;
    this.closed = false;

    // 创建逐行读取器
    this.rl = readline.createInterface({
      input: this.stdout,
      crlfDelay: Infinity,
    });

    // 监听每一行输出
    this.rl.on('line', (line) => {
      this.handleLine(line);
    });

    // 监听流关闭
    this.rl.on('close', () => {
      this.handleClose();
    });
  }

  /**
   * 创建新会话
   *
   * @param params 新会话参数
   * @returns 新会话结果
   */
  async newConversation(
    params: CodexNewConversationParams
  ): Promise<CodexNewConversationResult> {
    const result = await this.request<CodexNewConversationResult>(
      'newConversation',
      params
    );
    return result;
  }

  /**
   * 发送用户消息
   *
   * @param params 发送消息参数
   * @returns 发送结果
   */
  async sendUserMessage(
    params: CodexSendUserMessageParams
  ): Promise<CodexSendUserMessageResult> {
    const result = await this.request<CodexSendUserMessageResult>(
      'sendUserMessage',
      params
    );
    return result;
  }

  /**
   * 发送 JSON-RPC 请求
   *
   * @param method JSON-RPC 方法名
   * @param params 请求参数
   * @returns 响应结果
   */
  async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (this.closed) {
      throw new Error('CodexClient is closed');
    }

    const id = this.nextId++;
    const request: JSONRPCRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    // 创建 Promise 和超时定时器
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method} (id: ${id})`));
      }, this.timeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });

      // 发送请求
      const line = JSON.stringify(request);
      if (this.debug) {
        console.log('[CodexClient] Sending request:', line);
      }
      this.stdin.write(line + '\n');
    });
  }

  /**
   * 发送 JSON-RPC 通知 (无响应)
   *
   * @param method JSON-RPC 方法名
   * @param params 通知参数
   */
  notify(method: string, params?: unknown): void {
    if (this.closed) {
      throw new Error('CodexClient is closed');
    }

    const notification: JSONRPCNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const line = JSON.stringify(notification);
    if (this.debug) {
      console.log('[CodexClient] Sending notification:', line);
    }
    this.stdin.write(line + '\n');
  }

  /**
   * 关闭客户端
   */
  close(): void {
    if (this.closed) return;

    this.closed = true;

    // 拒绝所有待处理的请求
    const pendingEntries = Array.from(this.pendingRequests.entries());
    for (const [id, pending] of pendingEntries) {
      clearTimeout(pending.timer);
      pending.reject(new Error(`CodexClient closed (request id: ${id})`));
    }
    this.pendingRequests.clear();

    // 关闭 readline
    this.rl.close();

    this.emit('close');
  }

  /**
   * 检查客户端是否已关闭
   */
  isClosed(): boolean {
    return this.closed;
  }

  /**
   * 处理从 Codex 接收的每一行数据
   *
   * @param line 一行 JSON 数据
   */
  private handleLine(line: string): void {
    if (this.debug) {
      console.log('[CodexClient] Received line:', line);
    }

    try {
      const message = JSON.parse(line);

      // 检查是否为响应
      if (isJSONRPCResponse(message)) {
        this.handleResponse(message);
        return;
      }

      // 检查是否为通知
      if (isJSONRPCNotification(message)) {
        this.handleNotification(message);
        return;
      }

      // 未知消息类型
      if (this.debug) {
        console.warn('[CodexClient] Unknown message type:', message);
      }
    } catch (error) {
      console.error('[CodexClient] Failed to parse line:', line, error);
      this.emit('error', new Error(`Failed to parse JSON: ${line}`));
    }
  }

  /**
   * 处理 JSON-RPC 响应
   *
   * @param response JSON-RPC 响应对象
   */
  private handleResponse(response: JSONRPCResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      if (this.debug) {
        console.warn('[CodexClient] Received response for unknown id:', response.id);
      }
      return;
    }

    // 清除超时定时器
    clearTimeout(pending.timer);
    this.pendingRequests.delete(response.id);

    // 检查是否为错误响应
    if (response.error) {
      pending.reject(
        new Error(
          `JSON-RPC error (code: ${response.error.code}): ${response.error.message}`
        )
      );
      return;
    }

    // 正常响应
    pending.resolve(response.result);
  }

  /**
   * 处理 JSON-RPC 通知
   *
   * @param notification JSON-RPC 通知对象
   */
  private handleNotification(notification: JSONRPCNotification): void {
    // 触发事件: 'notification' 和具体的方法名
    this.emit('notification', notification);
    this.emit(notification.method, notification.params);
  }

  /**
   * 处理流关闭事件
   */
  private handleClose(): void {
    if (!this.closed) {
      this.close();
    }
  }
}

/**
 * 创建 Codex 客户端的工厂函数
 *
 * @param config 客户端配置
 * @returns CodexClient 实例
 */
export function createCodexClient(config: CodexClientConfig): CodexClient {
  return new CodexClient(config);
}