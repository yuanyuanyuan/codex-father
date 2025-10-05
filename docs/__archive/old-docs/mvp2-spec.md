# Technical Specification: MVP2 - 多进程并行管理

**Feature Branch**: `mvp2-multi-process` **Created**: 2025-10-01 **Status**:
Planning **Prerequisites**: MVP1 完成（单进程 MCP 服务器已实现）

---

## 执行流程

```
1. 加载 PRD 文档
   → ✅ 已完成：mvp2-prd.md 定义了 8 大功能模块、38 项需求
2. 提取技术决策点
   → ✅ 已识别：进程池管理、会话恢复、队列调度、并行审批
3. 设计系统架构
   → 📋 进行中：6 层架构设计
4. 定义数据模型
   → 📋 进行中：核心实体和关系
5. 设计 API 接口
   → 📋 待完成：内部接口设计
6. 制定技术方案
   → 📋 待完成：关键技术实现方案
7. 返回状态
   → 📋 IN PROGRESS：技术规范编写中
```

---

## 系统架构

### 整体架构（MVP2）

```
┌─────────────────────────────────────────────────────────────────┐
│                       MCP Client (External)                      │
│                    (IDE Plugin, CLI Tool, etc.)                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │ MCP Protocol (stdio)
┌───────────────────────────────▼─────────────────────────────────┐
│                         MCP Server Layer                         │
│  - Initialize/Tools/Call/Notifications Handler                  │
│  - Request Routing & Response Formatting                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│                      Bridge & Orchestration Layer                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │   MCP Bridge     │  │ Process          │  │ Queue          │ │
│  │   Layer          │  │ Orchestrator     │  │ Scheduler      │ │
│  │  (MVP1 复用)     │  │  (NEW)           │  │  (NEW)         │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
└───────────────────────────────┬─────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌───────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
│ Process Pool   │  │ Process Pool   │  │ Process Pool   │
│                │  │                │  │                │
│ ┌────────────┐ │  │ ┌────────────┐ │  │ ┌────────────┐ │
│ │ codex exec │ │  │ │ codex exec │ │  │ │ codex exec │ │
│ │ --json     │ │  │ │ --json     │ │  │ │ --json     │ │
│ │            │ │  │ │            │ │  │ │            │ │
│ │ Conv-A     │ │  │ │ Conv-B     │ │  │ │ Conv-C     │ │
│ └────────────┘ │  │ └────────────┘ │  │ └────────────┘ │
│                │  │                │  │                │
│ Session Dir A  │  │ Session Dir B  │  │ Session Dir C  │
│ - events.jsonl │  │ - events.jsonl │  │ - events.jsonl │
│ - config.json  │  │ - config.json  │  │ - config.json  │
│ - rollout-ref  │  │ - rollout-ref  │  │ - rollout-ref  │
└────────────────┘  └────────────────┘  └────────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
        ┌───────────────────▼───────────────────┐
        │    Session Recovery Manager (NEW)     │
        │  - Rollout File Locator               │
        │  - Resume Command Builder             │
        │  - Backup Manager                     │
        └───────────────────┬───────────────────┘
                            │
        ┌───────────────────▼───────────────────┐
        │   Approval & Policy Layer (Enhanced)  │
        │  ┌─────────────────────────────────┐  │
        │  │ Approval Queue (NEW)            │  │
        │  │ - Multi-Request Management      │  │
        │  │ - Batch Operations              │  │
        │  └─────────────────────────────────┘  │
        │  ┌─────────────────────────────────┐  │
        │  │ Policy Engine (MVP1 复用)       │  │
        │  │ - Whitelist Matching            │  │
        │  │ - Auto Approval Logic           │  │
        │  └─────────────────────────────────┘  │
        │  ┌─────────────────────────────────┐  │
        │  │ Terminal UI (Enhanced)          │  │
        │  │ - Queue Display                 │  │
        │  │ - Batch Operations UI           │  │
        │  └─────────────────────────────────┘  │
        └───────────────────────────────────────┘
                            │
        ┌───────────────────▼───────────────────┐
        │  Session & Logging Layer (MVP1 复用)  │
        │  - Event Logger (JSONL)               │
        │  - Config Persister (JSON)            │
        │  - Session Manager                    │
        └───────────────────────────────────────┘
                            │
        ┌───────────────────▼───────────────────┐
        │  Observability Layer (NEW)            │
        │  - Metrics Collector                  │
        │  - Metrics Aggregator                 │
        │  - Metrics Exporter (JSON)            │
        └───────────────────────────────────────┘
```

