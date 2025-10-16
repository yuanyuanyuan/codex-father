import { JSONRPCRequest, JSONRPCResponse } from '../interfaces/json-rpc';

export interface GitDiffToRemoteParams {
  cwd: string;
  repository?: string;
  diff?: string;
  remote?: string;
  branch?: string;
}

export interface ExecOneOffCommandParams {
  command: string[];
  timeoutMs?: number;
  cwd?: string;
  sandboxPolicy?: string;
}

export interface GitDiffToRemoteResult {
  sha: string;
  diff: string;
}

export interface ExecOneOffCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  output?: string;
}

export async function handleGitDiffToRemote(
  request: JSONRPCRequest,
  handler: (params: GitDiffToRemoteParams) => Promise<GitDiffToRemoteResult>
): Promise<JSONRPCResponse> {
  if (request.method !== 'gitDiffToRemote') {
    throw new Error('Invalid method');
  }

  const params = request.params || {};

  // 验证参数类型
  if (typeof params !== 'object' || Array.isArray(params)) {
    throw new Error('Invalid gitDiffToRemote request parameters: params must be object');
  }

  if (!params.cwd || typeof params.cwd !== 'string') {
    throw new Error('Invalid gitDiffToRemote request parameters: cwd is required and must be string');
  }

  // 验证没有额外字段
  const allowedKeys = ['cwd', 'repository', 'diff', 'remote', 'branch'];
  const extraKeys = Object.keys(params).filter(key => !allowedKeys.includes(key));
  if (extraKeys.length > 0) {
    throw new Error(
      `Invalid gitDiffToRemote request parameters: extra fields not allowed: ${extraKeys.join(', ')}`
    );
  }

  const result = await handler(params as GitDiffToRemoteParams);
  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}

export async function handleExecOneOffCommand(
  request: JSONRPCRequest,
  handler: (params: ExecOneOffCommandParams) => Promise<ExecOneOffCommandResult>
): Promise<JSONRPCResponse> {
  if (request.method !== 'execOneOffCommand') {
    throw new Error('Invalid method');
  }

  const params = request.params || {};

  // 验证参数类型
  if (typeof params !== 'object' || Array.isArray(params)) {
    throw new Error('Invalid execOneOffCommand request parameters: params must be object');
  }

  if (!params.command || !Array.isArray(params.command) || params.command.length === 0) {
    throw new Error('Invalid execOneOffCommand request parameters: command is required and must be non-empty array');
  }

  // 验证timeoutMs
  if ('timeoutMs' in params && (typeof params.timeoutMs !== 'number' || params.timeoutMs < 1)) {
    throw new Error('Invalid execOneOffCommand request parameters: timeoutMs must be number >= 1');
  }

  // 验证sandboxPolicy枚举值
  if ('sandboxPolicy' in params) {
    const validPolicies = ['read-only', 'workspace-write', 'danger-full-access'];
    if (!validPolicies.includes(params.sandboxPolicy)) {
      throw new Error(
        `Invalid execOneOffCommand request parameters: sandboxPolicy must be one of ${validPolicies.join(', ')}`
      );
    }
  }

  // 验证没有额外字段
  const allowedKeys = ['command', 'timeoutMs', 'cwd', 'sandboxPolicy'];
  const extraKeys = Object.keys(params).filter(key => !allowedKeys.includes(key));
  if (extraKeys.length > 0) {
    throw new Error(
      `Invalid execOneOffCommand request parameters: extra fields not allowed: ${extraKeys.join(', ')}`
    );
  }

  const result = await handler(params as ExecOneOffCommandParams);
  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}
