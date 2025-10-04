# 🔍 Codex-Father 能力评估报告

**评估日期**: 2025-10-02 **评估者**: 幽浮喵（浮浮酱）
**评估方法**: 源代码深度分析 + 架构文档验证 **报告版本**: 1.0.0

---

## 📊 核心评估结论

### ⚠️ **当前状态**: 部分满足需求，需要重要扩展

**满足度评分**: **4/10** ⭐⭐⭐⭐☆☆☆☆☆☆

用户需求是一个**复杂的多 Agent 编排系统**，但当前 codex-father 只是一个**单进程 MCP 服务器**。

### 用户核心需求

> "让 codex-father 去完成某个需求，这个需求里面有 10 个任务，都可以并行的，叫 10 个 codex 去完成。要能够检查上下文是否足够，检查下面的 codex 是否能够理解这些任务，并且可以并行配合开发。如果其中一个 codex 说一个任务在开发过程中出现了问题，需要向上反馈调整策略，就需要 codex 反馈 codex-father 再反馈给用户。"

### 需求关键要素

1. **任务分解**: 将大需求分解为 10 个并行子任务
2. **多实例管理**: 同时管理 10 个 Codex 实例
3. **角色配置**: 预定义开发者、审查者、测试等角色
4. **能力差异化**: 不同角色有不同的 MCP 工具、权限、hooks
5. **状态监控**: 实时监控所有 Codex 的工作状态
6. **双向反馈**: Codex → codex-father → 用户的反馈链路

---

## 🧭 codex-father 2.0 Headless Mode 需求摘要

- **模式矩阵**: Headless Mode 是推荐路径，YOLO
  Mode 属于高风险模式，均需工具白名单与权限策略护栏（参见 `docs/prd-006.md:58`
  和 `docs/prd-006.md:88`）。
- **核心价值**: 自动化、可编程、安全可控、可观测是产品四大价值点，评估需对照这些目标衡量差距（参见
  `docs/prd-006.md:35`）。
- **CLI 合规性**: PRD 规定了
  `--allowedTools`、`--permission-mode`、`--output-format`
  等核心参数以及等级化白名单，评估报告中的安全审视需逐条比对（参见
  `docs/prd-006.md:105` 与 `docs/prd-006.md:168`）。
- **业务场景**: 批量处理、智能测试修复、渐进式迁移等脚本示例明确要求并行执行与自主修复能力，是后续差距分析的主锚点（参见
  `docs/prd-006.md:197`）。

---

## ✅ 当前已实现的能力（从源代码确认）

### 1. **MCP 协议服务器** ✅

- **文件**: `core/mcp/server.ts`
- **能力**: 完整的 MCP 协议支持（initialize、tools/list、tools/call、notifications）
- **状态**:
  MVP1 已完成；测试覆盖较多（以 CI/本地测试结果为准，仓库内未直接标注“506 个”）
- **性能目标**: tools/call <
  500ms、事件转发低延迟（代码中未内置基准采集，属目标而非既有测量）

### 2. **单进程 Codex 管理** ✅

- **文件**: `core/process/manager.ts` (`SingleProcessManager`)
- **能力**:
  - 启动单个 `codex mcp` 进程
  - 健康检查和自动重启
  - 进程生命周期管理
  - 进程状态监控（STOPPED/STARTING/READY/RESTARTING）
- **限制**: **仅支持单个进程，无并行能力** ❌

### 3. **会话管理** ✅

- **文件**: `core/session/session-manager.ts`
- **能力**:
  - 创建和管理会话（conversationId ↔ jobId 映射）
  - 会话生命周期管理（INITIALIZING/ACTIVE/IDLE/TERMINATED）
  - 事件日志记录（JSONL 格式）
  - 配置持久化（JSON 格式）
  - 会话目录管理（`.codex-father/sessions/<session-name>-<date>/`）

### 4. **审批机制** ✅

- **文件**:
  - `core/approval/policy-engine.ts` - 策略引擎
  - `core/approval/terminal-ui.ts` - 终端交互 UI
- **能力**:
  - 白名单规则匹配（正则表达式）
  - 终端交互 UI（基于 inquirer）
  - 审批决策（allow/deny）
  - 自动批准/人工审批
  - 审批历史记录

### 5. **角色指令接口预留（待贯通）** ⚠️

- **文件**: `core/mcp/codex-client.ts:32-42`
- **现状**: `CodexNewConversationParams` 确有 `baseInstructions`
  字段，但默认链路未贯通：
  - `BridgeLayer.start-codex-task` 的输入架构未包含 `baseInstructions`
  - `SessionManager.createSession()` 调用 `newConversation()` 时未传递该参数
  - 因此通过 MCP 默认工具目前无法生效
  ```typescript
  export interface CodexNewConversationParams {
    model?: string;
    profile?: string;
    cwd?: string;
    approvalPolicy?: 'untrusted' | 'on-request' | 'on-failure' | 'never';
    sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access';
    config?: Record<string, unknown>;
    baseInstructions?: string; // 接口已预留，但默认桥接未透传
    includePlanTool?: boolean;
    includeApplyPatchTool?: boolean;
  }
  ```
- **意义**: 为后续角色差异化提供了接口基础，但需先扩展 MCP 工具与会话创建逻辑方可对外可用。

### 6. **事件系统** ✅

- **文件**:
  - `core/session/event-logger.ts` - 事件日志记录器
  - `core/mcp/event-mapper.ts` - 事件映射器
- **能力**:
  - JSONL 格式事件日志
  - Codex event → MCP notification 转换
  - jobId 关联
- **注意**: 事件落盘未实现自动“脱敏/屏蔽”，`maskSensitive`
  仅用于配置查看命令的输出渲染，非事件日志路径。

### 7. **数据持久化** ✅

- **文件**: `core/session/config-persister.ts`
- **能力**:
  - 会话配置 JSON 持久化
  - rollout-ref.txt 记录（用于 MVP2 会话恢复）
  - 结构化日志存储

---

## ❌ 当前缺失的能力（用户需求对比）

### 1. **任务分解和编排能力** ❌

**用户需求**: 将一个大需求分解为 10 个并行子任务

**PRD 要求**: 场景矩阵与并行脚本强调在 CI/CD 中自动拆分并并行执行多文件任务（参见
`docs/prd-006.md:197` 和 `docs/prd-006.md:638`）。

**现状**:

- ❌ 没有找到 `TaskDecomposer`、`Orchestrator`、`Coordinator` 相关代码
- ❌ 没有任务依赖关系管理
- ❌ 没有任务分配和调度逻辑
- ❌ 没有任务拆分算法

**代码搜索结果**:

```bash
# 搜索 orchestrator/coordinator 相关代码
grep -r "orchestrat\|coordinat" core/
# 结果：仅在 bridge-layer.ts 中有注释提及，无实际实现
```

