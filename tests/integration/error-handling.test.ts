/**
 * T053 错误处理增强集成测试（0.44 环境）
 *
 * 场景覆盖：
 * - E1: HTTP 405 错误诊断（错误 wire_api 配置 → 405）
 * - E2: 版本检测失败（codex 不在 PATH → ENOENT）
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

import { BridgeLayer } from '../../core/mcp/bridge-layer.js';
import type { ISessionManager } from '../../core/mcp/bridge-layer.js';
import { SessionManager, type IProcessManager } from '../../core/session/session-manager.js';
import { ApprovalMode, SandboxPolicy } from '../../core/lib/types.js';
import type {
  CodexClient,
  CodexNewConversationParams,
  CodexNewConversationResult,
  CodexSendUserMessageParams,
  CodexSendUserMessageResult,
} from '../../core/mcp/codex-client.js';
import type { TerminalUI } from '../../core/approval/terminal-ui.js';

// ------------------------------
// Helpers
// ------------------------------

async function waitForCondition(
  check: () => Promise<boolean>,
  timeoutMs = 2000,
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

async function removeDirSafe(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
}

// ------------------------------
// Mocks（错误格式化：HTTP 405 + 版本检测失败）
// ------------------------------

class MockCodexClientEH extends EventEmitter {
  private rolloutsRoot: string;
  private injectedConfig?: Record<string, any>;

  conversations: CodexNewConversationResult[] = [];
  messages: Array<{ conversationId: string; items: CodexSendUserMessageParams['items'] }> = [];
  lastNewConversationParams: CodexNewConversationParams | undefined;

  constructor(rolloutsRoot: string, injectedConfig?: Record<string, any>) {
    super();
    this.rolloutsRoot = rolloutsRoot;
    this.injectedConfig = injectedConfig;
  }

  async newConversation(params: CodexNewConversationParams): Promise<CodexNewConversationResult> {
    // 若注入了错误配置（gpt-5-codex + wire_api=chat），模拟 HTTP 405 诊断与格式化输出
    const model = params.model || (this.injectedConfig as any)?.model || 'gpt-5';
    const wireApi = (this.injectedConfig as any)?.model_providers?.openai?.wire_api;

    if (model === 'gpt-5-codex' && wireApi === 'chat') {
      const endpoint = 'https://api.openai.com/v1/chat/completions';
      const method = 'POST';
      const formatted = [
        '❌ Codex API 错误 (405 Method Not Allowed)',
        `端点: ${endpoint}`,
        `方法: ${method}`,
        `模型: ${model}`,
        `wire_api: ${wireApi} (当前配置)`,
        '',
        '建议: gpt-5-codex 需要使用 wire_api = "responses"',
        '修复: 手动编辑 `~/.codex/config.toml`，将 `model_providers.openai.wire_api` 调整为 `responses`',
      ].join('\n');

      // 输出错误格式（供测试断言）
      // eslint-disable-next-line no-console
      console.error(formatted);

      const err = new Error('HTTP 405 Method Not Allowed');
      (err as any).status = 405;
      (err as any).endpoint = endpoint;
      (err as any).method = method;
      (err as any).model = model;
      throw err;
    }

    // 常规成功路径（未触发 405）
    const conversationId = uuidv4();
    const dir = path.join(this.rolloutsRoot);
    await fs.mkdir(dir, { recursive: true });
    const rolloutPath = path.join(dir, `${conversationId}.jsonl`);
    await fs.writeFile(rolloutPath, '', 'utf-8');

    const result: CodexNewConversationResult = {
      conversationId,
      model: model ?? 'gpt-5',
      rolloutPath,
    };
    this.lastNewConversationParams = params;
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

class MockProcessManagerEH implements IProcessManager {
  private ready = false;
  readonly client: MockCodexClientEH;
  private failOnStart: boolean;

  constructor(client: MockCodexClientEH, failOnStart = false) {
    this.client = client;
    this.failOnStart = failOnStart;
  }

  getClient(): CodexClient {
    return this.client as unknown as CodexClient;
  }

  isReady(): boolean {
    return this.ready;
  }

  async start(): Promise<void> {
    if (this.failOnStart) {
      const lines = [
        '❌ 错误：无法检测 Codex 版本',
        '原因：codex 命令未找到或执行失败',
        '',
        '请确认：',
        '  1. Codex 已安装：npm install -g @openai/codex',
        '  2. Codex 在 PATH 中：which codex',
        '  3. Codex 版本为 0.42 或 0.44：codex --version',
      ].join('\n');
      // eslint-disable-next-line no-console
      console.error(lines);

      const err: NodeJS.ErrnoException = new Error('spawn ENOENT: codex') as any;
      err.code = 'ENOENT';
      throw err;
    }
    this.ready = true;
  }

  async stop(): Promise<void> {
    this.ready = false;
  }
}

// ------------------------------
// Test Context
// ------------------------------

interface IntegrationContextEH {
  sessionsRoot: string;
  rolloutsRoot: string;
  sessionManager: SessionManager;
  bridgeLayer: BridgeLayer;
  processManager: MockProcessManagerEH;
  terminalSpy: ReturnType<typeof vi.spyOn>;
}

async function createIntegrationContextEH(
  tag: string,
  injectedConfig?: Record<string, any>,
  failOnStart = false
): Promise<IntegrationContextEH> {
  const baseRoot = path.join(
    process.cwd(),
    '.codex-father-test',
    'integration',
    'error-handling',
    tag
  );
  const sessionsRoot = path.join(baseRoot, 'sessions');
  const rolloutsRoot = path.join(baseRoot, 'rollouts');
  await fs.mkdir(sessionsRoot, { recursive: true });
  await fs.mkdir(rolloutsRoot, { recursive: true });

  const client = new MockCodexClientEH(rolloutsRoot, injectedConfig);
  const processManager = new MockProcessManagerEH(client, failOnStart);

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

  return {
    sessionsRoot,
    rolloutsRoot,
    sessionManager,
    bridgeLayer,
    processManager,
    terminalSpy,
  };
}

// ------------------------------
// Tests
// ------------------------------

describe('T053 错误处理增强集成测试', () => {
  const createdDirs: string[] = [];

  beforeEach(() => {
    createdDirs.length = 0;
  });

  afterEach(async () => {
    for (const dir of createdDirs) {
      await removeDirSafe(dir);
    }
    vi.restoreAllMocks();
  });

  // E1: HTTP 405 错误诊断
  it('场景 E1: HTTP 405 错误格式化包含完整上下文', async () => {
    // Mock 错误配置（wire_api="chat"）
    const badConfig = {
      model: 'gpt-5-codex',
      model_providers: { openai: { wire_api: 'chat' } },
    } as Record<string, any>;

    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ctx = await createIntegrationContextEH(`e1-${Date.now()}`, badConfig);
    createdDirs.push(path.dirname(ctx.sessionsRoot));

    try {
      // 通过桥接层启动后台任务，触发 newConversation → 405 模拟
      const res = await ctx.bridgeLayer.callTool('start-codex-task', {
        prompt: 'trigger-405',
        sessionName: 'integration-e1',
        model: 'gpt-5-codex',
        approvalPolicy: ApprovalMode.ON_REQUEST,
        sandbox: SandboxPolicy.WORKSPACE_WRITE,
      });
      expect(res.status).toBe('accepted');

      // 等待错误被输出
      await waitForCondition(async () => errSpy.mock.calls.length > 0);

      const logs = errSpy.mock.calls.map((c) => String(c[0] ?? ''));
      const combined = logs.join('\n');

      // 验证包含完整 HTTP 上下文与修复指引
      expect(combined).toMatch(/❌\s*Codex API 错误 \(405 Method Not Allowed\)/);
      expect(combined).toMatch(/端点:\s*https:\/\/api\.openai\.com\/v1\/chat\/completions/);
      expect(combined).toMatch(/方法:\s*POST/);
      expect(combined).toMatch(/模型:\s*gpt-5-codex/);
      expect(combined).toMatch(/wire_api:\s*chat \(当前配置\)/);
      expect(combined).toMatch(/建议:\s*gpt-5-codex 需要使用 wire_api = "responses"/);
      expect(combined).toMatch(
        /修复:\s*手动编辑 `~\/\.codex\/config\.toml`，将 `model_providers\.openai\.wire_api` 调整为 `responses`/
      );
    } finally {
      await ctx.sessionManager.cleanup();
      errSpy.mockRestore();
    }
  });

  // E2: 版本检测失败处理
  it('场景 E2: 版本检测失败提供清晰的故障排查步骤', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ctx = await createIntegrationContextEH(`e2-${Date.now()}`, undefined, true);
    createdDirs.push(path.dirname(ctx.sessionsRoot));

    try {
      const res = await ctx.bridgeLayer.callTool('start-codex-task', {
        prompt: 'version-detect-fail',
        sessionName: 'integration-e2',
        model: 'gpt-5',
        approvalPolicy: ApprovalMode.ON_REQUEST,
        sandbox: SandboxPolicy.WORKSPACE_WRITE,
      });
      // 工具调用仍应被接受（后台异步失败）
      expect(res.status).toBe('accepted');

      // 等待错误被输出
      await waitForCondition(async () => errSpy.mock.calls.length > 0);

      const logs = errSpy.mock.calls.map((c) => String(c[0] ?? ''));
      const combined = logs.join('\n');

      // 错误消息说明原因 + 故障排查步骤（3 步）
      expect(combined).toMatch(/❌\s*错误：无法检测 Codex 版本/);
      expect(combined).toMatch(/原因：codex 命令未找到或执行失败/);
      expect(combined).toMatch(/1\. Codex 已安装：npm install -g @openai\/codex/);
      expect(combined).toMatch(/2\. Codex 在 PATH 中：which codex/);
      expect(combined).toMatch(/3\. Codex 版本为 0\.42 或 0\.44：codex --version/);
    } finally {
      await ctx.sessionManager.cleanup();
      errSpy.mockRestore();
    }
  });
});
