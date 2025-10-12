/**
 * Bridge Layer - MCP 桥接层
 *
 * 负责 MCP 协议与 Codex JSON-RPC 之间的双向转换
 * 参考: specs/005-docs-prd-draft/data-model.md:227-268
 *
 * 设计原则:
 * - 单一职责: 仅负责协议转换和工具暴露
 * - 依赖倒置: 依赖于抽象的 SessionManager 接口
 * - 开闭原则: 可扩展新的 MCP 工具
 *
 * 功能:
 * 1. 暴露 MCP tools (start-codex-task)
 * 2. 将 MCP tools/call 请求转换为 Codex JSON-RPC 方法
 * 3. 处理 Codex 审批请求并返回决策
 */

import { MCPTool, MCPToolsCallResult } from './protocol/types.js';
import { v4 as uuidv4 } from 'uuid';
import { getSessionsRoot, resolveSessionDir } from '../lib/paths.js';
import {
  ApprovalRequest,
  ApprovalType,
  ApprovalMode,
  ApprovalStatus,
  SandboxPolicy,
  ExecCommandApproval,
  ApplyPatchApproval,
} from '../lib/types.js';

/**
 * 会话管理器接口 (Dependency Inversion Principle)
 *
 * 桥接层依赖此抽象接口,而不是具体实现
 */
export interface ISessionManager {
  /**
   * 创建新会话
   *
   * @param options 会话选项
   * @returns 会话 ID 和 jobId
   */
  createSession(options: {
    sessionName: string;
    jobId?: string;
    model?: string;
    cwd?: string;
    approvalMode?: ApprovalMode;
    sandboxPolicy?: SandboxPolicy;
    timeout?: number;
  }): Promise<{ conversationId: string; jobId: string; rolloutPath: string }>;

  /**
   * 发送用户消息到会话
   *
   * @param conversationId 会话 ID
   * @param message 用户消息
   */
  sendUserMessage(conversationId: string, message: string): Promise<void>;

  /**
   * 处理审批请求
   *
   * @param request 审批请求
   * @returns 审批决策 ('allow' | 'deny')
   */
  handleApprovalRequest(request: ApprovalRequest): Promise<'allow' | 'deny'>;

  /**
   * 通过 conversationId 查询 jobId
   */
  getJobIdByConversationId(conversationId: string): string | undefined;
}

/**
 * MCP 工具处理器类型
 */
type ToolResult = { status: string; [key: string]: unknown };
// 允许默认任务型工具返回 MCPToolsCallResult，诊断工具返回通用 ToolResult
type ToolHandler = (params: unknown) => Promise<ToolResult | MCPToolsCallResult>;

/**
 * MCP 桥接层配置
 */
export interface BridgeLayerConfig {
  sessionManager: ISessionManager; // 会话管理器 (依赖注入)
  defaultModel?: string; // 默认模型
  defaultApprovalMode?: ApprovalMode; // 默认审批模式
  defaultSandboxPolicy?: SandboxPolicy; // 默认沙盒策略
  defaultTimeout?: number; // 默认超时时间(毫秒)
}

/**
 * MCP 桥接层
 *
 * 职责 (Single Responsibility):
 * - 暴露 MCP tools
 * - 将 MCP tools/call 请求映射到会话管理器方法
 * - 处理审批请求并返回决策
 */
export class BridgeLayer {
  private sessionManager: ISessionManager;
  private config: Required<BridgeLayerConfig>;
  private tools: Map<string, { definition: MCPTool; handler: ToolHandler }>;

  constructor(config: BridgeLayerConfig) {
    this.sessionManager = config.sessionManager;
    this.config = {
      sessionManager: config.sessionManager,
      defaultModel: config.defaultModel ?? 'gpt-5',
      defaultApprovalMode: config.defaultApprovalMode ?? ApprovalMode.ON_REQUEST,
      defaultSandboxPolicy: config.defaultSandboxPolicy ?? SandboxPolicy.WORKSPACE_WRITE,
      defaultTimeout: config.defaultTimeout ?? 300000, // 5 分钟
    };

    // 初始化工具注册表
    this.tools = new Map();

    // 注册默认工具
    this.registerDefaultTools();
  }

