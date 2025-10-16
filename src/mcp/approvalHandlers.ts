import { JSONRPCRequest, JSONRPCResponse } from '../interfaces/json-rpc';

export interface ApplyPatchApprovalParams {
  conversationId: string;
  callId: string;
  fileChanges: Array<{
    path: string;
    type: 'create' | 'modify' | 'delete';
    diff?: string;
  }>;
  reason: string;
}

export interface ApplyPatchApprovalResult {
  decision: 'allow' | 'deny';
  reason?: string;
}

export async function handleApplyPatchApproval(
  request: JSONRPCRequest,
  handler: (params: ApplyPatchApprovalParams) => Promise<ApplyPatchApprovalResult>
): Promise<JSONRPCResponse> {
  if (request.method !== 'applyPatchApproval') {
    throw new Error('Invalid method');
  }

  const params = request.params as ApplyPatchApprovalParams;

  if (!params.conversationId || !params.callId || !params.fileChanges || !params.reason) {
    throw new Error(
      'Invalid applyPatchApproval request parameters: conversationId, callId, fileChanges, and reason are required'
    );
  }

  const result = await handler(params);
  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}
