import { z } from 'zod';
import {
  type JSONRPCRequest,
  type JSONRPCResponse,
  type JSONRPCNotification,
  JSONRPCRequestSchema,
  createJSONRPCNotification,
} from '../../core/mcp/protocol/types.js';

// ============ Zod Schemas (aligned to specs/008-ultrathink-codex-0/contracts/*.schema.json) ============

// T038: loginApiKey
const LoginApiKeyRequestSchema = z
  .object({
    apiKey: z.string().min(1),
  })
  .strict();

export type LoginApiKeyRequest = z.infer<typeof LoginApiKeyRequestSchema>;

export interface LoginApiKeyResult {
  success: boolean;
  message?: string;
}

// T039: loginChatGpt (request allows additionalProperties)
const LoginChatGptRequestSchema = z.object({}).passthrough();

export type LoginChatGptRequest = z.infer<typeof LoginChatGptRequestSchema>;

export interface LoginChatGptResult {
  loginId: string; // uuid
  authUrl: string; // uri
  expiresAt?: string; // ISO 8601
}

// loginChatGptComplete (notification)
const LoginChatGptCompleteParamsSchema = z
  .object({
    loginId: z.string().uuid(),
    success: z.boolean(),
    error: z.string().optional(),
    timestamp: z.string().datetime().optional(),
  })
  .strict();

export type LoginChatGptCompleteParams = z.infer<typeof LoginChatGptCompleteParamsSchema>;

// T040: cancelLoginChatGpt
const CancelLoginChatGptRequestSchema = z
  .object({
    loginId: z.string().uuid(),
  })
  .strict();

export type CancelLoginChatGptRequest = z.infer<typeof CancelLoginChatGptRequestSchema>;

export interface CancelLoginChatGptResult {
  success: boolean;
}

// logoutChatGpt (no params, additionalProperties: false)
const LogoutChatGptRequestSchema = z.object({}).strict();

export type LogoutChatGptRequest = z.infer<typeof LogoutChatGptRequestSchema>;

export interface LogoutChatGptResult {
  success: boolean;
  message?: string;
}

// T041: getAuthStatus
const GetAuthStatusRequestSchema = z
  .object({
    includeToken: z.boolean().optional(),
    refreshToken: z.boolean().optional(),
  })
  .strict();

export type GetAuthStatusRequest = z.infer<typeof GetAuthStatusRequestSchema>;

export interface GetAuthStatusResult {
  authenticated: boolean;
  method?: 'apiKey' | 'chatGpt' | 'none';
  token?: string;
  expiresAt?: string; // ISO 8601
}

// authStatusChange (notification)
const AuthStatusChangeParamsSchema = z
  .object({
    authenticated: z.boolean(),
    method: z.enum(['apiKey', 'chatGpt', 'none']).optional(),
    timestamp: z.string().datetime().optional(),
  })
  .strict();

export type AuthStatusChangeParams = z.infer<typeof AuthStatusChangeParamsSchema>;

// ============ API (Request Handlers) ============

export async function handleLoginApiKey(
  request: JSONRPCRequest,
  login: (req: LoginApiKeyRequest) => Promise<LoginApiKeyResult> | LoginApiKeyResult
): Promise<JSONRPCResponse<LoginApiKeyResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'loginApiKey') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const parsed = LoginApiKeyRequestSchema.safeParse(request.params);
  if (!parsed.success) {
    throw new Error('Invalid loginapikey request parameters');
  }

  const result = await login(parsed.data);
  return { jsonrpc: '2.0', id: request.id, result };
}

export async function handleLoginChatGpt(
  request: JSONRPCRequest,
  begin: (req: LoginChatGptRequest) => Promise<LoginChatGptResult> | LoginChatGptResult
): Promise<JSONRPCResponse<LoginChatGptResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'loginChatGpt') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const params = request.params ?? {};
  const parsed = LoginChatGptRequestSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error('Invalid loginchatgpt request parameters');
  }

  const result = await begin(parsed.data);
  return { jsonrpc: '2.0', id: request.id, result };
}

export async function handleCancelLoginChatGpt(
  request: JSONRPCRequest,
  cancel: (
    req: CancelLoginChatGptRequest
  ) => Promise<CancelLoginChatGptResult> | CancelLoginChatGptResult
): Promise<JSONRPCResponse<CancelLoginChatGptResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'cancelLoginChatGpt') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const parsed = CancelLoginChatGptRequestSchema.safeParse(request.params);
  if (!parsed.success) {
    throw new Error('Invalid cancelloginchatgpt request parameters');
  }

  const result = await cancel(parsed.data);
  return { jsonrpc: '2.0', id: request.id, result };
}

export async function handleLogoutChatGpt(
  request: JSONRPCRequest,
  logout: (req: LogoutChatGptRequest) => Promise<LogoutChatGptResult> | LogoutChatGptResult
): Promise<JSONRPCResponse<LogoutChatGptResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'logoutChatGpt') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const params = request.params ?? {};
  const parsed = LogoutChatGptRequestSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error('Invalid logoutchatgpt request parameters');
  }

  const result = await logout(parsed.data);
  return { jsonrpc: '2.0', id: request.id, result };
}

export async function handleGetAuthStatus(
  request: JSONRPCRequest,
  getStatus: (req: GetAuthStatusRequest) => Promise<GetAuthStatusResult> | GetAuthStatusResult
): Promise<JSONRPCResponse<GetAuthStatusResult>> {
  const base = JSONRPCRequestSchema.safeParse(request);
  if (!base.success) {
    throw new Error('Invalid JSON-RPC request');
  }
  if (request.method !== 'getAuthStatus') {
    throw new Error(`Invalid method: ${request.method}`);
  }

  const params = request.params ?? {};
  const parsed = GetAuthStatusRequestSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error('Invalid getauthstatus request parameters');
  }

  const result = await getStatus(parsed.data);
  return { jsonrpc: '2.0', id: request.id, result };
}

// ============ Notifications ============

export function createLoginChatGptCompleteNotification(
  params: LoginChatGptCompleteParams
): JSONRPCNotification<LoginChatGptCompleteParams> {
  const parsed = LoginChatGptCompleteParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error('Invalid loginchatgptcomplete notification parameters');
  }
  return createJSONRPCNotification<LoginChatGptCompleteParams>('loginChatGptComplete', parsed.data);
}

export function createAuthStatusChangeNotification(
  params: AuthStatusChangeParams
): JSONRPCNotification<AuthStatusChangeParams> {
  const parsed = AuthStatusChangeParamsSchema.safeParse(params);
  if (!parsed.success) {
    throw new Error('Invalid authstatuschange notification parameters');
  }
  return createJSONRPCNotification<AuthStatusChangeParams>('authStatusChange', parsed.data);
}
