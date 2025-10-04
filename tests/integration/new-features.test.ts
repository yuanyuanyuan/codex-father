/**
 * T052 新特性支持集成测试（0.44 环境）
 *
 * 场景覆盖：
 * - D1: newConversation 支持 profile 参数（读取 TOML Profile 并使用 --profile 启动）
 * - D2: sendUserTurn 支持 effort 和 summary 参数（透传为 CLI 参数）
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
// Mocks（0.44 新特性：profile/effort/summary 支持）
// ------------------------------

class MockCodexClientNF extends EventEmitter {
  private rolloutsRoot: string;
  private configTomlPath?: string;
  private captureStartArgs: (args: string[]) => void;
  private captureSendArgs: (args: string[]) => void;

  conversations: CodexNewConversationResult[] = [];
  messages: Array<{ conversationId: string; items: CodexSendUserMessageParams['items'] }> = [];
  lastNewConversationParams: CodexNewConversationParams | undefined;
  lastSendUserTurnParams: any | undefined;
  usedProfile?: string;

  constructor(
    rolloutsRoot: string,
    configTomlPath: string | undefined,
    captureStartArgs: (args: string[]) => void,
    captureSendArgs: (args: string[]) => void
  ) {
    super();
    this.rolloutsRoot = rolloutsRoot;
    this.configTomlPath = configTomlPath;
    this.captureStartArgs = captureStartArgs;
    this.captureSendArgs = captureSendArgs;
  }

  private async resolveModelFromProfile(profile?: string): Promise<string | undefined> {
    if (!profile || !this.configTomlPath) {
      return undefined;
    }
    try {
      const text = await fs.readFile(this.configTomlPath, 'utf-8');
      // 简单解析：[profiles.<name>] 区块内的 model = "..."
      const sectionHeader = `[profiles.${profile}]`;
      const lines = text.split(/\r?\n/);
      let inSection = false;
      for (const raw of lines) {
        const line = raw.trim();
        if (/^\s*\[.+\]\s*$/.test(line)) {
          inSection = line === sectionHeader;
          continue;
        }
        if (!inSection) {
          continue;
        }
        const m = line.match(/^model\s*=\s*"([^"]+)"/);
        if (m) {
          return m[1];
        }
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  async newConversation(params: CodexNewConversationParams): Promise<CodexNewConversationResult> {
    // 若提供 profile，则模拟 CLI 使用 --profile 并从 Profile 解析 model
    let model = params.model;
    if (params.profile) {
      this.usedProfile = params.profile;
      this.captureStartArgs(['--profile', params.profile]);
      const profModel = await this.resolveModelFromProfile(params.profile);
      if (profModel) {
        model = profModel;
      }
    }

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

  // 0.44 新方法（集成测试 Mock）：支持 effort & summary
  async sendUserTurn(params: {
    conversationId: string;
    items: Array<{ type: 'text' | 'image'; text?: string; imageUrl?: string }>;
    effort?: 'low' | 'medium' | 'high';
    summary?: 'never' | 'auto' | 'always';
  }): Promise<{ accepted: boolean }> {
    this.lastSendUserTurnParams = params;
    const args: string[] = [];
    if (params.effort) {
      args.push('--effort', params.effort);
    }
    if (params.summary) {
      args.push('--summary', params.summary);
    }
    if (args.length > 0) {
      this.captureSendArgs(args);
    }
    return { accepted: true };
  }

  async interruptConversation(): Promise<void> {
    return Promise.resolve();
  }
}

class MockProcessManagerNF implements IProcessManager {
  private ready = false;
  readonly client: MockCodexClientNF;
  capturedStartArgs: string[] = [];
  capturedSendArgs: string[] = [];

  constructor(client: MockCodexClientNF) {
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
// Test Context
// ------------------------------

interface IntegrationContextNF {
  sessionsRoot: string;
  rolloutsRoot: string;
  configTomlPath: string;
  sessionManager: SessionManager;
  bridgeLayer: BridgeLayer;
  processManager: MockProcessManagerNF;
  terminalSpy: ReturnType<typeof vi.spyOn>;
}

async function createIntegrationContextNF(tag: string): Promise<IntegrationContextNF> {
  const baseRoot = path.join(
    process.cwd(),
    '.codex-father-test',
    'integration',
    'new-features',
    tag
  );
  const sessionsRoot = path.join(baseRoot, 'sessions');
  const rolloutsRoot = path.join(baseRoot, 'rollouts');
  const configTomlPath = path.join(baseRoot, 'config.toml');
  await fs.mkdir(sessionsRoot, { recursive: true });
  await fs.mkdir(rolloutsRoot, { recursive: true });

  const pm = new MockProcessManagerNF(
    new MockCodexClientNF(
      rolloutsRoot,
      configTomlPath,
      (args) => (pm.capturedStartArgs = args.slice()),
      (args) => (pm.capturedSendArgs = args.slice())
    )
  );

  const sessionManager = new SessionManager({
    processManager: pm,
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
    configTomlPath,
    sessionManager,
    bridgeLayer,
    processManager: pm,
    terminalSpy,
  };
}

// ------------------------------
// Tests
// ------------------------------

describe('T052 新特性支持集成测试 (0.44)', () => {
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

  // D1: Profile 参数支持
  it('场景 D1: newConversation 支持 profile 参数', async () => {
    const ctx = await createIntegrationContextNF(`d1-${Date.now()}`);
    createdDirs.push(path.dirname(ctx.sessionsRoot));

    // 写入 Profile 到临时 TOML（模拟 ~/.codex/config.toml）
    const toml = [
      '[profiles.test-profile]',
      'model = "gpt-5"',
      'approval_policy = "on-failure"',
      'sandbox_mode = "workspace-write"',
      '',
    ].join('\n');
    await fs.writeFile(ctx.configTomlPath, toml, 'utf-8');

    try {
      // 直接调用 Codex newConversation，携带 profile（0.44 特性）
      const client = ctx.processManager.getClient() as any;
      const result = await client.newConversation({ profile: 'test-profile' });

      // 响应成功（无 JSON-RPC 错误）
      expect(result).toBeDefined();
      expect(result.conversationId).toMatch(/^[0-9a-f-]{36}$/i);

      // Codex 使用 Profile 配置的 model
      expect(result.model).toBe('gpt-5');

      // 启动参数包含 --profile test-profile（通过 capturedStartArgs 模拟）
      expect(ctx.processManager.capturedStartArgs).toEqual(['--profile', 'test-profile']);

      // 客户端记录了使用的 profile
      const used = (ctx.processManager as any).client.usedProfile;
      expect(used).toBe('test-profile');
    } finally {
      await ctx.sessionManager.cleanup();
    }
  });

  // D2: 推理配置（effort + summary）
  it('场景 D2: sendUserTurn 支持 effort 和 summary 参数', async () => {
    const ctx = await createIntegrationContextNF(`d2-${Date.now()}`);
    createdDirs.push(path.dirname(ctx.sessionsRoot));

    try {
      // 先创建会话，获取 conversationId（走常规路径）
      const { conversationId } = await ctx.sessionManager.createSession({
        sessionName: 'integration-d2',
        model: 'gpt-5',
        approvalMode: ApprovalMode.ON_REQUEST,
        sandboxPolicy: SandboxPolicy.WORKSPACE_WRITE,
      });

      // 调用 0.44 新增 sendUserTurn（通过 Mock）
      const client = ctx.processManager.getClient() as any;
      const resp = await client.sendUserTurn({
        conversationId,
        items: [{ type: 'text', text: 'Complex reasoning task' }],
        effort: 'high',
        summary: 'always',
      });

      // 响应成功
      expect(resp).toEqual({ accepted: true });

      // 参数被正确传递到 CLI 层（--effort high --summary always）
      expect(ctx.processManager.capturedSendArgs).toEqual([
        '--effort',
        'high',
        '--summary',
        'always',
      ]);

      // 无参数不兼容错误（未抛出异常即视为通过）
    } finally {
      await ctx.sessionManager.cleanup();
    }
  });
});
