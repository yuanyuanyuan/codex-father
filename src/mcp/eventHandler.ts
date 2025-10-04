import { z } from 'zod';
import {
  createJSONRPCNotification,
  type JSONRPCNotification,
} from '../../core/mcp/protocol/types.js';

// ============ Zod Schemas ============

// File change entry
const FileChangeSchema = z
  .object({
    path: z.string(),
    type: z.enum(['create', 'modify', 'delete']),
    diff: z.string().optional(),
    contentPreview: z.string().optional(),
  })
  .passthrough();

// Token usage snapshot
const TokenUsageSchema = z.object({
  inputTokens: z.number().int().min(0),
  cachedInputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  reasoningOutputTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
});

// Token usage info
const TokenUsageInfoSchema = z.object({
  totalTokenUsage: TokenUsageSchema,
  lastTokenUsage: TokenUsageSchema,
  modelContextWindow: z.number().int().min(0).nullable().optional(),
});

// Info wrapper
const InfoSchema = z.object({
  tokenUsage: TokenUsageInfoSchema,
  rateLimits: z.record(z.unknown()).nullable().optional(),
});

// Event type discriminator list (kept in sync with schema JSON)
const EventTypeEnum = z.enum([
  'error',
  'task_started',
  'task_complete',
  'token_count',
  'agent_message',
  'user_message',
  'agent_message_delta',
  'agent_reasoning',
  'agent_reasoning_delta',
  'agent_reasoning_raw_content',
  'agent_reasoning_raw_content_delta',
  'agent_reasoning_section_break',
  'session_configured',
  'mcp_tool_call_begin',
  'mcp_tool_call_end',
  'web_search_begin',
  'web_search_end',
  'exec_command_begin',
  'exec_command_output_delta',
  'exec_command_end',
  'exec_approval_request',
  'apply_patch_approval_request',
  'background_event',
  'stream_error',
  'patch_apply_begin',
  'patch_apply_end',
  'turn_diff',
  'get_history_entry_response',
  'mcp_list_tools_response',
  'list_custom_prompts_response',
  'plan_update',
  'turn_aborted',
  'shutdown_complete',
  'conversation_path',
  'entered_review_mode',
  'exited_review_mode',
]);

// Base event schema (with optional fields)
const BaseCodexEventSchema = z.object({
  type: EventTypeEnum,
  conversationId: z.string().optional(),
  taskId: z.string().optional(),
  callId: z.string().optional(),
  timestamp: z.string().datetime().optional(),
  message: z.string().optional(),
  role: z.enum(['assistant', 'user', 'system', 'tool']).optional(),
  delta: z.string().optional(),
  text: z.string().optional(),
  reason: z.string().optional(),
  command: z.union([z.array(z.string()).min(1), z.string().min(1)]).optional(),
  cwd: z.string().optional(),
  autoApproved: z.boolean().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  success: z.boolean().optional(),
  unifiedDiff: z.string().optional(),
  changes: z.record(FileChangeSchema).optional(),
  info: InfoSchema.optional(),
  tools: z.record(z.unknown()).optional(),
  customPrompts: z.array(z.object({}).passthrough()).optional(),
  reviewOutput: z.record(z.unknown()).nullable().optional(),
  entry: z.record(z.unknown()).nullable().optional(),
  _meta: z
    .object({
      requestId: z.string(),
    })
    .optional(),
});

// Apply conditional requirements per event type
export const CodexEventSchema = BaseCodexEventSchema.superRefine((val, ctx) => {
  const type = val.type;

  const ensure = (cond: boolean, field: string, msg?: string) => {
    if (!cond) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg ?? `Missing ${field}` });
    }
  };

  // Conditional requirements (aligned to JSON Schema allOf rules)
  if (type === 'agent_message') {
    ensure(!!val.message, 'message');
  }
  if (type === 'user_message') {
    ensure(!!val.message, 'message');
  }
  if (type === 'agent_message_delta') {
    ensure(!!val.delta, 'delta');
  }
  if (type === 'agent_reasoning') {
    ensure(!!val.text, 'text');
  }
  if (type === 'agent_reasoning_delta') {
    ensure(!!val.delta, 'delta');
  }
  if (type === 'agent_reasoning_raw_content') {
    ensure(!!val.text, 'text');
  }
  if (type === 'agent_reasoning_raw_content_delta') {
    ensure(!!val.delta, 'delta');
  }
  if (type === 'task_started') {
    ensure(!!val.conversationId, 'conversationId');
  }
  if (type === 'task_complete') {
    ensure(!!val.conversationId, 'conversationId');
  }
  if (type === 'token_count') {
    ensure(!!val.info && !!val.info.tokenUsage, 'info.tokenUsage');
  }
  if (type === 'exec_approval_request') {
    ensure(!!val.callId, 'callId');
    ensure(!!val.command, 'command');
    ensure(!!val.cwd, 'cwd');
  }
  if (type === 'apply_patch_approval_request') {
    ensure(!!val.callId, 'callId');
    ensure(!!val.changes && Object.keys(val.changes).length > 0, 'changes');
  }
  if (type === 'patch_apply_begin') {
    ensure(!!val.callId, 'callId');
    ensure(!!val.changes && Object.keys(val.changes).length > 0, 'changes');
    ensure(typeof val.autoApproved === 'boolean', 'autoApproved');
  }
  if (type === 'patch_apply_end') {
    ensure(!!val.callId, 'callId');
    ensure(typeof val.stdout === 'string', 'stdout');
    ensure(typeof val.stderr === 'string', 'stderr');
    ensure(typeof val.success === 'boolean', 'success');
  }
  if (type === 'turn_diff') {
    ensure(typeof val.unifiedDiff === 'string', 'unifiedDiff');
  }
});

export type CodexEvent = z.infer<typeof CodexEventSchema>;

// ============ JSON-RPC wrapper detection ============

interface JsonRpcLike {
  jsonrpc?: unknown;
  method?: unknown;
  params?: unknown;
}

function isCodexEventNotification(
  x: unknown
): x is JsonRpcLike & { method: 'codex/event'; params: unknown } {
  if (!x || typeof x !== 'object') {
    return false;
  }
  const m = (x as JsonRpcLike).method;
  return m === 'codex/event';
}

// ============ API ============

/**
 * 解析 Codex 事件（支持 JSON-RPC Notification 形式与纯事件负载形式）。
 */
export function parseCodexEvent(event: unknown): CodexEvent {
  const payload = isCodexEventNotification(event) ? (event as any).params : event;
  const parsed = CodexEventSchema.safeParse(payload);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => i.message).join('; ');
    throw new Error(`Invalid codex event: ${issues}`);
  }
  return parsed.data;
}

// 可注入的通知下行通道（测试可覆盖）
type NotificationSink = (notification: JSONRPCNotification<CodexEvent>) => void;
let sink: NotificationSink | undefined;

/**
 * 设置通知发送通道（测试可注入）。
 */
export function setNotificationSink(next?: NotificationSink): void {
  sink = next;
}

/**
 * 将 CodexEvent 作为 MCP 通知（method: 'codex/event'）发送。
 * 若未设置 sink，则回退到 stdout 行分隔 JSON 输出。
 */
export function emitMcpNotification(event: CodexEvent): void {
  const notification = createJSONRPCNotification<CodexEvent>('codex/event', event);
  if (sink) {
    sink(notification);
    return;
  }
  // Fallback: 输出到 stdout，保持一行一个 JSON
  try {
    process.stdout.write(JSON.stringify(notification) + '\n');
  } catch {
    // 忽略输出失败（不应影响主流程）
  }
}