  /**
   * 注册默认 MCP 工具
   *
   * MVP1: 仅支持 start-codex-task
   */
  private registerDefaultTools(): void {
    // 工具: start-codex-task
    const startTaskTool: MCPTool = {
      name: 'start-codex-task',
      description:
        'Start a new Codex AI task with a given prompt. Returns a jobId for tracking the task execution.',
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

  /**
   * 获取所有 MCP 工具定义
   *
   * @returns MCP 工具列表
   */
  getTools(): MCPTool[] {
    return Array.from(this.tools.values()).map((tool) => tool.definition);
  }

  /**
   * 调用 MCP 工具
   *
   * @param toolName 工具名称
   * @param params 工具参数
   * @returns 工具调用结果
   */
  async callTool(toolName: string, params: unknown): Promise<ToolResult | MCPToolsCallResult> {
    const tool = this.tools.get(toolName);

    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    // 调用工具处理器
    return await tool.handler(params);
  }

  /**
   * 处理 start-codex-task 工具调用
   *
   * @param params 工具参数
   * @returns 工具调用结果
   */
  private async handleStartCodexTask(params: unknown): Promise<MCPToolsCallResult> {
    // 验证参数
    if (!params || typeof params !== 'object') {
      throw new Error('Invalid tool parameters: must be an object');
    }

    const typedParams = params as {
      prompt: string;
      sessionName?: string;
      model?: string;
      cwd?: string;
      approvalPolicy?: ApprovalMode;
      sandbox?: SandboxPolicy;
      timeout?: number;
    };

    if (!typedParams.prompt || typeof typedParams.prompt !== 'string') {
      throw new Error('Invalid tool parameters: prompt is required and must be a string');
    }

    // 组装会话名（可读性 + 去抖）
    const sessionName =
      typedParams.sessionName || `task-${new Date().toISOString().split('T')[0]}-${Date.now()}`;

    const jobId = uuidv4();

    const runBackgroundTask = async (): Promise<void> => {
      try {
        const { conversationId } = await this.sessionManager.createSession({
          sessionName,
          jobId,
          model: typedParams.model || this.config.defaultModel,
          cwd: typedParams.cwd || process.cwd(),
          approvalMode: typedParams.approvalPolicy || this.config.defaultApprovalMode,
          sandboxPolicy: typedParams.sandbox || this.config.defaultSandboxPolicy,
          timeout: typedParams.timeout || this.config.defaultTimeout,
        });

        await this.sessionManager.sendUserMessage(conversationId, typedParams.prompt);
      } catch (error) {
        console.error('[BridgeLayer] Background task failed:', (error as Error).message);
      }
    };

    void runBackgroundTask();

    return {
      status: 'accepted',
      jobId,
      message: `Task accepted. Session: ${sessionName}. Progress will be sent via notifications`,
    };
  }

  /**
   * 处理 Codex 审批请求 (applyPatchApproval)
   *
   * @param requestId JSON-RPC 请求 ID
   * @param params 审批请求参数
   * @returns JSON-RPC 响应对象
   */
  async handleApplyPatchApproval(
    requestId: string,
    params: unknown
  ): Promise<{ decision: 'allow' | 'deny' }> {
    if (typeof requestId !== 'string' || requestId.length === 0) {
      throw new Error('Invalid approval request parameters');
    }

    if (!params || typeof params !== 'object') {
      throw new Error('Invalid approval request parameters');
    }

    const typedParams = params as {
      conversationId?: string;
      callId?: string;
      fileChanges?: Array<{ path: string; type: 'create' | 'modify' | 'delete'; diff: string }>;
      reason?: string;
      grantRoot?: boolean;
    };

    if (
      !typedParams.conversationId ||
      !typedParams.callId ||
      !Array.isArray(typedParams.fileChanges)
    ) {
      throw new Error('Invalid approval request parameters');
    }

    const fileChanges = typedParams.fileChanges.map((change) => {
      if (
        !change ||
        typeof change.path !== 'string' ||
        !['create', 'modify', 'delete'].includes(change.type) ||
        typeof change.diff !== 'string'
      ) {
        throw new Error('Invalid approval request parameters');
      }
      return change;
    });

    // 构造审批请求
    // 将 conversationId 映射为 jobId
    const mappedJobId = this.sessionManager.getJobIdByConversationId(typedParams.conversationId!);
    if (!mappedJobId) {
      throw new Error(
        `Unknown conversationId: ${typedParams.conversationId}. Cannot resolve jobId for approval`
      );
    }

    const approvalRequest: ApprovalRequest = {
      requestId: typedParams.callId,
      jobId: mappedJobId,
      type: ApprovalType.APPLY_PATCH,
      details: {
        fileChanges,
        reason: typedParams.reason,
        grantRoot: typedParams.grantRoot,
      } as ApplyPatchApproval,
      status: ApprovalStatus.PENDING,
      createdAt: new Date(),
    };

    // 委托给会话管理器处理
    const decision = await this.sessionManager.handleApprovalRequest(approvalRequest);

    return { decision };
  }

  /**
   * 处理 Codex 审批请求 (execCommandApproval)
   *
   * @param requestId JSON-RPC 请求 ID
   * @param params 审批请求参数
   * @returns JSON-RPC 响应对象
   */
  async handleExecCommandApproval(
    requestId: string,
    params: unknown
  ): Promise<{ decision: 'allow' | 'deny' }> {
    if (typeof requestId !== 'string' || requestId.length === 0) {
      throw new Error('Invalid approval request parameters');
    }

    if (!params || typeof params !== 'object') {
      throw new Error('Invalid approval request parameters');
    }

    const typedParams = params as {
      conversationId?: string;
      callId?: string;
      command?: string;
      cwd?: string;
      reason?: string;
    };

    if (
      !typedParams.conversationId ||
      !typedParams.callId ||
      typeof typedParams.command !== 'string' ||
      typedParams.command.length === 0 ||
      typeof typedParams.cwd !== 'string' ||
      typedParams.cwd.length === 0
    ) {
      throw new Error('Invalid approval request parameters');
    }

    // 构造审批请求
    const mappedJobId = this.sessionManager.getJobIdByConversationId(typedParams.conversationId!);
    if (!mappedJobId) {
      throw new Error(
        `Unknown conversationId: ${typedParams.conversationId}. Cannot resolve jobId for approval`
      );
    }

    const approvalRequest: ApprovalRequest = {
      requestId: typedParams.callId,
      jobId: mappedJobId,
      type: ApprovalType.EXEC_COMMAND,
      details: {
        command: typedParams.command,
        cwd: typedParams.cwd,
        reason: typedParams.reason,
      } as ExecCommandApproval,
      status: ApprovalStatus.PENDING,
      createdAt: new Date(),
    };

    // 委托给会话管理器处理
    const decision = await this.sessionManager.handleApprovalRequest(approvalRequest);

    return { decision };
  }

  /**
   * 注册自定义工具 (扩展点)
   *
   * @param tool 工具定义
   * @param handler 工具处理器
   */
  registerTool(tool: MCPTool, handler: ToolHandler): void {
    this.tools.set(tool.name, { definition: tool, handler });
  }

  /**
   * 注销工具
   *
   * @param toolName 工具名称
   * @returns 是否成功注销
   */
  unregisterTool(toolName: string): boolean {
    return this.tools.delete(toolName);
  }
}

/**
 * 创建 MCP 桥接层的工厂函数
 *
 * @param config 配置对象
 * @returns BridgeLayer 实例
 */
export function createBridgeLayer(config: BridgeLayerConfig): BridgeLayer {
  return new BridgeLayer(config);
}

/**
 * 可选：注册诊断只读工具（不作为默认工具，以避免破坏现有契约测试）。
 * - read-report-file: 读取 report.json 并返回 JSON
 * - read-events-preview: 读取 events.jsonl 末尾 N 行
 */
export async function registerDiagnosticTools(bridge: BridgeLayer): Promise<void> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');

  // 工具 1：read-report-file
  const readReportTool: MCPTool = {
    name: 'read-report-file',
    description: 'Read an orchestration report.json by absolute or relative path',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to report.json' },
      },
      required: ['path'],
    },
  };

  bridge.registerTool(readReportTool, async (params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('Invalid tool parameters: must be an object');
    }
    const p = (params as { path?: string }).path;
    if (!p || typeof p !== 'string') {
      throw new Error('Invalid tool parameters: path is required and must be a string');
    }
    // 仅接受绝对路径，避免符号链接/盘符差异导致的定位偏差
    if (!path.isAbsolute(p)) {
      throw new Error('EINVALID: path must be absolute');
    }
    const abs = p;
    let raw: string;
    try {
      raw = await fs.readFile(abs, 'utf-8');
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e?.code === 'ENOENT') {
        throw new Error(`ENOENT: not_found ${abs}`);
      }
      if (e?.code === 'EACCES' || e?.code === 'EPERM') {
        throw new Error(`EACCES: permission_denied ${abs}`);
      }
      throw err as Error;
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      status: 'ok',
      path: abs,
      report: parsed,
    };
  });

  // 工具 2：read-events-preview
  const readEventsTool: MCPTool = {
    name: 'read-events-preview',
    description: 'Read last N lines from a events.jsonl file',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to events.jsonl' },
        limit: { type: 'number', description: 'Number of lines from the end (default 100)' },
      },
      required: ['path'],
    },
  };

  bridge.registerTool(readEventsTool, async (params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('Invalid tool parameters: must be an object');
    }
    const { path: p, limit } = params as { path?: string; limit?: number };
    if (!p || typeof p !== 'string') {
      throw new Error('Invalid tool parameters: path is required and must be a string');
    }
    if (!path.isAbsolute(p)) {
      throw new Error('EINVALID: path must be absolute');
    }
    const abs = p;
    let content: string;
    try {
      content = await fs.readFile(abs, 'utf-8');
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e?.code === 'ENOENT') {
        throw new Error(`ENOENT: not_found ${abs}`);
      }
      if (e?.code === 'EACCES' || e?.code === 'EPERM') {
        throw new Error(`EACCES: permission_denied ${abs}`);
      }
      throw err as Error;
    }
    const lines = content.trim().split(/\r?\n/);
    const n =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 100;
    const preview = lines.slice(-n);
    return {
      status: 'ok',
      path: abs,
      count: preview.length,
      lines: preview,
    };
  });

  // 工具 3：read-session-artifacts
  const readSessionArtifacts: MCPTool = {
    name: 'read-session-artifacts',
    description: 'Resolve .codex-father session artifacts (report.json, events.jsonl) by sessionId',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID (e.g., orc_xxx)' },
        baseDir: { type: 'string', description: 'Base directory (default: process.cwd())' },
      },
      required: ['sessionId'],
    },
  };

  bridge.registerTool(readSessionArtifacts, async (params: unknown) => {
    if (!params || typeof params !== 'object') {
      throw new Error('Invalid tool parameters: must be an object');
    }
    const { sessionId, baseDir } = params as { sessionId?: string; baseDir?: string };
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('Invalid tool parameters: sessionId is required and must be a string');
    }
    const hasBase = typeof baseDir === 'string' && baseDir.trim().length > 0;
    const sessionDir = hasBase
      ? path.join(path.resolve(String(baseDir)), '.codex-father', 'sessions', sessionId)
      : resolveSessionDir(sessionId);
    const report = path.join(sessionDir, 'report.json');
    const events = path.join(sessionDir, 'events.jsonl');
    // Validate existence (do not throw if missing, return existence flags)
    const exists = async (p: string): Promise<boolean> =>
      fs
        .access(p)
        .then(() => true)
        .catch(() => false);
    const reportExists = await exists(report);
    const eventsExists = await exists(events);
    return {
      status: 'ok',
      sessionDir,
      reportPath: reportExists ? report : null,
      eventsPath: eventsExists ? events : null,
    } as unknown as MCPToolsCallResult;
  });

  // 追加轻量只读/诊断工具（扩充矩阵，无副作用）
  const simpleTool = (
    name: string,
    description: string,
    schema: Record<string, unknown>,
    handler: ToolHandler
  ): void => {
    const tool: MCPTool = {
      name,
      description,
      inputSchema: schema as unknown as MCPTool['inputSchema'],
    };
    bridge.registerTool(tool, handler);
  };

  // 4: list-tools
  simpleTool(
    'list-tools',
    'List all available MCP tools',
    { type: 'object', properties: {} },
    async () => ({
      status: 'ok',
      tools: bridge.getTools().map((t) => t.name),
    })
  );

  // 5: ping-bridge
  simpleTool(
    'ping-bridge',
    'Ping the MCP bridge layer',
    { type: 'object', properties: {} },
    async () => ({
      status: 'ok',
      now: new Date().toISOString(),
    })
  );

  // 6: echo
  simpleTool(
    'echo',
    'Echo back the given payload',
    { type: 'object', properties: { payload: { type: 'object' } }, required: ['payload'] },
    async (params) => ({ status: 'ok', payload: (params as { payload?: unknown }).payload })
  );

  // 7: exists
  simpleTool(
    'exists',
    'Check if a path exists',
    { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    async (params) => {
      const p = (params as { path?: string }).path;
      const abs = path.resolve(String(p));
      const ok = await fs
        .access(abs)
        .then(() => true)
        .catch(() => false);
      return { status: 'ok', path: abs, exists: ok };
    }
  );

  // 8: stat-path
  simpleTool(
    'stat-path',
    'Stat a file or directory',
    { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    async (params) => {
      const abs = path.resolve(String((params as { path?: string }).path));
      const s = await fs.stat(abs).catch(() => null);
      return s
        ? {
            status: 'ok',
            path: abs,
            size: s.size,
            mtimeMs: s.mtimeMs,
            isFile: s.isFile(),
            isDirectory: s.isDirectory(),
          }
        : { status: 'error', path: abs, error: 'ENOENT' };
    }
  );

  // 9: list-dir
  simpleTool(
    'list-dir',
    'List directory entries (name only)',
    {
      type: 'object',
      properties: { path: { type: 'string' }, limit: { type: 'number' } },
      required: ['path'],
    },
    async (params) => {
      const { path: p, limit } = params as { path?: string; limit?: number };
      const abs = path.resolve(String(p));
      const entries = await fs.readdir(abs).catch(() => [] as string[]);
      const n = typeof limit === 'number' && limit > 0 ? Math.floor(limit) : entries.length;
      return { status: 'ok', path: abs, entries: entries.slice(0, n) };
    }
  );

  // 10: list-sessions
  simpleTool(
    'list-sessions',
    'List .codex-father session IDs in baseDir',
    {
      type: 'object',
      properties: { baseDir: { type: 'string' } },
    },
    async (params) => {
      const baseDir = (params as { baseDir?: string })?.baseDir;
      const sessRoot =
        baseDir && baseDir.trim().length > 0
          ? path.join(path.resolve(baseDir), '.codex-father', 'sessions')
          : getSessionsRoot();
      const entries = await fs.readdir(sessRoot).catch(() => [] as string[]);
      const ids = entries.filter((n) => n && typeof n === 'string');
      return { status: 'ok', baseDir: baseDir ?? null, sessionRoot: sessRoot, sessionIds: ids };
    }
  );

  // 11: get-latest-session
  simpleTool(
    'get-latest-session',
    'Return latest session directory by mtime',
    { type: 'object', properties: { baseDir: { type: 'string' } } },
    async (params) => {
      const baseDir = (params as { baseDir?: string })?.baseDir;
      const sessRoot =
        baseDir && baseDir.trim().length > 0
          ? path.join(path.resolve(baseDir), '.codex-father', 'sessions')
          : getSessionsRoot();
      const entries = await fs.readdir(sessRoot).catch(() => [] as string[]);
      let best: { id: string; mtimeMs: number } | null = null;
      for (const id of entries) {
        const p = path.join(sessRoot, id);
        const s = await fs.stat(p).catch(() => null);
        if (s?.isDirectory()) {
          if (!best || s.mtimeMs > best.mtimeMs) {
            best = { id, mtimeMs: s.mtimeMs };
          }
        }
      }
      return { status: 'ok', sessionId: best?.id ?? null, sessionRoot: sessRoot };
    }
  );

  // 12: read-report-metrics
  simpleTool(
    'read-report-metrics',
    'Read metrics and references from report.json',
    { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    async (params) => {
      const p = (params as { path?: string }).path;
      if (!p || typeof p !== 'string') {
        throw new Error('Invalid tool parameters: path is required and must be a string');
      }
      if (!path.isAbsolute(p)) {
        throw new Error('EINVALID: path must be absolute');
      }
      const abs = p;
      let raw: string;
      try {
        raw = await fs.readFile(abs, 'utf-8');
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e?.code === 'ENOENT') {
          throw new Error(`ENOENT: not_found ${abs}`);
        }
        if (e?.code === 'EACCES' || e?.code === 'EPERM') {
          throw new Error(`EACCES: permission_denied ${abs}`);
        }
        throw err as Error;
      }
      const json = JSON.parse(raw) as Record<string, unknown>;
      return {
        status: 'ok',
        metrics: json.metrics ?? null,
        references: json.references ?? null,
        referencesByTask: json.referencesByTask ?? null,
        referencesCoverage: json.referencesCoverage ?? null,
      };
    }
  );

  // 13: grep-events (contains/regex)
  simpleTool(
    'grep-events',
    'Filter events.jsonl lines by substring or regex',
    {
      type: 'object',
      properties: {
        path: { type: 'string' },
        q: { type: 'string' },
        limit: { type: 'number' },
        ignoreCase: { type: 'boolean' },
        regex: { type: 'boolean' },
      },
      required: ['path', 'q'],
    },
    async (params) => {
      const {
        path: p,
        q,
        limit,
        ignoreCase,
        regex,
      } = params as {
        path?: string;
        q?: string;
        limit?: number;
        ignoreCase?: boolean;
        regex?: boolean;
      };
      if (!p || typeof p !== 'string') {
        throw new Error('Invalid tool parameters: path is required and must be a string');
      }
      if (!path.isAbsolute(p)) {
        throw new Error('EINVALID: path must be absolute');
      }
      if (typeof q !== 'string' || q.trim().length === 0) {
        throw new Error('EINVALID: q is required and must be non-empty string');
      }
      if (
        typeof limit !== 'undefined' &&
        !(typeof limit === 'number' && Number.isFinite(limit) && limit > 0)
      ) {
        throw new Error('EINVALID: limit must be a positive integer');
      }
      const abs = p;
      let content = '';
      try {
        content = await fs.readFile(abs, 'utf-8');
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e?.code === 'ENOENT') {
          throw new Error(`ENOENT: not_found ${abs}`);
        }
        if (e?.code === 'EACCES' || e?.code === 'EPERM') {
          throw new Error(`EACCES: permission_denied ${abs}`);
        }
        throw err as Error;
      }
      const lines = content
        .trim()
        .split(/\r?\n/)
        .filter((l) => {
          if (regex === true) {
            try {
              const r = new RegExp(q, ignoreCase === true ? 'i' : undefined);
              return r.test(l);
            } catch {
              throw new Error('EINVALID: invalid_regex');
            }
          }
          if (ignoreCase === true) {
            return l.toLowerCase().includes(q.toLowerCase());
          }
          return l.includes(q);
        });
      const n = typeof limit === 'number' && limit > 0 ? Math.floor(limit) : lines.length;
      return { status: 'ok', count: Math.min(n, lines.length), lines: lines.slice(0, n) };
    }
  );

  // 14: resolve-path
  simpleTool(
    'resolve-path',
    'Resolve a path to absolute one',
    { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    async (params) => ({
      status: 'ok',
      absPath: path.resolve(String((params as { path?: string }).path)),
    })
  );

  // 15: call-with-downgrade（405/通信降级诊断）
  simpleTool(
    'call-with-downgrade',
    'Call a tool; if method not allowed or communication issue, return degraded result',
    {
      type: 'object',
      properties: {
        targetTool: { type: 'string' },
        arguments: { type: 'object' },
        fallback: { type: 'object' },
      },
      required: ['targetTool'],
    },
    async (params) => {
      const {
        targetTool,
        arguments: args,
        fallback,
      } = params as {
        targetTool?: string;
        arguments?: Record<string, unknown>;
        fallback?: unknown;
      };
      try {
        const result = await bridge.callTool(String(targetTool), args ?? {});
        return { status: 'ok', degraded: false, result };
      } catch (err) {
        const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
        let reason:
          | 'method_not_allowed'
          | 'invalid_arguments'
          | 'not_found'
          | 'permission_denied'
          | 'timeout'
          | 'communication_error'
          | 'server_error' = 'communication_error';
        if (message.includes('unknown tool')) {
          reason = 'method_not_allowed';
        } else if (
          message.includes('invalid tool parameters') ||
          message.includes('einvalid') ||
          (message.includes('invalid') && message.includes('parameters'))
        ) {
          reason = 'invalid_arguments';
        } else if (message.includes('enoent') || message.includes('not_found')) {
          reason = 'not_found';
        } else if (
          message.includes('eacces') ||
          message.includes('eperm') ||
          message.includes('permission_denied')
        ) {
          reason = 'permission_denied';
        } else if (message.includes('timeout')) {
          reason = 'timeout';
        } else if (message.includes('error')) {
          reason = 'server_error';
        }
        return {
          status: 'ok',
          degraded: true,
          reason,
          error: err instanceof Error ? err.message : String(err),
          result: fallback ?? null,
        };
      }
    }
  );
}
