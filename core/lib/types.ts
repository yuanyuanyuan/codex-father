/**
 * Core Type Definitions and Zod Schemas
 *
 * 定义 codex-father MCP 架构的核心数据类型和运行时验证 schema
 * 参考: specs/005-docs-prd-draft/data-model.md
 *
 * 架构原则:
 * - 不可变性: 关键事件和日志记录不可修改
 * - 可追溯性: 所有状态变更记录时间戳和原因
 * - 类型安全: TypeScript + Zod 运行时验证
 */

import { z } from 'zod';

// ============================================================================
// 1. Job (作业) - data-model.md:20-84
// ============================================================================

/**
 * 作业状态枚举
 */
export enum JobStatus {
  PENDING = 'pending', // 已接受,等待执行
  RUNNING = 'running', // 正在执行
  COMPLETED = 'completed', // 执行完成
  FAILED = 'failed', // 执行失败
  CANCELLED = 'cancelled', // 用户取消
  TIMEOUT = 'timeout', // 超时
}

/**
 * 作业执行指标
 */
export interface JobMetrics {
  startTime?: Date; // 开始执行时间
  endTime?: Date; // 结束时间
  duration?: number; // 执行时长(毫秒)
  approvalCount: number; // 审批请求次数
  approvalDuration: number; // 审批等待总时长(毫秒)
}

/**
 * 错误详情
 */
export interface ErrorDetails {
  code: string; // 错误代码
  message: string; // 错误消息
  stack?: string; // 堆栈跟踪
  context?: Record<string, unknown>; // 上下文信息
}

/**
 * 审批策略枚举
 */
export enum ApprovalMode {
  UNTRUSTED = 'untrusted', // 所有操作需要审批
  ON_REQUEST = 'on-request', // Codex 请求时审批
  ON_FAILURE = 'on-failure', // 失败时审批
  NEVER = 'never', // 从不审批(危险)
}

/**
 * 沙箱策略枚举
 */
export enum SandboxPolicy {
  READ_ONLY = 'read-only', // 只读访问
  WORKSPACE_WRITE = 'workspace-write', // 工作区可写
  DANGER_FULL_ACCESS = 'danger-full-access', // 完全访问(危险)
}

/**
 * 作业实体 - 表示一次完整的 AI 辅助任务请求
 */
export interface Job {
  jobId: string; // UUID,唯一标识
  requestId: string; // MCP 请求 ID(来自客户端)
  conversationId?: string; // Codex 会话 ID(启动后生成)
  status: JobStatus; // 作业状态
  createdAt: Date; // 创建时间
  updatedAt: Date; // 最后更新时间
  input: {
    prompt: string; // 用户输入的提示
    model?: string; // 模型选择(如 'gpt-5')
    cwd?: string; // 工作目录
    approvalPolicy?: ApprovalMode; // 审批策略
    sandboxPolicy?: SandboxPolicy; // 沙箱策略
    timeout?: number; // 超时时间(毫秒)
  };
  output?: {
    result?: string; // 最终结果(如有)
    error?: ErrorDetails; // 错误信息(如有)
    metrics: JobMetrics; // 执行指标
  };
}

// Zod Schemas for Job
export const ErrorDetailsSchema = z.object({
  code: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  context: z.record(z.unknown()).optional(),
});

export const JobMetricsSchema = z.object({
  startTime: z.date().optional(),
  endTime: z.date().optional(),
  duration: z.number().positive().optional(),
  approvalCount: z.number().int().min(0),
  approvalDuration: z.number().min(0),
});

export const JobSchema = z.object({
  jobId: z.string().uuid(),
  requestId: z.string().min(1),
  conversationId: z.string().uuid().optional(),
  status: z.nativeEnum(JobStatus),
  createdAt: z.date(),
  updatedAt: z.date(),
  input: z.object({
    prompt: z.string().min(1),
    model: z.string().optional(),
    cwd: z.string().optional(),
    approvalPolicy: z.nativeEnum(ApprovalMode).optional(),
    sandboxPolicy: z.nativeEnum(SandboxPolicy).optional(),
    timeout: z.number().positive().optional(),
  }),
  output: z
    .object({
      result: z.string().optional(),
      error: ErrorDetailsSchema.optional(),
      metrics: JobMetricsSchema,
    })
    .optional(),
});