---

### 核心组件设计

#### 1. ProcessOrchestrator（进程编排器）⭐

**职责**：

- 管理多个 `codex exec` 进程的生命周期
- 维护进程池（空闲/繁忙状态）
- 路由任务到可用进程
- 监控进程健康状态

**接口设计**：

```typescript
interface ProcessOrchestrator {
  // 启动进程池
  initialize(config: ProcessPoolConfig): Promise<void>;

  // 获取可用进程（如果没有则创建新进程）
  acquireProcess(task: Task): Promise<ManagedProcess>;

  // 释放进程（标记为空闲）
  releaseProcess(processId: string): Promise<void>;

  // 停止进程
  terminateProcess(processId: string): Promise<void>;

  // 监控所有进程
  monitorProcesses(): void;

  // 获取进程池状态
  getPoolStatus(): ProcessPoolStatus;
}

interface ProcessPoolConfig {
  maxProcesses: number; // 最大并行进程数
  minProcesses: number; // 最小保持进程数
  idleTimeout: number; // 空闲超时（毫秒）
  healthCheckInterval: number; // 健康检查间隔（毫秒）
}

interface ManagedProcess {
  id: string;
  pid: number;
  status: 'idle' | 'busy' | 'crashed' | 'terminated';
  conversationId?: string;
  startedAt: Date;
  lastActivityAt: Date;
  workDir: string;
  sessionDir: string;
}

interface ProcessPoolStatus {
  total: number;
  idle: number;
  busy: number;
  crashed: number;
  queueLength: number;
}
```

**关键技术决策**：

1. **进程池策略**：动态扩容 + 空闲回收

   ```typescript
   // 启动时创建 minProcesses 个进程
   // 需要时动态扩容到 maxProcesses
   // 空闲超过 idleTimeout 的进程自动回收
   ```

2. **进程状态管理**：状态机模式

   ```
   IDLE → BUSY → IDLE  (正常流程)
   BUSY → CRASHED → TERMINATED  (崩溃流程)
   IDLE → TERMINATED  (回收流程)
   ```

3. **健康检查**：心跳 + 文件监听
   ```typescript
   // 每 5s 检查一次
   // 1. 检查进程是否存活 (process.kill(pid, 0))
   // 2. 检查事件日志文件是否更新（最近 30s）
   // 3. 如果都失败，标记为 CRASHED
   ```

---

#### 2. QueueScheduler（队列调度器）⭐

**职责**：

- 管理任务队列（优先级队列）
- 实现重试逻辑
- 管理死信队列（DLQ）
- 提供队列监控接口

**接口设计**：

```typescript
interface QueueScheduler {
  // 任务入队
  enqueue(task: Task, priority: Priority): Promise<void>;

  // 任务出队（获取下一个待执行任务）
  dequeue(): Promise<Task | null>;

  // 任务重试
  retry(task: Task): Promise<void>;

  // 移入死信队列
  moveToDLQ(task: Task, reason: string): Promise<void>;

  // 获取队列状态
  getQueueStatus(): QueueStatus;

  // 持久化队列
  persist(): Promise<void>;

  // 恢复队列
  restore(): Promise<void>;
}

enum Priority {
  HIGH = 0,
  MEDIUM = 1,
  LOW = 2,
}

interface Task {
  id: string;
  jobId: string;
  priority: Priority;
  prompt: string;
  model: string;
  agentType: string;
  cwd: string;
  sandbox: string;
  approvalPolicy: string;
  timeout: number;

  // 重试相关
  retryCount: number;
  maxRetries: number;
  lastError?: string;

  // 时间戳
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

interface QueueStatus {
  pending: {
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  processing: number;
  dlq: number;
  avgWaitTime: number; // 平均等待时间（秒）
}
```

**关键技术决策**：

