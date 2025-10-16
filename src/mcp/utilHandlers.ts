import { JSONRPCRequest, JSONRPCResponse } from '../interfaces/json-rpc';

export interface GitDiffToRemoteParams {
  repository: string;
  diff: string;
  remote?: string;
  branch?: string;
}

export interface ExecOneOffCommandParams {
  command: string;
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

export interface GitDiffToRemoteResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface ExecOneOffCommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: string;
}

export async function handleGitDiffToRemote(
  request: JSONRPCRequest,
  handler: (params: GitDiffToRemoteParams) => Promise<GitDiffToRemoteResult>
): Promise<JSONRPCResponse> {
  if (request.method !== 'gitDiffToRemote') {
    throw new Error('Invalid method');
  }

  const params = request.params as GitDiffToRemoteParams;

  if (!params.repository || !params.diff) {
    throw new Error('Invalid gitDiffToRemote request parameters: repository and diff are required');
  }

  const result = await handler(params);
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

  const params = request.params as ExecOneOffCommandParams;

  if (!params.command) {
    throw new Error('Invalid execOneOffCommand request parameters: command is required');
  }

  const result = await handler(params);
  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}
