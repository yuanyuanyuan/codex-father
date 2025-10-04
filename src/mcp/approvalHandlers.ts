import { z } from 'zod';
import {
  type JSONRPCRequest,
  type JSONRPCResponse,
  JSONRPCRequestSchema,
} from '../../core/mcp/protocol/types.js';

// ============ Zod Schemas ============

// execCommandApproval (aligns with specs/008-ultrathink-codex-0/contracts/execCommandApproval.schema.json)
const ExecCommandApprovalRequestSchema = z
  .object({
    conversationId: z.string(),
    callId: z.string().min(1),
    command: z.string().min(1),
    cwd: z.string().min(1),
    reason: z.string().optional(),
  })
  .strict();

export type ExecCommandApprovalRequest = z.infer<typeof ExecCommandApprovalRequestSchema>;

export type ExecCommandApprovalDecision =
  | 'allow'
  | 'deny'
  | { decision: 'allow' | 'deny'; note?: string };

export interface ExecCommandApprovalResult {
  decision: 'allow' | 'deny';
  note?: string;
}

// applyPatchApproval (aligns with specs/008-ultrathink-codex-0/contracts/applyPatchApproval.schema.json)
const FileChangeSchema = z
  .object({
    path: z.string(),
    type: z.enum(['create', 'modify', 'delete']),
    diff: z.string(),
    contentPreview: z.string().optional(),
  })
  .strict();

const ApplyPatchApprovalRequestSchema = z
  .object({
    conversationId: z.string(),
    callId: z.string().min(1),
    fileChanges: z.array(FileChangeSchema).min(1),
    reason: z.string().optional(),
    grantRoot: z.boolean().optional(),
  })
  .strict();

export type ApplyPatchApprovalRequest = z.infer<typeof ApplyPatchApprovalRequestSchema>;

export type ApplyPatchApprovalDecision =
  | 'allow'
  | 'deny'
  | { decision: 'allow' | 'deny'; note?: string };

export interface ApplyPatchApprovalResult {
  decision: 'allow' | 'deny';
  note?: string;
}

// ============ API ============

/**
 * 处理 Codex Server → Client 的 execCommandApproval 请求。
 */
export async function handleExecCommandApproval(
  request: JSONRPCRequest,
  decide: (
    req: ExecCommandApprovalRequest
  ) => Promise<ExecCommandApprovalDecision> | ExecCommandApprovalDecision
): Promise<JSONRPCResponse<ExecCommandApprovalResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'execCommandApproval') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const parsed = ExecCommandApprovalRequestSchema.safeParse(request.params);
  if (!parsed.success) {
    throw new Error('Invalid execCommandApproval request parameters');
  }

  const decision = await decide(parsed.data);
  const result: ExecCommandApprovalResult = typeof decision === 'string' ? { decision } : decision;

  return { jsonrpc: '2.0', id: request.id, result };
}

/**
 * 处理 Codex Server → Client 的 applyPatchApproval 请求。
 */
export async function handleApplyPatchApproval(
  request: JSONRPCRequest,
  decide: (
    req: ApplyPatchApprovalRequest
  ) => Promise<ApplyPatchApprovalDecision> | ApplyPatchApprovalDecision
): Promise<JSONRPCResponse<ApplyPatchApprovalResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'applyPatchApproval') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const parsed = ApplyPatchApprovalRequestSchema.safeParse(request.params);
  if (!parsed.success) {
    throw new Error('Invalid applyPatchApproval request parameters');
  }

  const decision = await decide(parsed.data);
  const result: ApplyPatchApprovalResult = typeof decision === 'string' ? { decision } : decision;

  return { jsonrpc: '2.0', id: request.id, result };
}
