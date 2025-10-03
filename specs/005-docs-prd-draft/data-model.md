# Data Model: 架构调整 - MCP 模式优先实现

**Feature**: 005-docs-prd-draft
**Date**: 2025-09-30
**Status**: Design Complete

---

## 概述

本文档定义 MCP 协议优先架构的核心实体、数据结构和状态转换。所有实体设计遵循：
- **不可变性**：关键事件和日志记录不可修改
- **可追溯性**：所有状态变更记录时间戳和原因
- **类型安全**：使用 TypeScript + Zod 进行运行时验证

---

## 核心实体

### 1. Job（作业）

**定义**：表示一次完整的 AI 辅助任务请求。

**字段**：

```typescript
interface Job {
  jobId: string;                  // UUID，唯一标识
  requestId: string;              // MCP 请求 ID（来自客户端）
  conversationId?: string;        // Codex 会话 ID（启动后生成）
  status: JobStatus;              // 作业状态
  createdAt: Date;                // 创建时间
  updatedAt: Date;                // 最后更新时间
  input: {
    prompt: string;               // 用户输入的提示
    model?: string;               // 模型选择（如 'gpt-5'）
    cwd?: string;                 // 工作目录
    approvalPolicy?: ApprovalPolicy;  // 审批策略
    sandboxPolicy?: SandboxPolicy;    // 沙箱策略
    timeout?: number;             // 超时时间（毫秒）
  };
  output?: {
    result?: string;              // 最终结果（如有）
    error?: ErrorDetails;         // 错误信息（如有）
    metrics: JobMetrics;          // 执行指标
  };
}

enum JobStatus {
  PENDING = 'pending',       // 已接受，等待执行
  RUNNING = 'running',       // 正在执行
  COMPLETED = 'completed',   // 执行完成
  FAILED = 'failed',         // 执行失败
  CANCELLED = 'cancelled',   // 用户取消
  TIMEOUT = 'timeout'        // 超时
}

interface JobMetrics {
  startTime?: Date;          // 开始执行时间
  endTime?: Date;            // 结束时间
  duration?: number;         // 执行时长（毫秒）
  approvalCount: number;     // 审批请求次数
  approvalDuration: number;  // 审批等待总时长（毫秒）
}
```

**状态转换**：
```
PENDING → RUNNING → COMPLETED
            ↓
            ├─→ FAILED (执行错误)
            ├─→ CANCELLED (用户取消，通过 interruptConversation)
            └─→ TIMEOUT (超时自动终止)
```

**验证规则**：
- `jobId` 和 `requestId` 必须非空
- `status` 转换必须合法（不能从 COMPLETED 回到 RUNNING）
- `timeout` 默认值：1 小时（3600000ms）

**持久化**：
- 配置：`sessions/<session-name>-<date>/config.json`
- 状态更新：记录在 `events.jsonl` 中（不修改 config.json）

---

### 2. Session（会话）

**定义**：表示一次 Codex 交互式对话，包含多轮消息往来。

**字段**：

```typescript
interface Session {
  conversationId: string;    // UUID（Codex 原生标识符）
  sessionName: string;       // 用户友好的名称（如 'feature-abc'）
  jobId: string;             // 关联的作业 ID
  createdAt: Date;           // 创建时间
  sessionDir: string;        // 会话目录路径（如 '.codex-father/sessions/feature-abc-2025-09-30'）
  rolloutRef: string;        // Codex 原生 rollout 文件路径（来自 rollout-ref.txt）
  processId?: number;        // 关联的进程 PID（MVP2）
  status: SessionStatus;     // 会话状态
  config: {
    model: string;
    cwd: string;
    approvalPolicy: ApprovalPolicy;
    sandboxPolicy: SandboxPolicy;
    timeout: number;
  };
}

enum SessionStatus {
  INITIALIZING = 'initializing',  // 正在启动
  ACTIVE = 'active',              // 活跃（可接收消息）
  IDLE = 'idle',                  // 空闲（等待下一轮输入）
  RECOVERING = 'recovering',      // 正在恢复（MVP2）
  TERMINATED = 'terminated'       // 已终止
}
```

**状态转换**：
```
INITIALIZING → ACTIVE → IDLE → ACTIVE (循环)
                  ↓
            RECOVERING → ACTIVE (MVP2 崩溃恢复)
                  ↓
            TERMINATED
```