// ============================================================================
// 2. Session (会话) - data-model.md:87-138
// ============================================================================

/**
 * 会话状态枚举
 */
export enum SessionStatus {
  INITIALIZING = 'initializing', // 正在启动
  ACTIVE = 'active', // 活跃(可接收消息)
  IDLE = 'idle', // 空闲(等待下一轮输入)
  RECOVERING = 'recovering', // 正在恢复(MVP2)
  TERMINATED = 'terminated', // 已终止
}

/**
 * 会话实体 - 表示一次 Codex 交互式对话
 */
export interface Session {
  conversationId: string; // UUID(Codex 原生标识符)
  sessionName: string; // 用户友好的名称(如 'feature-abc')
  jobId: string; // 关联的作业 ID
  createdAt: Date; // 创建时间
  sessionDir: string; // 会话目录路径
  rolloutRef: string; // Codex 原生 rollout 文件路径(来自 rollout-ref.txt)
  processId?: number; // 关联的进程 PID(MVP2)
  status: SessionStatus; // 会话状态
  config: {
    model: string;
    cwd: string;
    approvalPolicy: ApprovalMode;
    sandboxPolicy: SandboxPolicy;
    timeout: number;
  };
}

// Zod Schema for Session
export const SessionSchema = z.object({
  conversationId: z.string().uuid(),
  sessionName: z.string().min(1),
  jobId: z.string().uuid(),
  createdAt: z.date(),
  sessionDir: z.string().min(1),
  rolloutRef: z.string().min(1),
  processId: z.number().int().positive().optional(),
  status: z.nativeEnum(SessionStatus),
  config: z.object({
    model: z.string(),
    cwd: z.string(),
    approvalPolicy: z.nativeEnum(ApprovalMode),
    sandboxPolicy: z.nativeEnum(SandboxPolicy),
    timeout: z.number().positive(),
  }),
});

// ============================================================================
// 3. ApprovalRequest (审批请求) - data-model.md:342-398
// ============================================================================

/**
 * 审批请求类型枚举
 */
export enum ApprovalType {
  EXEC_COMMAND = 'exec-command', // 命令执行审批
  APPLY_PATCH = 'apply-patch', // 文件补丁审批
}

/**
 * 审批请求状态枚举
 */
export enum ApprovalStatus {
  PENDING = 'pending', // 等待决策
  APPROVED = 'approved', // 已批准
  DENIED = 'denied', // 已拒绝
  AUTO_APPROVED = 'auto-approved', // 白名单自动批准
}

/**
 * 审批决策枚举
 */
export enum ApprovalDecision {
  ALLOW = 'allow', // 允许
  DENY = 'deny', // 拒绝
}

/**
 * 文件变更类型枚举
 */
export enum FileChangeType {
  CREATE = 'create',
  MODIFY = 'modify',
  DELETE = 'delete',
}

/**
 * 文件变更详情
 */
export interface FileChange {
  path: string; // 文件路径
  type: FileChangeType; // 变更类型
  contentPreview?: string; // 前 500 字符
  diff?: string; // diff 内容
}

/**
 * 命令执行审批详情
 */
export interface ExecCommandApproval {
  command: string; // 要执行的命令
  cwd: string; // 工作目录
  reason?: string; // 执行原因
}

/**
 * 文件补丁审批详情
 */
export interface ApplyPatchApproval {
  fileChanges: FileChange[]; // 文件变更列表
  reason?: string; // 变更原因
  grantRoot?: boolean; // 是否授予 root 权限
}

/**
 * 审批请求实体 - 表示一次需要外部决策的审批请求
 */
export interface ApprovalRequest {
  requestId: string; // UUID
  jobId: string; // 关联的作业 ID
  type: ApprovalType; // 审批类型
  createdAt: Date; // 创建时间
  resolvedAt?: Date; // 解决时间
  status: ApprovalStatus; // 审批状态
  details: ExecCommandApproval | ApplyPatchApproval; // 具体内容
  decision?: ApprovalDecision; // 最终决策
  decisionReason?: string; // 决策原因(如 '白名单自动批准')
  waitingDuration?: number; // 等待时长(毫秒)
}

