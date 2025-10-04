import { z } from 'zod';
import {
  type JSONRPCRequest,
  type JSONRPCResponse,
  JSONRPCRequestSchema,
} from '../../core/mcp/protocol/types.js';

// ============ Zod Schema (aligns with specs/008-ultrathink-codex-0/contracts/execCommandApproval.schema.json) ============

const ExecCommandApprovalRequestSchema = z
  .object({
    conversationId: z.string().uuid(),
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

/**
 * 处理 Codex Server → Client 的 execCommandApproval 请求。
 *
 * - 验证 JSON-RPC 请求格式与 params 形状
 * - 将有效负载交由回调决定 allow/deny
 * - 返回符合契约的 JSON-RPC 响应对象
 */
export async function handleExecCommandApproval(
  request: JSONRPCRequest,
  decide: (
    req: ExecCommandApprovalRequest
  ) => Promise<ExecCommandApprovalDecision> | ExecCommandApprovalDecision
): Promise<JSONRPCResponse<ExecCommandApprovalResult>> {
  // 基础请求结构校验
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }

  if (request.method !== 'execCommandApproval') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  // 业务入参校验（与 schema 对齐）
  const parsedParams = ExecCommandApprovalRequestSchema.safeParse(request.params);
  if (!parsedParams.success) {
    throw new Error('Invalid execCommandApproval request parameters');
  }

  const decisionRaw = await decide(parsedParams.data);
  const result: ExecCommandApprovalResult =
    typeof decisionRaw === 'string' ? { decision: decisionRaw } : decisionRaw;

  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}