1. **队列数据结构**：三个优先级队列

   ```typescript
   class PriorityQueue {
     private highQueue: Task[] = [];
     private mediumQueue: Task[] = [];
     private lowQueue: Task[] = [];

     dequeue(): Task | null {
       return (
         this.highQueue.shift() ||
         this.mediumQueue.shift() ||
         this.lowQueue.shift() ||
         null
       );
     }
   }
   ```

2. **持久化策略**：JSON 文件

   ```typescript
   // 队列文件：.codex-father/queue/tasks.json
   {
     "pending": [...],
     "processing": [...],
     "dlq": [...]
   }

   // 每次队列变化时自动持久化
   // 启动时自动恢复队列
   ```

3. **重试策略**：指数退避
   ```typescript
   function calculateRetryDelay(retryCount: number): number {
     return Math.min(1000 * Math.pow(2, retryCount), 60000);
     // 1s, 2s, 4s, 8s, 16s, 32s, 60s (最大 60s)
   }
   ```

---

#### 3. SessionRecoveryManager（会话恢复管理器）⭐

**职责**：

- 定位 Codex 原生 rollout 文件
- 构建 `codex exec resume` 命令
- 可选：备份 rollout 文件
- 验证 rollout 文件完整性

**接口设计**：

```typescript
interface SessionRecoveryManager {
  // 记录 rollout 文件路径
  recordRolloutPath(sessionId: string, rolloutPath: string): Promise<void>;

  // 定位 rollout 文件
  locateRolloutFile(sessionId: string): Promise<string | null>;

  // 恢复会话
  recoverSession(sessionId: string): Promise<ManagedProcess>;

  // 备份 rollout 文件（可选）
  backupRolloutFile(sessionId: string): Promise<void>;

  // 验证 rollout 文件
  validateRolloutFile(path: string): Promise<boolean>;
}

interface RolloutFileRef {
  sessionId: string;
  conversationId: string;
  rolloutPath: string; // CODEX_HOME/sessions/<conversation-id>.jsonl
  backupPath?: string; // .codex-father/sessions/<session-id>/rollout.backup.jsonl
  createdAt: Date;
  lastVerifiedAt: Date;
}
```

**关键技术决策**：

1. **Rollout 文件路径规则**：

   ```typescript
   // Codex 原生路径
   const rolloutPath = `${CODEX_HOME}/sessions/${conversationId}.jsonl`;

   // codex-father 记录路径
   const refPath = `.codex-father/sessions/${sessionId}/rollout-ref.txt`;

   // 内容格式
   // rollout-ref.txt:
   // /home/user/.codex/sessions/abc123.jsonl
   ```

2. **会话恢复流程**：

   ```typescript
   async function recoverSession(sessionId: string): Promise<ManagedProcess> {
     // 1. 读取 rollout-ref.txt
     const rolloutPath = await this.locateRolloutFile(sessionId);

     // 2. 验证文件存在且完整
     if (!(await this.validateRolloutFile(rolloutPath))) {
       throw new Error('Rollout file is invalid or missing');
     }

     // 3. 可选：备份文件
     if (config.backupEnabled) {
       await this.backupRolloutFile(sessionId);
     }

     // 4. 构建 resume 命令
     const command = `codex exec resume ${sessionId} --json`;

     // 5. 启动进程
     const process = await this.startProcess(command);

     return process;
   }
   ```

3. **备份策略**（可选）：

   ```typescript
   // 配置项
   interface RecoveryConfig {
     backupEnabled: boolean;
     backupOnCrash: boolean; // 崩溃时自动备份
     backupPeriodic: boolean; // 定期备份
     backupInterval: number; // 备份间隔（毫秒）
   }

   // 备份路径
   const backupPath = `.codex-father/sessions/${sessionId}/rollout.backup.jsonl`;
   ```

---

#### 4. ApprovalQueue（审批队列）⭐

**职责**：

- 管理多个并行审批请求
- 提供队列 UI 显示
- 支持批量操作
- 记录审批历史

**接口设计**：

