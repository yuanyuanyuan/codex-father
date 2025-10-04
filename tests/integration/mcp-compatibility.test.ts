/**
 * T054 MCP 协议兼容性集成测试
 *
 * 场景覆盖：
 * - F1: 所有 MCP 方法可用（基于 contracts-checklist 与现有 Schema/契约测试覆盖校验 + BridgeLayer 工具可见性）
 * - F2: 审批流程（applyPatchApproval）Server → Client 请求与响应处理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import Ajv from 'ajv';

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

function normalizeMethodToFileBase(method: string): string {
  // 将方法名转换为文件名基底：
  // - codex/event → codex-event
  // - 其它保持不变
  return method.replaceAll('/', '-');
}

// ------------------------------
// Mocks（与既有集成测试保持一致风格）
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
// Test Context
// ------------------------------

interface IntegrationContext {
  sessionsRoot: string;
  rolloutsRoot: string;
  sessionManager: SessionManager;
  bridgeLayer: BridgeLayer;
  processManager: MockProcessManager;
  terminalSpy: ReturnType<typeof vi.spyOn>;
}

async function createIntegrationContext(tag: string): Promise<IntegrationContext> {
  const baseRoot = path.join(process.cwd(), '.codex-father-test', 'integration', 'mcp-compat', tag);
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

  // 自动批准（可在测试中覆写）
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

describe('T054 MCP 协议兼容性集成测试', () => {
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

  // F1: 所有 MCP 方法可用（基于文档与已存在的 Schema/契约文件进行一致性核验）
  it('场景 F1: 验证所有 MCP 方法契约覆盖 + Bridge 工具可见性', async () => {
    // 1) 读取 contracts-checklist.md 提取方法名
    const checklistPath = 'specs/008-ultrathink-codex-0/contracts/contracts-checklist.md';
    const text = await fs.readFile(checklistPath, 'utf-8');
    const methodSet = new Set<string>();

    const ignore = new Set<string>([
      // 忽略 Schema 字段名/示例键名
      'title',
      'description',
      'dataSource',
      'minVersion',
      'versionSpecificParams',
      'request',
      'response',
      'fileChange',
      'properties',
    ]);

    for (const m of text.matchAll(/`([a-zA-Z0-9_\/-]+)`/g)) {
      const name = m[1];
      // 过滤明显非方法的样本（如 yaml 键名等），这里只做轻微过滤
      if (/^[a-zA-Z]/.test(name) && !ignore.has(name)) {
        methodSet.add(name);
      }
    }

    // 若解析异常（为空或过少），回退到任务给出的 23 个方法清单（保证稳定性）
    if (methodSet.size < 10) {
      [
        // 工具方法（18）
        'start-codex-task',
        'stop-codex-task',
        'query-job-status',
        'read-job-log',
        'list-jobs',
        'codex_newConversation',
        'codex_sendUserMessage',
        'codex_sendUserTurn',
        'codex_getConversationInfo',
        'codex_abortConversation',
        'codex_pauseConversation',
        'codex_resumeConversation',
        'codex_applyPatch',
        'codex_execCommand',
        'codex_readFile',
        'codex_writeFile',
        'codex_listDirectory',
        'codex_searchFiles',
        // Prompt（2）
        'get-codex-instructions',
        'get-system-prompts',
        // Resource（3）
        'read://job-log/{id}',
        'read://job-state/{id}',
        'read://sessions-list',
      ].forEach((n) => methodSet.add(n));
    }

    const methods = Array.from(methodSet);

    // 2) BridgeLayer.getTools() 应至少包含 start-codex-task（当前 MVP 已实现）
    const ctx = await createIntegrationContext(`f1-${Date.now()}`);
    createdDirs.push(path.dirname(ctx.sessionsRoot));

    try {
      const tools = ctx.bridgeLayer.getTools();
      const toolNames = tools.map((t) => t.name);
      expect(toolNames).toContain('start-codex-task');
      expect(tools.length).toBeGreaterThanOrEqual(1);

      // 3) 校验每个方法均有 Schema 或契约测试存在（文件存在性校验）
      const missing: string[] = [];
      for (const m of methods) {
        const base = normalizeMethodToFileBase(m);
        const schemaPathA = path.join(
          'specs/008-ultrathink-codex-0/contracts',
          `${base}.schema.json`
        );
        const contractPathA = path.join('tests/contract', `${base}.contract.test.ts`);
        const contractPathB = path.join(
          'specs/008-ultrathink-codex-0/contracts',
          `${base}.contract.test.ts`
        );

        const exists = await Promise.all([
          fs
            .access(schemaPathA)
            .then(() => true)
            .catch(() => false),
          fs
            .access(contractPathA)
            .then(() => true)
            .catch(() => false),
          fs
            .access(contractPathB)
            .then(() => true)
            .catch(() => false),
        ]);

        if (!exists.some(Boolean)) {
          // 少数方法名可能与文件名不完全一致（例如 newConversation 在 specs 目录）
          // 额外对 newConversation/codex-event 做兜底匹配
          if (
            m === 'newConversation' ||
            m === 'codex/event' ||
            m === 'sendUserMessage' ||
            m === 'sendUserTurn'
          ) {
            const alt = normalizeMethodToFileBase(m);
            const altExists = await Promise.all([
              fs
                .access(path.join('specs/008-ultrathink-codex-0/contracts', `${alt}.schema.json`))
                .then(() => true)
                .catch(() => false),
              fs
                .access(
                  path.join('specs/008-ultrathink-codex-0/contracts', `${alt}.contract.test.ts`)
                )
                .then(() => true)
                .catch(() => false),
            ]);
            if (!altExists.some(Boolean)) {
              missing.push(m);
            }
          } else {
            missing.push(m);
          }
        }
      }

      if (missing.length > 0) {
        // 输出缺失列表，避免误报导致难以定位
        // 这里不直接失败所有断言以便随版本推进逐步完善。
        // 但仍要求核心文档与至少一个实现（schema/contract）存在性匹配。
        console.warn('[F1] 以下方法未找到对应的 Schema/契约测试文件：', missing);
      }

      expect(missing).toEqual([]);
    } finally {
      await ctx.sessionManager.cleanup();
    }
  });

  // F2: 审批流程（applyPatchApproval）
  it('场景 F2: 验证 applyPatchApproval 审批流程', async () => {
    const ctx = await createIntegrationContext(`f2-${Date.now()}`);
    createdDirs.push(path.dirname(ctx.sessionsRoot));

    try {
      // 1) 创建会话，建立 conversationId → jobId 映射
      const { conversationId } = await ctx.sessionManager.createSession({
        sessionName: 'compat-f2',
        model: 'gpt-5',
        approvalMode: ApprovalMode.ON_REQUEST,
        sandboxPolicy: SandboxPolicy.WORKSPACE_WRITE,
      });

      // 2) 构造 Server → Client JSON-RPC 请求（applyPatchApproval）
      const request = {
        jsonrpc: '2.0' as const,
        id: `srv-${uuidv4()}`,
        method: 'applyPatchApproval' as const,
        params: {
          conversationId,
          callId: `call-${uuidv4()}`,
          fileChanges: [
            { path: 'src/app.ts', type: 'modify' as const, diff: '--- old\n+++ new' },
            { path: 'README.md', type: 'modify' as const, diff: '- a\n+ b' },
          ],
          reason: 'Apply changes to fix bug',
        },
      };

      // 3) 校验请求参数契约（JSON Schema）
      const ajv = new Ajv({ strict: false });
      const schema = JSON.parse(
        await fs.readFile(
          'specs/008-ultrathink-codex-0/contracts/applyPatchApproval.schema.json',
          'utf-8'
        )
      );
      // request 引用了顶层 definitions，编译时合并 definitions 以便 $ref 可解析
      const validateReq = ajv.compile({
        ...schema.request,
        definitions: schema.definitions,
      });
      expect(validateReq(request.params)).toBe(true);

      // 4) 触发审批处理：桥接层处理 Server → Client 请求
      const decision1 = await ctx.bridgeLayer.handleApplyPatchApproval(request.id, request.params);
      expect(decision1).toEqual({ decision: 'allow' });

      // 5) 验证事件日志记录（审批请求与批准）
      const [sessionDirName] = await fs.readdir(ctx.sessionsRoot);
      const sessionDir = path.join(ctx.sessionsRoot, sessionDirName);
      const eventsPath = path.join(sessionDir, 'events.jsonl');

      await waitForCondition(async () => {
        const list = await readEventsFile(eventsPath);
        return list.some((e) => e.type === EventType.APPROVAL_REQUESTED);
      }, 3000);

      await waitForCondition(async () => {
        const list = await readEventsFile(eventsPath);
        return list.some(
          (e) =>
            e.type === EventType.APPROVAL_APPROVED || e.type === EventType.APPROVAL_AUTO_APPROVED
        );
      }, 3000);

      // 6) 覆写为 deny 决策，验证拒绝路径（可选）
      ctx.terminalSpy.mockResolvedValueOnce('deny');
      const decision2 = await ctx.bridgeLayer.handleApplyPatchApproval(request.id, request.params);
      expect(decision2).toEqual({ decision: 'deny' });
    } finally {
      await ctx.sessionManager.cleanup();
    }
  });
});
