import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

import { BridgeLayer } from '../../core/mcp/bridge-layer.js';
import type { ISessionManager } from '../../core/mcp/bridge-layer.js';
import { SessionManager, type IProcessManager } from '../../core/session/session-manager.js';
import {
  ApprovalMode,
  ApprovalStatus,
  ApprovalType,
  EventType,
  SandboxPolicy,
  type ApprovalRequest,
} from '../../core/lib/types.js';
import { createEventMapper } from '../../core/mcp/event-mapper.js';
import type {
  CodexNewConversationParams,
  CodexNewConversationResult,
  CodexSendUserMessageParams,
  CodexSendUserMessageResult,
  CodexClient,
} from '../../core/mcp/codex-client.js';
import type { TerminalUI } from '../../core/approval/terminal-ui.js';
import type { PolicyEngine } from '../../core/approval/policy-engine.js';

class MockCodexClient extends EventEmitter {
  conversations: CodexNewConversationResult[] = [];
  messages: Array<{ conversationId: string; items: CodexSendUserMessageParams['items'] }> = [];

  async newConversation(params: CodexNewConversationParams): Promise<CodexNewConversationResult> {
    const conversationId = uuidv4();
    const result: CodexNewConversationResult = {
      conversationId,
      model: params.model ?? 'gpt-5',
      rolloutPath: `/mock/rollouts/${conversationId}.jsonl`,
    };
    this.conversations.push(result);
    return result;
  }

  async sendUserMessage(params: CodexSendUserMessageParams): Promise<CodexSendUserMessageResult> {
    this.messages.push({ conversationId: params.conversationId, items: params.items });
    return { status: 'accepted' };
  }

  async interruptConversation(): Promise<void> {
    return Promise.resolve();
  }
}

class MockProcessManager implements IProcessManager {
  private ready = false;
  readonly client = new MockCodexClient();

  getClient(): CodexClient {
    return this.client as unknown as CodexClient;
  }

  isReady(): boolean {
    return this.ready;
  }

  async start(): Promise<void> {
    this.ready = true;
  }

  async stop(): Promise<void> {
    this.ready = false;
  }
}

interface AcceptanceContext {
  sessionsRoot: string;
  sessionManager: SessionManager;
  bridgeLayer: BridgeLayer;
  processManager: MockProcessManager;
  terminalSpy: ReturnType<typeof vi.spyOn>;
}

async function createAcceptanceContext(tag: string): Promise<AcceptanceContext> {
  const sessionsRoot = path.join(process.cwd(), '.codex-father-test', 'acceptance', tag);
  await fs.mkdir(sessionsRoot, { recursive: true });

  const processManager = new MockProcessManager();
  const sessionManager = new SessionManager({
    processManager,
    sessionsDir: sessionsRoot,
    defaultApprovalMode: ApprovalMode.UNTRUSTED,
    defaultSandboxPolicy: SandboxPolicy.WORKSPACE_WRITE,
  });

  const bridgeLayer = new BridgeLayer({
    sessionManager: sessionManager as unknown as ISessionManager,
    defaultApprovalMode: ApprovalMode.UNTRUSTED,
  });

  const terminalUI = (sessionManager as unknown as { terminalUI: TerminalUI }).terminalUI;
  const terminalSpy = vi.spyOn(terminalUI, 'promptApproval').mockResolvedValue('allow');

  return {
    sessionsRoot,
    sessionManager,
    bridgeLayer,
    processManager,
    terminalSpy,
  };
}

async function waitForCondition(
  check: () => Promise<boolean>,
  timeoutMs = 1000,
  intervalMs = 25
): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Condition not met within timeout');
}