```typescript
interface ApprovalQueue {
  // 添加审批请求
  addRequest(request: ApprovalRequest): Promise<void>;

  // 获取下一个审批请求
  nextRequest(): Promise<ApprovalRequest | null>;

  // 处理当前审批请求
  processRequest(decision: ApprovalDecision): Promise<void>;

  // 批量批准所有
  batchApproveAll(): Promise<void>;

  // 批量拒绝所有
  batchDenyAll(): Promise<void>;

  // 获取队列状态
  getQueueStatus(): ApprovalQueueStatus;
}

interface ApprovalRequest {
  id: string;
  jobId: string;
  conversationId: string;
  type: 'exec-command' | 'apply-patch' | 'read-file';
  details: {
    command?: string;
    patch?: string;
    filePath?: string;
    cwd: string;
  };
  timestamp: Date;
  waitingDuration: number; // 毫秒
}

interface ApprovalDecision {
  requestId: string;
  decision: 'allow' | 'deny' | 'whitelist';
  reason?: string;
  timestamp: Date;
}

interface ApprovalQueueStatus {
  pending: number;
  current: ApprovalRequest | null;
  currentIndex: number;
  total: number;
  history: ApprovalDecision[];
}
```

**关键技术决策**：

1. **队列 UI 设计**（终端 UI）：

   ```
   ┌─────────────────────────────────────────────────────────┐
   │ 审批请求队列 (2/5)                                       │
   ├─────────────────────────────────────────────────────────┤
   │ 任务: task-abc123                                       │
   │ 类型: exec-command                                      │
   │ 命令: rm -rf build                                      │
   │ 工作目录: /workspace/project-a                          │
   │ 等待时间: 0:05:30                                       │
   ├─────────────────────────────────────────────────────────┤
   │ 队列预览:                                               │
   │   [1] ✅ git status (已批准)                            │
   │ → [2] ⏳ rm -rf build (当前)                            │
   │   [3] ⏳ npm install                                     │
   │   [4] ⏳ git push                                        │
   │   [5] ⏳ docker build                                    │
   ├─────────────────────────────────────────────────────────┤
   │ [A] 批准  [D] 拒绝  [W] 加入白名单  [S] 跳过           │
   │ [B] 批量批准所有 (3 pending)                            │
   │ [X] 批量拒绝所有 (3 pending)                            │
   └─────────────────────────────────────────────────────────┘
   ```

2. **批量操作确认**：

   ```typescript
   async function batchApproveAll(): Promise<void> {
     const pendingCount = this.queue.length;

     // 显示确认提示
     const confirmed = await inquirer.confirm({
       message: `确认批准所有 ${pendingCount} 个待审批请求？`,
       default: false,
     });

     if (!confirmed) return;

     // 批量批准
     for (const request of this.queue) {
       await this.processRequest({
         requestId: request.id,
         decision: 'allow',
         reason: 'Batch approved by user',
       });
     }
   }
   ```

3. **审批历史记录**：
   ```typescript
   // 审批历史文件：.codex-father/sessions/<session-id>/approval-history.jsonl
   {
     "requestId": "r1",
     "jobId": "job-123",
     "type": "exec-command",
     "command": "rm -rf build",
     "decision": "allow",
     "reason": "User approved",
     "waitingDuration": 15000,
     "timestamp": "2025-10-01T10:00:00Z"
   }
   ```

---

#### 5. MetricsCollector（指标收集器）⭐

**职责**：

- 收集系统运行指标
- 聚合和计算统计数据
- 导出 JSON 格式指标

**接口设计**：