**评分**: 0/10 （完全缺失）

**缺口分析**:

- 需要新增 `TaskOrchestrator` 模块，负责任务分解逻辑
- 需要定义任务依赖关系（DAG 图）
- 需要实现任务调度算法

---

### 2. **多 Codex 实例并行管理** ❌

**用户需求**: 同时管理 10 个 Codex 实例并行执行

**PRD 要求**: Headless
Mode 的模式对比表要求在无人工干预前提下完成多任务批处理，需并发的工具授权与输出编排（参见
`docs/prd-006.md:88`）。

**现状**:

- ❌ 当前只有 `SingleProcessManager`（单进程模式）
- ❌ MVP2 的 `ProcessOrchestrator`（多进程池）在设计文档中，但**未实现**
- ❌ 没有进程池实现代码
- ❌ 没有多进程调度器

**代码搜索结果**:

```bash
# 搜索多进程相关实现
grep -r "multi.*codex\|codex.*pool\|process.*pool" core/
# 结果：无相关实现
```

**MVP2 规划状态**:

- 📋 设计文档在归档目录：`docs/_archive/mvp2-spec.md`、`docs/_archive/mvp2-prd.md`
- ❌ 实现代码未开始（规划阶段）
- 📅 预计开发周期：2-3 周（依据规划文档）

**评分**: 0/10 （MVP2 规划中，但未实现）

**缺口分析**:

- 需要实现 `ProcessOrchestrator` 类（管理进程池）
- 需要实现进程分配算法（空闲进程选择）
- 需要实现进程健康监控（心跳检测）
- 需要实现进程崩溃恢复机制

---

### 3. **预定义角色配置系统** ❌

**用户需求**: 预定义的开发者、审查者、测试等角色

**PRD 要求**: CLI 参数中要求通过 `--allowedTools`、`--permission-mode`
组合出受控角色，YOLO Mode 明确禁止缺乏护栏的默认模式（参见 `docs/prd-006.md:105`
和 `docs/prd-006.md:88`）。

**现状**:

- ⚠️ `baseInstructions` 仅在客户端类型定义中存在，默认 MCP 工具链路未暴露/未透传
- ❌ 没有预定义的角色模板系统
- ❌ 没有角色配置文件或数据库
- ❌ 没有角色管理模块

**代码搜索结果**:

```bash
# 搜索角色定义相关代码
grep -r "role.*config\|role.*definition\|agent.*role" core/
# 结果：无相关实现
```

**评分**: 2/10 （接口预留但未对外可用，需要桥接与管理层能力）

**缺口分析**:

- 需要新增 `RoleManager` 模块
- 需要设计角色配置文件格式（YAML/JSON）
- 需要定义标准角色模板（developer, reviewer, tester, etc.）
- 需要实现角色实例化逻辑

**示例角色配置**（建议格式）:

```yaml
# .codex-father/config/roles.yaml
roles:
  developer:
    name: '专业开发者'
    baseInstructions: |
      你是一位经验丰富的软件工程师，擅长编写高质量、可维护的代码。
      你的职责是：
      1. 理解需求并设计技术方案
      2. 编写符合 SOLID 原则的代码
      3. 确保代码通过所有测试
    model: 'gpt-5'
    approvalPolicy: 'on-request'
    sandbox: 'workspace-write'
    mcpTools: ['read-file', 'write-file', 'exec-command']

  reviewer:
    name: '代码审查专家'
    baseInstructions: |
      你是一位资深代码审查者，专注于发现代码质量问题。
      你的职责是：
      1. 检查代码是否符合最佳实践
      2. 发现潜在的 bug 和性能问题
      3. 提出改进建议
    model: 'gpt-5'
    approvalPolicy: 'untrusted'
    sandbox: 'read-only'
    mcpTools: ['read-file', 'grep', 'git-diff']

  tester:
    name: '测试工程师'
    baseInstructions: |
      你是一位专业测试工程师，负责确保软件质量。
      你的职责是：
      1. 设计测试用例
      2. 编写自动化测试
      3. 执行测试并报告问题
    model: 'gpt-5'
    approvalPolicy: 'on-request'
    sandbox: 'workspace-write'
    mcpTools: ['read-file', 'write-file', 'exec-command', 'run-tests']
```

---

### 4. **能力差异化配置** ❌

**用户需求**: 不同角色有不同的 MCP 工具、权限、hooks 脚本

**PRD 要求**: 权限模式与工具白名单分级需要根据角色场景动态切换（参见
`docs/prd-006.md:157` 和 `docs/prd-006.md:170`）。

**现状**:

- ❌ 没有角色级别的 MCP 工具配置
- ❌ 没有角色级别的权限管理
- ❌ 没有 hooks 脚本集成机制
- ✅ 有基础的 `sandbox` 和 `approvalPolicy` 配置

**评分**: 2/10 （仅有基础沙箱配置）

**缺口分析**:

- 需要实现 MCP 工具动态注册/注销
- 需要实现角色级工具白名单
- 需要集成 hooks 脚本系统（类似 git hooks）
- 需要实现细粒度权限控制

**示例能力差异化**（目标设计）:

```typescript
interface RoleCapabilities {
  mcpTools: string[]; // 允许使用的 MCP 工具
  filePermissions: {
    // 文件访问权限
    read: string[]; // 可读路径模式
    write: string[]; // 可写路径模式
    execute: string[]; // 可执行路径模式
  };
  approvalPolicy: ApprovalMode;
  sandbox: SandboxPolicy;
  hooks?: {
    // 角色专属 hooks
    onTaskStart?: string; // 任务开始时执行的脚本
    onTaskComplete?: string; // 任务完成时执行的脚本
    onError?: string; // 错误时执行的脚本
  };
  resourceLimits?: {
    // 资源限制
    maxMemory?: number;
    maxCpu?: number;
    timeout?: number;
  };
}
```

---

### 5. **任务状态维护和监控** ⚠️ 部分实现

**用户需求**: 实时监控 10 个 Codex 的工作状态

**PRD 要求**: 输出格式系统必须支撑 JSON 与 Stream-JSON 以供监控系统消费，保障可观测性（参见
`docs/prd-006.md:77` 与 `docs/prd-006.md:151`）。

**现状**:

- ✅ 有事件日志系统（`EventLogger`）
- ✅ 有会话状态管理（`SessionStatus`）
- ❌ 没有全局任务编排状态
- ❌ 没有实时进度聚合
- ❌ 没有可视化监控界面

**评分**: 4/10 （单会话状态可查，但无全局视图）

**缺口分析**:

- 需要实现 `OrchestratorStatus` 全局状态管理
- 需要实现多任务进度聚合
- 需要实现实时状态推送（WebSocket/SSE）
- 需要实现监控 Dashboard（可选）

**示例全局状态**（目标设计）:

