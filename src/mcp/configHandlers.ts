import { JSONRPCRequest, JSONRPCResponse } from '../interfaces/json-rpc';

export interface GetUserSavedConfigParams {}

export interface SetDefaultModelParams {
  model: string;
}

export interface GetUserAgentParams {}

export interface UserInfoParams {}

export interface UserSavedConfig {
  models: string[];
  defaultModel: string;
  preferences: Record<string, any>;
}

export interface UserInfo {
  id: string;
  name: string;
  email?: string;
  preferences: Record<string, any>;
}

export interface UserAgent {
  name: string;
  version: string;
  capabilities: string[];
}

export async function handleGetUserSavedConfig(
  request: JSONRPCRequest,
  handler: (params: GetUserSavedConfigParams) => Promise<UserSavedConfig>
): Promise<JSONRPCResponse> {
  if (request.method !== 'getUserSavedConfig') {
    throw new Error('Invalid method');
  }

  const params = (request.params as GetUserSavedConfigParams) || {};
  const result = await handler(params);

  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}

export async function handleSetDefaultModel(
  request: JSONRPCRequest,
  handler: (params: SetDefaultModelParams) => Promise<{ success: boolean }>
): Promise<JSONRPCResponse> {
  if (request.method !== 'setDefaultModel') {
    throw new Error('Invalid method');
  }

  const params = request.params as SetDefaultModelParams;

  if (!params.model || typeof params.model !== 'string') {
    throw new Error(
      'Invalid setDefaultModel request parameters: model is required and must be a string'
    );
  }

  const result = await handler(params);
  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}

export async function handleGetUserAgent(
  request: JSONRPCRequest,
  handler: (params: GetUserAgentParams) => Promise<UserAgent>
): Promise<JSONRPCResponse> {
  if (request.method !== 'getUserAgent') {
    throw new Error('Invalid method');
  }

  const params = (request.params as GetUserAgentParams) || {};
  const result = await handler(params);

  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}

export async function handleUserInfo(
  request: JSONRPCRequest,
  handler: (params: UserInfoParams) => Promise<UserInfo>
): Promise<JSONRPCResponse> {
  if (request.method !== 'userInfo') {
    throw new Error('Invalid method');
  }

  const params = (request.params as UserInfoParams) || {};
  const result = await handler(params);

  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}