// Zod Schemas for ApprovalRequest
export const FileChangeSchema = z.object({
  path: z.string(),
  type: z.nativeEnum(FileChangeType),
  contentPreview: z.string().optional(),
  diff: z.string().optional(),
});

export const ExecCommandApprovalSchema = z.object({
  command: z.string().min(1),
  cwd: z.string(),
  reason: z.string().optional(),
});

export const ApplyPatchApprovalSchema = z.object({
  fileChanges: z.array(FileChangeSchema).min(1),
  reason: z.string().optional(),
  grantRoot: z.boolean().optional(),
});

export const ApprovalRequestSchema = z.object({
  requestId: z.string().uuid(),
  jobId: z.string().uuid(),
  type: z.nativeEnum(ApprovalType),
  createdAt: z.date(),
  resolvedAt: z.date().optional(),
  status: z.nativeEnum(ApprovalStatus),
  details: z.union([ExecCommandApprovalSchema, ApplyPatchApprovalSchema]),
  decision: z.nativeEnum(ApprovalDecision).optional(),
  decisionReason: z.string().optional(),
  waitingDuration: z.number().min(0).optional(),
});

// ============================================================================
// 4. ApprovalPolicy (审批策略) - data-model.md:401-458
// ============================================================================

/**
 * 白名单规则
 */
export interface WhitelistRule {
  pattern: string; // 正则表达式字符串
  reason: string; // 白名单原因
  enabled: boolean; // 是否启用
}

/**
 * 审批策略 - 定义审批规则和白名单
 */
export interface ApprovalPolicy {
  mode: ApprovalMode; // 审批模式
  whitelist: WhitelistRule[]; // 白名单规则列表
  timeout?: number; // 审批超时(毫秒, undefined = 无限等待)
  autoApprovePatterns?: RegExp[]; // 自动批准的命令模式
}

// Zod Schemas for ApprovalPolicy
export const WhitelistRuleSchema = z.object({
  pattern: z.string().min(1),
  reason: z.string(),
  enabled: z.boolean(),
});

export const ApprovalPolicySchema = z.object({
  mode: z.nativeEnum(ApprovalMode),
  whitelist: z.array(WhitelistRuleSchema),
  timeout: z.number().positive().optional(),
  autoApprovePatterns: z.array(z.instanceof(RegExp)).optional(),
});

// ============================================================================
// 5. Event (事件) - data-model.md:461-526
// ============================================================================

/**
 * 事件类型枚举
 */
export enum EventType {
  // 作业生命周期
  JOB_CREATED = 'job-created',
  JOB_STARTED = 'job-started',
  JOB_COMPLETED = 'job-completed',
  JOB_FAILED = 'job-failed',
  JOB_CANCELLED = 'job-cancelled',
  JOB_TIMEOUT = 'job-timeout',

  // 会话生命周期
  SESSION_CREATED = 'session-created',
  SESSION_ACTIVE = 'session-active',
  SESSION_IDLE = 'session-idle',
  SESSION_RECOVERING = 'session-recovering',
  SESSION_TERMINATED = 'session-terminated',

  // 进程事件
  PROCESS_STARTED = 'process-started',
  PROCESS_CRASHED = 'process-crashed',
  PROCESS_RESTARTED = 'process-restarted',

  // 审批事件
  APPROVAL_REQUESTED = 'approval-requested',
  APPROVAL_APPROVED = 'approval-approved',
  APPROVAL_DENIED = 'approval-denied',
  APPROVAL_AUTO_APPROVED = 'approval-auto-approved',

  // Codex 事件(转发)
  CODEX_TASK_STARTED = 'codex-task-started',
  CODEX_AGENT_MESSAGE = 'codex-agent-message',
  CODEX_TASK_COMPLETE = 'codex-task-complete',
  CODEX_TASK_ERROR = 'codex-task-error',
}

/**
 * 事件实体 - 表示系统运行中产生的各类通知
 */
export interface Event {
  eventId: string; // UUID
  timestamp: Date; // 事件时间戳
  jobId?: string; // 关联的作业 ID(如适用)
  sessionId?: string; // 关联的会话 ID(如适用)
  type: EventType; // 事件类型
  data: Record<string, unknown>; // 事件数据(类型依赖于 type)
}

