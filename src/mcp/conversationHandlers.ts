import { z } from 'zod';
import {
  type JSONRPCRequest,
  type JSONRPCResponse,
  JSONRPCRequestSchema,
} from '../../core/mcp/protocol/types.js';

// ============ Zod Schemas ============

// archiveConversation (aligns with specs/008-ultrathink-codex-0/contracts/archiveConversation.schema.json)
const ArchiveConversationRequestSchema = z
  .object({
    conversationId: z.string().uuid(),
  })
  .strict();

export type ArchiveConversationRequest = z.infer<typeof ArchiveConversationRequestSchema>;

export interface ArchiveConversationResult {
  success: boolean;
}

// resumeConversation (aligns with specs/008-ultrathink-codex-0/contracts/resumeConversation.schema.json)
const ResumeConversationRequestSchema = z
  .object({
    conversationId: z.string().uuid(),
  })
  .strict();

export type ResumeConversationRequest = z.infer<typeof ResumeConversationRequestSchema>;

export interface ResumeConversationResult {
  success: boolean;
  conversationId?: string;
}

// ============ API ============

/**
 * 处理 Client → Server 的 archiveConversation 请求封装。
 */
export async function handleArchiveConversation(
  request: JSONRPCRequest,
  archive: (req: ArchiveConversationRequest) => Promise<ArchiveConversationResult>
): Promise<JSONRPCResponse<ArchiveConversationResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'archiveConversation') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const parsed = ArchiveConversationRequestSchema.safeParse(request.params);
  if (!parsed.success) {
    throw new Error('Invalid archiveConversation request parameters');
  }

  const result = await archive(parsed.data);
  return { jsonrpc: '2.0', id: request.id, result };
}
/**
 * 处理 Client → Server 的 resumeConversation 请求封装。
 */
export async function handleResumeConversation(
  request: JSONRPCRequest,
  resume: (
    req: ResumeConversationRequest
  ) => Promise<ResumeConversationResult> | ResumeConversationResult
): Promise<JSONRPCResponse<ResumeConversationResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'resumeConversation') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const parsed = ResumeConversationRequestSchema.safeParse(request.params);
  if (!parsed.success) {
    throw new Error('Invalid resumeConversation request parameters');
  }

  const result = await resume(parsed.data);
  return { jsonrpc: '2.0', id: request.id, result };
}

// interruptConversation (aligns with specs/008-ultrathink-codex-0/contracts/interruptConversation.schema.json)
export const InterruptConversationRequestSchema = z
  .object({
    conversationId: z.string().uuid(),
  })
  .strict();

export type InterruptConversationRequest = z.infer<typeof InterruptConversationRequestSchema>;

export interface InterruptConversationResult {
  success: boolean;
  message?: string;
}

/**
 * 处理 Client → Server 的 interruptConversation 请求。
 */
export async function handleInterruptConversation(
  request: JSONRPCRequest,
  interrupt: (req: InterruptConversationRequest) => Promise<InterruptConversationResult>
): Promise<JSONRPCResponse<InterruptConversationResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'interruptConversation') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const parsed = InterruptConversationRequestSchema.safeParse(request.params);
  if (!parsed.success) {
    throw new Error('Invalid interruptConversation request parameters');
  }

  const result = await interrupt(parsed.data);
  return { jsonrpc: '2.0', id: request.id, result };
}

// listConversations (aligns with specs/008-ultrathink-codex-0/contracts/listConversations.schema.json)
const ConversationStatusSchema = z.enum([
  'initializing',
  'active',
  'idle',
  'paused',
  'interrupted',
  'archived',
  'terminated',
]);

export const ListConversationsRequestSchema = z
  .object({
    status: ConversationStatusSchema.optional(),
    model: z.string().optional(),
  })
  .strict();

export type ListConversationsRequest = z.infer<typeof ListConversationsRequestSchema>;

export interface ConversationItem {
  id: string;
  model: string;
  createdAt: string; // ISO 8601
  status: z.infer<typeof ConversationStatusSchema>;
  title?: string;
}

export interface ListConversationsResult {
  conversations: ConversationItem[];
}

/**
 * 处理 Client → Server 的 listConversations 请求。
 */
export async function handleListConversations(
  request: JSONRPCRequest,
  list: (req: ListConversationsRequest) => Promise<ListConversationsResult>
): Promise<JSONRPCResponse<ListConversationsResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'listConversations') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const params = request.params ?? {};
  const parsed = ListConversationsRequestSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error('Invalid listConversations request parameters');
  }

  const result = await list(parsed.data);
  return { jsonrpc: '2.0', id: request.id, result };
}