**验证规则**：
- `sessionName` 必须唯一（同一天内）
- `sessionDir` 必须可写
- `rolloutRef` 必须指向存在的文件（恢复时检查）

**持久化**：
- 配置：`sessions/<session-name>-<date>/config.json`
- Rollout 引用：`sessions/<session-name>-<date>/rollout-ref.txt`

---

### 3. MCPBridgeLayer（MCP 桥接层）

**定义**：负责 MCP 协议与 Codex JSON-RPC 方法之间的转换。

**字段**：

```typescript
interface MCPTool {
  name: string;              // 工具名称（如 'start-codex-task'）
  description: string;       // 工具描述
  inputSchema: JSONSchema;   // 输入参数 schema
  handler: ToolHandler;      // 处理函数（映射到 Codex 方法）
}

type ToolHandler = (params: any) => Promise<ToolResult>;

interface ToolResult {
  status: 'accepted' | 'rejected';
  jobId?: string;
  conversationId?: string;
  message: string;
  error?: ErrorDetails;
}

interface EventMapping {
  codexEventType: string;    // Codex 事件类型（如 'TaskStarted'）
  mcpNotificationMethod: string;  // MCP 通知方法（固定为 'codex-father/progress'）
  transform: (codexEvent: any) => MCPNotification;  // 转换函数
}

interface MCPNotification {
  method: 'codex-father/progress';
  params: {
    jobId: string;
    eventType: string;       // 对应 Codex 事件类型
    eventData: any;          // 原始事件数据
    timestamp: Date;
  };
}
```

**工具定义**（`tools/list` 响应）：

```typescript
const MCP_TOOLS: MCPTool[] = [
  {
    name: 'start-codex-task',
    description: 'Start a new Codex task with specified prompt',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        model: { type: 'string', optional: true },
        cwd: { type: 'string', optional: true },
        approvalPolicy: { type: 'string', enum: ['untrusted', 'on-request', 'on-failure', 'never'] },
        sandboxPolicy: { type: 'string', enum: ['read-only', 'workspace-write', 'danger-full-access'] }
      },
      required: ['prompt']
    },
    handler: async (params) => {
      // 调用 Codex newConversation
      const conversationId = await codexClient.newConversation({ ... });
      return { status: 'accepted', jobId: uuid(), conversationId };
    }
  },
  {
    name: 'send-message',
    description: 'Send a follow-up message to an existing Codex conversation',
    inputSchema: {
      type: 'object',
      properties: {
        conversationId: { type: 'string', format: 'uuid' },
        message: { type: 'string' },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['text', 'image'] },
              text: { type: 'string' },
              imageUrl: { type: 'string' }
            }
          }
        }
      },
      required: ['conversationId']
    },
    handler: async (params) => {
      // 调用 Codex sendUserTurn
      await codexClient.sendUserTurn({
        conversationId: params.conversationId,
        items: params.items || [{ type: 'text', text: params.message }]
      });
      return { status: 'accepted', jobId: params.conversationId, conversationId: params.conversationId };
    }
  },
  {
    name: 'interrupt-task',
    description: 'Interrupt a running Codex task',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string' }
      },
      required: ['jobId']
    },
    handler: async (params) => {
      // 调用 Codex interruptConversation
      await codexClient.interruptConversation({ conversationId });
      return { status: 'accepted', jobId: params.jobId };
    }
  }
];
```

**事件映射规则**：

| Codex 事件 | MCP 通知 eventType | 说明 |
|------------|-------------------|------|
| `TaskStarted` | `task-started` | 任务开始执行 |
| `AgentMessage` | `agent-message` | Agent 输出消息 |
| `TaskComplete` | `task-complete` | 任务成功完成 |
| `TaskError` | `task-error` | 任务执行错误 |
| `ApprovalRequired` | `approval-required` | 需要审批（特殊处理） |

---

### 4. ProcessManager（进程管理器）

**MVP1: 单进程管理**