```typescript
interface MetricsCollector {
  // 记录任务事件
  recordTaskEvent(event: TaskEvent): void;

  // 记录审批事件
  recordApprovalEvent(event: ApprovalEvent): void;

  // 记录进程事件
  recordProcessEvent(event: ProcessEvent): void;

  // 获取指标摘要
  getMetricsSummary(timeRange: TimeRange): MetricsSummary;

  // 导出指标
  exportMetrics(format: 'json' | 'prometheus'): string;
}

interface TaskEvent {
  type:
    | 'task-created'
    | 'task-started'
    | 'task-completed'
    | 'task-failed'
    | 'task-timeout'
    | 'task-cancelled';
  jobId: string;
  timestamp: Date;
  duration?: number;
  error?: string;
}

interface ApprovalEvent {
  type: 'approval-requested' | 'approval-approved' | 'approval-denied';
  requestId: string;
  jobId: string;
  decision?: 'allow' | 'deny';
  waitingDuration: number;
  timestamp: Date;
}

interface ProcessEvent {
  type: 'process-started' | 'process-stopped' | 'process-crashed';
  processId: string;
  pid: number;
  timestamp: Date;
}

interface MetricsSummary {
  timeRange: TimeRange;
  tasks: TaskMetrics;
  concurrency: ConcurrencyMetrics;
  performance: PerformanceMetrics;
  approvals: ApprovalMetrics;
  failures: FailureMetrics;
}

interface TaskMetrics {
  total: number;
  completed: number;
  failed: number;
  timeout: number;
  cancelled: number;
  running: number;
}

interface ConcurrencyMetrics {
  maxParallel: number; // 最大并行数
  avgParallel: number; // 平均并行数
  processPoolSize: number; // 进程池大小
}

interface PerformanceMetrics {
  avgDurationSec: number; // 平均耗时（秒）
  p50DurationSec: number; // P50 耗时
  p95DurationSec: number; // P95 耗时
  p99DurationSec: number; // P99 耗时
}

interface ApprovalMetrics {
  totalRequests: number;
  autoApproved: number;
  manualApproved: number;
  denied: number;
  whitelistHitRate: number; // 白名单命中率
}

interface FailureMetrics {
  processCrash: number;
  timeout: number;
  userCancelled: number;
  approvalDenied: number;
}
```

**关键技术决策**：

1. **指标存储**：内存 + 持久化

   ```typescript
   // 内存中保留最近 1 小时的事件
   private recentEvents: Event[] = [];

   // 每 5 分钟聚合一次，持久化到文件
   // .codex-father/metrics/metrics-2025-10-01T10.json
   ```

2. **指标计算**：流式计算

   ```typescript
   class MetricsAggregator {
     private taskDurations: number[] = [];

     recordTaskEvent(event: TaskEvent) {
       if (event.type === 'task-completed' && event.duration) {
         this.taskDurations.push(event.duration);
       }
     }

     calculatePercentile(p: number): number {
       const sorted = this.taskDurations.sort((a, b) => a - b);
       const index = Math.floor((sorted.length * p) / 100);
       return sorted[index] || 0;
     }
   }
   ```

3. **导出格式**：JSON
   ```json
   {
     "time_range": {
       "start": "2025-10-01T10:00:00Z",
       "end": "2025-10-01T11:00:00Z"
     },
     "tasks": {
       "total": 50,
       "completed": 45,
       "failed": 3,
       "timeout": 2
     },
     "concurrency": {
       "max_parallel": 4,
       "avg_parallel": 2.8
     },
     "performance": {
       "avg_duration_sec": 180,
       "p50_duration_sec": 120,
       "p95_duration_sec": 300
     },
     "approvals": {
       "total_requests": 120,
       "auto_approved": 80,
       "whitelist_hit_rate": 0.67
     }
   }
   ```

---

## 数据模型

### 核心实体关系图

```
┌─────────────┐
│    Task     │
│  (任务)     │
│  - id       │
│  - jobId    │
│  - priority │
└──────┬──────┘
       │ 1
       │
       │ 1
┌──────▼──────┐
│   Process   │
│  (进程)     │
│  - id       │
│  - pid      │
│  - status   │
└──────┬──────┘
       │ 1
       │
       │ 1
┌──────▼──────┐
│  Session    │
│  (会话)     │
│  - id       │
│  - convId   │
└──────┬──────┘
       │ 1
       │
       │ 1
┌──────▼──────────┐
│ RolloutFileRef  │
│ (恢复文件引用)   │
│ - rolloutPath   │
│ - backupPath    │
└─────────────────┘

┌──────────────┐
│   Approval   │
│   Request    │
│  (审批请求)   │
│  - id        │
│  - jobId     │
│  - type      │
└──────┬───────┘
       │ 1
       │
       │ 1
┌──────▼───────┐
│  Approval    │
│  Decision    │
│  (审批决策)   │
│  - decision  │
│  - reason    │
└──────────────┘

┌──────────────┐
│   Metrics    │
│   Event      │
│  (指标事件)   │
│  - type      │
│  - timestamp │
└──────┬───────┘
       │ *
       │
       │ 1
┌──────▼───────┐
│  Metrics     │
│  Summary     │
│  (指标摘要)   │
│  - tasks     │
│  - approvals │
└──────────────┘
```

---

### 数据持久化设计

