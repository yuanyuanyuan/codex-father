import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { EventLogger } from './event-logger.js';
import { ConfigPersister } from './config-persister.js';
import { PolicyEngine } from '../approval/policy-engine.js';
import { TerminalUI } from '../approval/terminal-ui.js';
import { SessionStatus, ApprovalMode, SandboxPolicy, ApprovalStatus, EventType, } from '../lib/types.js';
export class SessionManager {
    processManager;
    config;
    sessions;
    eventLoggers;
    configPersisters;
    policyEngines;
    terminalUI;
    constructor(config) {
        this.processManager = config.processManager;
        this.config = {
            processManager: config.processManager,
            sessionsDir: config.sessionsDir || path.join(process.cwd(), '.codex-father/sessions'),
            defaultModel: config.defaultModel || 'gpt-5',
            defaultApprovalMode: config.defaultApprovalMode || ApprovalMode.ON_REQUEST,
            defaultSandboxPolicy: config.defaultSandboxPolicy || SandboxPolicy.WORKSPACE_WRITE,
            defaultTimeout: config.defaultTimeout || 300000,
        };
        this.sessions = new Map();
        this.eventLoggers = new Map();
        this.configPersisters = new Map();
        this.policyEngines = new Map();
        this.terminalUI = new TerminalUI();
    }
    async createSession(options) {
        if (!this.processManager.isReady()) {
            await this.processManager.start();
        }
        const jobId = uuidv4();
        const sessionDir = path.join(this.config.sessionsDir, `${options.sessionName}-${new Date().toISOString().split('T')[0]}`);
        const model = options.model || this.config.defaultModel;
        const cwd = options.cwd || process.cwd();
        const approvalMode = options.approvalMode || this.config.defaultApprovalMode;
        const sandboxPolicy = options.sandboxPolicy || this.config.defaultSandboxPolicy;
        const timeout = options.timeout || this.config.defaultTimeout;
        const client = this.processManager.getClient();
        const result = await client.newConversation({
            model,
            cwd,
            approvalPolicy: approvalMode,
            sandbox: sandboxPolicy,
        });
        const session = {
            conversationId: result.conversationId,
            sessionName: options.sessionName,
            jobId,
            createdAt: new Date(),
            sessionDir,
            rolloutRef: result.rolloutPath,
            status: SessionStatus.ACTIVE,
            config: {
                model,
                cwd,
                approvalPolicy: approvalMode,
                sandboxPolicy,
                timeout,
            },
        };
        this.sessions.set(result.conversationId, session);
        const eventLogger = new EventLogger({
            logDir: sessionDir,
            logFileName: 'events.jsonl',
        });
        this.eventLoggers.set(jobId, eventLogger);
        const configPersister = new ConfigPersister({
            sessionDir,
            configFileName: 'config.json',
        });
        this.configPersisters.set(jobId, configPersister);
        await configPersister.saveConfig(session);
        const policyEngine = new PolicyEngine({
            policy: {
                mode: approvalMode,
                whitelist: [],
                timeout,
            },
        });
        this.policyEngines.set(jobId, policyEngine);
        await eventLogger.logEvent({
            type: EventType.SESSION_CREATED,
            jobId,
            sessionId: result.conversationId,
            data: {
                sessionName: options.sessionName,
                model,
                cwd,
                approvalMode,
                sandboxPolicy,
            },
        });
        return {
            conversationId: result.conversationId,
            jobId,
            rolloutPath: result.rolloutPath,
        };
    }
    async sendUserMessage(conversationId, message) {
        const session = this.sessions.get(conversationId);
        if (!session) {
            throw new Error(`Session not found: ${conversationId}`);
        }
        session.status = SessionStatus.ACTIVE;
        const client = this.processManager.getClient();
        await client.sendUserMessage({
            conversationId,
            items: [{ type: 'text', text: message }],
        });
        const eventLogger = this.eventLoggers.get(session.jobId);
        if (eventLogger) {
            await eventLogger.logEvent({
                type: EventType.CODEX_AGENT_MESSAGE,
                jobId: session.jobId,
                sessionId: conversationId,
                data: {
                    role: 'user',
                    message,
                },
            });
        }
    }
    async handleApprovalRequest(request) {
        const policyEngine = this.policyEngines.get(request.jobId);
        if (!policyEngine) {
            throw new Error(`Policy engine not found for job: ${request.jobId}`);
        }
        const eventLogger = this.eventLoggers.get(request.jobId);
        if (eventLogger) {
            await eventLogger.logEvent({
                type: EventType.APPROVAL_REQUESTED,
                jobId: request.jobId,
                data: {
                    requestId: request.requestId,
                    type: request.type,
                    details: request.details,
                },
            });
        }
        let decision;
        let terminalDecision;
        if (request.type === 'exec-command') {
            const details = request.details;
            const policyDecision = policyEngine.evaluateCommand(details.command);
            if (!policyDecision.needsApproval) {
                decision = 'allow';
                request.status = ApprovalStatus.AUTO_APPROVED;
            }
            else {
                terminalDecision = await this.terminalUI.promptApproval(request);
                decision = terminalDecision === 'allow' ? 'allow' : 'deny';
                request.status = decision === 'allow' ? ApprovalStatus.APPROVED : ApprovalStatus.DENIED;
            }
        }
        else if (request.type === 'apply-patch') {
            terminalDecision = await this.terminalUI.promptApproval(request);
            decision = terminalDecision === 'allow' ? 'allow' : 'deny';
            request.status = decision === 'allow' ? ApprovalStatus.APPROVED : ApprovalStatus.DENIED;
        }
        else {
            throw new Error(`Unknown approval type: ${request.type}`);
        }
        if (eventLogger) {
            const eventType = request.status === ApprovalStatus.APPROVED
                ? EventType.APPROVAL_APPROVED
                : request.status === ApprovalStatus.AUTO_APPROVED
                    ? EventType.APPROVAL_AUTO_APPROVED
                    : EventType.APPROVAL_DENIED;
            await eventLogger.logEvent({
                type: eventType,
                jobId: request.jobId,
                data: {
                    requestId: request.requestId,
                    decision,
                    status: request.status,
                },
            });
        }
        return decision;
    }
    getSession(conversationId) {
        return this.sessions.get(conversationId);
    }
    listSessions() {
        return Array.from(this.sessions.values());
    }
    async terminateSession(conversationId) {
        const session = this.sessions.get(conversationId);
        if (!session) {
            throw new Error(`Session not found: ${conversationId}`);
        }
        session.status = SessionStatus.TERMINATED;
        const eventLogger = this.eventLoggers.get(session.jobId);
        if (eventLogger) {
            await eventLogger.logEvent({
                type: EventType.SESSION_TERMINATED,
                jobId: session.jobId,
                sessionId: conversationId,
                data: {
                    reason: 'manual',
                },
            });
        }
        const configPersister = this.configPersisters.get(session.jobId);
        if (configPersister) {
            await configPersister.saveConfig(session);
        }
    }
    async cleanup() {
        const activeSessions = Array.from(this.sessions.values()).filter((session) => session.status === SessionStatus.ACTIVE);
        for (const session of activeSessions) {
            await this.terminateSession(session.conversationId);
        }
        await this.processManager.stop();
        this.sessions.clear();
        this.eventLoggers.clear();
        this.configPersisters.clear();
        this.policyEngines.clear();
    }
}
export function createSessionManager(config) {
    return new SessionManager(config);
}