```typescript
interface SingleProcessManager {
  process: CodexMCPProcess;     // 单个 codex mcp 进程
  conversationMap: Map<string, string>;  // request_id → conversationId
  status: 'starting' | 'ready' | 'restarting' | 'stopped';
  healthCheck: NodeJS.Timeout;  // 健康检查定时器

  start(): Promise<void>;
  restart(): Promise<void>;
  handleToolsCall(requestId: string, params: any): Promise<ToolResult>;
  handleCancel(requestId: string): Promise<void>;
}

interface CodexMCPProcess {
  pid: number;
  process: ChildProcess;
  stdin: Writable;
  stdout: Readable;
  requestHandlers: Map<string, PromiseResolver>;  // JSON-RPC request_id → resolver
  eventEmitter: EventEmitter;   // 用于通知

  sendRequest(method: string, params: any): Promise<any>;
  onNotification(handler: (notification: any) => void): void;
}
```

**MVP2: 进程池管理**

```typescript
interface ProcessPoolManager {
  pool: CodexExecProcess[];     // 进程池
  maxProcesses: number;         // 最大进程数（默认：CPU 核数）
  taskQueue: Job[];             // 等待执行的任务队列
  processMap: Map<string, CodexExecProcess>;  // jobId → process

  allocateProcess(job: Job): Promise<CodexExecProcess>;
  releaseProcess(process: CodexExecProcess): void;
  recoverSession(sessionDir: string): Promise<CodexExecProcess>;
}

interface CodexExecProcess {
  pid: number;
  process: ChildProcess;
  status: 'idle' | 'busy' | 'crashed';
  currentJobId?: string;
  sessionId?: string;
  createdAt: Date;

  assignTask(job: Job): Promise<void>;
  terminate(): Promise<void>;
  isAlive(): boolean;
}
```

**状态转换**（单进程）：
```
starting → ready → restarting → ready
                 ↓
              stopped
```

**状态转换**（进程池中的单个进程）：
```
idle → busy → idle
        ↓
    crashed → (removed from pool)
```

---

### 5. ApprovalRequest（审批请求）

**定义**：表示一次需要外部决策的审批请求。

**字段**：

```typescript
interface ApprovalRequest {
  requestId: string;         // UUID
  jobId: string;             // 关联的作业 ID
  type: 'exec-command' | 'apply-patch';  // 审批类型
  createdAt: Date;           // 创建时间
  resolvedAt?: Date;         // 解决时间
  status: 'pending' | 'approved' | 'denied' | 'auto-approved';

  details: ExecCommandApproval | ApplyPatchApproval;  // 具体内容
  decision?: 'allow' | 'deny';  // 最终决策
  decisionReason?: string;   // 决策原因（如 '白名单自动批准'）
  waitingDuration?: number;  // 等待时长（毫秒）
}

interface ExecCommandApproval {
  command: string;
  cwd: string;
  reason?: string;
}

interface ApplyPatchApproval {
  fileChanges: FileChange[];
  reason?: string;
  grantRoot?: boolean;
}

interface FileChange {
  path: string;
  type: 'create' | 'modify' | 'delete';
  contentPreview?: string;   // 前 500 字符
}
```

**状态转换**：
```
pending → approved
        ↓
       denied
        ↓
    auto-approved (白名单匹配)
```

**验证规则**：
- `command` 或 `fileChanges` 必须非空
- `decision` 必须在 `resolvedAt` 设置时同时设置
- `waitingDuration` = `resolvedAt - createdAt`

**持久化**：
- 记录在 `events.jsonl` 中（类型：`ApprovalRequest`）

---

### 6. ApprovalPolicy（审批策略）

**定义**：定义审批规则和白名单。

**字段**：

```typescript
interface ApprovalPolicy {
  mode: ApprovalMode;
  whitelist: WhitelistRule[];
  timeout?: number;          // 审批超时（毫秒，undefined = 无限等待）
  autoApprovePatterns?: RegExp[];  // 自动批准的命令模式
}

enum ApprovalMode {
  UNTRUSTED = 'untrusted',       // 所有操作需要审批
  ON_REQUEST = 'on-request',     // Codex 请求时审批
  ON_FAILURE = 'on-failure',     // 失败时审批
  NEVER = 'never'                // 从不审批（危险）
}

interface WhitelistRule {
  pattern: string;           // 正则表达式字符串
  reason: string;            // 白名单原因
  enabled: boolean;          // 是否启用
}
```