#### 文件结构

```
.codex-father/
├── queue/
│   └── tasks.json              # 任务队列（持久化）
├── sessions/
│   └── <session-id>/
│       ├── events.jsonl        # 事件日志
│       ├── config.json         # 会话配置
│       ├── rollout-ref.txt     # Codex rollout 文件路径
│       ├── rollout.backup.jsonl  # Rollout 备份（可选）
│       ├── approval-history.jsonl  # 审批历史
│       ├── stdout.log          # 标准输出
│       └── stderr.log          # 标准错误
├── metrics/
│   └── metrics-<timestamp>.json  # 指标摘要
└── config/
    ├── server.yaml             # 服务器配置
    ├── approval-policy.yaml    # 审批策略
    └── agents.yaml             # Agent 定义
```

#### 配置文件格式

**server.yaml**（服务器配置）：

```yaml
# 进程池配置
process_pool:
  max_processes: 4 # 最大并行进程数（默认：CPU 核数）
  min_processes: 1 # 最小保持进程数
  idle_timeout: 300000 # 空闲超时（毫秒，5 分钟）
  health_check_interval: 5000 # 健康检查间隔（毫秒）

# 队列配置
queue:
  max_queue_size: 100 # 最大队列长度
  persist_interval: 1000 # 持久化间隔（毫秒）
  retry:
    max_retries: 3 # 最大重试次数
    backoff_multiplier: 2 # 退避倍数

# 会话恢复配置
recovery:
  enabled: true # 启用会话恢复
  backup_enabled: true # 启用 rollout 文件备份
  backup_periodic: false # 定期备份
  backup_interval: 60000 # 备份间隔（毫秒，1 分钟）

# 审批配置
approval:
  queue_enabled: true # 启用审批队列
  batch_operations: true # 启用批量操作
  timeout: 0 # 审批超时（0 = 无限等待）

# 指标配置
metrics:
  enabled: true # 启用指标收集
  export_interval: 300000 # 导出间隔（毫秒，5 分钟）
  retention_period: 86400000 # 保留时长（毫秒，1 天）
```

**agents.yaml**（Agent 定义）：

```yaml
agents:
  - type: codex
    enabled: true
    command_template:
      'codex exec --json -C {{cwd}} --sandbox {{sandbox}} --ask-for-approval
      {{approvalPolicy}}'
    protocol: json-rpc
    event_parser: codex_event_parser
    work_dir_template: '.codex-father/sessions/{{sessionId}}/work'

  - type: claude-code
    enabled: false
    command_template: 'claude code --json-events --cwd {{cwd}}'
    protocol: json-stream
    event_parser: claude_code_event_parser
    work_dir_template: '.codex-father/sessions/{{sessionId}}/work'
```

---

## 接口设计

### 内部接口（模块间通信）

#### ProcessOrchestrator ↔ QueueScheduler

```typescript
// ProcessOrchestrator 从 QueueScheduler 获取任务
const task = await queueScheduler.dequeue();

// 获取可用进程
const process = await processOrchestrator.acquireProcess(task);

// 任务完成后释放进程
await processOrchestrator.releaseProcess(process.id);
```

#### ProcessOrchestrator ↔ SessionRecoveryManager

```typescript
// 进程崩溃时触发恢复
processOrchestrator.on('process-crashed', async (processId) => {
  const sessionId = getSessionIdByProcess(processId);

  // 尝试恢复会话
  try {
    const newProcess = await sessionRecoveryManager.recoverSession(sessionId);
    // 恢复成功，替换旧进程
    await processOrchestrator.replaceProcess(processId, newProcess);
  } catch (error) {
    // 恢复失败，记录错误
    logger.error(`Failed to recover session ${sessionId}: ${error}`);
  }
});
```

#### ApprovalQueue ↔ TerminalUI

```typescript
// ApprovalQueue 发送审批请求到 TerminalUI
approvalQueue.on('approval-needed', async (request: ApprovalRequest) => {
  const queueStatus = approvalQueue.getQueueStatus();

  // 显示队列 UI
  const decision = await terminalUI.promptApprovalWithQueue(
    request,
    queueStatus
  );

  // 处理审批决策
  await approvalQueue.processRequest(decision);
});
```

---

## 技术方案

