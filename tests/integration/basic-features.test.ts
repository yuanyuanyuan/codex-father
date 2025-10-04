/**
 * T049 基础功能集成测试（0.42/0.44 通用）
 *
 * 场景覆盖：
 * - A1: MCP 服务器启动（桥接层可用 + 进程就绪 + 无错误）
 * - A2: newConversation 方法验证（UUID、model 一致、rolloutPath 存在）
 * - A3: sendUserMessage 方法验证（accepted=true，收到 codex/event 通知，事件日志写入）
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

import { BridgeLayer } from '../../core/mcp/bridge-layer.js';
import type { ISessionManager } from '../../core/mcp/bridge-layer.js';
import { SessionManager, type IProcessManager } from '../../core/session/session-manager.js';
import { ApprovalMode, EventType, SandboxPolicy } from '../../core/lib/types.js';
import type {
  CodexClient,
  CodexNewConversationParams,
  CodexNewConversationResult,
  CodexSendUserMessageParams,
  CodexSendUserMessageResult,
} from '../../core/mcp/codex-client.js';
import type { TerminalUI } from '../../core/approval/terminal-ui.js';

// ------------------------------
// Mocks
// ------------------------------

class MockCodexClient extends EventEmitter {
  private rolloutsRoot: string;
  conversations: CodexNewConversationResult[] = [];
  messages: Array<{ conversationId: string; items: CodexSendUserMessageParams['items'] }> = [];

  constructor(rolloutsRoot: string) {
    super();
    this.rolloutsRoot = rolloutsRoot;
  }

  async newConversation(params: CodexNewConversationParams): Promise<CodexNewConversationResult> {
    const conversationId = uuidv4();
    const dir = path.join(this.rolloutsRoot);
    await fs.mkdir(dir, { recursive: true });
    const rolloutPath = path.join(dir, `${conversationId}.jsonl`);
    await fs.writeFile(rolloutPath, '', 'utf-8');

    const result: CodexNewConversationResult = {
      conversationId,
      model: params.model ?? 'gpt-5',
      rolloutPath,
    };
    this.conversations.push(result);
    return result;
  }

  async sendUserMessage(params: CodexSendUserMessageParams): Promise<CodexSendUserMessageResult> {
    this.messages.push({ conversationId: params.conversationId, items: params.items });

    // 模拟 Codex 通知流（codex/event）
    this.emit('notification', {
      jsonrpc: '2.0',
      method: 'codex/event',
      params: {
        conversationId: params.conversationId,
        type: 'codex-agent-message',
        content: (params.items[0]?.type === 'text' && params.items[0]?.text) || '',
        eventId: uuidv4(),
      },
    });

    return { status: 'accepted' };
  }

  async interruptConversation(): Promise<void> {
    return Promise.resolve();
  }
}

class MockProcessManager implements IProcessManager {
  private ready = false;
  readonly client: MockCodexClient;

  constructor(client: MockCodexClient) {
    this.client = client;
  }

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

// ------------------------------
// Helpers
// ------------------------------

async function waitForCondition(
  check: () => Promise<boolean>,
  timeoutMs = 1500,
  intervalMs = 25
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) {
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Condition not met within timeout');
}

async function readEventsFile(filePath: string): Promise<any[]> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content
      .trim()
      .split('\n')
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

async function removeDirSafe(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
}

// ------------------------------
// Test Context
// ------------------------------

interface IntegrationContext {
  sessionsRoot: string;
  rolloutsRoot: string;
  sessionManager: SessionManager;
  bridgeLayer: BridgeLayer;
  processManager: MockProcessManager;
  terminalSpy: ReturnType<typeof vi.spyOn>;
  capturedNotifications: any[];
}

async function createIntegrationContext(tag: string): Promise<IntegrationContext> {
  const baseRoot = path.join(process.cwd(), '.codex-father-test', 'integration', tag);
  const sessionsRoot = path.join(baseRoot, 'sessions');
  const rolloutsRoot = path.join(baseRoot, 'rollouts');
  await fs.mkdir(sessionsRoot, { recursive: true });
  await fs.mkdir(rolloutsRoot, { recursive: true });

  const client = new MockCodexClient(rolloutsRoot);
  const processManager = new MockProcessManager(client);

  const sessionManager = new SessionManager({
    processManager,
    sessionsDir: sessionsRoot,
    defaultApprovalMode: ApprovalMode.ON_REQUEST,
    defaultSandboxPolicy: SandboxPolicy.WORKSPACE_WRITE,
  });

  const bridgeLayer = new BridgeLayer({
    sessionManager: sessionManager as unknown as ISessionManager,
    defaultApprovalMode: ApprovalMode.ON_REQUEST,
  });

  // 自动批准审批请求（如触发）
  const terminalUI = (sessionManager as unknown as { terminalUI: TerminalUI }).terminalUI;
  const terminalSpy = vi.spyOn(terminalUI, 'promptApproval').mockResolvedValue('allow');

  // 捕获 codex/event 通知
  const capturedNotifications: any[] = [];
  client.on('notification', (n) => capturedNotifications.push(n));

  return {
    sessionsRoot,
    rolloutsRoot,
    sessionManager,
    bridgeLayer,
    processManager,
    terminalSpy,
    capturedNotifications,
  };
}

// ------------------------------
// Tests
// ------------------------------

describe('T049 基础功能集成测试', () => {
  const createdDirs: string[] = [];

  beforeEach(() => {
    createdDirs.length = 0;
  });

  afterEach(async () => {
    for (const dir of createdDirs) {
      await removeDirSafe(dir);
    }
  });

  it('场景 A1: MCP 服务器启动（桥接层工具可用 & 进程就绪）', async () => {
    const ctx = await createIntegrationContext(`a1-${Date.now()}`);
    createdDirs.push(path.dirname(ctx.sessionsRoot));

    try {
      // 工具列表应包含 start-codex-task
      const tools = ctx.bridgeLayer.getTools();
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.map((t) => t.name)).toContain('start-codex-task');

      // 调用一次以触发进程启动与会话创建
      const res = await ctx.bridgeLayer.callTool('start-codex-task', {
        prompt: 'health check',
        approvalPolicy: ApprovalMode.ON_REQUEST,
      });
      expect(res.status).toBe('accepted');

      // 进程应就绪，且会话事件与配置文件生成
      expect(ctx.processManager.isReady()).toBe(true);

      await waitForCondition(async () => {
        const sessionDirs = await fs.readdir(ctx.sessionsRoot).catch(() => []);
        if (sessionDirs.length === 0) {
          return false;
        }
        const sessionDir = path.join(ctx.sessionsRoot, sessionDirs[0]!);
        const hasConfig = await fs
          .access(path.join(sessionDir, 'config.json'))
          .then(() => true)
          .catch(() => false);
        const hasEvents = await fs
          .access(path.join(sessionDir, 'events.jsonl'))
          .then(() => true)
          .catch(() => false);
        return hasConfig && hasEvents;
      }, 3000);

      // 事件中应包含会话创建
      const [sessionDirName] = await fs.readdir(ctx.sessionsRoot);
      const sessionDir = path.join(ctx.sessionsRoot, sessionDirName);
      const events = await readEventsFile(path.join(sessionDir, 'events.jsonl'));
      expect(events.some((e) => e.type === EventType.SESSION_CREATED)).toBe(true);
    } finally {
      await ctx.sessionManager.cleanup();
    }
  });

  it('场景 A2: 创建新会话（newConversation 方法验证）', async () => {
    const ctx = await createIntegrationContext(`a2-${Date.now()}`);
    createdDirs.push(path.dirname(ctx.sessionsRoot));

    try {
      // 通过 MCP 工具触发 newConversation
      const result = await ctx.bridgeLayer.callTool('start-codex-task', {
        prompt: 'Hello Codex',
        sessionName: 'integration-a2',
        model: 'gpt-5',
        approvalPolicy: ApprovalMode.ON_REQUEST,
        sandbox: SandboxPolicy.WORKSPACE_WRITE,
      });

      expect(result.status).toBe('accepted');

      // 等待 Mock 客户端记录会话
      await waitForCondition(async () => ctx.processManager.client.conversations.length > 0);

      const conv = ctx.processManager.client.conversations[0]!;
      // conversationId 为有效 UUID
      expect(conv.conversationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      // model 与请求一致
      expect(conv.model).toBe('gpt-5');
      // rolloutPath 存在
      const exists = await fs
        .access(conv.rolloutPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);

      // 验证无 HTTP 405 错误（无异常即视为通过）
      // 额外：会话配置已持久化
      const [sessionDirName] = await fs.readdir(ctx.sessionsRoot);
      const sessionDir = path.join(ctx.sessionsRoot, sessionDirName);
      const configRaw = await fs.readFile(path.join(sessionDir, 'config.json'), 'utf-8');
      const config = JSON.parse(configRaw);
      expect(config.config.approvalPolicy).toBe('on-request');
    } finally {
      await ctx.sessionManager.cleanup();
    }
  });

  it('场景 A3: 发送用户消息（sendUserMessage 方法验证）', async () => {
    const ctx = await createIntegrationContext(`a3-${Date.now()}`);
    createdDirs.push(path.dirname(ctx.sessionsRoot));

    try {
      // 先创建会话
      const { conversationId, jobId } = await ctx.sessionManager.createSession({
        sessionName: 'integration-a3',
        model: 'gpt-5',
        approvalMode: ApprovalMode.ON_REQUEST,
        sandboxPolicy: SandboxPolicy.WORKSPACE_WRITE,
      });
      expect(jobId).toMatch(/^[0-9a-f-]{36}$/i);

      // 发送用户消息
      await ctx.sessionManager.sendUserMessage(conversationId, 'Hello Codex');

      // 响应 accepted=true（由 Mock 返回），通过已记录的消息数量验证
      expect(ctx.processManager.client.messages.length).toBeGreaterThan(0);

      // 收到 codex/event 通知流
      await waitForCondition(async () => ctx.capturedNotifications.length > 0);
      const notif = ctx.capturedNotifications[0]!;
      expect(notif.method).toBe('codex/event');
      expect(notif.params?.conversationId).toBe(conversationId);

      // 事件日志应记录 CODEX_AGENT_MESSAGE
      await waitForCondition(async () => {
        const sessionDirs = await fs.readdir(ctx.sessionsRoot);
        if (sessionDirs.length === 0) {
          return false;
        }
        const sessionDir = path.join(ctx.sessionsRoot, sessionDirs[0]!);
        const events = await readEventsFile(path.join(sessionDir, 'events.jsonl'));
        return events.some((e) => e.type === EventType.CODEX_AGENT_MESSAGE);
      }, 3000);
    } finally {
      await ctx.sessionManager.cleanup();
    }
  });
});