```typescript
interface OrchestratorStatus {
  orchestrationId: string;
  totalTasks: number;
  completedTasks: number;
  runningTasks: number;
  failedTasks: number;
  tasks: {
    [taskId: string]: {
      role: string;
      status: 'pending' | 'running' | 'completed' | 'failed';
      progress: number; // 0-100
      codexInstance: {
        pid: number;
        conversationId: string;
        startTime: Date;
        lastActivity: Date;
      };
      logs: string[];
    };
  };
  dependencies: {
    [taskId: string]: string[]; // 任务依赖关系
  };
  startTime: Date;
  estimatedCompletion?: Date;
}
```

---

### 6. **双向反馈和策略调整** ❌

**用户需求**: Codex 反馈问题 → codex-father 调整策略 → 反馈给用户

**PRD 要求**: 自动化脚本在失败时需回滚或报告，尤其是智能测试修复场景对反馈链路有显式描述（参见
`docs/prd-006.md:229` 和 `docs/prd-006.md:895`）。

**现状**:

- ✅ Codex → codex-father 的事件通知（通过 MCP `codex/event`）
- ✅ 审批机制（execCommandApproval、applyPatchApproval）
- ❌ 没有策略动态调整机制
- ❌ 没有反馈分析和决策系统
- ❌ 没有用户反馈上报机制

**评分**: 2/10 （仅有单向事件接收）

**缺口分析**:

- 需要实现 `FeedbackHandler` 模块
- 需要实现问题分析引擎
- 需要实现策略调整规则
- 需要实现用户通知机制

**示例反馈处理流程**（目标设计）:

```typescript
interface FeedbackHandler {
  // 1. 接收 Codex 反馈
  onCodexFeedback(event: CodexEvent): void {
    const problem = this.analyzeProblem(event);
    const strategy = this.adjustStrategy(problem);
    this.reportToUser(strategy);
  }

  // 2. 分析问题
  analyzeProblem(event: CodexEvent): Problem {
    // 识别问题类型：依赖缺失、权限不足、上下文不足等
    // 分析影响范围：单任务还是全局
    // 评估严重程度：可自动修复还是需要人工介入
  }

  // 3. 调整策略
  adjustStrategy(problem: Problem): Strategy {
    // 自动修复：安装依赖、调整权限、增加上下文
    // 任务重分配：将任务分配给其他 Codex
    // 策略调整：修改审批策略、沙箱策略
  }

  // 4. 上报用户
  reportToUser(strategy: Strategy): void {
    // 通过 MCP notification 通知外部客户端
    // 记录到日志
    // 可选：暂停执行等待用户决策
  }
}
```

---

## 🎯 用户需求 vs 当前能力对比表

| 需求项           | 重要性     | 当前状态      | 评分 | 实现文件                                            | 缺口说明                         |
| ---------------- | ---------- | ------------- | ---- | --------------------------------------------------- | -------------------------------- |
| **任务分解能力** | ⭐⭐⭐⭐⭐ | ❌ 完全缺失   | 0/10 | 无                                                  | 需要新增 `TaskOrchestrator` 模块 |
| **多实例并行**   | ⭐⭐⭐⭐⭐ | ❌ 单进程限制 | 0/10 | `core/process/manager.ts` (仅单进程)                | MVP2 规划中，未实现              |
| **角色配置**     | ⭐⭐⭐⭐   | ⚠️ 接口预留   | 2/10 | `core/mcp/codex-client.ts:39`（未贯通）             | 需桥接/会话层透传与角色模板系统  |
| **能力差异化**   | ⭐⭐⭐⭐   | ❌ 基础配置   | 2/10 | `core/mcp/codex-client.ts` (sandbox/approvalPolicy) | 需要角色级工具/权限管理          |
| **状态维护**     | ⭐⭐⭐     | ⚠️ 部分支持   | 4/10 | `core/session/session-manager.ts`                   | 需要全局编排状态                 |
| **双向反馈**     | ⭐⭐⭐     | ❌ 单向接收   | 2/10 | `core/mcp/event-mapper.ts`                          | 需要策略调整引擎                 |

**综合评分**: **≈1.5 / 10** （按重要性加权的估算值）

**关键瓶颈**:

1. **并行能力**: 当前单进程限制是最大瓶颈
2. **编排能力**: 缺少任务分解和调度逻辑
3. **角色系统**: 虽有基础参数，但无完整角色管理

---

## 📈 性能与验证目标

| 场景                   | 平均耗时 | P95 耗时 | 目标成本 | PRD 参考              |
| ---------------------- | -------- | -------- | -------- | --------------------- |
| 代码审查 (200 行)      | 8s       | 15s      | $0.02    | `docs/prd-006.md:961` |
| 测试修复 (5 个失败)    | 25s      | 45s      | $0.08    | `docs/prd-006.md:962` |
| 文档生成 (10 个函数)   | 12s      | 20s      | $0.03    | `docs/prd-006.md:963` |
| 类型迁移 (1 个文件)    | 18s      | 30s      | $0.05    | `docs/prd-006.md:964` |
| 大规模重构 (50 个文件) | 5min     | 8min     | $0.50    | `docs/prd-006.md:965` |

**现状差距**:

- ❌ 尚无性能基准或统计数据，与 PRD 目标脱节
- ❌ 无成本度量与追踪机制，无法验证高强度批处理的资源预算
- ⚠️ 需要建立可观测性链路，将 Stream-JSON 事件汇聚后再计算 P95 指标

**后续行动**:

1. 在多任务编排 MVP 中引入性能采集 hook，输出 JSON 指标
2. 基于 `tests/mcp_ts_e2e.sh` 拓展性能测试脚本，对照 PRD 场景矩阵
3. 将成本估算字段写入会话日志，便于回填表格

---

## 🔄 与 PRD 对齐的优先级

1. **并行执行与任务编排**: 直接支撑 CI/CD 批处理与测试修复脚本，优先级最高（参见
   `docs/prd-006.md:197`）。
2. **安全与权限护栏**: 对应模式矩阵与权限分级，保障 Headless/YOLO 模式的可控落地（参见
   `docs/prd-006.md:88` 与 `docs/prd-006.md:157`）。
3. **角色模板与差异化能力**: 使开发者、审查者、测试角色的 `--allowedTools`
   与审批模式可配置（参见 `docs/prd-006.md:105`）。
4. **可观测性与反馈回路**: 满足 Stream-JSON、自动回滚和策略调整的业务流程（参见
   `docs/prd-006.md:151` 与 `docs/prd-006.md:895`）。
5. **性能与成本监控**: 对齐 PRD 给出的基准表与资源链接，确保上线后可量化（参见
   `docs/prd-006.md:961` 与 `docs/prd-006.md:969`）。

---

## 💡 实现用户需求的改进建议

### 🎯 方案 A: 基于当前架构扩展（推荐 ⭐⭐⭐⭐）

**优点**:

- 充分利用现有架构和代码
- 保持代码质量和测试覆盖率
- 符合项目长期规划（MVP2）

**缺点**:

- 开发周期较长（5-8 周）
- 需要深入理解现有架构

#### 新增模块清单

##### 1. **任务编排层** (TaskOrchestrator)

```typescript
// 新文件: core/orchestrator/task-orchestrator.ts
interface TaskOrchestrator {
  // 分解任务
  decomposeTasks(requirement: string): Task[] {
    // 1. 分析需求（使用 LLM 或规则引擎）
    // 2. 识别任务边界
    // 3. 确定任务依赖关系
    // 4. 生成任务 DAG 图
  }

  // 分配角色
  assignRoles(tasks: Task[]): RoleAssignment[] {
    // 1. 根据任务类型匹配角色
    // 2. 负载均衡（避免某个角色过载）
    // 3. 考虑任务依赖关系
  }

  // 并行执行
  executeParallel(assignments: RoleAssignment[]): Promise<void> {
    // 1. 按照 DAG 图拓扑排序
    // 2. 并行启动无依赖的任务
    // 3. 等待依赖任务完成后启动下游任务
    // 4. 收集所有任务结果
  }

  // 监控状态
  monitorProgress(): OrchestratorStatus {
    // 1. 聚合所有任务状态
    // 2. 计算总体进度
    // 3. 检测死锁和循环依赖
  }
}

interface Task {
  id: string;
  description: string;
  roleType: 'developer' | 'reviewer' | 'tester';
  dependencies: string[];  // 依赖的任务 ID
  estimatedDuration: number;
  priority: number;
}

interface RoleAssignment {
  taskId: string;
  role: RoleDefinition;
  codexInstance?: string;  // 分配的 Codex 实例 ID
}
```

##### 2. **角色管理系统** (RoleManager)

```typescript
// 新文件: core/orchestrator/role-manager.ts
interface RoleDefinition {
  name: string;               // "developer" | "reviewer" | "tester"
  displayName: string;        // "专业开发者"
  baseInstructions: string;   // 角色专属指令
  model?: string;             // 覆盖默认模型
  mcpTools: string[];         // 角色可用的 MCP 工具
  approvalPolicy: ApprovalMode;
  sandbox: SandboxPolicy;
  hooks?: {                   // 角色专属 hooks
    onTaskStart?: string;
    onTaskComplete?: string;
    onError?: string;
  };
  capabilities?: {            // 能力限制
    maxConcurrentTasks?: number;
    resourceLimits?: {
      maxMemory?: number;
      maxCpu?: number;
      timeout?: number;
    };
  };
}

interface RoleManager {
  // 加载角色配置
  loadRoles(configPath: string): void {
    // 从 YAML/JSON 文件加载角色定义
    // 验证配置格式
    // 缓存到内存
  }

  // 获取角色定义
  getRole(name: string): RoleDefinition {
    // 从缓存中获取角色定义
    // 如果不存在，返回默认角色
  }

  // 创建角色实例
  createRoleInstance(role: string, task: Task): CodexInstance {
    // 1. 获取角色定义
    // 2. 准备 baseInstructions
    // 3. 配置 MCP 工具白名单
    // 4. 创建 Codex 进程
    // 5. 返回实例引用
  }

  // 列出所有角色
  listRoles(): RoleDefinition[] {
    // 返回所有已注册的角色
  }
}
```

##### 3. **多进程管理器** (MultiProcessManager)

```typescript
// 修改: core/process/manager.ts
class MultiProcessManager {
  private processPool: Map<string, CodexProcess>;
  private maxProcesses: number;
  private idleProcesses: Set<string>;
  private busyProcesses: Set<string>;

  // 启动进程池
  async startPool(size: number): Promise<void> {
    // 1. 创建指定数量的 Codex 进程
    // 2. 初始化健康检查
    // 3. 标记为空闲状态
  }

  // 分配任务到进程
  async assignTask(task: Task, role: RoleDefinition): Promise<CodexProcess> {
    // 1. 从空闲进程池获取进程
    // 2. 如果没有空闲进程，等待或创建新进程
    // 3. 配置进程角色
    // 4. 标记为繁忙状态
    // 5. 返回进程引用
  }

  // 释放进程
  async releaseProcess(processId: string): Promise<void> {
    // 1. 清理进程状态
    // 2. 移回空闲进程池
  }

  // 监控所有进程
  monitorAll(): ProcessPoolStatus {
    // 1. 聚合所有进程状态
    // 2. 计算资源使用率
    // 3. 检测异常进程
  }

  // 健康检查
  healthCheck(): void {
    // 1. 检查进程存活状态
    // 2. 检查进程响应速度
    // 3. 检查资源使用情况
    // 4. 崩溃进程重启或移除
  }
}

interface CodexProcess {
  id: string;
  pid: number;
  status: 'idle' | 'busy' | 'crashed' | 'terminated';
  role?: RoleDefinition;
  conversationId?: string;
  startedAt: Date;
  lastActivityAt: Date;
  workDir: string;
  sessionDir: string;
  resourceUsage?: {
    cpu: number;
    memory: number;
  };
}

interface ProcessPoolStatus {
  total: number;
  idle: number;
  busy: number;
  crashed: number;
  queueLength: number;
  avgCpuUsage: number;
  avgMemoryUsage: number;
}
```

##### 4. **反馈处理器** (FeedbackHandler)

```typescript
// 新文件: core/orchestrator/feedback-handler.ts
interface FeedbackHandler {
  // 接收 Codex 反馈
  onCodexFeedback(event: CodexEvent): void {
    const problem = this.analyzeProblem(event);

    if (problem.canAutoResolve) {
      const strategy = this.adjustStrategy(problem);
      this.applyStrategy(strategy);
    } else {
      this.reportToUser(problem);
    }
  }

  // 分析问题
  analyzeProblem(event: CodexEvent): Problem {
    // 识别问题类型
    const type = this.classifyProblem(event);

    // 分析影响范围
    const scope = this.analyzeScope(event);

    // 评估严重程度
    const severity = this.assessSeverity(event);

    return { type, scope, severity, canAutoResolve: this.canResolve(type) };
  }

  // 问题分类
  classifyProblem(event: CodexEvent): ProblemType {
    // 常见问题类型：
    // - DEPENDENCY_MISSING: 缺少依赖
    // - PERMISSION_DENIED: 权限不足
    // - CONTEXT_INSUFFICIENT: 上下文不足
    // - RESOURCE_EXHAUSTED: 资源耗尽
    // - SYNTAX_ERROR: 语法错误
    // - LOGIC_ERROR: 逻辑错误
  }

  // 调整策略
  adjustStrategy(problem: Problem): Strategy {
    switch (problem.type) {
      case 'DEPENDENCY_MISSING':
        return { action: 'INSTALL_DEPENDENCY', params: {...} };
      case 'PERMISSION_DENIED':
        return { action: 'ADJUST_PERMISSION', params: {...} };
      case 'CONTEXT_INSUFFICIENT':
        return { action: 'ADD_CONTEXT', params: {...} };
      case 'RESOURCE_EXHAUSTED':
        return { action: 'REALLOCATE_RESOURCE', params: {...} };
      default:
        return { action: 'REPORT_TO_USER', params: {...} };
    }
  }

  // 应用策略
  applyStrategy(strategy: Strategy): void {
    // 执行策略调整
    // 记录日志
    // 通知相关任务
  }

  // 上报用户
  reportToUser(problem: Problem): void {
    // 通过 MCP notification 通知外部客户端
    // 包含问题描述、影响范围、建议操作
    // 等待用户决策（可选）
  }
}

interface Problem {
  type: ProblemType;
  scope: 'task' | 'role' | 'global';
  severity: 'low' | 'medium' | 'high' | 'critical';
  canAutoResolve: boolean;
  details: Record<string, unknown>;
}

interface Strategy {
  action: string;
  params: Record<string, unknown>;
  rollback?: () => void;
}
```

