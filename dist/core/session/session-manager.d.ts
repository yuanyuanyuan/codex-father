import { CodexClient } from '../mcp/codex-client.js';
import { Session, ApprovalMode, SandboxPolicy, ApprovalRequest } from '../lib/types.js';
export interface IProcessManager {
    getClient(): CodexClient;
    isReady(): boolean;
    start(): Promise<void>;
    stop(): Promise<void>;
}
export interface SessionManagerConfig {
    processManager: IProcessManager;
    sessionsDir?: string;
    defaultModel?: string;
    defaultApprovalMode?: ApprovalMode;
    defaultSandboxPolicy?: SandboxPolicy;
    defaultTimeout?: number;
}
export interface CreateSessionOptions {
    sessionName: string;
    model?: string;
    cwd?: string;
    approvalMode?: ApprovalMode;
    sandboxPolicy?: SandboxPolicy;
    timeout?: number;
}
export declare class SessionManager {
    private processManager;
    private config;
    private sessions;
    private eventLoggers;
    private configPersisters;
    private policyEngines;
    private terminalUI;
    constructor(config: SessionManagerConfig);
    createSession(options: CreateSessionOptions): Promise<{
        conversationId: string;
        jobId: string;
        rolloutPath: string;
    }>;
    sendUserMessage(conversationId: string, message: string): Promise<void>;
    handleApprovalRequest(request: ApprovalRequest): Promise<'allow' | 'deny'>;
    getSession(conversationId: string): Session | undefined;
    listSessions(): Session[];
    terminateSession(conversationId: string): Promise<void>;
    cleanup(): Promise<void>;
}
export declare function createSessionManager(config: SessionManagerConfig): SessionManager;