### 1. 进程池管理技术方案

**方案选择**：动态进程池 + 心跳监控

**实现细节**：

1. **进程启动**：

   ```typescript
   async function startProcess(task: Task): Promise<ManagedProcess> {
     const command = buildCommand(task);
     const child = spawn(command, {
       cwd: task.cwd,
       stdio: ['pipe', 'pipe', 'pipe'],
       env: {
         ...process.env,
         CODEX_HOME: getCodexHome(),
       },
     });

     // 监听事件
     child.on('exit', (code) => {
       if (code !== 0) {
         this.emit('process-crashed', process.id);
       }
     });

     // 创建进程对象
     const managedProcess: ManagedProcess = {
       id: generateId(),
       pid: child.pid,
       status: 'busy',
       conversationId: task.jobId,
       startedAt: new Date(),
       lastActivityAt: new Date(),
       workDir: task.cwd,
       sessionDir: getSessionDir(task.jobId),
     };

     return managedProcess;
   }
   ```

2. **健康检查**：

   ```typescript
   setInterval(() => {
     for (const process of this.processes) {
       // 检查进程是否存活
       const isAlive = checkProcessAlive(process.pid);

       // 检查事件日志是否更新
       const lastActivity = getLastActivityTime(process.sessionDir);
       const timeSinceActivity = Date.now() - lastActivity.getTime();

       if (!isAlive || timeSinceActivity > 30000) {
         // 标记为崩溃
         process.status = 'crashed';
         this.emit('process-crashed', process.id);
       }
     }
   }, 5000);
   ```

3. **进程回收**：

   ```typescript
   setInterval(() => {
     for (const process of this.processes) {
       if (process.status === 'idle') {
         const idleTime = Date.now() - process.lastActivityAt.getTime();

         if (idleTime > this.config.idleTimeout) {
           // 终止空闲进程
           await this.terminateProcess(process.id);
         }
       }
     }
   }, 10000);
   ```

---

### 2. 会话恢复技术方案

**方案选择**：基于 Codex rollout 文件 + 可选备份

**实现细节**：

1. **记录 rollout 文件路径**：

   ```typescript
   async function recordRolloutPath(
     sessionId: string,
     conversationId: string
   ): Promise<void> {
     // 构建 rollout 文件路径
     const rolloutPath = path.join(
       getCodexHome(),
       'sessions',
       `${conversationId}.jsonl`
     );

     // 记录到 rollout-ref.txt
     const refPath = path.join(getSessionDir(sessionId), 'rollout-ref.txt');

     await fs.writeFile(refPath, rolloutPath, 'utf-8');
   }
   ```

2. **恢复会话**：

   ```typescript
   async function recoverSession(sessionId: string): Promise<ManagedProcess> {
     // 1. 读取 rollout 文件路径
     const refPath = path.join(getSessionDir(sessionId), 'rollout-ref.txt');
     const rolloutPath = await fs.readFile(refPath, 'utf-8');

     // 2. 验证文件存在
     if (!(await fs.pathExists(rolloutPath))) {
       throw new Error(`Rollout file not found: ${rolloutPath}`);
     }

     // 3. 可选：备份文件
     if (config.backupEnabled) {
       const backupPath = path.join(
         getSessionDir(sessionId),
         'rollout.backup.jsonl'
       );
       await fs.copyFile(rolloutPath, backupPath);
     }

     // 4. 构建 resume 命令
     const command = `codex exec resume ${sessionId} --json`;

     // 5. 启动进程
     return await this.startProcess({
       ...task,
       command,
     });
   }
   ```

3. **验证 rollout 文件**：

   ```typescript
   async function validateRolloutFile(path: string): Promise<boolean> {
     try {
       // 检查文件存在
       if (!(await fs.pathExists(path))) return false;

       // 检查文件大小（至少 1 字节）
       const stat = await fs.stat(path);
       if (stat.size === 0) return false;

       // 检查 JSONL 格式（读取第一行）
       const content = await fs.readFile(path, 'utf-8');
       const firstLine = content.split('\n')[0];
       JSON.parse(firstLine); // 如果解析失败会抛出异常

       return true;
     } catch (error) {
       return false;
     }
   }
   ```

---

### 3. 并行审批 UI 技术方案

