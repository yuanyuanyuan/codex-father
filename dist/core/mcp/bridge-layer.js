import { ApprovalType, ApprovalMode, ApprovalStatus, SandboxPolicy, } from '../lib/types.js';
export class BridgeLayer {
    sessionManager;
    config;
    tools;
    constructor(config) {
        this.sessionManager = config.sessionManager;
        this.config = {
            sessionManager: config.sessionManager,
            defaultModel: config.defaultModel ?? 'gpt-5',
            defaultApprovalMode: config.defaultApprovalMode ?? ApprovalMode.ON_REQUEST,
            defaultSandboxPolicy: config.defaultSandboxPolicy ?? SandboxPolicy.WORKSPACE_WRITE,
            defaultTimeout: config.defaultTimeout ?? 300000,
        };
        this.tools = new Map();
        this.registerDefaultTools();
    }
    registerDefaultTools() {
        const startTaskTool = {
            name: 'start-codex-task',
            description: 'Start a new Codex AI task with a given prompt. Returns a jobId for tracking the task execution.',
            inputSchema: {
                type: 'object',
                properties: {
                    prompt: {
                        type: 'string',
                        description: 'The task prompt or instruction for the Codex agent',
                    },
                    sessionName: {
                        type: 'string',
                        description: 'Optional session name for tracking (default: auto-generated)',
                    },
                    model: {
                        type: 'string',
                        description: `Model to use (default: ${this.config.defaultModel})`,
                    },
                    cwd: {
                        type: 'string',
                        description: 'Working directory path (default: current directory)',
                    },
                    approvalPolicy: {
                        type: 'string',
                        enum: ['untrusted', 'on-request', 'on-failure', 'never'],
                        description: `Approval policy (default: ${this.config.defaultApprovalMode})`,
                    },
                    sandbox: {
                        type: 'string',
                        enum: ['read-only', 'workspace-write', 'danger-full-access'],
                        description: `Sandbox policy (default: ${this.config.defaultSandboxPolicy})`,
                    },
                    timeout: {
                        type: 'number',
                        description: `Task timeout in milliseconds (default: ${this.config.defaultTimeout})`,
                    },
                },
                required: ['prompt'],
            },
        };
        this.tools.set('start-codex-task', {
            definition: startTaskTool,
            handler: this.handleStartCodexTask.bind(this),
        });
    }
    getTools() {
        return Array.from(this.tools.values()).map((tool) => tool.definition);
    }
    async callTool(toolName, params) {
        const tool = this.tools.get(toolName);
        if (!tool) {
            throw new Error(`Unknown tool: ${toolName}`);
        }
        return await tool.handler(params);
    }
    async handleStartCodexTask(params) {
        if (!params || typeof params !== 'object') {
            throw new Error('Invalid tool parameters: must be an object');
        }
        const typedParams = params;
        if (!typedParams.prompt || typeof typedParams.prompt !== 'string') {
            throw new Error('Invalid tool parameters: prompt is required and must be a string');
        }
        const sessionName = typedParams.sessionName || `task-${new Date().toISOString().split('T')[0]}-${Date.now()}`;
        try {
            const { conversationId, jobId, rolloutPath } = await this.sessionManager.createSession({
                sessionName,
                model: typedParams.model || this.config.defaultModel,
                cwd: typedParams.cwd || process.cwd(),
                approvalMode: typedParams.approvalPolicy || this.config.defaultApprovalMode,
                sandboxPolicy: typedParams.sandbox || this.config.defaultSandboxPolicy,
                timeout: typedParams.timeout || this.config.defaultTimeout,
            });
            await this.sessionManager.sendUserMessage(conversationId, typedParams.prompt);
            return {
                status: 'accepted',
                jobId,
                conversationId,
                message: `Task started successfully. Session: ${sessionName}, Job ID: ${jobId}, Rollout: ${rolloutPath}`,
            };
        }
        catch (error) {
            return {
                status: 'rejected',
                jobId: 'none',
                message: `Task failed: ${error.message}`,
            };
        }
    }
    async handleApplyPatchApproval(params) {
        if (!params || typeof params !== 'object') {
            throw new Error('Invalid approval request parameters');
        }
        const typedParams = params;
        const approvalRequest = {
            requestId: typedParams.callId,
            jobId: typedParams.conversationId,
            type: ApprovalType.APPLY_PATCH,
            details: {
                fileChanges: typedParams.fileChanges,
                reason: typedParams.reason,
                grantRoot: typedParams.grantRoot,
            },
            status: ApprovalStatus.PENDING,
            createdAt: new Date(),
        };
        const decision = await this.sessionManager.handleApprovalRequest(approvalRequest);
        return { decision };
    }
    async handleExecCommandApproval(params) {
        if (!params || typeof params !== 'object') {
            throw new Error('Invalid approval request parameters');
        }
        const typedParams = params;
        const approvalRequest = {
            requestId: typedParams.callId,
            jobId: typedParams.conversationId,
            type: ApprovalType.EXEC_COMMAND,
            details: {
                command: typedParams.command,
                cwd: typedParams.cwd,
                reason: typedParams.reason,
            },
            status: ApprovalStatus.PENDING,
            createdAt: new Date(),
        };
        const decision = await this.sessionManager.handleApprovalRequest(approvalRequest);
        return { decision };
    }
    registerTool(tool, handler) {
        this.tools.set(tool.name, { definition: tool, handler });
    }
    unregisterTool(toolName) {
        return this.tools.delete(toolName);
    }
}
export function createBridgeLayer(config) {
    return new BridgeLayer(config);
}