async function readEventsFile(filePath: string): Promise<any[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function removeDirSafe(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
}

async function waitForPolicyEngine(
  sessionManager: SessionManager,
  jobId: string
): Promise<PolicyEngine> {
  let engine: PolicyEngine | undefined;

  await waitForCondition(async () => {
    engine = (
      sessionManager as unknown as { policyEngines: Map<string, PolicyEngine> }
    ).policyEngines.get(jobId);
    return engine !== undefined;
  }, 1500);

  if (!engine) {
    throw new Error(`Policy engine not initialized for job ${jobId}`);
  }

  return engine;
}

describe('T037 自动化验收测试', () => {
  const createdDirs: string[] = [];

  beforeEach(() => {
    createdDirs.length = 0;
  });

  afterEach(async () => {
    for (const dir of createdDirs) {
      await removeDirSafe(dir);
    }
  });

  it('场景 1: MCP 单进程流程应完全自动化验证', async () => {
    const context = await createAcceptanceContext(`scenario1-${Date.now()}`);
    createdDirs.push(context.sessionsRoot);

    try {
      const tools = context.bridgeLayer.getTools();
      expect(tools.length).toBeGreaterThanOrEqual(1);
      expect(tools.map((tool) => tool.name)).toContain('start-codex-task');

      const startTime = Date.now();
      const result = await context.bridgeLayer.callTool('start-codex-task', {
        prompt: 'List files in current directory',
        sessionName: 'acceptance-s1',
        approvalPolicy: ApprovalMode.UNTRUSTED,
      });
      const duration = Date.now() - startTime;

      expect(result.status).toBe('accepted');
      expect(result.jobId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(result.message).toContain('Task accepted');
      expect(duration).toBeLessThan(500);

      await waitForCondition(async () => {
        const sessionDirs = await fs.readdir(context.sessionsRoot);
        return sessionDirs.length > 0;
      });

      const [sessionDirName] = await fs.readdir(context.sessionsRoot);
      const sessionDir = path.join(context.sessionsRoot, sessionDirName);

      await waitForCondition(async () => {
        const exists = await fs
          .access(path.join(sessionDir, 'config.json'))
          .then(() => true)
          .catch(() => false);
        const logExists = await fs
          .access(path.join(sessionDir, 'events.jsonl'))
          .then(() => true)
          .catch(() => false);
        return exists && logExists;
      }, 1500);

      const configRaw = await fs.readFile(path.join(sessionDir, 'config.json'), 'utf-8');
      const config = JSON.parse(configRaw);
      expect(config.jobId).toBe(result.jobId);
      expect(config.config.approvalPolicy).toBe('untrusted');

      const events = await readEventsFile(path.join(sessionDir, 'events.jsonl'));
      expect(events.some((event) => event.type === EventType.SESSION_CREATED)).toBe(true);

      const mapper = createEventMapper();
      const mapped = mapper.mapEvent(
        {
          ...events[0],
          timestamp: new Date(events[0].timestamp),
        },
        result.jobId
      );
      expect(mapped.params.jobId).toBe(result.jobId);

      expect(context.processManager.client.conversations.length).toBe(1);
      expect(context.processManager.client.messages.length).toBe(1);
    } finally {
      await context.sessionManager.cleanup();
    }
  });

  it('场景 2: 审批机制应在自动化测试中覆盖全部分支', async () => {
    const context = await createAcceptanceContext(`scenario2-${Date.now()}`);
    createdDirs.push(context.sessionsRoot);

    try {
      const result = await context.bridgeLayer.callTool('start-codex-task', {
        prompt: 'Inspect repository status',
        sessionName: 'acceptance-s2',
        approvalPolicy: ApprovalMode.UNTRUSTED,
      });

      await waitForCondition(async () => {
        const sessionDirs = await fs.readdir(context.sessionsRoot);
        return sessionDirs.length > 0;
      });

      const [sessionDirName] = await fs.readdir(context.sessionsRoot);
      const sessionDir = path.join(context.sessionsRoot, sessionDirName);

      const policyEngine = await waitForPolicyEngine(context.sessionManager, result.jobId);
      policyEngine.addWhitelistRule({
        pattern: '^git status',
        reason: 'Read-only status command',
        enabled: true,
      });

      const whitelistRequest: ApprovalRequest = {
        requestId: uuidv4(),
        jobId: result.jobId,
        type: ApprovalType.EXEC_COMMAND,
        createdAt: new Date(),
        status: ApprovalStatus.PENDING,
        details: {
          command: 'git status',
          cwd: process.cwd(),
        },
      };

      const spy = context.terminalSpy;
      spy.mockResolvedValue('deny');

      const autoDecision = await context.sessionManager.handleApprovalRequest(whitelistRequest);
      expect(autoDecision).toBe('allow');
      expect(whitelistRequest.status).toBe(ApprovalStatus.AUTO_APPROVED);
      expect(spy).not.toHaveBeenCalled();

      const manualRequestAllow: ApprovalRequest = {
        requestId: uuidv4(),
        jobId: result.jobId,
        type: ApprovalType.EXEC_COMMAND,
        createdAt: new Date(),
        status: ApprovalStatus.PENDING,
        details: {
          command: 'rm -rf build',
          cwd: process.cwd(),
        },
      };

      spy.mockResolvedValueOnce('allow');
      const manualDecisionAllow =
        await context.sessionManager.handleApprovalRequest(manualRequestAllow);
      expect(manualDecisionAllow).toBe('allow');
      expect(manualRequestAllow.status).toBe(ApprovalStatus.APPROVED);

      const manualRequestDeny: ApprovalRequest = {
        requestId: uuidv4(),
        jobId: result.jobId,
        type: ApprovalType.EXEC_COMMAND,
        createdAt: new Date(),
        status: ApprovalStatus.PENDING,
        details: {
          command: 'npm install dangerous-package',
          cwd: process.cwd(),
        },
      };

      spy.mockResolvedValueOnce('deny');
      const manualDecisionDeny =
        await context.sessionManager.handleApprovalRequest(manualRequestDeny);
      expect(manualDecisionDeny).toBe('deny');
      expect(manualRequestDeny.status).toBe(ApprovalStatus.DENIED);

      await waitForCondition(async () => {
        const events = await readEventsFile(path.join(sessionDir, 'events.jsonl'));
        return events.some((event) => event.type === EventType.APPROVAL_REQUESTED);
      }, 1500);

      const events = await readEventsFile(path.join(sessionDir, 'events.jsonl'));
      const requested = events.filter((event) => event.type === EventType.APPROVAL_REQUESTED);
      const approved = events.filter((event) => event.type === EventType.APPROVAL_APPROVED);
      const denied = events.filter((event) => event.type === EventType.APPROVAL_DENIED);
      const autoApproved = events.filter(
        (event) => event.type === EventType.APPROVAL_AUTO_APPROVED
      );

      expect(requested.length).toBeGreaterThanOrEqual(2);
      expect(approved.length).toBeGreaterThanOrEqual(1);
      expect(denied.length).toBeGreaterThanOrEqual(1);
      expect(autoApproved.length).toBeGreaterThanOrEqual(1);
    } finally {
      await context.sessionManager.cleanup();
    }
  });
});