// Zod Schema for Event
export const EventSchema = z.object({
  eventId: z.string().uuid(),
  timestamp: z.date(),
  jobId: z.string().uuid().optional(),
  sessionId: z.string().uuid().optional(),
  type: z.nativeEnum(EventType),
  data: z.record(z.unknown()),
});

// ============================================================================
// 6. MCP Bridge Layer Types - data-model.md:141-265
// ============================================================================

/**
 * MCP 工具结果状态
 */
export enum ToolResultStatus {
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

/**
 * MCP 工具调用结果
 */
export interface ToolResult {
  status: ToolResultStatus; // 接受或拒绝
  jobId?: string; // 作业 ID
  conversationId?: string; // 会话 ID
  message: string; // 结果消息
  error?: ErrorDetails; // 错误详情(如有)
}

/**
 * MCP 通知事件类型
 */
export enum MCPEventType {
  TASK_STARTED = 'task-started',
  AGENT_MESSAGE = 'agent-message',
  TASK_COMPLETE = 'task-complete',
  TASK_ERROR = 'task-error',
  APPROVAL_REQUIRED = 'approval-required',
}

/**
 * MCP 进度通知
 */
export interface MCPNotification {
  method: 'codex-father/progress'; // 固定通知方法
  params: {
    jobId: string; // 关联的作业 ID
    eventType: MCPEventType; // 事件类型
    eventData: Record<string, unknown>; // 原始事件数据
    timestamp: Date; // 时间戳
  };
}

// Zod Schemas for MCP Bridge Layer
export const ToolResultSchema = z.object({
  status: z.nativeEnum(ToolResultStatus),
  jobId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
  message: z.string(),
  error: ErrorDetailsSchema.optional(),
});

export const MCPNotificationSchema = z.object({
  method: z.literal('codex-father/progress'),
  params: z.object({
    jobId: z.string().uuid(),
    eventType: z.nativeEnum(MCPEventType),
    eventData: z.record(z.unknown()),
    timestamp: z.date(),
  }),
});

// ============================================================================
// 7. Process Manager Types - data-model.md:268-339
// ============================================================================

/**
 * 单进程管理器状态
 */
export enum SingleProcessStatus {
  STARTING = 'starting', // 正在启动
  READY = 'ready', // 就绪
  RESTARTING = 'restarting', // 正在重启
  STOPPED = 'stopped', // 已停止
}

/**
 * 进程池中单个进程状态
 */
export enum ProcessStatus {
  IDLE = 'idle', // 空闲
  BUSY = 'busy', // 忙碌
  CRASHED = 'crashed', // 崩溃
}

// ============================================================================
// 8. Metrics Summary Types - data-model.md:592-630
// ============================================================================

/**
 * 指标摘要 - 某个时间段内的系统运行指标汇总
 */
export interface MetricsSummary {
  periodStart: Date; // 统计周期开始
  periodEnd: Date; // 统计周期结束
  totalJobs: number; // 总作业数
  completedJobs: number; // 完成作业数
  failedJobs: number; // 失败作业数
  cancelledJobs: number; // 取消作业数
  timeoutJobs: number; // 超时作业数

  avgJobDuration: number; // 平均作业时长(毫秒)
  p50JobDuration: number; // 50 分位时长
  p95JobDuration: number; // 95 分位时长
  p99JobDuration: number; // 99 分位时长

  totalApprovals: number; // 总审批数
  autoApprovedCount: number; // 自动批准数
  manualApprovedCount: number; // 手动批准数
  deniedCount: number; // 拒绝数
  avgApprovalDuration: number; // 平均审批等待时长

  processRestarts: number; // 进程重启次数
  sessionRecoveries: number; // 会话恢复次数(MVP2)

