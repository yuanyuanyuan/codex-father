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
type ToolHandler = (params: unknown) => Promise<MCPToolsCallResult>;

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
  async callTool(toolName: string, params: unknown): Promise<MCPToolsCallResult> {
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
