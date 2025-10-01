import { MCPTool, MCPToolsCallResult } from './protocol/types.js';
import { ApprovalRequest, ApprovalMode, SandboxPolicy } from '../lib/types.js';
export interface ISessionManager {
    createSession(options: {
        sessionName: string;
        model?: string;
        cwd?: string;
        approvalMode?: ApprovalMode;
        sandboxPolicy?: SandboxPolicy;
        timeout?: number;
    }): Promise<{
        conversationId: string;
        jobId: string;
        rolloutPath: string;
    }>;
    sendUserMessage(conversationId: string, message: string): Promise<void>;
    handleApprovalRequest(request: ApprovalRequest): Promise<'allow' | 'deny'>;
}
type ToolHandler = (params: unknown) => Promise<MCPToolsCallResult>;
export interface BridgeLayerConfig {
    sessionManager: ISessionManager;
    defaultModel?: string;
    defaultApprovalMode?: ApprovalMode;
    defaultSandboxPolicy?: SandboxPolicy;
    defaultTimeout?: number;
}
export declare class BridgeLayer {
    private sessionManager;
    private config;
    private tools;
    constructor(config: BridgeLayerConfig);
    private registerDefaultTools;
    getTools(): MCPTool[];
    callTool(toolName: string, params: unknown): Promise<MCPToolsCallResult>;
    private handleStartCodexTask;
    handleApplyPatchApproval(params: unknown): Promise<{
        decision: 'allow' | 'deny';
    }>;
    handleExecCommandApproval(params: unknown): Promise<{
        decision: 'allow' | 'deny';
    }>;
    registerTool(tool: MCPTool, handler: ToolHandler): void;
    unregisterTool(toolName: string): boolean;
}
export declare function createBridgeLayer(config: BridgeLayerConfig): BridgeLayer;
export {};
