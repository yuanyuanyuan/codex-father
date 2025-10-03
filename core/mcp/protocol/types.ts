/**
 * MCP Protocol Types - MCP 协议类型定义
 *
 * 定义标准 MCP (Model Context Protocol) JSON-RPC 2.0 消息格式
 * 参考: specs/005-docs-prd-draft/contracts/mcp-protocol.yaml
 *
 * 设计原则:
 * - 严格遵循 MCP 标准规范
 * - JSON-RPC 2.0 over line-delimited JSON (stdio 传输)
 * - 类型安全: TypeScript 类型定义 + Zod schema 验证
 */

import { z } from 'zod';

/**
 * JSON-RPC 2.0 基础类型
 */
export type JSONRPCVersion = '2.0';
export type JSONRPCId = string | number;

/**
 * JSON-RPC 2.0 错误码
 * 参考: https://www.jsonrpc.org/specification#error_object
 */
export enum JSONRPCErrorCode {
  PARSE_ERROR = -32700, // 解析错误
  INVALID_REQUEST = -32600, // 无效请求
  METHOD_NOT_FOUND = -32601, // 方法不存在
  INVALID_PARAMS = -32602, // 无效参数
  INTERNAL_ERROR = -32603, // 内部错误
  SERVER_ERROR = -32000, // 服务器错误（自定义范围: -32000 to -32099）
}

/**
 * JSON-RPC 2.0 错误对象
 */
export interface JSONRPCError {
  code: JSONRPCErrorCode;
  message: string;
  data?: unknown;
}

export const JSONRPCErrorSchema = z.object({
  code: z.nativeEnum(JSONRPCErrorCode),
  message: z.string(),
  data: z.unknown().optional(),
});

/**
 * JSON-RPC 2.0 基础请求
 */
export interface JSONRPCRequest<T = unknown> {
  jsonrpc: JSONRPCVersion;
  id: JSONRPCId;
  method: string;
  params?: T;
}

export const JSONRPCRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.string(),
  params: z.unknown().optional(),
});

/**
 * JSON-RPC 2.0 基础响应
 */
export interface JSONRPCResponse<T = unknown> {
  jsonrpc: JSONRPCVersion;
  id: JSONRPCId;
  result?: T;
  error?: JSONRPCError;
}

export const JSONRPCResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.unknown().optional(),
  error: JSONRPCErrorSchema.optional(),
});

/**
 * JSON-RPC 2.0 通知（无 id 字段）
 */
export interface JSONRPCNotification<T = unknown> {
  jsonrpc: JSONRPCVersion;
  method: string;
  params?: T;
}

export const JSONRPCNotificationSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.unknown().optional(),
});

// ========== MCP Initialize ==========

/**
 * MCP 客户端能力
 */
export interface MCPClientCapabilities {
  roots?: {
    listChanged?: boolean;
  };
  sampling?: Record<string, unknown>;
}

export const MCPClientCapabilitiesSchema = z.object({
  roots: z
    .object({
      listChanged: z.boolean().optional(),
    })
    .optional(),
  sampling: z.record(z.unknown()).optional(),
});

/**
 * MCP 客户端信息
 */
export interface MCPClientInfo {
  name: string;
  version: string;
}

export const MCPClientInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
});

/**
 * MCP initialize 请求参数
 */
export interface MCPInitializeParams {
  protocolVersion: string;
  capabilities: MCPClientCapabilities;
  clientInfo: MCPClientInfo;
}

export const MCPInitializeParamsSchema = z.object({
  protocolVersion: z.string(),
  capabilities: MCPClientCapabilitiesSchema,
  clientInfo: MCPClientInfoSchema,
});

/**
 * MCP 服务器能力
 */
export interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  notifications?: Record<string, unknown>;
}

export const MCPServerCapabilitiesSchema = z.object({
  tools: z
    .object({
      listChanged: z.boolean().optional(),
    })
    .optional(),
  notifications: z.record(z.unknown()).optional(),
});

/**
 * MCP 服务器信息
 */
export interface MCPServerInfo {
  name: string;
  version: string;
}

export const MCPServerInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
});

/**
 * MCP initialize 响应结果
 */
export interface MCPInitializeResult {
  protocolVersion: string;
  capabilities: MCPServerCapabilities;
  serverInfo: MCPServerInfo;
}

export const MCPInitializeResultSchema = z.object({
  protocolVersion: z.string(),
  capabilities: MCPServerCapabilitiesSchema,
  serverInfo: MCPServerInfoSchema,
});

// ========== MCP Tools ==========

/**
 * MCP 工具输入 Schema (JSON Schema)
 */
export interface MCPToolInputSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export const MCPToolInputSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.unknown()),
  required: z.array(z.string()).optional(),
  additionalProperties: z.boolean().optional(),
});

/**
 * MCP 工具定义
 */
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: MCPToolInputSchema;
}

export const MCPToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: MCPToolInputSchemaSchema,
});

/**
 * MCP tools/list 响应结果
 */
export interface MCPToolsListResult {
  tools: MCPTool[];
}

export const MCPToolsListResultSchema = z.object({
  tools: z.array(MCPToolSchema),
});

/**
 * MCP tools/call 请求参数
 */
export interface MCPToolsCallParams {
  name: string;
  arguments: Record<string, unknown>;
}

export const MCPToolsCallParamsSchema = z.object({
  name: z.string(),
  arguments: z.record(z.unknown()),
});

/**
 * MCP tools/call 响应结果
 *
 * 快速返回机制 (< 500ms)：
 * - status: accepted 或 rejected
 * - jobId: 用于关联后续通知
 * - message: 人类可读的消息
 */
