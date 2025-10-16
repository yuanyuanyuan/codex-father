import { JSONRPCRequest, JSONRPCResponse } from '../interfaces/json-rpc';

export interface LoginApiKeyParams {
  apiKey: string;
}

export interface LoginChatGptParams {
  prompt?: string;
  locale?: string;
}

export interface LoginChatGptResult {
  loginId: string;
  authUrl: string;
  expiresAt?: string;
}

export interface CancelLoginChatGptParams {
  loginId: string;
}

export interface LogoutChatGptParams {
  sessionId?: string;
}

export interface GetAuthStatusParams {
  includeToken?: boolean;
}

export interface AuthStatusResult {
  authenticated: boolean;
  method?: string;
  token?: string;
  expiresAt?: string;
}

export interface LoginChatGptCompleteParams {
  loginId: string;
  success: boolean;
  timestamp: string;
}

export interface AuthStatusChangeParams {
  authenticated: boolean;
  method?: string;
  timestamp: string;
}

export async function handleLoginApiKey(
  request: JSONRPCRequest,
  handler: (params: LoginApiKeyParams) => Promise<{ success: boolean }>
): Promise<JSONRPCResponse> {
  if (request.method !== 'loginApiKey') {
    throw new Error('Invalid method');
  }

  const params = request.params as LoginApiKeyParams;
  if (!params.apiKey) {
    throw new Error('Invalid loginApiKey request parameters: apiKey is required');
  }

  const result = await handler(params);
  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}

export async function handleLoginChatGpt(
  request: JSONRPCRequest,
  handler: (params: LoginChatGptParams) => Promise<LoginChatGptResult>
): Promise<JSONRPCResponse> {
  if (request.method !== 'loginChatGpt') {
    throw new Error('Invalid method');
  }

  const params = (request.params as LoginChatGptParams) || {};
  const result = await handler(params);

  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}

export async function handleCancelLoginChatGpt(
  request: JSONRPCRequest,
  handler: (params: CancelLoginChatGptParams) => Promise<{ success: boolean }>
): Promise<JSONRPCResponse> {
  if (request.method !== 'cancelLoginChatGpt') {
    throw new Error('Invalid method');
  }

  const params = request.params as CancelLoginChatGptParams;
  if (!params.loginId) {
    throw new Error('Invalid cancelLoginChatGpt request parameters: loginId is required');
  }

  const result = await handler(params);
  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}

export async function handleLogoutChatGpt(
  request: JSONRPCRequest,
  handler: (params: LogoutChatGptParams) => Promise<{ success: boolean }>
): Promise<JSONRPCResponse> {
  if (request.method !== 'logoutChatGpt') {
    throw new Error('Invalid method');
  }

  const params = (request.params as LogoutChatGptParams) || {};

  if (Object.keys(params).length > 1) {
    throw new Error('Invalid logoutChatGpt request parameters: too many properties');
  }

  const result = await handler(params);
  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}

export async function handleGetAuthStatus(
  request: JSONRPCRequest,
  handler: (params: GetAuthStatusParams) => Promise<AuthStatusResult>
): Promise<JSONRPCResponse> {
  if (request.method !== 'getAuthStatus') {
    throw new Error('Invalid method');
  }

  const params = (request.params as GetAuthStatusParams) || {};

  if (params.includeToken !== undefined && typeof params.includeToken !== 'boolean') {
    throw new Error('Invalid getAuthStatus request parameters: includeToken must be boolean');
  }

  const result = await handler(params);
  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}

export function createLoginChatGptCompleteNotification(
  params: LoginChatGptCompleteParams
): JSONRPCResponse {
  if (!params.loginId || typeof params.success !== 'boolean' || !params.timestamp) {
    throw new Error('Invalid loginChatGptComplete notification parameters');
  }

  return {
    jsonrpc: '2.0',
    method: 'loginChatGptComplete',
    params,
  };
}

export function createAuthStatusChangeNotification(
  params: AuthStatusChangeParams
): JSONRPCResponse {
  if (typeof params.authenticated !== 'boolean' || !params.timestamp) {
    throw new Error('Invalid authStatusChange notification parameters');
  }

  return {
    jsonrpc: '2.0',
    method: 'authStatusChange',
    params,
  };
}
