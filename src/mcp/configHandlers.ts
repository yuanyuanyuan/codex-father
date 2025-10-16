import { JSONRPCRequest, JSONRPCResponse } from '../interfaces/json-rpc';

export interface GetUserSavedConfigParams {}

export interface SetDefaultModelParams {
  model: string | null;
  reasoningEffort?: string;
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

  const params = request.params || {};

  // 验证参数为空对象，不允许额外字段
  if (typeof params !== 'object' || Array.isArray(params) || Object.keys(params).length > 0) {
    throw new Error('Invalid getUserSavedConfig request parameters: params must be empty object');
  }

  const result = await handler(params as GetUserSavedConfigParams);

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

  const params = request.params || {};

  // 验证参数类型和必需字段
  if (typeof params !== 'object' || Array.isArray(params)) {
    throw new Error('Invalid setDefaultModel request parameters: params must be object');
  }

  if (!('model' in params)) {
    throw new Error(
      'Invalid setDefaultModel request parameters: model is required'
    );
  }

  if (params.model !== null && typeof params.model !== 'string') {
    throw new Error(
      'Invalid setDefaultModel request parameters: model must be string or null'
    );
  }

  // 验证reasoningEffort枚举值
  if ('reasoningEffort' in params) {
    const validEfforts = ['low', 'medium', 'high'];
    if (!validEfforts.includes(params.reasoningEffort)) {
      throw new Error(
        `Invalid setDefaultModel request parameters: reasoningEffort must be one of ${validEfforts.join(', ')}`
      );
    }
  }

  // 验证没有额外字段
  const allowedKeys = ['model', 'reasoningEffort'];
  const extraKeys = Object.keys(params).filter(key => !allowedKeys.includes(key));
  if (extraKeys.length > 0) {
    throw new Error(
      `Invalid setDefaultModel request parameters: extra fields not allowed: ${extraKeys.join(', ')}`
    );
  }

  const result = await handler(params as SetDefaultModelParams);
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

  const params = request.params || {};

  // 验证参数为空对象，不允许额外字段
  if (typeof params !== 'object' || Array.isArray(params) || Object.keys(params).length > 0) {
    throw new Error('Invalid getUserAgent request parameters: params must be empty object');
  }

  const result = await handler(params as GetUserAgentParams);

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

  const params = request.params || {};

  // 验证参数为空对象，不允许额外字段
  if (typeof params !== 'object' || Array.isArray(params) || Object.keys(params).length > 0) {
    throw new Error('Invalid userInfo request parameters: params must be empty object');
  }

  const result = await handler(params as UserInfoParams);

  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}