export interface MCPToolsCallResult {
  status: 'accepted' | 'rejected';
  jobId: string; // UUID
  conversationId?: string; // Codex 会话 ID (UUID)
  message: string;
}

export const MCPToolsCallResultSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
  jobId: z.string().uuid(),
  conversationId: z.string().uuid().optional(),
  message: z.string(),
});

// ========== MCP Notifications ==========

/**
 * MCP 进度事件类型
 */
export enum MCPProgressEventType {
  TASK_STARTED = 'task-started',
  AGENT_MESSAGE = 'agent-message',
  TASK_COMPLETE = 'task-complete',
  TASK_ERROR = 'task-error',
  APPROVAL_REQUIRED = 'approval-required',
}

/**
 * MCP 进度通知参数 (codex-father/progress)
 *
 * 用于推送任务执行进度，替代 tools/call 的阻塞等待
 */
export interface MCPProgressNotificationParams {
  jobId: string; // 关联的作业 ID (UUID)
  eventType: MCPProgressEventType;
  eventData: Record<string, unknown>; // 事件具体数据
  timestamp: string; // ISO 8601 时间戳
}

export const MCPProgressNotificationParamsSchema = z.object({
  jobId: z.string().uuid(),
  eventType: z.nativeEnum(MCPProgressEventType),
  eventData: z.record(z.unknown()),
  timestamp: z.string().datetime(),
});

/**
 * MCP 取消通知参数 (notifications/cancelled)
 *
 * 客户端请求取消正在执行的请求
 */
export interface MCPCancelNotificationParams {
  requestId: JSONRPCId; // 要取消的请求 ID
  reason?: string;
}

export const MCPCancelNotificationParamsSchema = z.object({
  requestId: z.union([z.string(), z.number()]),
  reason: z.string().optional(),
});

// ========== 具体的 MCP 消息类型 ==========

/**
 * MCP initialize 请求
 */
export type MCPInitializeRequest = JSONRPCRequest<MCPInitializeParams>;

/**
 * MCP initialize 响应
 */
export type MCPInitializeResponse = JSONRPCResponse<MCPInitializeResult>;

/**
 * MCP tools/list 请求
 */
export type MCPToolsListRequest = JSONRPCRequest<null>;

/**
 * MCP tools/list 响应
 */
export type MCPToolsListResponse = JSONRPCResponse<MCPToolsListResult>;

/**
 * MCP tools/call 请求
 */
export type MCPToolsCallRequest = JSONRPCRequest<MCPToolsCallParams>;

/**
 * MCP tools/call 响应
 */
export type MCPToolsCallResponse = JSONRPCResponse<MCPToolsCallResult>;

/**
 * MCP 进度通知 (服务端 → 客户端)
 */
export type MCPProgressNotification = JSONRPCNotification<MCPProgressNotificationParams>;

/**
 * MCP 取消通知 (客户端 → 服务端)
 */
export type MCPCancelNotification = JSONRPCNotification<MCPCancelNotificationParams>;

// ========== 辅助类型 ==========

/**
 * MCP 方法名称
 */
export enum MCPMethod {
  INITIALIZE = 'initialize',
  TOOLS_LIST = 'tools/list',
  TOOLS_CALL = 'tools/call',
  PROGRESS = 'codex-father/progress',
  CANCELLED = 'notifications/cancelled',
}

/**
 * MCP 消息联合类型 (用于类型守卫)
 */
export type MCPMessage =
  | MCPInitializeRequest
  | MCPInitializeResponse
  | MCPToolsListRequest
  | MCPToolsListResponse
  | MCPToolsCallRequest
  | MCPToolsCallResponse
  | MCPProgressNotification
  | MCPCancelNotification;

// ========== 工厂函数 ==========

/**
 * 创建 JSON-RPC 请求
 */
export function createJSONRPCRequest<T>(
  id: JSONRPCId,
  method: string,
  params?: T
): JSONRPCRequest<T> {
  const request: JSONRPCRequest<T> = {
    jsonrpc: '2.0',
    id,
    method,
  };

  if (params !== undefined) {
    request.params = params;
  }

  return request;
}

/**
 * 创建 JSON-RPC 响应
 */
export function createJSONRPCResponse<T>(id: JSONRPCId, result: T): JSONRPCResponse<T> {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * 创建 JSON-RPC 错误响应
 */
export function createJSONRPCErrorResponse(id: JSONRPCId, error: JSONRPCError): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    error,
  };
}

/**
 * 创建 JSON-RPC 通知
 */
export function createJSONRPCNotification<T>(method: string, params?: T): JSONRPCNotification<T> {
  const notification: JSONRPCNotification<T> = {
    jsonrpc: '2.0',
    method,
  };

  if (params !== undefined) {
    notification.params = params;
  }

  return notification;
}

// ========== 类型守卫 ==========

/**
 * 检查是否为 JSON-RPC 请求
 */
export function isJSONRPCRequest(msg: unknown): msg is JSONRPCRequest {
  return JSONRPCRequestSchema.safeParse(msg).success;
}

/**
 * 检查是否为 JSON-RPC 响应
 */
export function isJSONRPCResponse(msg: unknown): msg is JSONRPCResponse {
  return JSONRPCResponseSchema.safeParse(msg).success;
}

/**
 * 检查是否为 JSON-RPC 通知
 */
export function isJSONRPCNotification(msg: unknown): msg is JSONRPCNotification {
  return JSONRPCNotificationSchema.safeParse(msg).success;
}

/**
 * 检查是否为 JSON-RPC 错误响应
 */
export function isJSONRPCError(msg: unknown): boolean {
  if (!isJSONRPCResponse(msg)) {
    return false;
  }
  return msg.error !== undefined;
}