##### 5. **全局状态管理** (StateManager)

```typescript
// 新文件: core/orchestrator/state-manager.ts
interface StateManager {
  // 创建编排会话
  createOrchestration(requirement: string): Orchestration {
    const id = generateId();
    const orchestration: Orchestration = {
      id,
      requirement,
      tasks: [],
      status: 'initializing',
      createdAt: new Date(),
    };
    this.orchestrations.set(id, orchestration);
    return orchestration;
  }

  // 更新任务状态
  updateTaskStatus(orchestrationId: string, taskId: string, status: TaskStatus): void {
    const orchestration = this.orchestrations.get(orchestrationId);
    const task = orchestration.tasks.find(t => t.id === taskId);
    task.status = status;
    task.updatedAt = new Date();
    this.emitStateChange(orchestration);
  }

  // 获取全局状态
  getOrchestrationStatus(id: string): OrchestratorStatus {
    const orchestration = this.orchestrations.get(id);
    return {
      orchestrationId: id,
      totalTasks: orchestration.tasks.length,
      completedTasks: orchestration.tasks.filter(t => t.status === 'completed').length,
      runningTasks: orchestration.tasks.filter(t => t.status === 'running').length,
      failedTasks: orchestration.tasks.filter(t => t.status === 'failed').length,
      tasks: this.getTaskDetails(orchestration.tasks),
      dependencies: this.getDependencyGraph(orchestration.tasks),
      startTime: orchestration.createdAt,
      estimatedCompletion: this.estimateCompletion(orchestration),
    };
  }

  // 实时推送状态更新
  emitStateChange(orchestration: Orchestration): void {
    // 通过 EventEmitter 推送状态变化
    // 外部可以订阅状态更新
    this.emit('state-change', this.getOrchestrationStatus(orchestration.id));
  }
}

interface Orchestration {
  id: string;
  requirement: string;
  tasks: Task[];
  status: 'initializing' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}
```

#### 实施路径（方案 A）

**阶段 1: MVP2 基础（2-3 周）** - 前置依赖

- [ ] 实现 `ProcessOrchestrator`（多进程池管理）
- [ ] 实现 `QueueScheduler`（任务队列）
- [ ] 实现会话恢复机制（基于 rollout 文件）
- [ ] 单元测试覆盖率 ≥ 80%

**阶段 2: 编排系统核心（2-3 周）** ⭐ 核心功能

- [ ] 实现 `TaskOrchestrator`（任务分解和编排）
- [ ] 实现 `RoleManager`（角色配置系统）
- [ ] 实现 `StateManager`（全局状态管理）
- [ ] 实现任务依赖关系（DAG 图）
- [ ] 集成测试：并行执行 10 个任务

**阶段 3: 能力增强（1-2 周）**

- [ ] 实现 `FeedbackHandler`（双向反馈）
- [ ] 实现角色级 MCP 工具配置
- [ ] 实现 Hooks 脚本集成
- [ ] 实现资源限制和监控

**阶段 4: 优化和文档（1 周）**

- [ ] 性能优化（并发数、内存占用）
- [ ] 监控 Dashboard（可选）
- [ ] 完整文档和示例
- [ ] 用户指南

**总计**: 6-9 周开发周期

---

### 🚀 方案 B: 利用现有能力的快速实现（权宜之计 ⭐⭐）

**优点**:

- 快速验证想法（1-2 周）
- 无需修改核心代码
- 可作为方案 A 的过渡方案

**缺点**:

- 功能受限（非真正并行）
- 需要手动配置和维护
- 扩展性差

#### 实施方案

##### 1. **外部任务分解脚本**

```javascript
// 新文件: scripts/orchestrate-tasks.js
const roles = {
  developer: {
    baseInstructions: `你是一位专业软件工程师，负责编写高质量代码。
职责：
1. 理解需求并设计技术方案
2. 编写符合 SOLID 原则的代码
3. 确保代码通过所有测试

当前任务上下文：
- 项目：{{projectName}}
- 技术栈：{{techStack}}
- 依赖任务：{{dependencies}}
`,
    approvalPolicy: 'on-request',
    sandbox: 'workspace-write',
  },

  reviewer: {
    baseInstructions: `你是一位资深代码审查者，专注于发现代码质量问题。
职责：
1. 检查代码是否符合最佳实践
2. 发现潜在的 bug 和性能问题
3. 提出改进建议

审查重点：
- 代码质量和可读性
- 潜在的安全隐患
- 性能优化建议
`,
    approvalPolicy: 'untrusted',
    sandbox: 'read-only',
  },

  tester: {
    baseInstructions: `你是一位专业测试工程师，负责确保软件质量。
职责：
1. 设计测试用例
2. 编写自动化测试
3. 执行测试并报告问题

测试范围：
- 单元测试
- 集成测试
- 边界情况测试
`,
    approvalPolicy: 'on-request',
    sandbox: 'workspace-write',
  },
};

// 手动分解任务
function decomposeTasks(requirement) {
  // 这里需要手动分解任务
  // 或者使用 LLM API 辅助分解
  return [
    {
      id: 'task-1',
      description: '设计数据模型',
      role: 'developer',
      dependencies: [],
    },
    {
      id: 'task-2',
      description: '实现 API 接口',
      role: 'developer',
      dependencies: ['task-1'],
    },
    {
      id: 'task-3',
      description: '编写单元测试',
      role: 'tester',
      dependencies: ['task-2'],
    },
    {
      id: 'task-4',
      description: '代码审查',
      role: 'reviewer',
      dependencies: ['task-2'],
    },
    // ... 更多任务
  ];
}

// 启动任务编排
async function orchestrate(requirement) {
  const tasks = decomposeTasks(requirement);

  // 按依赖关系执行任务
  for (const task of tasks) {
    // 等待依赖任务完成
    await waitForDependencies(task.dependencies);

    // 获取角色配置
    const role = roles[task.role];

    // 准备角色说明并拼入 prompt（当前 MCP 工具未支持 baseInstructions 透传）
    const roleText = role.baseInstructions
      .replace('{{projectName}}', 'codex-father')
      .replace('{{techStack}}', 'TypeScript + Node.js')
      .replace('{{dependencies}}', task.dependencies.join(', '));
    const fullPrompt = `${roleText}\n\n任务：${task.description}`;

    // 启动 Codex 实例（调用 MCP）
    await mcpClient.call('start-codex-task', {
      prompt: fullPrompt,
      approvalPolicy: role.approvalPolicy,
      sandbox: role.sandbox,
    });
  }
}
```