**方案选择**：inquirer + 自定义提示符

**实现细节**：

1. **队列 UI 渲染**：

   ```typescript
   async function promptApprovalWithQueue(
     request: ApprovalRequest,
     queueStatus: ApprovalQueueStatus
   ): Promise<ApprovalDecision> {
     // 构建提示消息
     const message = `
   ┌─────────────────────────────────────────────────────────┐
   │ 审批请求队列 (${queueStatus.currentIndex}/${queueStatus.total})    │
   ├─────────────────────────────────────────────────────────┤
   │ 任务: ${request.jobId}                                  │
   │ 类型: ${request.type}                                   │
   │ 命令: ${request.details.command}                        │
   │ 工作目录: ${request.details.cwd}                        │
   │ 等待时间: ${formatDuration(request.waitingDuration)}   │
   ├─────────────────────────────────────────────────────────┤
   ${renderQueuePreview(queueStatus)}
   ├─────────────────────────────────────────────────────────┤
   │ [A] 批准  [D] 拒绝  [W] 加入白名单  [S] 跳过           │
   │ [B] 批量批准所有 (${queueStatus.pending} pending)      │
   │ [X] 批量拒绝所有 (${queueStatus.pending} pending)      │
   └─────────────────────────────────────────────────────────┘
     `;

     // 显示提示符
     const answer = await inquirer.prompt({
       type: 'input',
       name: 'choice',
       message,
       validate: (input) => {
         return ['A', 'D', 'W', 'S', 'B', 'X'].includes(input.toUpperCase());
       },
     });

     // 处理选择
     return handleChoice(answer.choice, request);
   }
   ```

2. **批量操作**：

   ```typescript
   async function handleBatchOperation(
     operation: 'approve-all' | 'deny-all',
     queueStatus: ApprovalQueueStatus
   ): Promise<void> {
     // 显示确认提示
     const confirmed = await inquirer.confirm({
       message: `确认${operation === 'approve-all' ? '批准' : '拒绝'}所有 ${queueStatus.pending} 个待审批请求？`,
       default: false,
     });

     if (!confirmed) return;

     // 批量处理
     if (operation === 'approve-all') {
       await approvalQueue.batchApproveAll();
     } else {
       await approvalQueue.batchDenyAll();
     }
   }
   ```

---

## 测试策略

### 单元测试

每个核心组件都需要独立的单元测试：

- **ProcessOrchestrator**: 进程启动、停止、健康检查、状态管理
- **QueueScheduler**: 入队、出队、优先级、重试、持久化
- **SessionRecoveryManager**: 文件定位、验证、恢复、备份
- **ApprovalQueue**: 队列管理、批量操作、UI 渲染
- **MetricsCollector**: 事件记录、指标计算、导出

### 集成测试

- **多进程并行执行**: 验证 3 个任务同时运行
- **进程崩溃恢复**: 模拟进程崩溃，验证自动恢复
- **并行审批管理**: 验证多个审批请求排队处理
- **队列持久化**: 验证重启后队列恢复

### 性能测试

- **并发性能**: 验证 4 个并行任务的吞吐量
- **内存占用**: 验证总内存 < 1GB（4 进程）
- **响应时间**: 验证 tools/call < 500ms

---

## 实施计划

### 阶段 1：基础架构（2-3 周）

- [ ] ProcessOrchestrator 实现
- [ ] QueueScheduler 实现
- [ ] 单元测试覆盖率 ≥ 80%

### 阶段 2：会话恢复（1-2 周）

- [ ] SessionRecoveryManager 实现
- [ ] Rollout 文件备份机制
- [ ] 集成测试：崩溃恢复流程

### 阶段 3：并行审批（1-2 周）

- [ ] ApprovalQueue 实现
- [ ] 终端 UI 增强
- [ ] 批量操作功能

### 阶段 4：可观测性（1 周）

- [ ] MetricsCollector 实现
- [ ] 指标导出和查询
- [ ] 性能测试

### 阶段 5：Agent 扩展（可选，1 周）

- [ ] Agent 定义配置
- [ ] 事件解析器接口
- [ ] claude-code 集成示例

---

**文档版本**: 1.0.0 **创建日期**: 2025-10-01 **最后更新**: 2025-10-01
**维护者**: codex-father 团队
