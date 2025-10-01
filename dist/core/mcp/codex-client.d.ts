/// <reference types="node" resolution-mode="require"/>
/// <reference types="node" resolution-mode="require"/>
import { EventEmitter } from 'events';
import { Readable, Writable } from 'stream';
import { JSONRPCNotification } from './protocol/types.js';
export interface CodexNewConversationParams {
    model?: string;
    profile?: string;
    cwd?: string;
    approvalPolicy?: 'untrusted' | 'on-request' | 'on-failure' | 'never';
    sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
    config?: Record<string, unknown>;
    baseInstructions?: string;
    includePlanTool?: boolean;
    includeApplyPatchTool?: boolean;
}
export interface CodexNewConversationResult {
    conversationId: string;
    model: string;
    reasoningEffort?: string | null;
    rolloutPath: string;
}
export interface CodexUserMessageItem {
    type: 'text' | 'image';
    text?: string;
    imageUrl?: string;
}
export interface CodexSendUserMessageParams {
    conversationId: string;
    items: CodexUserMessageItem[];
}
export interface CodexSendUserMessageResult {
    status: string;
}
export type CodexEvent = JSONRPCNotification;
export interface CodexClientConfig {
    stdin: Writable;
    stdout: Readable;
    timeout?: number;
    debug?: boolean;
}
export declare class CodexClient extends EventEmitter {
    private stdin;
    private stdout;
    private rl;
    private pendingRequests;
    private nextId;
    private timeout;
    private debug;
    private closed;
    constructor(config: CodexClientConfig);
    newConversation(params: CodexNewConversationParams): Promise<CodexNewConversationResult>;
    sendUserMessage(params: CodexSendUserMessageParams): Promise<CodexSendUserMessageResult>;
    request<T = unknown>(method: string, params?: unknown): Promise<T>;
    notify(method: string, params?: unknown): void;
    close(): void;
    isClosed(): boolean;
    private handleLine;
    private handleResponse;
    private handleNotification;
    private handleClose;
}
export declare function createCodexClient(config: CodexClientConfig): CodexClient;
