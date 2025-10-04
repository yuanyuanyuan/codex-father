/**
 * T051 配置验证与修正集成测试（0.44 环境）
 *
 * 场景覆盖：
 * - C1: 检测 405 错误风险配置（gpt-5-codex + wire_api="chat"）并显示交互式提示
 * - C2: 用户确认 Y 后创建修正 Profile（codex-father-auto-fix），并使用 --profile 启动
 * - C3: 用户确认 N 后保留原配置启动（不创建 Profile）
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import inquirer from 'inquirer';

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

import { validateConfig as validateCodexConfig } from '../../src/lib/configValidator';
import { createAutoFixProfile, writeProfile, readProfile } from '../../src/lib/profileManager';

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
// Mocks（配置验证 + 交互式修正 + Profile 写入）
// ------------------------------

class MockCodexClientCV extends EventEmitter {
  private rolloutsRoot: string;
  private injectedConfig: Record<string, any> | undefined;
  private configTomlPath: string | undefined;

  conversations: CodexNewConversationResult[] = [];
  messages: Array<{ conversationId: string; items: CodexSendUserMessageParams['items'] }> = [];
  lastNewConversationParams: CodexNewConversationParams | undefined;
  warnings: string[] = [];
  usedProfile?: string;

  constructor(rolloutsRoot: string, injectedConfig?: Record<string, any>, configTomlPath?: string) {
    super();
    this.rolloutsRoot = rolloutsRoot;
    this.injectedConfig = injectedConfig;
    this.configTomlPath = configTomlPath;
  }

  async newConversation(params: CodexNewConversationParams): Promise<CodexNewConversationResult> {
    // 触发配置验证（仅在注入了配置时）
    if (this.injectedConfig) {
      const result = await validateCodexConfig(this.injectedConfig as any, '0.44.0');

      const hasWireApiMismatch = result.errors.some((e) => e.code === 'WIRE_API_MISMATCH');
      if (hasWireApiMismatch) {
        // 输出交互式提示
        const model = (this.injectedConfig as any).model || 'unknown-model';
        const current =
          (this.injectedConfig as any)?.model_providers?.openai?.wire_api ?? 'unknown';
        const suggested = 'responses';

        // 提示消息（供测试断言）
        const header = '⚠️ 配置验证警告：';
        const detail = `检测到可能导致 405 错误的配置：\n  模型: ${model}\n  当前 wire_api: "${current}"\n  建议 wire_api: "${suggested}"`;
        // eslint-disable-next-line no-console
        console.warn(header + '\n' + detail + '\n\n是否自动修正配置？[Y/n]');

        // 交互式确认（使用 inquirer）
        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'autoFix',
            message: '是否自动修正配置？',
            default: true,
          },
        ]);

        if (answer && (answer as any).autoFix) {
          // 执行自动修正：创建 Profile 并记录将使用 --profile 启动
          const fixedConfig = JSON.parse(JSON.stringify(this.injectedConfig));
          fixedConfig.model_providers = fixedConfig.model_providers || {};
          fixedConfig.model_providers.openai = fixedConfig.model_providers.openai || {};
          fixedConfig.model_providers.openai.wire_api = 'responses';

          const reason = 'gpt-5-codex requires wire_api = "responses"';
          const profile = createAutoFixProfile(
            this.injectedConfig as any,
            fixedConfig as any,
            reason
          );
          await writeProfile(profile, this.configTomlPath);
          this.usedProfile = 'codex-father-auto-fix';
          // eslint-disable-next-line no-console
          console.log('✓ 配置已修正并保存到 Profile: codex-father-auto-fix');
          // eslint-disable-next-line no-console
          console.log('✓ 启动 Codex 时将使用 --profile codex-father-auto-fix');
        } else {
          // eslint-disable-next-line no-console
          console.warn('⚠️ 保留原配置，如遇 405 错误请手动调整 wire_api');
        }
      }
    }

    // 常规 newConversation 行为
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

class MockProcessManagerCV implements IProcessManager {
  private ready = true;
  readonly client: MockCodexClientCV;

  constructor(client: MockCodexClientCV) {
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

interface IntegrationContext {
  sessionsRoot: string;
  rolloutsRoot: string;
  configTomlPath: string;
  sessionManager: SessionManager;
  bridgeLayer: BridgeLayer;
  processManager: MockProcessManagerCV;
  terminalSpy: ReturnType<typeof vi.spyOn>;
}

async function createIntegrationContext(
  tag: string,
  injectedConfig?: Record<string, any>
): Promise<IntegrationContext> {
  const baseRoot = path.join(
    process.cwd(),
    '.codex-father-test',
    'integration',
    'config-validation',
    tag
  );
  const sessionsRoot = path.join(baseRoot, 'sessions');
  const rolloutsRoot = path.join(baseRoot, 'rollouts');
  const configTomlPath = path.join(baseRoot, 'config.toml');
  await fs.mkdir(sessionsRoot, { recursive: true });
  await fs.mkdir(rolloutsRoot, { recursive: true });

  const client = new MockCodexClientCV(rolloutsRoot, injectedConfig, configTomlPath);
  const processManager = new MockProcessManagerCV(client);

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
    configTomlPath,
    sessionManager,
    bridgeLayer,
    processManager,
    terminalSpy,
  };
}

// ------------------------------
// Tests
// ------------------------------

describe('T051 配置验证与修正集成测试', () => {
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

  // C1: 检测 405 错误风险配置
  it('场景 C1: 检测 gpt-5-codex + wire_api="chat" 风险配置并显示交互提示', async () => {
    // 注入风险配置
    const riskConfig = {
      model: 'gpt-5-codex',
      model_providers: { openai: { wire_api: 'chat' } },
    } as Record<string, any>;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const promptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ autoFix: false } as any);

    const ctx = await createIntegrationContext(`c1-${Date.now()}`, riskConfig);
    createdDirs.push(path.dirname(ctx.sessionsRoot));

    try {
      // 触发启动（后台调用 newConversation → 配置验证）
      const res = await ctx.bridgeLayer.callTool('start-codex-task', {
        prompt: 'config-check',
        sessionName: 'integration-c1',
        model: 'gpt-5-codex',
        approvalPolicy: ApprovalMode.ON_REQUEST,
        sandbox: SandboxPolicy.WORKSPACE_WRITE,
      });
      expect(res.status).toBe('accepted');

      // 等待会话生成
      await waitForCondition(async () => {
        const ses = await fs.readdir(ctx.sessionsRoot).catch(() => []);
        return ses.length > 0;
      });

      // 验证提示被调用且包含期望文案
      expect(promptSpy).toHaveBeenCalledTimes(1);
      const logged = warnSpy.mock.calls.map((c) => String(c[0] ?? ''));
      const combined = logged.join('\n');
      expect(combined).toMatch(/配置验证警告/);
      expect(combined).toMatch(/gpt-5-codex/);
      expect(combined).toMatch(/当前 wire_api: "chat"/);
      expect(combined).toMatch(/建议 wire_api: "responses"/);
      expect(combined).toMatch(/是否自动修正配置？\[Y\/n\]/);
    } finally {
      warnSpy.mockRestore();
      await ctx.sessionManager.cleanup();
    }
  });

  // C2: 自动修正配置（用户确认 Y）
  it('场景 C2: 用户确认 Y 后创建修正 Profile 并使用 --profile 启动', async () => {
    const riskConfig = {
      model: 'gpt-5-codex',
      model_providers: { openai: { wire_api: 'chat' } },
    } as Record<string, any>;

    const promptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ autoFix: true } as any);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const ctx = await createIntegrationContext(`c2-${Date.now()}`, riskConfig);
    createdDirs.push(path.dirname(ctx.sessionsRoot));

    try {
      const res = await ctx.bridgeLayer.callTool('start-codex-task', {
        prompt: 'auto-fix',
        sessionName: 'integration-c2',
        model: 'gpt-5-codex',
        approvalPolicy: ApprovalMode.ON_REQUEST,
        sandbox: SandboxPolicy.WORKSPACE_WRITE,
      });
      expect(res.status).toBe('accepted');

      // 等待到 Mock 客户端产生会话（意味着 newConversation 流程完成）
      await waitForCondition(async () => ctx.processManager.client.conversations.length > 0);

      // Profile 文件应创建，且内容正确
      const profile = await readProfile('codex-father-auto-fix', ctx.configTomlPath);
      expect(profile).not.toBeNull();
      expect(profile?.name).toBe('codex-father-auto-fix');
      expect(profile?.config?.model).toBe('gpt-5-codex');
      expect(profile?.config?.model_providers?.openai?.wire_api).toBe('responses');
      // 注释（宽松校验，允许现实现中的 Auto-generated/Reason 格式）
      const text = await fs.readFile(ctx.configTomlPath, 'utf-8');
      expect(text).toContain('[profiles.codex-father-auto-fix]');
      expect(text).toMatch(/wire_api\s*=\s*"responses"/);
      expect(/Auto-(generated|fixed) by codex-father/i.test(text)).toBe(true);

      // 启动参数应包含 --profile（以 usedProfile 属性模拟）
      const used = (ctx.processManager.client as any).usedProfile;
      expect(used).toBe('codex-father-auto-fix');

      // 日志包含确认信息
      const logs = logSpy.mock.calls.map((c) => String(c[0] ?? ''));
      expect(logs.some((l) => /使用 --profile codex-father-auto-fix/.test(l))).toBe(true);

      // 服务器正常启动（会话/事件生成）
      await waitForCondition(async () => {
        const ses = await fs.readdir(ctx.sessionsRoot).catch(() => []);
        if (ses.length === 0) {
          return false;
        }
        const sessionDir = path.join(ctx.sessionsRoot, ses[0]!);
        const hasEvents = await fs
          .access(path.join(sessionDir, 'events.jsonl'))
          .then(() => true)
          .catch(() => false);
        return hasEvents;
      }, 3000);
    } finally {
      logSpy.mockRestore();
      await ctx.sessionManager.cleanup();
    }
  });

  // C3: 保留原配置（用户确认 N）
  it('场景 C3: 用户确认 N 后保留原配置启动（不创建 Profile）', async () => {
    const riskConfig = {
      model: 'gpt-5-codex',
      model_providers: { openai: { wire_api: 'chat' } },
    } as Record<string, any>;

    const promptSpy = vi.spyOn(inquirer, 'prompt').mockResolvedValue({ autoFix: false } as any);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const ctx = await createIntegrationContext(`c3-${Date.now()}`, riskConfig);
    createdDirs.push(path.dirname(ctx.sessionsRoot));

    try {
      const res = await ctx.bridgeLayer.callTool('start-codex-task', {
        prompt: 'keep-original',
        sessionName: 'integration-c3',
        model: 'gpt-5-codex',
        approvalPolicy: ApprovalMode.ON_REQUEST,
        sandbox: SandboxPolicy.WORKSPACE_WRITE,
      });
      expect(res.status).toBe('accepted');

      // 等待到会话创建，提示应已显示
      await waitForCondition(async () => ctx.processManager.client.conversations.length > 0);

      // 显示警告提示
      const warns = warnSpy.mock.calls.map((c) => String(c[0] ?? ''));
      expect(warns.join('\n')).toMatch(/保留原配置/);

      // 不创建/修改 Profile 文件（文件应不存在）
      const exists = await fs
        .access(ctx.configTomlPath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);

      // 使用原配置启动（未设置 usedProfile）
      const used = (ctx.processManager.client as any).usedProfile;
      expect(used).toBeUndefined();

      // 服务器继续启动（事件文件写入）
      await waitForCondition(async () => {
        const ses = await fs.readdir(ctx.sessionsRoot).catch(() => []);
        if (ses.length === 0) {
          return false;
        }
        const sessionDir = path.join(ctx.sessionsRoot, ses[0]!);
        const events = await readEventsFile(path.join(sessionDir, 'events.jsonl'));
        return events.some((e) => e.type === EventType.SESSION_CREATED);
      }, 3000);
    } finally {
      await ctx.sessionManager.cleanup();
      warnSpy.mockRestore();
    }
  });
});