##### 2. **多实例启动脚本**（串行模拟并行）

```bash
#!/bin/bash
# 新文件: scripts/start-multi-codex.sh

# 配置
MAX_PARALLEL=10
TASKS_FILE="tasks.json"

# 读取任务列表
tasks=$(cat $TASKS_FILE | jq -r '.[] | @base64')

# 启动多个 codex-father 实例（不同端口）
current=0
for task in $tasks; do
  if [ $current -ge $MAX_PARALLEL ]; then
    # 等待某个任务完成
    wait -n
    current=$((current - 1))
  fi

  # 解码任务
  task_json=$(echo "$task" | base64 -d)
  task_id=$(echo "$task_json" | jq -r '.id')
  task_prompt=$(echo "$task_json" | jq -r '.description')
  task_role=$(echo "$task_json" | jq -r '.role')

  # 后台启动任务
  (
    PORT=$((3000 + current))
    echo "Starting task $task_id on port $PORT with role $task_role"

    mcp-client --port $PORT start-codex-task \
      --prompt "$task_prompt" \
      --role "$task_role" \
      > "logs/$task_id.log" 2>&1

    echo "Task $task_id completed"
  ) &

  current=$((current + 1))
done

# 等待所有任务完成
wait
echo "All tasks completed"
```

##### 3. **状态监控脚本**

```javascript
// 新文件: scripts/monitor-tasks.js
const fs = require('fs');
const path = require('path');

// 监控任务状态
function monitorTasks(tasksDir) {
  setInterval(() => {
    const tasks = fs.readdirSync(tasksDir);
    const status = {
      total: tasks.length,
      running: 0,
      completed: 0,
      failed: 0,
    };

    tasks.forEach((taskId) => {
      const sessionDir = path.join(tasksDir, taskId);
      const eventsFile = path.join(sessionDir, 'events.jsonl');

      if (fs.existsSync(eventsFile)) {
        const events = fs
          .readFileSync(eventsFile, 'utf-8')
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line));

        const lastEvent = events[events.length - 1];

        if (lastEvent.type === 'codex-task-complete') {
          status.completed++;
        } else if (lastEvent.type === 'codex-task-error') {
          status.failed++;
        } else {
          status.running++;
        }
      }
    });

    console.clear();
    console.log('=== Task Orchestration Status ===');
    console.log(`Total: ${status.total}`);
    console.log(`Running: ${status.running}`);
    console.log(`Completed: ${status.completed}`);
    console.log(`Failed: ${status.failed}`);
    console.log(
      `Progress: ${Math.round((status.completed / status.total) * 100)}%`
    );
  }, 2000);
}

monitorTasks('.codex-father/sessions');
```

#### 实施路径（方案 B）

**第 1 周：快速验证**

- [ ] 编写任务分解脚本
- [ ] 编写多实例启动脚本
- [ ] 编写状态监控脚本
- [ ] 测试 10 个任务的串行执行
- [ ] 临时以“角色指令 + 任务描述”合并构造 prompt；如需参数化 baseInstructions，先扩展 MCP 工具与会话创建透传

**第 2 周：优化和文档**

- [ ] 优化脚本性能
- [ ] 添加错误处理
- [ ] 编写使用文档
- [ ] 收集用户反馈

---

## 📊 方案对比

| 对比项       | 方案 A（架构扩展）   | 方案 B（快速实现） |
| ------------ | -------------------- | ------------------ |
| **开发周期** | 6-9 周               | 1-2 周             |
| **真正并行** | ✅ 是（MVP2 进程池） | ❌ 否（串行模拟）  |
| **任务分解** | ✅ 自动化            | ⚠️ 手动或半自动    |
| **角色管理** | ✅ 完整系统          | ⚠️ 配置文件        |
| **状态监控** | ✅ 实时全局视图      | ⚠️ 简单日志查看    |
| **双向反馈** | ✅ 智能策略调整      | ❌ 手动处理        |
| **扩展性**   | ✅ 高                | ❌ 低              |
| **维护成本** | ⚠️ 中等              | ✅ 低              |
| **代码质量** | ✅ 高                | ⚠️ 中              |
| **风险**     | ⚠️ 技术复杂度高      | ✅ 低              |

---

## 🎯 最终建议

### 推荐实施策略：**分阶段混合方案** ⭐⭐⭐⭐⭐

#### 第一阶段（短期，1-2 周）：快速验证

使用**方案 B**快速实现并验证概念：

1. ✅ 在未扩展 MCP 工具前，将“角色指令”合并到 prompt 开头作为临时方案；如需参数化，先扩展
   `start-codex-task` 与会话创建以透传 `baseInstructions`
2. ✅ 外部脚本实现任务分解
3. ✅ 多实例串行模拟并行（验证可行性）
4. ✅ 收集真实使用反馈

**目标**: 快速验证需求的可行性和实用性

#### 第二阶段（中期，2-3 周）：MVP2 基础

完成 MVP2 核心功能（多进程池）：

1. ✅ 实现 `ProcessOrchestrator`（真正并行）
2. ✅ 实现 `QueueScheduler`（任务队列）
3. ✅ 实现会话恢复机制
4. ✅ 充分测试和文档

**目标**: 建立并行执行的基础能力

#### 第三阶段（中期，2-3 周）：编排系统

实施**方案 A**的核心功能：

1. ✅ 实现 `TaskOrchestrator`（任务分解和编排）
2. ✅ 实现 `RoleManager`（角色管理系统）
3. ✅ 实现 `StateManager`（全局状态管理）
4. ✅ 集成测试：并行执行 10 个任务

**目标**: 实现完整的多 Agent 编排能力

#### 第四阶段（长期，1-2 周）：能力增强

根据实际使用反馈优化：

1. ✅ 实现 `FeedbackHandler`（双向反馈）
2. ✅ 角色级工具和权限配置
3. ✅ Hooks 脚本集成
4. ✅ 监控和可视化

**目标**: 完善用户体验和运维能力

---

## 📌 关键风险提示

