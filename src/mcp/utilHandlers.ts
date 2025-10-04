import { z } from 'zod';
import {
  type JSONRPCRequest,
  type JSONRPCResponse,
  JSONRPCRequestSchema,
} from '../../core/mcp/protocol/types.js';

// ============ Zod Schemas (aligned to specs/008-ultrathink-codex-0/contracts/*.schema.json) ============

// T047: gitDiffToRemote — request requires { cwd }
const GitDiffToRemoteRequestSchema = z
  .object({
    cwd: z.string().min(1),
  })
  .strict();

export type GitDiffToRemoteRequest = z.infer<typeof GitDiffToRemoteRequestSchema>;

export interface GitDiffToRemoteResult {
  sha: string; // 40-char hex by contract
  diff: string; // unified diff
}

// T048: execOneOffCommand — request requires { command: string[] } and optional timeoutMs/cwd/sandboxPolicy
const SandboxPolicySchema = z.enum(['read-only', 'workspace-write', 'danger-full-access']);

const ExecOneOffCommandRequestSchema = z
  .object({
    command: z.array(z.string().min(1)).min(1),
    timeoutMs: z.number().int().min(1).optional(),
    cwd: z.string().optional(),
    sandboxPolicy: SandboxPolicySchema.optional(),
  })
  .strict();

export type ExecOneOffCommandRequest = z.infer<typeof ExecOneOffCommandRequestSchema>;

export interface ExecOneOffCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  output?: string;
}

// ============ API (Request Handlers) ============

export async function handleGitDiffToRemote(
  request: JSONRPCRequest,
  getDiff: (req: GitDiffToRemoteRequest) => Promise<GitDiffToRemoteResult> | GitDiffToRemoteResult
): Promise<JSONRPCResponse<GitDiffToRemoteResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'gitDiffToRemote') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const parsed = GitDiffToRemoteRequestSchema.safeParse(request.params);
  if (!parsed.success) {
    throw new Error('Invalid gitDiffToRemote request parameters');
  }

  const result = await getDiff(parsed.data);
  return { jsonrpc: '2.0', id: request.id, result };
}

export async function handleExecOneOffCommand(
  request: JSONRPCRequest,
  execOnce: (
    req: ExecOneOffCommandRequest
  ) => Promise<ExecOneOffCommandResult> | ExecOneOffCommandResult
): Promise<JSONRPCResponse<ExecOneOffCommandResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'execOneOffCommand') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const parsed = ExecOneOffCommandRequestSchema.safeParse(request.params);
  if (!parsed.success) {
    throw new Error('Invalid execOneOffCommand request parameters');
  }

  const result = await execOnce(parsed.data);
  return { jsonrpc: '2.0', id: request.id, result };
}