**默认白名单**（可配置）：
```yaml
whitelist:
  - pattern: "^git status"
    reason: "Read-only git command"
    enabled: true
  - pattern: "^git diff"
    reason: "Read-only git command"
    enabled: true
  - pattern: "^git log"
    reason: "Read-only git command"
    enabled: true
  - pattern: "^ls "
    reason: "Read-only file listing"
    enabled: true
  - pattern: "^cat "
    reason: "Read-only file viewing"
    enabled: true
  # 注意：npm install 可执行任意 postinstall 脚本，默认不自动批准
  # 如需自动批准，请显式启用：
  # - pattern: "^npm install$"
  #   reason: "Dependency installation (HIGH RISK: can run arbitrary postinstall scripts)"
  #   enabled: false
```

**加载来源**：
1. 全局配置：`~/.codex-father/config/approval-whitelist.yaml`
2. 项目配置：`.codex-father/approval-whitelist.yaml`
3. 任务指定：在 `tools/call` 参数中覆盖

---

### 7. Event（事件）

**定义**：表示系统运行中产生的各类通知，持久化到 JSONL 日志。

**字段**：

```typescript
interface Event {
  eventId: string;           // UUID
  timestamp: Date;           // 事件时间戳
  jobId?: string;            // 关联的作业 ID（如适用）
  sessionId?: string;        // 关联的会话 ID（如适用）
  type: EventType;           // 事件类型
  data: any;                 // 事件数据（类型依赖于 type）
}

enum EventType {
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

  // Codex 事件（转发）
  CODEX_TASK_STARTED = 'codex-task-started',
  CODEX_AGENT_MESSAGE = 'codex-agent-message',
  CODEX_TASK_COMPLETE = 'codex-task-complete',
  CODEX_TASK_ERROR = 'codex-task-error'
}
```

**示例事件**（JSONL 格式）：

```jsonl
{"eventId":"e1","timestamp":"2025-09-30T10:00:00Z","jobId":"j1","type":"job-created","data":{"input":{"prompt":"Fix bug"}}}
{"eventId":"e2","timestamp":"2025-09-30T10:00:01Z","jobId":"j1","sessionId":"s1","type":"session-created","data":{"sessionName":"fix-bug-2025-09-30"}}
{"eventId":"e3","timestamp":"2025-09-30T10:00:02Z","jobId":"j1","type":"job-started","data":{}}
{"eventId":"e4","timestamp":"2025-09-30T10:01:00Z","jobId":"j1","type":"approval-requested","data":{"requestId":"a1","command":"rm -rf build"}}
{"eventId":"e5","timestamp":"2025-09-30T10:01:15Z","jobId":"j1","type":"approval-approved","data":{"requestId":"a1","decision":"allow"}}
{"eventId":"e6","timestamp":"2025-09-30T10:05:00Z","jobId":"j1","type":"job-completed","data":{"duration":300000}}
```

**持久化**：
- 路径：`sessions/<session-name>-<date>/events.jsonl`
- 格式：每行一个 JSON 对象，追加写入（append-only）
- 用途：监控、审计、调试（**不用于会话恢复**）

---

### 8. AgentDefinition（Agent 定义）- MVP2

**定义**：定义外部 agent 的配置信息，支持扩展到其他 agent CLI。

**字段**：

```typescript
interface AgentDefinition {
  name: string;              // agent 名称（如 'codex', 'claude-code'）
  type: 'mcp' | 'exec';      // 通信协议类型
  command: string[];         // 启动命令（如 ['codex', 'exec', '--json']）
  env?: Record<string, string>;  // 环境变量
  eventParsing: EventParsingStrategy;  // 事件解析策略
  healthCheck: HealthCheckStrategy;    // 健康检查策略
}

interface EventParsingStrategy {
  format: 'json-rpc' | 'jsonl' | 'custom';  // 事件格式
  lineDelimited: boolean;    // 是否 line-delimited
  eventTypeField: string;    // 事件类型字段名（如 'method' 或 'type'）
  parser?: (line: string) => Event;  // 自定义解析器
}

interface HealthCheckStrategy {
  method: 'process-alive' | 'heartbeat' | 'custom';
  interval: number;          // 检查间隔（毫秒）
  timeout: number;           // 超时时间（毫秒）
}
```