### 1. **技术复杂度高** (￣^￣)

**风险**: 多进程编排 + 角色管理 + 反馈机制，比 MVP1/MVP2 复杂度高 3-5 倍

**缓解措施**:

- 分阶段实施，每个阶段充分测试
- 保持高测试覆盖率（≥ 80%）
- 严格代码审查（SOLID 原则）
- 详细的架构文档

### 2. **Codex CLI 限制** (@\_@;)

**风险**: 如果 Codex
CLI 本身不支持某些功能（如并行、hooks），codex-father 也无能为力

**缓解措施**:

- 提前验证 Codex CLI 的能力边界
- 阅读 Codex 官方文档和源代码
- 准备降级方案（如使用外部脚本）

### 2.1 **MCP 会话并发局限**（重要）

**风险**: 通过单一 `codex mcp`
进程承载多会话，在高并发场景下存在调度与隔离局限：会话复用同一进程，难以做到作业级资源隔离与崩溃隔离，也不利于按任务粒度做超时、限流与熔断。

**建议与缓解**:

- 并发与隔离优先采用“无头/非交互”链路：`codex exec --json`（每作业独立进程），天然具备多实例并行与隔离能力；需要恢复可用
  `codex exec resume`。
- 在 MVP2 引入进程池：由进程编排器统一调度多个 `codex exec` 进程（参见
  `docs/_archive/mvp2-spec.md`），结合队列/优先级/超时/重试策略实现稳定并发。
- MCP 模式建议用于轻量、单作业交互；重负载/需隔离/需恢复的任务切换到
  `codex exec` 无头模式。

  官方参数与示例（依据 refer-research/openai-codex 文档汇总）:
  - 只读、无审批（CI 推荐）
    - 命令：`codex exec --sandbox read-only --ask-for-approval never --json "解释这个仓库的结构"`
  - 工作区可写（默认禁网）
    - 命令：`codex exec --sandbox workspace-write --ask-for-approval never --json "在 README 增补使用说明"`
    - 如需网络：`~/.codex/config.toml` 中启用
      `[sandbox_workspace_write].network_access = true`
  - 全权限（容器已提供隔离时）
    - 命令：`codex exec --sandbox danger-full-access --ask-for-approval never --json "执行构建并产出发布草案"`
    - 等价旗标：`codex exec --dangerously-bypass-approvals-and-sandbox --json ...`
  - 会话恢复（长任务/中断续跑）
    - 首次：`codex exec --json ...`
    - 续写：`codex exec resume <SESSION_ID> --json ...`

### 3. **维护成本增加** (>\_<|||

**风险**: 新增这么多模块后，项目复杂度会急剧上升，需要更严格的测试和文档

**缓解措施**:

- 保持模块化设计（SOLID 原则）
- 完善的单元测试和集成测试
- 详细的 API 文档和架构文档
- 示例和最佳实践指南

### 4. **性能瓶颈** (⊙﹏⊙)

**风险**: 10 个并行 Codex 实例可能导致资源耗尽（CPU、内存）

**缓解措施**:

- 实现资源限制和监控
- 动态调整并发数（根据系统负载）
- 实现任务优先级队列
- 定期性能基准测试

### 5. **任务分解准确性** (๑•́ ₃ •̀๑)

**风险**: 自动任务分解可能不准确，导致任务划分不合理

**缓解措施**:

- 初期使用半自动分解（人工审核）
- 积累任务分解模式库
- 提供任务调整和重分配接口
- 收集用户反馈持续优化

---

## 📚 附录

### A. 相关文件清单

**已实现模块**:

- `core/mcp/server.ts` - MCP 服务器
- `core/mcp/codex-client.ts` - Codex
  JSON-RPC 客户端 ⭐（包含 baseInstructions，接口预留）
- `core/mcp/bridge-layer.ts` - MCP 桥接层
- `core/process/manager.ts` - 单进程管理器
- `core/session/session-manager.ts` - 会话管理器
- `core/session/event-logger.ts` - 事件日志记录器
- `core/approval/policy-engine.ts` - 审批策略引擎
- `core/approval/terminal-ui.ts` - 终端交互 UI

**MVP2 设计文档**:

- `docs/_archive/mvp2-prd.md` - MVP2 产品需求文档
- `docs/_archive/mvp2-spec.md` - MVP2 技术规范

**官方参数与无头模式整理**:

- `./codex-non-interactive.md` - Codex 非交互（exec/headless）模式命令与配置汇总

**待实现模块** (方案 A):

- `core/orchestrator/task-orchestrator.ts` - 任务编排器（新增）
- `core/orchestrator/role-manager.ts` - 角色管理器（新增）
- `core/orchestrator/state-manager.ts` - 状态管理器（新增）
- `core/orchestrator/feedback-handler.ts` - 反馈处理器（新增）
- `core/process/multi-manager.ts` - 多进程管理器（MVP2）

**外部脚本** (方案 B):

- `scripts/orchestrate-tasks.js` - 任务编排脚本（新增）
- `scripts/start-multi-codex.sh` - 多实例启动脚本（新增）
- `scripts/monitor-tasks.js` - 状态监控脚本（新增）

### B. 关键配置示例

#### 角色配置文件（建议格式）

