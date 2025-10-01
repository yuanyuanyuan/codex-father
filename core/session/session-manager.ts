/**
 * Session Manager - 会话管理器
 *
 * 负责会话生命周期管理和协调各个子系统
 * 参考: specs/005-docs-prd-draft/data-model.md:139-226
 *
 * 设计原则:
 * - 单一职责: 仅负责会话协调,不直接处理进程/事件/审批细节
 * - 依赖倒置: 依赖于抽象的接口,不依赖具体实现
 * - 开闭原则: 可通过依赖注入扩展功能
 *
 * 职责:
 * 1. 创建和管理会话生命周期
 * 2. 协调 CodexClient、EventLogger、ConfigPersister、PolicyEngine、TerminalUI
 * 3. 处理审批请求
 * 4. 记录系统事件
 */

import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { CodexClient } from '../mcp/codex-client.js';
import { EventLogger } from './event-logger.js';
import { ConfigPersister } from './config-persister.js';
import { PolicyEngine } from '../approval/policy-engine.js';
import { TerminalUI } from '../approval/terminal-ui.js';
import {
  Session,
  SessionStatus,
  ApprovalMode,
  SandboxPolicy,
  ApprovalRequest,
  ApprovalStatus,
  EventType,
} from '../lib/types.js';
import type { ApprovalDecision as TerminalUIDecision } from '../approval/terminal-ui.js';

/**
 * 进程管理器接口 (Dependency Inversion Principle)
 *
 * 会话管理器依赖此抽象接口,而不是具体实现
 */
export interface IProcessManager {
  /**
   * 获取 Codex 客户端
   *
   * @returns CodexClient 实例
   */
  getClient(): CodexClient;

  /**
   * 检查进程是否就绪
   */
  isReady(): boolean;

  /**
   * 启动进程管理器
   */
  start(): Promise<void>;

  /**
   * 停止进程管理器
   */
  stop(): Promise<void>;
}

/**
 * 会话管理器配置
 */
export interface SessionManagerConfig {
  processManager: IProcessManager; // 进程管理器 (依赖注入)
  sessionsDir?: string; // 会话数据目录 (默认: .codex-father/sessions)
  defaultModel?: string; // 默认模型
  defaultApprovalMode?: ApprovalMode; // 默认审批模式
  defaultSandboxPolicy?: SandboxPolicy; // 默认沙盒策略
  defaultTimeout?: number; // 默认超时时间(毫秒)
}

/**
 * 创建会话选项
 */
export interface CreateSessionOptions {
  sessionName: string;
  model?: string;
  cwd?: string;
  approvalMode?: ApprovalMode;
  sandboxPolicy?: SandboxPolicy;
  timeout?: number;
}

/**
 * 会话管理器
 *
 * 职责 (Single Responsibility):
 * - 创建和管理会话
 * - 协调各个子系统 (CodexClient, EventLogger, ConfigPersister, PolicyEngine, TerminalUI)
 * - 处理审批请求
 * - 记录系统事件
 */
export class SessionManager {
  private processManager: IProcessManager;
  private config: Required<SessionManagerConfig>;
  private sessions: Map<string, Session>; // conversationId → Session
  private eventLoggers: Map<string, EventLogger>; // jobId → EventLogger
  private configPersisters: Map<string, ConfigPersister>; // jobId → ConfigPersister
  private policyEngines: Map<string, PolicyEngine>; // jobId → PolicyEngine
  private terminalUI: TerminalUI;

  constructor(config: SessionManagerConfig) {
    this.processManager = config.processManager;
    this.config = {
      processManager: config.processManager,
      sessionsDir: config.sessionsDir || path.join(process.cwd(), '.codex-father/sessions'),
      defaultModel: config.defaultModel || 'gpt-5',
      defaultApprovalMode: config.defaultApprovalMode || ApprovalMode.ON_REQUEST,
      defaultSandboxPolicy: config.defaultSandboxPolicy || SandboxPolicy.WORKSPACE_WRITE,
      defaultTimeout: config.defaultTimeout || 300000, // 5 分钟
    };

    this.sessions = new Map();
    this.eventLoggers = new Map();
    this.configPersisters = new Map();
    this.policyEngines = new Map();

    // 创建终端 UI (共享实例)
    this.terminalUI = new TerminalUI();
  }

