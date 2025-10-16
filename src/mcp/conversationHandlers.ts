import { JSONRPCRequest, JSONRPCResponse } from '../interfaces/json-rpc';

export interface ArchiveConversationParams {
  conversationId: string;
}

export interface ResumeConversationParams {
  conversationId: string;
}

export interface InterruptConversationParams {
  conversationId: string;
}

export interface ListConversationsParams {
  limit?: number;
  offset?: number;
  status?: string;
}

export interface ConversationInfo {
  id: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  title?: string;
}

export interface ListConversationsResult {
  conversations: ConversationInfo[];
  total: number;
  hasMore: boolean;
}

export interface ConversationActionResult {
  success: boolean;
  conversation?: ConversationInfo;
  error?: string;
}

export async function handleArchiveConversation(
  request: JSONRPCRequest,
  handler: (params: ArchiveConversationParams) => Promise<ConversationActionResult>
): Promise<JSONRPCResponse> {
  if (request.method !== 'archiveConversation') {
    throw new Error('Invalid method');
  }

  const params = request.params as ArchiveConversationParams;

  if (!params.conversationId) {
    throw new Error('Invalid archiveConversation request parameters: conversationId is required');
  }

  const result = await handler(params);
  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}

export async function handleResumeConversation(
  request: JSONRPCRequest,
  handler: (params: ResumeConversationParams) => Promise<ConversationActionResult>
): Promise<JSONRPCResponse> {
  if (request.method !== 'resumeConversation') {
    throw new Error('Invalid method');
  }

  const params = request.params as ResumeConversationParams;

  if (!params.conversationId) {
    throw new Error('Invalid resumeConversation request parameters: conversationId is required');
  }

  const result = await handler(params);
  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}

export async function handleInterruptConversation(
  request: JSONRPCRequest,
  handler: (params: InterruptConversationParams) => Promise<ConversationActionResult>
): Promise<JSONRPCResponse> {
  if (request.method !== 'interruptConversation') {
    throw new Error('Invalid method');
  }

  const params = request.params as InterruptConversationParams;

  if (!params.conversationId) {
    throw new Error('Invalid interruptConversation request parameters: conversationId is required');
  }

  const result = await handler(params);
  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}

export async function handleListConversations(
  request: JSONRPCRequest,
  handler: (params: ListConversationsParams) => Promise<ListConversationsResult>
): Promise<JSONRPCResponse> {
  if (request.method !== 'listConversations') {
    throw new Error('Invalid method');
  }

  const params = (request.params as ListConversationsParams) || {};

  if (params.limit !== undefined && (typeof params.limit !== 'number' || params.limit < 0)) {
    throw new Error(
      'Invalid listConversations request parameters: limit must be a non-negative number'
    );
  }

  if (params.offset !== undefined && (typeof params.offset !== 'number' || params.offset < 0)) {
    throw new Error(
      'Invalid listConversations request parameters: offset must be a non-negative number'
    );
  }

  const result = await handler(params);
  return {
    jsonrpc: '2.0',
    id: request.id,
    result,
  };
}