```yaml
# .codex-father/config/roles.yaml
version: '1.0'
roles:
  developer:
    name: '专业开发者'
    baseInstructions: |
      你是一位经验丰富的软件工程师，擅长编写高质量、可维护的代码。

      核心职责：
      1. 深入理解需求，设计合理的技术方案
      2. 编写符合 SOLID 原则的代码
      3. 确保代码通过所有测试
      4. 编写清晰的代码注释和文档

      工作原则：
      - 代码优先：简洁 > 复杂
      - 测试优先：先写测试，后写实现
      - 质量优先：宁可慢一点，也要保证质量

      当前上下文：
      - 项目：{{projectName}}
      - 技术栈：{{techStack}}
      - 编码规范：{{codingStandards}}
      - 依赖任务：{{dependencies}}

    model: 'gpt-5'
    approvalPolicy: 'on-request'
    sandbox: 'workspace-write'
    mcpTools:
      - 'read-file'
      - 'write-file'
      - 'exec-command'
      - 'grep'
      - 'git-status'
      - 'git-diff'

    capabilities:
      maxConcurrentTasks: 2
      resourceLimits:
        maxMemory: 500 # MB
        timeout: 3600000 # 1 hour

    hooks:
      onTaskStart: 'scripts/hooks/developer-start.sh'
      onTaskComplete: 'scripts/hooks/developer-complete.sh'
      onError: 'scripts/hooks/developer-error.sh'

  reviewer:
    name: '代码审查专家'
    baseInstructions: |
      你是一位资深代码审查者，拥有多年的软件开发和代码审查经验。

      核心职责：
      1. 全面审查代码质量和可读性
      2. 发现潜在的 bug 和性能问题
      3. 检查是否符合编码规范
      4. 提出建设性的改进建议

      审查重点：
      - 代码质量：可读性、可维护性、可测试性
      - 安全性：SQL 注入、XSS、CSRF 等常见漏洞
      - 性能：算法复杂度、内存泄漏、数据库查询优化
      - 架构：设计模式、SOLID 原则

      审查态度：
      - 严格但友善：指出问题，但给出解决方案
      - 注重实效：优先解决高风险问题
      - 持续改进：总结常见问题，提出系统性改进建议

      当前上下文：
      - 项目：{{projectName}}
      - 审查范围：{{reviewScope}}
      - 关注重点：{{focusAreas}}

    model: 'gpt-5'
    approvalPolicy: 'untrusted'
    sandbox: 'read-only'
    mcpTools:
      - 'read-file'
      - 'grep'
      - 'git-status'
      - 'git-diff'
      - 'git-log'

    capabilities:
      maxConcurrentTasks: 3
      resourceLimits:
        maxMemory: 300 # MB
        timeout: 1800000 # 30 minutes

  tester:
    name: '测试工程师'
    baseInstructions: |
      你是一位专业测试工程师，致力于确保软件质量和稳定性。

      核心职责：
      1. 设计全面的测试用例（单元测试、集成测试、边界测试）
      2. 编写高质量的自动化测试代码
      3. 执行测试并生成详细的测试报告
      4. 发现并报告 bug，跟踪修复进度

      测试策略：
      - 全面性：覆盖所有功能点和边界条件
      - 自动化：优先编写可自动化的测试
      - 可重复性：确保测试可以重复执行
      - 易维护性：测试代码也要遵循编码规范

      测试类型：
      - 单元测试：测试单个函数/类
      - 集成测试：测试模块间交互
      - 边界测试：测试边界条件和异常情况
      - 性能测试：测试性能指标（可选）

      当前上下文：
      - 项目：{{projectName}}
      - 测试框架：{{testFramework}}
      - 测试范围：{{testScope}}
      - 覆盖率要求：{{coverageTarget}}

    model: 'gpt-5'
    approvalPolicy: 'on-request'
    sandbox: 'workspace-write'
    mcpTools:
      - 'read-file'
      - 'write-file'
      - 'exec-command'
      - 'run-tests'
      - 'git-status'

    capabilities:
      maxConcurrentTasks: 2
      resourceLimits:
        maxMemory: 400 # MB
        timeout: 2400000 # 40 minutes

    hooks:
      onTaskComplete: 'scripts/hooks/tester-report.sh'

defaults:
  model: 'gpt-5'
  approvalPolicy: 'on-request'
  sandbox: 'workspace-write'
  timeout: 3600000 # 1 hour
```

#### 编排配置文件（建议格式）

```yaml
# .codex-father/config/orchestration.yaml
version: '1.0'

orchestration:
  maxParallelTasks: 10
  taskTimeout: 3600000 # 1 hour
  retryPolicy:
    maxRetries: 3
    backoffMultiplier: 2

  taskDecomposition:
    strategy: 'llm-assisted' # "manual" | "rule-based" | "llm-assisted"
    llmModel: 'gpt-5'
    llmPrompt: |
      将以下需求分解为可并行执行的子任务：

      需求描述：
      {{requirement}}

      项目信息：
      - 项目名称：{{projectName}}
      - 技术栈：{{techStack}}

      请输出 JSON 格式的任务列表，每个任务包含：
      - id: 任务唯一标识
      - description: 任务描述
      - roleType: 角色类型（developer/reviewer/tester）
      - dependencies: 依赖的任务 ID 列表
      - estimatedDuration: 预估耗时（分钟）
      - priority: 优先级（1-10）

  roleAssignment:
    strategy: 'load-balanced' # "round-robin" | "load-balanced" | "capability-matched"

feedback:
  autoResolve: true
  autoResolveTypes:
    - 'DEPENDENCY_MISSING'
    - 'PERMISSION_DENIED'
  userConfirmRequired:
    - 'CONTEXT_INSUFFICIENT'
    - 'LOGIC_ERROR'

monitoring:
  stateUpdateInterval: 2000 # ms
  healthCheckInterval: 5000 # ms
  metricsExportInterval: 60000 # ms
```

### C. 示例使用场景

#### 场景：并行开发 REST API

```javascript
// 使用方案 A（完整架构）
const orchestrator = new TaskOrchestrator();
const requirement = `
开发一个用户管理 REST API，包括：
1. 用户注册（POST /users）
2. 用户登录（POST /auth/login）
3. 获取用户信息（GET /users/:id）
4. 更新用户信息（PUT /users/:id）
5. 删除用户（DELETE /users/:id）

要求：
- 使用 Express.js 框架
- 数据库使用 PostgreSQL
- 包含完整的单元测试和集成测试
- 代码审查通过
`;

// 1. 分解任务
const tasks = await orchestrator.decomposeTasks(requirement);
console.log(`分解为 ${tasks.length} 个任务`);

// 2. 分配角色
const assignments = await orchestrator.assignRoles(tasks);
console.log('角色分配完成');

// 3. 并行执行
await orchestrator.executeParallel(assignments);

// 4. 监控进度
orchestrator.on('progress', (status) => {
  console.log(`进度: ${status.completedTasks}/${status.totalTasks}`);
});

// 5. 接收反馈
orchestrator.on('feedback', (feedback) => {
  console.log(`收到反馈: ${feedback.problem.type}`);
  // 自动或手动处理反馈
});

// 6. 获取最终结果
const result = await orchestrator.waitForCompletion();
console.log('所有任务完成！');
console.log(`成功: ${result.successCount}, 失败: ${result.failedCount}`);
```

---

## 📝 总结

### 当前能力评估

- **多实例并行**: ❌ 不支持（仅单进程）
- **任务分解编排**: ❌ 不支持
- **角色配置**: ⚠️ 接口预留（`baseInstructions` 未在默认链路生效）
- **能力差异化**: ⚠️ 部分支持（sandbox/approvalPolicy）
- **状态监控**: ⚠️ 单会话支持
- **双向反馈**: ⚠️ 单向接收

**综合评分**: **1.8/10**

### 实施建议

1. **短期**（1-2 周）：方案 B 快速验证
2. **中期**（2-3 个月）：方案 A 完整实现
3. **长期**：持续优化和迭代

### 关键成功因素

1. ✅ 分阶段实施，降低风险
2. ✅ 保持高测试覆盖率和代码质量
3. ✅ 充分利用现有架构（baseInstructions 等）
4. ✅ 收集用户反馈，持续改进

---

**报告完成日期**: 2025-10-02 **下次评估建议**: MVP2 完成后（预计 2025-11 月）

---

_本报告由幽浮喵（浮浮酱）基于源代码深度分析生成 ฅ'ω'ฅ_