**预定义 Agent**：

```yaml
# config/agents.yaml
agents:
  - name: codex
    type: exec
    command: ['codex', 'exec', '--json', '--model', 'gpt-5']
    eventParsing:
      format: jsonl
      lineDelimited: true
      eventTypeField: type
    healthCheck:
      method: process-alive
      interval: 5000
      timeout: 10000

  - name: claude-code
    type: exec
    command: ['claude', 'code', '--json']
    eventParsing:
      format: jsonl
      lineDelimited: true
      eventTypeField: event
    healthCheck:
      method: heartbeat
      interval: 10000
      timeout: 30000
```

---

### 9. MetricsSummary（指标摘要）

**定义**：表示某个时间段内的系统运行指标汇总。

**字段**：

```typescript
interface MetricsSummary {
  periodStart: Date;
  periodEnd: Date;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  timeoutJobs: number;

  avgJobDuration: number;    // 平均作业时长（毫秒）
  p50JobDuration: number;    // 50 分位时长
  p95JobDuration: number;    // 95 分位时长
  p99JobDuration: number;    // 99 分位时长

  totalApprovals: number;
  autoApprovedCount: number;
  manualApprovedCount: number;
  deniedCount: number;
  avgApprovalDuration: number;  // 平均审批等待时长

  processRestarts: number;   // 进程重启次数
  sessionRecoveries: number; // 会话恢复次数（MVP2）

  errorDistribution: Record<string, number>;  // 错误类型分布
}
```

**生成方式**：
- 从 `events.jsonl` 中解析计算
- 定期生成（如每小时）或按需生成
- 输出为 JSON 格式：`sessions/<session-name>-<date>/metrics.json`

---

## 数据验证（Zod Schema）

所有实体使用 Zod 进行运行时验证，确保类型安全。

**示例**：

```typescript
import { z } from 'zod';

const JobSchema = z.object({
  jobId: z.string().uuid(),
  requestId: z.string().min(1),
  conversationId: z.string().uuid().optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'timeout']),
  createdAt: z.date(),
  updatedAt: z.date(),
  input: z.object({
    prompt: z.string().min(1),
    model: z.string().optional(),
    cwd: z.string().optional(),
    approvalPolicy: z.enum(['untrusted', 'on-request', 'on-failure', 'never']).optional(),
    sandboxPolicy: z.enum(['read-only', 'workspace-write', 'danger-full-access']).optional(),
    timeout: z.number().positive().optional()
  }),
  output: z.object({
    result: z.string().optional(),
    error: ErrorDetailsSchema.optional(),
    metrics: JobMetricsSchema
  }).optional()
});

// 使用示例
function createJob(data: unknown): Job {
  return JobSchema.parse(data);  // 抛出验证错误如果不匹配
}
```

---

## 数据流图

### MVP1: 单进程流程

```
外部 MCP 客户端
    ↓ (MCP tools/call)
MCPBridgeLayer
    ↓ (创建 Job, 状态: PENDING)
SingleProcessManager
    ↓ (newConversation)
Codex MCP Process
    ↓ (codex/event 通知)
EventMapper
    ↓ (codex-father/progress 通知)
外部 MCP 客户端
```

### MVP2: 进程池流程

```
外部 MCP 客户端
    ↓ (MCP tools/call)
MCPBridgeLayer
    ↓ (创建 Job, 状态: PENDING)
ProcessPoolManager
    ↓ (allocateProcess)
Codex Exec Process (独立进程)
    ↓ (JSONL 事件流)
EventMapper
    ↓ (codex-father/progress 通知)
外部 MCP 客户端

[崩溃场景]
Codex Exec Process (crashed)
    ↓
ProcessPoolManager (检测崩溃)
    ↓ (读取 rollout-ref.txt)
SessionRecoveryManager
    ↓ (codex exec resume <session-id>)
Codex Exec Process (恢复)
```

---

## 总结

所有核心实体已定义，满足以下要求：
- ✅ 类型安全（TypeScript + Zod）
- ✅ 状态转换明确
- ✅ 持久化策略清晰
- ✅ 支持 MVP1 和 MVP2 扩展
- ✅ 符合 constitution 的架构原则

**准备就绪，可以进入契约定义阶段** ✓