  errorDistribution: Record<string, number>; // 错误类型分布
}

// Zod Schema for MetricsSummary
export const MetricsSummarySchema = z.object({
  periodStart: z.date(),
  periodEnd: z.date(),
  totalJobs: z.number().int().min(0),
  completedJobs: z.number().int().min(0),
  failedJobs: z.number().int().min(0),
  cancelledJobs: z.number().int().min(0),
  timeoutJobs: z.number().int().min(0),
  avgJobDuration: z.number().min(0),
  p50JobDuration: z.number().min(0),
  p95JobDuration: z.number().min(0),
  p99JobDuration: z.number().min(0),
  totalApprovals: z.number().int().min(0),
  autoApprovedCount: z.number().int().min(0),
  manualApprovedCount: z.number().int().min(0),
  deniedCount: z.number().int().min(0),
  avgApprovalDuration: z.number().min(0),
  processRestarts: z.number().int().min(0),
  sessionRecoveries: z.number().int().min(0),
  errorDistribution: z.record(z.number().int().min(0)),
});

// ============================================================================
// 9. Helper Functions
// ============================================================================

/**
 * 验证并解析 Job 数据
 */
export function parseJob(data: unknown): z.infer<typeof JobSchema> {
  return JobSchema.parse(data);
}

/**
 * 验证并解析 Session 数据
 */
export function parseSession(data: unknown): z.infer<typeof SessionSchema> {
  return SessionSchema.parse(data);
}

/**
 * 验证并解析 ApprovalRequest 数据
 */
export function parseApprovalRequest(data: unknown): z.infer<typeof ApprovalRequestSchema> {
  return ApprovalRequestSchema.parse(data);
}

/**
 * 验证并解析 Event 数据
 */
export function parseEvent(data: unknown): z.infer<typeof EventSchema> {
  return EventSchema.parse(data);
}

/**
 * 验证 Job 状态转换是否合法
 */
export function isValidJobStatusTransition(from: JobStatus, to: JobStatus): boolean {
  const validTransitions: Record<JobStatus, JobStatus[]> = {
    [JobStatus.PENDING]: [JobStatus.RUNNING, JobStatus.CANCELLED],
    [JobStatus.RUNNING]: [
      JobStatus.COMPLETED,
      JobStatus.FAILED,
      JobStatus.CANCELLED,
      JobStatus.TIMEOUT,
    ],
    [JobStatus.COMPLETED]: [], // 终态
    [JobStatus.FAILED]: [], // 终态
    [JobStatus.CANCELLED]: [], // 终态
    [JobStatus.TIMEOUT]: [], // 终态
  };

  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * 验证 Session 状态转换是否合法
 */
export function isValidSessionStatusTransition(from: SessionStatus, to: SessionStatus): boolean {
  const validTransitions: Record<SessionStatus, SessionStatus[]> = {
    [SessionStatus.INITIALIZING]: [SessionStatus.ACTIVE, SessionStatus.TERMINATED],
    [SessionStatus.ACTIVE]: [
      SessionStatus.IDLE,
      SessionStatus.RECOVERING,
      SessionStatus.TERMINATED,
    ],
    [SessionStatus.IDLE]: [SessionStatus.ACTIVE, SessionStatus.TERMINATED],
    [SessionStatus.RECOVERING]: [SessionStatus.ACTIVE, SessionStatus.TERMINATED],
    [SessionStatus.TERMINATED]: [], // 终态
  };

  return validTransitions[from]?.includes(to) ?? false;
}

// ============================================================================
// 9. CLI Command Types - CLI 命令相关类型
// ============================================================================

/**
 * CLI 命令上下文
 */
export interface CommandContext {
  args: string[]; // 命令参数
  options: Record<string, unknown>; // 命令选项
  verbose: boolean; // 详细输出
  dryRun: boolean; // 试运行模式
  json: boolean; // JSON 输出格式
  workingDirectory: string; // 工作目录
  configPath: string; // 配置文件路径
  logLevel: 'debug' | 'info' | 'warn' | 'error'; // 日志级别
}

/**
 * CLI 命令执行结果
 */
export interface CommandResult {
  success: boolean; // 是否成功
  message?: string; // 消息
  data?: unknown; // 数据
  errors?: string[]; // 错误列表
  warnings?: string[]; // 警告列表
  executionTime: number; // 执行时间(毫秒)
}

// ============================================================================
// 10. Helper Functions - 辅助函数
// ============================================================================

/**
 * 获取默认的审批策略白名单
 */
export function getDefaultWhitelist(): WhitelistRule[] {
  return [
    {
      pattern: '^git status',
      reason: 'Read-only git command',
      enabled: true,
    },
    {
      pattern: '^git diff',
      reason: 'Read-only git command',
      enabled: true,
    },
    {
      pattern: '^git log',
      reason: 'Read-only git command',
      enabled: true,
    },
    {
      pattern: '^ls ',
      reason: 'Read-only file listing',
      enabled: true,
    },
    {
      pattern: '^cat ',
      reason: 'Read-only file viewing',
      enabled: true,
    },
    {
      pattern: '^npm install$',
      reason: 'Dependency installation (HIGH RISK: can run arbitrary postinstall scripts)',
      enabled: false, // 默认禁用,需用户显式启用
    },
  ];
}

// ============================================================================
// 11. Project Configuration Types - 项目配置相关类型
// ============================================================================

export interface LogOutput {
  type: 'console' | 'file' | 'syslog';
  path?: string;
  rotation?: boolean;
  maxSize?: string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'text' | 'json';
  outputs: LogOutput[];
}

export interface PerformanceConfig {
  maxExecutionTime: number; // 毫秒
  maxMemoryUsage: number; // 字节
  enableProfiling: boolean;
}

export interface SecurityConfig {
  sandboxMode: 'readonly' | 'workspace-write' | 'full';
  auditLogging: boolean;
  redactSensitiveData: boolean;
}

export interface ProjectConfig {
  version: string;
  environment: 'development' | 'testing' | 'production';
  logging: LoggingConfig;
  performance: PerformanceConfig;
  security: SecurityConfig;
}

// ============================================================================
// 12. Queue Types - 队列与任务相关类型
// ============================================================================

export type TaskStatus =
  | 'pending'
  | 'scheduled'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'cancelled'
  | 'timeout';

export interface TaskRetryPolicy {
  maxAttempts: number;
  baseDelay: number; // 毫秒
  maxDelay: number; // 毫秒
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  retryableErrors?: string[];
}

export interface TaskMetadata {
  source: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  tags: string[];
  environment: string;
  version: string;
}

export interface TaskDefinition {
  type: string;
  priority: number;
  payload: Record<string, unknown>;
  scheduledAt?: Date;
  timeout?: number;
  retryPolicy?: TaskRetryPolicy;
  metadata?: TaskMetadata;
}

export interface Task {
  id: string;
  type: string;
  priority: number;
  payload: Record<string, unknown>;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  result?: unknown;
  error?: string;
  metadata: TaskMetadata;
  timeout: number;
  retryPolicy: TaskRetryPolicy;
}

export interface EnqueueResult {
  taskId: string;
  queuePosition?: number;
  estimatedStartTime?: Date;
  scheduledAt?: Date;
}

export interface CancelResult {
  taskId: string;
  cancelled: boolean;
  reason?: string;
  wasRunning: boolean;
}

export interface RetryResult {
  taskId: string;
  retryScheduled: boolean;
  nextAttemptAt?: Date;
  attemptNumber: number;
  reason?: string;
}

export interface QueueProcessingCapacity {
  maxConcurrent: number;
  currentlyProcessing: number;
  availableSlots: number;
}

export interface QueuePerformanceMetrics {
  throughputPerHour: number;
  averageWaitTime: number;
  successRate: number;
  retryRate: number;
}

export interface QueueStorageMetrics {
  diskUsage: number;
  fileCount: number;
  oldestTask?: Date;
  newestTask?: Date;
}

export interface QueueStatistics {
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByType: Record<string, number>;
  tasksByPriority: Record<number, number>;
  averageProcessingTime: number;
  queueDepth: number;
  processingCapacity: QueueProcessingCapacity;
  performance: QueuePerformanceMetrics;
  storage: QueueStorageMetrics;
}

export type QueueStatusDirectory =
  | 'pending'
  | 'scheduled'
  | 'processing'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled';

export interface QueueDirectoryStructure {
  base: string;
  statuses: Record<QueueStatusDirectory, string>;
  tasks: Record<QueueStatusDirectory, string>;
  metadata: Record<QueueStatusDirectory, string>;
  logs: string;
  index: string;
  locks: string;
  tmp: string;
  archived: string;
  all: string[];
}

export interface CorruptionIssue {
  type:
    | 'missing_file'
    | 'invalid_json'
    | 'inconsistent_status'
    | 'orphaned_file'
    | 'permission_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  path: string;
  description: string;
  autoFixable: boolean;
  recommendation: string;
}

export interface IntegrityCheckResult {
  valid: boolean;
  issues: CorruptionIssue[];
  recommendations: string[];
  checkedFiles: number;
  corruptedFiles: number;
  orphanedFiles: number;
  summary: string;
}

export interface RepairResult {
  repaired: boolean;
  issuesFixed: number;
  issuesRemaining: number;
  backupCreated: boolean;
  backupPath?: string;
  summary: string;
}

export interface BackupResult {
  success: boolean;
  backupPath: string;
  fileCount: number;
  totalSize: number;
  duration: number;
  compression: number;
}

export interface RestoreResult {
  success: boolean;
  restoredFiles: number;
  skippedFiles: number;
  errors: string[];
  duration: number;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  migratedTasks: number;
  backupPath: string;
  duration: number;
  warnings: string[];
}

export type QueueEvent =
  | 'task_enqueued'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_cancelled'
  | 'task_retrying'
  | 'queue_full'
  | 'queue_empty'
  | 'executor_started'
  | 'executor_stopped'
  | 'corruption_detected'
  | 'performance_warning';

export interface QueueEventData {
  event: QueueEvent;
  timestamp: Date;
  taskId?: string;
  details: Record<string, unknown>;
}

export type QueueEventListener = (data: QueueEventData) => void;

export interface QueueEventEmitter {
  on(event: QueueEvent, listener: QueueEventListener): void;
  off(event: QueueEvent, listener: QueueEventListener): void;
  emit(event: QueueEvent, data: Partial<QueueEventData>): void;
}

export const TASK_QUEUE_ERROR_CODES = {
  QUEUE_FULL: 'TQ001',
  QUEUE_CORRUPTED: 'TQ002',
  QUEUE_LOCKED: 'TQ003',
  QUEUE_NOT_INITIALIZED: 'TQ004',
  TASK_NOT_FOUND: 'TQ101',
  TASK_INVALID_STATUS: 'TQ102',
  TASK_TIMEOUT: 'TQ103',
  TASK_CANCELLED: 'TQ104',
  TASK_RETRY_EXHAUSTED: 'TQ105',
  PERMISSION_DENIED: 'TQ201',
  DISK_SPACE_FULL: 'TQ202',
  FILE_CORRUPTED: 'TQ203',
  DIRECTORY_NOT_FOUND: 'TQ204',
  EXECUTOR_NOT_FOUND: 'TQ301',
  EXECUTOR_OVERLOADED: 'TQ302',
  EXECUTOR_FAILED: 'TQ303',
} as const;

export type TaskQueueErrorCode =
  (typeof TASK_QUEUE_ERROR_CODES)[keyof typeof TASK_QUEUE_ERROR_CODES];

export class TaskQueueError extends Error {
  constructor(
    message: string,
    public readonly code: TaskQueueErrorCode,
    public readonly taskId?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TaskQueueError';
  }
}

// ============================================================================
// 13. Validation Types - 验证相关类型
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

// ============================================================================
// 14. Utility Types & Errors - 工具类型与错误
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export class CodexError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CodexError';
  }
}

export interface QueueMonitoringConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metricsInterval: number;
  alertThresholds: {
    queueDepth: number;
    failureRate: number;
    averageWaitTime: number;
    diskUsage: number;
  };
}

export interface QueuePerformanceConfig {
  batchSize: number;
  processingInterval: number;
  indexingEnabled: boolean;
  compressionEnabled: boolean;
  cacheSize: number;
  optimizationLevel: 'none' | 'basic' | 'aggressive';
}

export interface QueueConfiguration {
  baseDirectory: string;
  maxConcurrentTasks: number;
  maxQueueSize: number;
  defaultTimeout: number;
  defaultRetryPolicy: TaskRetryPolicy;
  cleanupInterval: number;
  archiveCompletedTasks: boolean;
  archiveAfterDays: number;
  monitoring: QueueMonitoringConfig;
  performance: QueuePerformanceConfig;
}
