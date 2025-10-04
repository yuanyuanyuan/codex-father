import { z } from 'zod';
import {
  type JSONRPCRequest,
  type JSONRPCResponse,
  JSONRPCRequestSchema,
} from '../../core/mcp/protocol/types.js';

// ============ Zod Schemas (aligned to specs/008-ultrathink-codex-0/contracts/*.schema.json) ============

// T043: getUserSavedConfig — request has no params (additionalProperties: false)
const GetUserSavedConfigRequestSchema = z.object({}).strict();
export type GetUserSavedConfigRequest = z.infer<typeof GetUserSavedConfigRequestSchema>;

// Types for result (align with schema definitions; response additionalProperties: false)
export type ApprovalPolicy = 'untrusted' | 'on-request' | 'on-failure' | 'never';
export type SandboxMode = 'read-only' | 'workspace-write' | 'danger-full-access';
export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high';
export type ReasoningSummary = 'auto' | 'concise' | 'detailed' | 'none';
export type Verbosity = 'low' | 'medium' | 'high';

export interface SandboxSettings {
  writableRoots?: string[];
  networkAccess?: boolean;
  excludeTmpdirEnvVar?: boolean;
  excludeSlashTmp?: boolean;
}

export interface ToolsConfig {
  webSearch?: boolean;
  viewImage?: boolean;
}

export interface ProfileConfig {
  model?: string;
  modelProvider?: string;
  approvalPolicy?: ApprovalPolicy;
  modelReasoningEffort?: ReasoningEffort;
  modelReasoningSummary?: ReasoningSummary;
  modelVerbosity?: Verbosity;
  chatgptBaseUrl?: string;
}

export type ProfilesMap = Record<string, ProfileConfig>;

export interface UserSavedConfig {
  approvalPolicy?: ApprovalPolicy;
  sandboxMode?: SandboxMode;
  sandboxSettings?: SandboxSettings;
  model?: string | null;
  modelReasoningEffort?: ReasoningEffort;
  modelReasoningSummary?: ReasoningSummary;
  modelVerbosity?: Verbosity;
  tools?: ToolsConfig;
  profile?: string;
  profiles: ProfilesMap; // required by contract
}

export interface GetUserSavedConfigResult {
  config: UserSavedConfig;
}

// T044: setDefaultModel — request requires { model } and optional reasoningEffort
const SetDefaultModelRequestSchema = z
  .object({
    model: z.union([z.string(), z.null()]),
    reasoningEffort: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
  })
  .strict();

export type SetDefaultModelRequest = z.infer<typeof SetDefaultModelRequestSchema>;

export interface SetDefaultModelResult {
  success: boolean;
  message?: string;
}

// T045: getUserAgent — request has no params
const GetUserAgentRequestSchema = z.object({}).strict();
export type GetUserAgentRequest = z.infer<typeof GetUserAgentRequestSchema>;

export interface GetUserAgentResult {
  userAgent: string;
}

// T046: userInfo — request has no params; response additionalProperties: false
const UserInfoRequestSchema = z.object({}).strict();
export type UserInfoRequest = z.infer<typeof UserInfoRequestSchema>;

export interface UserInfoResult {
  id?: string;
  email?: string; // email format by contract; tests ensure via Ajv
  name?: string;
  allegedUserEmail: string; // required
}

// ============ API (Request Handlers) ============

export async function handleGetUserSavedConfig(
  request: JSONRPCRequest,
  getConfig: (
    req: GetUserSavedConfigRequest
  ) => Promise<GetUserSavedConfigResult> | GetUserSavedConfigResult
): Promise<JSONRPCResponse<GetUserSavedConfigResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'getUserSavedConfig') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const params = request.params ?? {};
  const parsed = GetUserSavedConfigRequestSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error('Invalid getUserSavedConfig request parameters');
  }

  const result = await getConfig(parsed.data);
  return { jsonrpc: '2.0', id: request.id, result };
}

export async function handleSetDefaultModel(
  request: JSONRPCRequest,
  setModel: (req: SetDefaultModelRequest) => Promise<SetDefaultModelResult> | SetDefaultModelResult
): Promise<JSONRPCResponse<SetDefaultModelResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'setDefaultModel') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const parsed = SetDefaultModelRequestSchema.safeParse(request.params);
  if (!parsed.success) {
    throw new Error('Invalid setDefaultModel request parameters');
  }

  const result = await setModel(parsed.data);
  return { jsonrpc: '2.0', id: request.id, result };
}

export async function handleGetUserAgent(
  request: JSONRPCRequest,
  getAgent: (req: GetUserAgentRequest) => Promise<GetUserAgentResult> | GetUserAgentResult
): Promise<JSONRPCResponse<GetUserAgentResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'getUserAgent') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const params = request.params ?? {};
  const parsed = GetUserAgentRequestSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error('Invalid getUserAgent request parameters');
  }

  const result = await getAgent(parsed.data);
  return { jsonrpc: '2.0', id: request.id, result };
}

export async function handleUserInfo(
  request: JSONRPCRequest,
  getInfo: (req: UserInfoRequest) => Promise<UserInfoResult> | UserInfoResult
): Promise<JSONRPCResponse<UserInfoResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'userInfo') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const params = request.params ?? {};
  const parsed = UserInfoRequestSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error('Invalid userInfo request parameters');
  }

  const result = await getInfo(parsed.data);
  return { jsonrpc: '2.0', id: request.id, result };
}