  /**
   * 创建新会话
   *
   * @param options 会话选项
   * @returns 会话信息 (conversationId, jobId, rolloutPath)
   */
  async createSession(
    options: CreateSessionOptions
  ): Promise<{ conversationId: string; jobId: string; rolloutPath: string }> {
    // 确保进程管理器已启动
    if (!this.processManager.isReady()) {
      await this.processManager.start();
    }

    // 生成唯一 ID
    const jobId = uuidv4();
    const sessionDir = path.join(
      this.config.sessionsDir,
      `${options.sessionName}-${new Date().toISOString().split('T')[0]}`
    );

    // 创建会话配置
    const model = options.model || this.config.defaultModel;
    const cwd = options.cwd || process.cwd();
    const approvalMode = options.approvalMode || this.config.defaultApprovalMode;
    const sandboxPolicy = options.sandboxPolicy || this.config.defaultSandboxPolicy;
    const timeout = options.timeout || this.config.defaultTimeout;

    // 调用 Codex JSON-RPC: newConversation
    const client = this.processManager.getClient();
    const result = await client.newConversation({
      model,
      cwd,
      approvalPolicy: approvalMode,
      sandbox: sandboxPolicy,
    });

    // 创建 Session 对象
    const session: Session = {
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

    // 保存会话到内存
    this.sessions.set(result.conversationId, session);

    // 初始化事件日志记录器
    const eventLogger = new EventLogger({
      logDir: sessionDir,
      logFileName: 'events.jsonl',
    });
    this.eventLoggers.set(jobId, eventLogger);

    // 初始化配置持久化器
    const configPersister = new ConfigPersister({
      sessionDir,
      configFileName: 'config.json',
    });
    this.configPersisters.set(jobId, configPersister);

    // 保存会话配置到文件
    await configPersister.saveConfig(session);

    // 初始化审批策略引擎
    const policyEngine = new PolicyEngine({
      policy: {
        mode: approvalMode,
        whitelist: [], // TODO: 从配置加载白名单
        timeout,
      },
    });
    this.policyEngines.set(jobId, policyEngine);

    // 记录会话创建事件
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

  /**
   * 发送用户消息到会话
   *
   * @param conversationId 会话 ID
   * @param message 用户消息
   */
  async sendUserMessage(conversationId: string, message: string): Promise<void> {
    const session = this.sessions.get(conversationId);
    if (!session) {
      throw new Error(`Session not found: ${conversationId}`);
    }

    // 更新会话状态为 ACTIVE
    session.status = SessionStatus.ACTIVE;

    // 调用 Codex JSON-RPC: sendUserMessage
    const client = this.processManager.getClient();
    await client.sendUserMessage({
      conversationId,
      items: [{ type: 'text', text: message }],
    });

    // 记录消息发送事件
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

  /**
   * 处理审批请求
   *
   * @param request 审批请求
   * @returns 审批决策 ('allow' | 'deny')
   */
  async handleApprovalRequest(request: ApprovalRequest): Promise<'allow' | 'deny'> {
    // 获取策略引擎
    const policyEngine = this.policyEngines.get(request.jobId);
    if (!policyEngine) {
      throw new Error(`Policy engine not found for job: ${request.jobId}`);
    }

    // 记录审批请求事件
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

    // 评估审批策略
    let decision: 'allow' | 'deny';
    let terminalDecision: TerminalUIDecision;

    if (request.type === 'exec-command') {
      const details = request.details as { command: string; cwd: string; reason?: string };
      const policyDecision = policyEngine.evaluateCommand(details.command);

      if (!policyDecision.needsApproval) {
        // 自动批准
        decision = 'allow';
        request.status = ApprovalStatus.AUTO_APPROVED;
      } else {
        // 需要人工审批
        terminalDecision = await this.terminalUI.promptApproval(request);
        decision = terminalDecision === 'allow' ? 'allow' : 'deny';
        request.status = decision === 'allow' ? ApprovalStatus.APPROVED : ApprovalStatus.DENIED;
      }
    } else if (request.type === 'apply-patch') {
      // apply-patch 默认需要人工审批
      terminalDecision = await this.terminalUI.promptApproval(request);
      decision = terminalDecision === 'allow' ? 'allow' : 'deny';
      request.status = decision === 'allow' ? ApprovalStatus.APPROVED : ApprovalStatus.DENIED;
    } else {
      throw new Error(`Unknown approval type: ${request.type}`);
    }

    // 记录审批决策事件
    if (eventLogger) {
      const eventType =
        request.status === ApprovalStatus.APPROVED
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

  /**
   * 获取会话信息
   *
   * @param conversationId 会话 ID
   * @returns Session 对象
   */
  getSession(conversationId: string): Session | undefined {
    return this.sessions.get(conversationId);
  }

  /**
   * 列出所有会话
   *
   * @returns Session 数组
   */
  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 终止会话
   *
   * @param conversationId 会话 ID
   */
  async terminateSession(conversationId: string): Promise<void> {
    const session = this.sessions.get(conversationId);
    if (!session) {
      throw new Error(`Session not found: ${conversationId}`);
    }

    // 更新会话状态
    session.status = SessionStatus.TERMINATED;

    // 记录会话终止事件
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

    // 保存最终状态
    const configPersister = this.configPersisters.get(session.jobId);
    if (configPersister) {
      await configPersister.saveConfig(session);
    }

    // 清理资源 (可选,MVP1 保留内存中的会话记录)
    // this.sessions.delete(conversationId);
    // this.eventLoggers.delete(session.jobId);
    // this.configPersisters.delete(session.jobId);
    // this.policyEngines.delete(session.jobId);
  }

  /**
   * 清理所有会话资源 (用于关闭服务器时)
   */
  async cleanup(): Promise<void> {
    // 终止所有活跃会话
    const activeSessions = Array.from(this.sessions.values()).filter(
      (session) => session.status === SessionStatus.ACTIVE
    );

    for (const session of activeSessions) {
      await this.terminateSession(session.conversationId);
    }

    // 停止进程管理器
    await this.processManager.stop();

    // 清空所有映射
    this.sessions.clear();
    this.eventLoggers.clear();
    this.configPersisters.clear();
    this.policyEngines.clear();
  }
}

/**
 * 创建会话管理器的工厂函数
 *
 * @param config 配置对象
 * @returns SessionManager 实例
 */
export function createSessionManager(config: SessionManagerConfig): SessionManager {
  return new SessionManager(config);
}
