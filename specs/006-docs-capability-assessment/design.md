# Technical Design: Multi-Agent Parallel Task Orchestration

**Feature Branch**: `006-docs-capability-assessment`
**Created**: 2025-10-02
**Status**: Draft
**Related Spec**: [spec.md](./spec.md)

---

## 📋 目录

1. [设计概述](#设计概述)
2. [系统架构](#系统架构)
3. [核心模块设计](#核心模块设计)
4. [关键流程设计](#关键流程设计)
5. [数据模型](#数据模型)
6. [接口设计](#接口设计)
7. [技术选型](#技术选型)
8. [风险与缓解](#风险与缓解)

---

## 设计概述

### 设计目标

基于 MVP1 的单进程架构，扩展为支持多 Codex 实例并行编排的系统，实现：

- ✅ **并行能力**：最多 10 个 Codex 实例并行执行
- ✅ **角色管理**：规则表优先 + LLM 兜底的角色匹配机制
- ✅ **冲突协调**：SWW（单写者窗口）+ 补丁顺序应用策略
- ✅ **容错机制**：自动资源降级、优雅停止、超时处理
- ✅ **可观测性**：Stream-JSON 输出 + JSONL 审计日志

### 设计原则

1. **渐进式演进**：在 MVP1 基础上扩展，复用现有模块（SessionManager、EventLogger、BridgeLayer）
2. **关注点分离**：编排逻辑、进程管理、角色管理、冲突协调各司其职
3. **最小惊讶原则**：保持与 MVP1 相似的配置和日志格式
4. **防御式设计**：默认非交互、资源限制、自动降级

### 关键约束

- 基于现有的 `codex exec` 无头模式（非 MCP 模式）
- 单机运行，不涉及分布式协调
- 默认沙箱为 `workspace-write`，网络默认关闭
- LLM 调用通道：仅使用 Codex CLI 内部 LLM；编排器进程保持禁网
- 每个任务超时 30 分钟（可配置）
- 默认成功率阈值 90%（可配置）
- 快速校验为强制：若缺少可执行的快速校验工具链，则阻塞写入并判失败
- 成功判定：成功率≥阈值 且 无任何补丁失败 才视为编排成功（退出码0）
 - 失败重试：失败任务自动重试 1 次（指数退避），超出尝试即标记失败

---

## Clarifications

### Session 2025-10-03

- Q: 设计中“LLM 模式”（任务分解/角色兜底）与“默认网络关闭”存在潜在冲突。请明确 LLM 的实际执行通道与网络策略。 → A: A（通过 Codex CLI 内部调用作为唯一 LLM 通道；编排器自身保持禁网）

- Q: SWW 快速校验在缺少工具链时的策略选择？ → A: D（无法执行快速校验即判失败并阻塞写入）

- Q: 补丁应用的默认策略与失败回退如何选择？ → A: C（默认 git，失败再尝试 native 提高兼容性）

- Q: 编排器退出码与成功判定标准？ → A: A（成功率≥阈值 且 无任何补丁失败 时退出码0）

- Q: 失败任务是否自动重试？ → A: B（固定最多重试 1 次，采用指数退避）

应用到设计：
- 约束层面：明确 orchestrator 进程禁网；仅通过 Codex CLI 的内置 LLM 通道进行调用。
- 模块层面：TaskDecomposer/RoleAssigner 的 LLM 路径均经由 Codex CLI 内部通道，不直接访问外部网络端点。
- 运维层面：无需为 orchestrator 配置任何网络白名单；保持默认 `--sandbox workspace-write` 与 `--ask-for-approval never`。

应用到设计（快速校验策略）：
- SWW 两阶段写中的快速校验为强制步骤；若发现项目缺少可执行的快速校验工具链，则判定该写任务失败并阻塞提交（不应用补丁）。
- 事件与审计：记录 `patch_failed`，`errorType: FAST_VALIDATE_UNAVAILABLE`，并包含缺失工具信息。

应用到设计（补丁策略）：
- 默认采用 `git apply`；若失败且允许回退，则自动尝试 `native` 补丁应用。
- 事件与审计：在 `patch_applied` 的 data 中加入 `usedFallback: true|false` 与 `strategy: git|native`。

应用到设计（退出码/成功判定）：
- `isSuccess` 判定：需同时满足 `successRate >= successRateThreshold` 且 `patch_failed` 事件计数为 0。
- 退出码：`0` 表示满足上述条件；否则为 `1`（或 >0 的错误码）。

应用到设计（失败重试策略）：
- 默认对失败任务自动重试 1 次（总尝试次数 2）。
- 退避策略：指数退避，`initialDelayMs`，`maxDelayMs` 可配置。
- 事件：新增 `task_retry_scheduled`，包含 `delayMs` 与 `attempt`。

---

## 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户层 (User Layer)                      │
│  - CLI 命令: codex-father orchestrate <requirement>             │
│  - 配置文件: role-rules.yaml, orchestration.yaml                │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                   编排核心 (Orchestration Core)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ TaskDecomposer│  │RoleAssigner │  │TaskScheduler │          │
│  │  任务分解      │  │ 角色分配     │  │  任务调度    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │StateManager  │  │FeedbackHandler│ │ResourceMonitor│          │
│  │  状态管理      │  │  反馈处理    │  │  资源监控     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                   进程池 (Process Pool Layer)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ProcessOrchestrator（多进程池管理器）                     │  │
│  │  - 进程池管理（最多 10 个）                                │  │
│  │  - 健康检查 & 自动重启                                      │  │
│  │  - 资源监控 & 自动升降并发                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                   冲突协调 (Conflict Resolution)                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  SWWCoordinator（单写者窗口协调器）                         │  │
│  │  - 写任务串行化                                            │  │
│  │  - 补丁顺序应用                                            │  │
│  │  - 两阶段写（隔离生成 + 串行应用）                          │  │
│  │  - 快速校验/测试                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────────┐
│                   执行层 (Execution Layer)                       │
│  ┌────────┐  ┌────────┐  ┌────────┐       ┌────────┐          │
│  │ Codex  │  │ Codex  │  │ Codex  │  ...  │ Codex  │          │
│  │  #1    │  │  #2    │  │  #3    │       │  #10   │          │
│  │(开发者) │  │(审查者) │  │(测试者) │       │(开发者) │          │
│  └────────┘  └────────┘  └────────┘       └────────┘          │
└─────────────────────────────────────────────────────────────────┘

           ┌──────────────────────────────────────┐
           │      存储层 (Storage Layer)           │
           │  - JSONL 审计日志                     │
           │  - 会话配置 (JSON)                    │
           │  - 补丁队列 (临时文件)                │
           └──────────────────────────────────────┘
```

### 架构层次说明

#### 1. 用户层
- **CLI 命令**：用户输入需求和配置
- **配置文件**：角色规则表、编排配置

#### 2. 编排核心
- **TaskDecomposer**：任务分解（手动/LLM）
- **RoleAssigner**：角色分配（规则表优先 + LLM 兜底）
- **TaskScheduler**：任务调度（拓扑排序 + 依赖管理）
- **StateManager**：全局状态管理（进度、状态聚合）
- **FeedbackHandler**：问题反馈处理
- **ResourceMonitor**：资源监控 & 自动降级

#### 3. 进程池层
- **ProcessOrchestrator**：多进程池管理、健康检查、资源监控

#### 4. 冲突协调层
- **SWWCoordinator**：单写者窗口 + 两阶段写 + 补丁顺序应用

#### 5. 执行层
- **Codex 实例**：独立的 `codex exec` 进程，按角色执行任务

#### 6. 存储层
- **JSONL 审计日志**：事件记录（`.codex-father/sessions/<orchestrationId>/events.jsonl`）
- **会话配置**：持久化状态（`.codex-father/sessions/<orchestrationId>/orchestration.json`）
- **补丁队列**：SWW 补丁管理（`.codex-father/sessions/<orchestrationId>/patches/`）
- **隔离工作区**：并行产出补丁（`.codex-father/sessions/<orchestrationId>/workspaces/agent_<id>/`）

---

## 核心模块设计

### 1. TaskDecomposer（任务分解器）

**职责**：将用户需求分解为可并行的子任务

**输入**：
```typescript
interface DecomposeInput {
  requirement: string;        // 用户需求描述
  mode: 'manual' | 'llm';    // 分解模式
  manualTasks?: Task[];      // 手动分解的任务列表（可选）
}
```

**输出**：
```typescript
interface DecomposeOutput {
  tasks: Task[];             // 分解后的任务列表
  dependencies: Map<string, string[]>; // 任务依赖关系（taskId -> [依赖的 taskId]）
}
```

**实现方案**：

**手动模式**：
```typescript
class ManualDecomposer {
  decompose(input: DecomposeInput): DecomposeOutput {
    // 1. 验证手动任务列表
    // 2. 检查任务 ID 唯一性
    // 3. 构建依赖关系图
    // 4. 检测循环依赖
    return { tasks, dependencies };
  }
}
```

**LLM 模式**：
```typescript
class LLMDecomposer {
  async decompose(input: DecomposeInput): Promise<DecomposeOutput> {
    // 1. 构建 LLM 提示词（包含任务分解指导）
    // 2. 通过 Codex CLI 内部 LLM 通道调用（使用 structured output），编排器自身不直接发起网络请求
    // 3. 解析 LLM 输出为任务列表
    // 4. 验证任务格式和依赖关系
    // 5. 检测循环依赖
    return { tasks, dependencies };
  }
}
```

**关键逻辑**：
- 循环依赖检测：使用 DFS 检测环
- 任务验证：确保每个任务有明确的描述、角色提示

---

### 2. RoleAssigner（角色分配器）

**职责**：根据任务类型分配合适的角色

**输入**：
```typescript
interface AssignInput {
  task: Task;
  roleRules: RoleRule[];     // 从配置文件加载的规则表
}
```

**输出**：
```typescript
interface AssignOutput {
  role: string;              // 分配的角色（developer/reviewer/tester）
  matchMethod: 'rule' | 'llm' | 'fallback'; // 匹配方式
  matchDetails: string;      // 匹配依据（用于审计）
}
```

**实现方案**：

```typescript
class RoleAssigner {
  private rules: RoleRule[];
  private fallbackConfig: FallbackConfig;

  async assign(task: Task): Promise<AssignOutput> {
    // 1. 规则表匹配（优先）
    const ruleMatch = this.matchByRules(task);
    if (ruleMatch) {
      return {
        role: ruleMatch.role,
        matchMethod: 'rule',
        matchDetails: `Matched keyword: "${ruleMatch.keyword}" in rule #${ruleMatch.ruleIndex}`
      };
    }

    // 2. LLM 兜底
    if (this.fallbackConfig.type === 'llm') {
      const llmMatch = await this.matchByLLM(task);
      return {
        role: llmMatch.role,
        matchMethod: 'llm',
        matchDetails: llmMatch.reasoning
      };
    }

    // 3. 拒绝（如果配置为 deny）
    throw new Error('No rule matched and fallback is set to deny');
  }

  private matchByRules(task: Task): RuleMatch | null {
    const text = `${task.title || ''} ${task.description}`;
    const matches: RuleMatch[] = [];

    // 遍历所有规则
    for (const [ruleIndex, rule] of this.rules.entries()) {
      for (const keyword of rule.keywords) {
        const index = text.indexOf(keyword);
        if (index !== -1) {
          matches.push({
            role: rule.role,
            keyword,
            keywordLength: keyword.length,
            ruleIndex,
            position: index
          });
        }
      }
    }

    if (matches.length === 0) return null;

    // 排序：更长的关键词优先，然后按规则顺序
    matches.sort((a, b) => {
      if (a.keywordLength !== b.keywordLength) {
        return b.keywordLength - a.keywordLength; // 长度降序
      }
      return a.ruleIndex - b.ruleIndex; // 规则索引升序
    });

    return matches[0];
  }

  private async matchByLLM(task: Task): Promise<LLMMatch> {
    // 通过 Codex CLI 内部 LLM 通道，保持编排器禁网
    const prompt = `根据以下任务描述，判断应该分配给哪个角色：
任务标题：${task.title || 'N/A'}
任务描述：${task.description}

可选角色：
- developer: 负责编写代码、实现功能、修复 bug
- reviewer: 负责代码审查、质量检查、提出改进建议
- tester: 负责编写测试、执行测试、确保质量

请以 JSON 格式回复：
{
  "role": "developer" | "reviewer" | "tester",
  "reasoning": "选择此角色的理由"
}`;

    const response = await callCodexLLM(prompt);
    return JSON.parse(response);
  }
}
```

**关键特性**：
- **确定性**：规则表保证相同输入相同输出
- **可审计**：记录匹配依据
- **可配置**：支持人工确认（fallbackConfig.requireConfirmation）

---

### 3. TaskScheduler（任务调度器）

**职责**：根据依赖关系调度任务执行顺序

**输入**：
```typescript
interface ScheduleInput {
  tasks: Task[];
  dependencies: Map<string, string[]>;
}
```

**输出**：
```typescript
interface ScheduleOutput {
  executionPlan: ExecutionWave[]; // 执行波次（每个波次内的任务可并行）
}

interface ExecutionWave {
  wave: number;                   // 波次编号（从 0 开始）
  tasks: Task[];                  // 本波次可执行的任务
}
```

**实现方案**：

```typescript
class TaskScheduler {
  schedule(input: ScheduleInput): ScheduleOutput {
    const { tasks, dependencies } = input;

    // 1. 拓扑排序（Kahn 算法）
    const inDegree = new Map<string, number>();
    const adjList = new Map<string, string[]>();

    // 初始化入度和邻接表
    for (const task of tasks) {
      inDegree.set(task.id, 0);
      adjList.set(task.id, []);
    }

    for (const [taskId, deps] of dependencies) {
      inDegree.set(taskId, deps.length);
      for (const depId of deps) {
        adjList.get(depId)!.push(taskId);
      }
    }

    // 分波次执行
    const executionPlan: ExecutionWave[] = [];
    let wave = 0;

    while (inDegree.size > 0) {
      // 找出所有入度为 0 的任务（本波次可执行）
      const readyTasks = tasks.filter(t =>
        inDegree.has(t.id) && inDegree.get(t.id) === 0
      );

      if (readyTasks.length === 0) {
        throw new Error('Circular dependency detected');
      }

      executionPlan.push({ wave, tasks: readyTasks });

      // 移除已调度的任务，更新后续任务的入度
      for (const task of readyTasks) {
        inDegree.delete(task.id);
        for (const nextTaskId of adjList.get(task.id)!) {
          if (inDegree.has(nextTaskId)) {
            inDegree.set(nextTaskId, inDegree.get(nextTaskId)! - 1);
          }
        }
      }

      wave++;
    }

    return { executionPlan };
  }
}
```

**关键特性**：
- **波次调度**：每个波次内的任务可并行
- **依赖保证**：严格遵守依赖关系
- **循环检测**：检测并拒绝循环依赖

---

### 4. ProcessOrchestrator（进程池管理器）

**职责**：管理多个 Codex 进程的生命周期

**复用 MVP2 设计**：
- 参考 `docs/_archive/mvp2-spec.md` 的 ProcessOrchestrator 设计
- 扩展资源监控和自动降并发能力

**关键接口**：

```typescript
class ProcessOrchestrator {
  private pool: Map<string, CodexProcess>;
  private maxConcurrency: number = 10;
  private currentConcurrency: number = 10;

  /**
   * 启动进程池
   */
  async startPool(size: number): Promise<void> {
    // 创建指定数量的 Codex 进程（空闲状态）
  }

  /**
   * 分配任务到进程
   */
  async assignTask(task: Task, role: RoleDefinition): Promise<CodexProcess> {
    // 1. 从空闲进程池获取进程
    // 2. 如果没有空闲进程，等待或触发降并发
    // 3. 配置进程角色和任务
    // 4. 启动任务执行
  }

  /**
   * 释放进程
   */
  async releaseProcess(processId: string): Promise<void> {
    // 清理进程状态，移回空闲池
  }

  /**
   * 资源监控与自动降并发
   */
  private lastAdjustAt = 0;
  async monitorResources(): Promise<void> {
    const usage = await this.getSystemResourceUsage();
    const now = Date.now();
    const minIntervalMs = this.config.resourceMonitor?.adjustMinIntervalMs || 5000;
    const cpuHigh = this.config.resourceMonitor?.cpuThreshold ?? 90;
    const cpuLow = this.config.resourceMonitor?.cpuLowThreshold ?? 60;
    const memHigh = this.config.resourceMonitor?.memoryThreshold ?? 90;
    const memLow = this.config.resourceMonitor?.memoryLowThreshold ?? 60;

    if (now - this.lastAdjustAt < minIntervalMs) return;

    // 降并发（高阈值）
    if (usage.cpu > cpuHigh || usage.memory > memHigh) {
      const prev = this.currentConcurrency;
      this.currentConcurrency = Math.max(1, this.currentConcurrency - 1);
      if (this.currentConcurrency < prev) {
        this.emitEvent('concurrency_reduced', {
          from: prev,
          to: this.currentConcurrency,
          reason: usage.cpu > cpuHigh ? 'high_cpu' : 'high_memory'
        });
        this.lastAdjustAt = now;
      }
      return;
    }

    // 升并发（低阈值）
    if (usage.cpu < cpuLow && usage.memory < memLow && this.currentConcurrency < this.maxConcurrency) {
      const prev = this.currentConcurrency;
      this.currentConcurrency = Math.min(this.maxConcurrency, this.currentConcurrency + 1);
      if (this.currentConcurrency > prev) {
        this.emitEvent('concurrency_increased', {
          from: prev,
          to: this.currentConcurrency,
          reason: 'resources_recovered'
        });
        this.lastAdjustAt = now;
      }
    }
  }

  /**
   * 优雅停止
   */
  async gracefulShutdown(timeoutMs: number = 60000): Promise<void> {
    // 1. 广播停止信号
    this.broadcastStop();

    // 2. 等待进程保存状态（最多 timeoutMs）
    await this.waitForProcesses(timeoutMs);

    // 3. 强制终止未完成的进程
    await this.forceTerminateAll();

    // 4. 生成汇总报告
    await this.generateReport();
  }
}
```

**关键特性**：
- **动态并发**：根据资源使用情况自动升降并发，带滞回与最小间隔
- **健康检查**：定期检查进程存活和响应
- **优雅停止**：60 秒保存窗口

---

### 5. SWWCoordinator（单写者窗口协调器）

**职责**：协调并发写入，避免文件冲突

**核心策略**：Single Writer Window（SWW）+ 两阶段写（Two-Phase Write）+ 补丁顺序应用

两阶段写说明：
- 阶段 A（并行）：各 Agent 在隔离工作区内生成补丁与变更摘要，不改动主工作区
- 阶段 B（串行）：进入写窗口后按序应用补丁并执行快速校验，通过则提交，失败则标记并上报

两阶段写时序（ASCII）：

```
Agent_i (隔离工作区)                SWWCoordinator                    主工作区
    | 生成补丁(阶段A)                 |                                 |
    |---- create patch (.patch) ---->|                                 |
    |                                | 入队 writerQueue                |
    |                                |-------------------------------->|
    |                                | [写窗口空闲?] 是                |
    |                                | 取出队首任务 currentWriter      |
    |                                |                                 |
    |                                | 应用补丁(阶段B)                 |
    |                                |---- applyPatch(patch) --------->| (native/git)
    |                                |                                 |
    |                                | 快速校验                        |
    |                                |---- quickValidate() ----------->| (按配置执行 steps)
    |                                |                                 |
    |                                | [成功] emit patch_applied       |
    |                                | [失败] emit patch_failed        |
    |                                | 释放写窗口，处理下一个          |
```

**关键接口**：

```typescript
class SWWCoordinator {
  private writerQueue: Task[] = [];      // 写任务队列
  private currentWriter: Task | null = null; // 当前写任务
  private patchSequence: number = 0;     // 补丁序号
  private applyPatchStrategy: 'git' | 'native' = this.config.applyPatchStrategy || 'git';
  private applyPatchFallbackOnFailure: boolean = this.config.applyPatchFallbackOnFailure !== false; // 默认允许回退
  private quickValidateSteps: string[] = this.config.quickValidate?.steps || [];
  private failOnMissingQuickValidate: boolean = this.config.quickValidate?.failOnMissing === true;

  /**
   * 调度任务（区分读/写任务）
   */
  async scheduleTask(task: Task): Promise<void> {
    if (this.isWriteTask(task)) {
      // 写任务加入队列（阶段 A：隔离工作区内并行生成补丁）
      this.writerQueue.push(task);
      await this.processWriterQueue();
    } else {
      // 读/分析任务直接执行
      await this.executeTask(task);
    }
  }

  /**
   * 处理写任务队列
   */
  private async processWriterQueue(): Promise<void> {
    // 确保同时只有一个写任务在执行
    if (this.currentWriter !== null) return;

    const nextWriter = this.writerQueue.shift();
    if (!nextWriter) return;

    this.currentWriter = nextWriter;

    try {
      // 阶段 A：执行写任务（隔离工作区生成补丁）
      const patch = await this.executeWriteTask(nextWriter);

      // 阶段 B：进入写窗口，按序应用补丁并快速校验
      const applyResult = await this.applyPatch(patch);
      const validateResult = await this.quickValidate(patch);

      if (!applyResult.success || !validateResult.success) {
        // 标记补丁失败并上报
        this.markPatchFailed(patch, applyResult.error || validateResult.error);
        this.emitEvent('patch_failed', {
          patchId: patch.id,
          taskId: nextWriter.id,
          reason: applyResult.error || validateResult.error,
        });
        this.reportToUser({
          type: 'patch_failed',
          taskId: nextWriter.id,
          patchId: patch.id,
          reason: applyResult.error || validateResult.error
        });
      } else {
        this.markPatchSuccess(patch);
        this.emitEvent('patch_applied', {
          patchId: patch.id,
          taskId: nextWriter.id,
          targetFiles: patch.targetFiles,
          sequence: patch.sequence,
          usedFallback: Boolean((applyResult as any).usedFallback),
          strategy: (applyResult as any).strategy || this.applyPatchStrategy,
        });
      }
    } finally {
      this.currentWriter = null;
      // 继续处理下一个写任务
      await this.processWriterQueue();
    }
  }

  /**
   * 应用补丁
   */
  private async applyPatch(patch: Patch): Promise<ApplyResult> {
    const tryGit = async () => {
      await execCommand(`git apply "${patch.filePath}"`);
      return { success: true as const, strategy: 'git' as const, usedFallback: false };
    };
    const tryNative = async () => {
      await this.nativeApplyPatch(patch);
      return { success: true as const, strategy: 'native' as const, usedFallback: false };
    };

    try {
      if (this.applyPatchStrategy === 'git') {
        try {
          const r = await tryGit();
          return r;
        } catch (errGit) {
          if (this.applyPatchFallbackOnFailure) {
            try {
              const r2 = await tryNative();
              return { ...r2, usedFallback: true };
            } catch (errNative) {
              return { success: false, error: String(errNative) };
            }
          }
          return { success: false, error: String(errGit) };
        }
      } else {
        // native 首选
        try {
          const r = await tryNative();
          return r;
        } catch (errNative) {
          if (this.applyPatchFallbackOnFailure) {
            try {
              const r2 = await tryGit();
              return { ...r2, usedFallback: true };
            } catch (errGit) {
              return { success: false, error: String(errGit) };
            }
          }
          return { success: false, error: String(errNative) };
        }
      }
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 快速校验
   */
  private async quickValidate(patch: Patch): Promise<ValidateResult> {
    try {
      // 运行快速校验步骤（可配置）
      if (this.quickValidateSteps.length === 0) {
        if (this.failOnMissingQuickValidate) {
          throw new Error('FAST_VALIDATE_UNAVAILABLE: no quick-validate steps configured');
        }
        // 未配置且允许跳过的情况下可放行（但当前策略为 failOnMissing=true）
        return { success: true };
      }
      for (const step of this.quickValidateSteps) {
        await execCommand(step);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 判断是否为写任务
   */
  private isWriteTask(task: Task): boolean {
    // 优先依据任务元数据与角色
    if (task.mutation === true) return true;
    if (task.role === 'developer') return true;
    // 兜底：关键词判定（可配置）
    const writeKeywords = ['实现', '编码', '修复', '重构', '开发'];
    const text = `${task.title || ''} ${task.description}`.toLowerCase();
    return writeKeywords.some(kw => text.includes(kw));
  }
}
```

**关键特性**：
- **串行写入**：任意时刻仅一个写任务
- **补丁模式**：写任务产出补丁而非直接修改文件
- **快速校验（强制）**：每次应用后运行 lint/type check；若缺少可执行的快速校验工具链，则直接判失败并阻塞提交
- **不阻塞读任务**：读/分析任务可并行执行

---

### 6. StateManager（状态管理器）

**职责**：管理编排会话的全局状态

**关键接口**：

```typescript
class StateManager {
  private orchestrations: Map<string, Orchestration>;

  /**
   * 创建编排会话
   */
  createOrchestration(requirement: string): Orchestration {
    const id = generateId('orc');
    const orchestration: Orchestration = {
      id,
      requirement,
      tasks: [],
      status: 'initializing',
      createdAt: new Date(),
      successRateThreshold: 0.9, // 默认 90%
    };
    this.orchestrations.set(id, orchestration);
    return orchestration;
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(orchestrationId: string, taskId: string, status: TaskStatus): void {
    const orchestration = this.orchestrations.get(orchestrationId);
    const task = orchestration.tasks.find(t => t.id === taskId);
    task.status = status;
    task.updatedAt = new Date();

    // 发送 Stream-JSON 事件
    this.emitEvent({
      event: this.mapStatusToEvent(status),
      timestamp: new Date().toISOString(),
      orchestrationId,
      taskId,
      role: task.role,
      seq: this.getNextSeq(orchestrationId),
      data: this.getStatusData(task)
    });

    // 失败重试：根据策略自动安排一次重试（最多 maxAttempts 次）
    if ((status === 'failed' || status === 'timeout') && this.shouldRetry(orchestrationId, task)) {
      const delayMs = this.computeBackoffDelay(orchestrationId, task);
      this.emitEvent({
        event: 'task_retry_scheduled',
        timestamp: new Date().toISOString(),
        orchestrationId,
        taskId,
        role: task.role,
        seq: this.getNextSeq(orchestrationId),
        data: { attempt: (task.attempts || 1) + 1, delayMs }
      });
      this.scheduleRetry(orchestrationId, taskId, delayMs);
    }
  }

  /**
   * 获取编排状态（实时）
   */
  getOrchestrationStatus(id: string): OrchestratorStatus {
    const orchestration = this.orchestrations.get(id);
    const successCount = orchestration.tasks.filter(t => t.status === 'completed').length;
    const failedCount = orchestration.tasks.filter(t => t.status === 'failed').length;
    const successRate = orchestration.tasks.length > 0
      ? successCount / orchestration.tasks.length
      : 0;
    const patchFailedCount = this.getPatchFailureCount(id); // 基于事件或持久层统计
    const isSuccess = successRate >= orchestration.successRateThreshold && patchFailedCount === 0;

    return {
      orchestrationId: id,
      totalTasks: orchestration.tasks.length,
      completedTasks: successCount,
      runningTasks: orchestration.tasks.filter(t => t.status === 'running').length,
      failedTasks: failedCount,
      successRate,
      isSuccess,
      tasks: this.getTaskDetails(orchestration.tasks),
      dependencies: this.getDependencyGraph(orchestration.tasks),
      startTime: orchestration.createdAt,
      estimatedCompletion: this.estimateCompletion(orchestration),
    };
  }

  /**
   * Stream-JSON 事件发送
   */
  private emitEvent(event: StreamJSONEvent): void {
    // 1. 写入 JSONL 日志
    this.writeToJSONL(event);

    // 2. 如果输出格式为 Stream-JSON，输出到 stdout
    if (this.config.outputFormat === 'stream-json') {
      console.log(JSON.stringify(event));
    }
  }
}
```

**关键特性**：
- **实时状态**：随时查询编排进度
- **Stream-JSON 输出**：标准化事件流
- **成功率计算**：自动判断编排是否成功

---

## 关键流程设计

### 流程 1：编排启动流程

```
用户执行命令
   ↓
codex-father orchestrate <requirement>
   ↓
1. 加载配置
   - role-rules.yaml
   - orchestration.yaml
   ↓
2. 创建编排会话
   - 生成 orchestrationId
   - 初始化 StateManager
   ↓
3. 任务分解
   - 手动模式：解析用户提供的任务列表
   - LLM 模式：调用 LLM 分解需求
   ↓
4. 角色分配
   - 规则表匹配（优先）
   - LLM 兜底
   - 记录匹配依据
   ↓
5. 任务调度
   - 拓扑排序
   - 生成执行波次
   ↓
6. 启动进程池
   - 创建最多 10 个 Codex 进程
   - 配置角色和权限
   ↓
7. 按波次执行任务
   - Wave 0: 无依赖的任务
   - Wave 1: 依赖 Wave 0 的任务
   - ...
   ↓
8. 监控执行
   - 实时更新状态
   - 资源监控 & 自动降并发
   - 超时检测
   ↓
9. 汇总报告
   - 成功率计算
   - 生成汇总报告
   - 判断编排成功/失败
```

### 流程 2：SWW 并发写入流程

```
任务分类
   ↓
读任务 ────────────────→ 直接并行执行（不受限制）
   ↓
写任务 → 加入写任务队列
   ↓
检查当前写窗口
   ↓
[写窗口空闲] → 弹出队列头部任务
   ↓
执行写任务
   ↓
生成补丁文件
   ↓
应用补丁
   ↓
快速校验（lint + type check；若不可执行→立即失败）
   ↓
[校验成功] → 标记补丁成功
   ↓
[校验失败] → 标记补丁失败 → 上报用户
   ↓
释放写窗口
   ↓
继续处理下一个写任务
```

### 流程 3：优雅停止流程

```
用户取消编排（Ctrl+C 或超时）
   ↓
1. 广播停止信号
   - 通知所有 Codex 进程停止
   ↓
2. 等待保存（最多 60 秒）
   - 允许进程保存状态和产物
   ↓
3. 检查进程状态
   ↓
[60 秒内全部完成] → 跳到步骤 5
   ↓
[仍有进程运行] → 强制终止
   ↓
4. 强制终止未完成任务
   - 发送 SIGTERM
   - 等待 5 秒
   - 发送 SIGKILL
   ↓
5. 生成汇总报告
   - 已完成任务列表
   - 未完成任务列表
   - 部分产物路径
   ↓
6. 上报用户
```

### 流程 4：资源不足降级流程

```
资源监控检测到高负载
   ↓
[CPU > 90% 或 Memory > 90%]
   ↓
1. 自动降并发
   - currentConcurrency = max(1, currentConcurrency - 1)
   ↓
2. 将超出并发限制的任务加入队列
   ↓
3. 发送事件通知
   - concurrency_reduced 事件
   ↓
4. 继续监控
   ↓
[资源仍不足 且 并发已降至 1]
   ↓
5. 拒绝新任务
   ↓
6. 上报用户
   - resource_exhausted 事件
   - 建议用户调整（减少并发或增加资源）
```

---

## 数据模型

### Orchestration（编排会话）

```typescript
interface Orchestration {
  id: string;                        // 编排 ID (orc_xxx)
  requirement: string;               // 用户需求描述
  tasks: Task[];                     // 任务列表
  status: OrchestrationStatus;       // 编排状态
  createdAt: Date;                   // 创建时间
  completedAt?: Date;                // 完成时间
  successRateThreshold: number;      // 成功率阈值（默认 0.9）
  config: OrchestrationConfig;       // 编排配置
}

type OrchestrationStatus =
  | 'initializing'  // 初始化中
  | 'running'       // 运行中
  | 'completed'     // 已完成（成功率 >= 阈值）
  | 'failed'        // 失败（成功率 < 阈值）
  | 'cancelled';    // 用户取消

interface OrchestrationConfig {
  maxConcurrency: number;                 // 最大并发数（默认 10）
  taskTimeout: number;                    // 任务超时时间（默认 1800000ms = 30 分钟）
  outputFormat: 'json' | 'stream-json';   // 输出格式
  successRateThreshold: number;           // 成功率阈值（默认 0.9）
  retryPolicy?: RetryPolicy;              // 失败重试策略（默认最多2次、指数退避）
  resourceMonitor?: ResourceMonitorConfig; // 资源监控配置
  quickValidate?: QuickValidateConfig;    // 快速校验配置
  applyPatchStrategy?: 'git' | 'native';  // 补丁策略
  applyPatchFallbackOnFailure?: boolean;  // 失败是否回退
}

interface RetryPolicy {
  maxAttempts: number;               // 总尝试次数（含首次），默认 2
  backoff: 'exponential' | 'fixed';  // 退避策略
  initialDelayMs: number;            // 初始延迟（默认 2000）
  maxDelayMs: number;                // 最大延迟（默认 30000）
}
```

### Task（任务）

```typescript
interface Task {
  id: string;                        // 任务 ID (t_xxx)
  title?: string;                    // 任务标题（可选）
  description: string;               // 任务描述
  role: string;                      // 分配的角色（developer/reviewer/tester）
  mutation?: boolean;                // 是否包含写入/变更（用于 SWW 判定）
  roleMatchMethod: 'rule' | 'llm';   // 角色匹配方式
  roleMatchDetails: string;          // 角色匹配依据
  status: TaskStatus;                // 任务状态
  dependencies: string[];            // 依赖的任务 ID
  priority: number;                  // 优先级（默认 0）
  timeout: number;                   // 超时时间（默认 30 分钟）
  createdAt: Date;                   // 创建时间
  startedAt?: Date;                  // 开始时间
  completedAt?: Date;                // 完成时间
  agentId?: string;                  // 分配的 Agent ID
  outputs?: TaskOutput[];            // 任务输出
  error?: string;                    // 错误信息（如果失败）
  attempts?: number;                 // 已尝试次数（含当前），默认 0 → 首次运行时置 1
}

type TaskStatus =
  | 'pending'       // 待执行
  | 'waiting'       // 等待依赖
  | 'running'       // 执行中
  | 'completed'     // 已完成
  | 'failed'        // 失败
  | 'timeout';      // 超时

interface TaskOutput {
  type: 'file' | 'patch' | 'log';    // 输出类型
  path: string;                      // 文件路径
  description?: string;              // 描述
}
```

### Agent（Codex 实例）

```typescript
interface Agent {
  id: string;                        // Agent ID (agent_xxx)
  role: string;                      // 角色
  status: AgentStatus;               // 状态
  processId: number;                 // 进程 ID
  currentTask?: string;              // 当前任务 ID
  startedAt: Date;                   // 启动时间
  lastActivityAt: Date;              // 最后活动时间
  workDir: string;                   // 工作目录
  sessionDir: string;                // 会话目录
  resourceUsage?: ResourceUsage;     // 资源使用情况
}

type AgentStatus =
  | 'idle'          // 空闲
  | 'busy'          // 忙碌
  | 'crashed'       // 崩溃
  | 'terminated';   // 已终止

interface ResourceUsage {
  cpu: number;      // CPU 使用率（百分比）
  memory: number;   // 内存使用（MB）
}
```

### Patch（补丁）

```typescript
interface Patch {
  id: string;                        // 补丁 ID (patch_xxx)
  taskId: string;                    // 来源任务 ID
  sequence: number;                  // 补丁序号（全局递增）
  filePath: string;                  // 补丁文件路径
  targetFiles: string[];             // 影响的文件列表
  status: PatchStatus;               // 补丁状态
  createdAt: Date;                   // 创建时间
  appliedAt?: Date;                  // 应用时间
  error?: string;                    // 错误信息（如果应用失败）
}

type PatchStatus =
  | 'pending'       // 待应用
  | 'applying'      // 应用中
  | 'applied'       // 已应用
  | 'failed';       // 应用失败
```

---

## 接口设计

### CLI 退出码约定

- 退出码 `0`：成功率 ≥ 配置阈值，且无任何补丁失败（`patch_failed` 计数为 0）。
- 退出码 `1`：不满足上述条件（包括成功率低于阈值或存在任意补丁失败）。
- 其他非零：进程级异常（如配置读取失败、资源监控模块崩溃）。

### CLI 接口

```bash
# 启动编排
codex-father orchestrate <requirement> [options]

# 选项
--mode <manual|llm>           # 任务分解模式（默认 llm）
--tasks-file <path>           # 手动任务列表文件（JSON 格式）
--max-concurrency <number>    # 最大并发数（默认 10）
--task-timeout <minutes>      # 任务超时时间（默认 30）
--success-threshold <0-1>     # 成功率阈值（默认 0.9）
--output-format <json|stream-json> # 输出格式（默认 stream-json）
--config <path>               # 配置文件路径

# 示例
codex-father orchestrate "实现用户管理模块" --mode llm --max-concurrency 5
codex-father orchestrate --tasks-file tasks.json --mode manual
```

### 配置文件接口

**role-rules.yaml**（角色规则表）

```yaml
version: "1.0"
rules:
  - role: developer
    keywords: ["实现", "开发", "编码", "接口", "重构", "修复"]
  - role: reviewer
    keywords: ["审查", "review", "规范", "代码质量", "diff", "建议"]
  - role: tester
    keywords: ["测试", "单元测试", "集成测试", "覆盖率", "CI"]

fallback:
  type: "llm"                  # 兜底方式：llm | deny
  requireConfirmation: false   # 是否需要人工确认
```

**orchestration.yaml**（编排配置）

```yaml
version: "1.0"

orchestration:
  maxConcurrency: 10           # 最大并发数
  taskTimeout: 1800000         # 任务超时（30 分钟，单位毫秒）
  successRateThreshold: 0.9    # 成功率阈值
  outputFormat: "stream-json"  # 输出格式

taskDecomposition:
  strategy: "llm"              # 分解策略：manual | llm
  llmModel: "gpt-5"            # LLM 模型
  llmPrompt: |
    将以下需求分解为可并行执行的子任务...

resourceMonitor:
  cpuThreshold: 90             # CPU 高阈值（降并发）
  cpuLowThreshold: 60          # CPU 低阈值（升并发）
  memoryThreshold: 90          # 内存高阈值（降并发）
  memoryLowThreshold: 60       # 内存低阈值（升并发）
  checkInterval: 5000          # 采样间隔（毫秒）
  adjustMinIntervalMs: 5000    # 并发调整的最小间隔（毫秒）

gracefulShutdown:
  saveTimeout: 60000           # 保存状态超时（60 秒）
  forceTerminateDelay: 5000    # 强制终止延迟（5 秒）

quickValidate:
  steps:
    - "npm run -s lint"
    - "tsc --noEmit"
  failOnMissing: true

applyPatchStrategy: "git"      # 补丁应用策略：git | native（默认 git）
applyPatchFallbackOnFailure: true  # 当首选策略失败时，自动启用回退
```

**tasks.json**（手动任务列表）

```json
{
  "tasks": [
    {
      "id": "t1",
      "title": "设计数据模型",
      "description": "设计用户、角色、权限的数据库模型",
      "roleHint": "developer",
      "dependencies": [],
      "priority": 1
    },
    {
      "id": "t2",
      "title": "实现 API 接口",
      "description": "实现用户注册、登录、权限验证的 API",
      "roleHint": "developer",
      "dependencies": ["t1"],
      "priority": 2
    },
    {
      "id": "t3",
      "title": "编写单元测试",
      "description": "为 API 接口编写单元测试",
      "roleHint": "tester",
      "dependencies": ["t2"],
      "priority": 3
    }
  ]
}
```

### Stream-JSON 输出接口

**事件格式**（遵循 spec.md 附录 B）

```json
// 编排开始
{"event":"start","timestamp":"2025-10-02T10:00:00Z","orchestrationId":"orc_1","seq":1,"data":{"totalTasks":10}}

// 任务调度
{"event":"task_scheduled","timestamp":"2025-10-02T10:00:01Z","orchestrationId":"orc_1","taskId":"t1","seq":2,"data":{"dependencies":[]}}

// 任务开始
{"event":"task_started","timestamp":"2025-10-02T10:00:02Z","orchestrationId":"orc_1","taskId":"t1","role":"developer","agentId":"agent_1","seq":3,"data":{"role":"developer"}}

// 工具使用
{"event":"tool_use","timestamp":"2025-10-02T10:00:05Z","orchestrationId":"orc_1","taskId":"t1","role":"developer","seq":4,"data":{"tool":"write_file","argsSummary":"src/models/user.ts"}}

// 任务完成
{"event":"task_completed","timestamp":"2025-10-02T10:03:05Z","orchestrationId":"orc_1","taskId":"t1","role":"developer","seq":5,"data":{"durationMs":180000,"outputsCount":2}}

// 任务失败
{"event":"task_failed","timestamp":"2025-10-02T10:05:00Z","orchestrationId":"orc_1","taskId":"t2","role":"developer","seq":6,"data":{"reason":"timeout","errorType":"TASK_TIMEOUT"}}

// 失败重试已安排
{"event":"task_retry_scheduled","timestamp":"2025-10-02T10:05:01Z","orchestrationId":"orc_1","taskId":"t2","role":"developer","seq":6,"data":{"attempt":2,"delayMs":2000}}

// 并发降级
{"event":"concurrency_reduced","timestamp":"2025-10-02T10:10:00Z","orchestrationId":"orc_1","seq":7,"data":{"from":10,"to":9,"reason":"high_cpu"}}

// 并发回升
{"event":"concurrency_increased","timestamp":"2025-10-02T10:20:00Z","orchestrationId":"orc_1","seq":8,"data":{"from":9,"to":10,"reason":"resources_recovered"}}

// 补丁应用成功
{"event":"patch_applied","timestamp":"2025-10-02T10:21:00Z","orchestrationId":"orc_1","taskId":"t3","role":"developer","seq":9,"data":{"patchId":"patch_12","targetFiles":["src/a.ts"],"sequence":12}}

// 补丁应用失败
{"event":"patch_failed","timestamp":"2025-10-02T10:22:00Z","orchestrationId":"orc_1","taskId":"t4","role":"developer","seq":10,"data":{"patchId":"patch_13","reason":"apply_conflict","errorType":"PATCH_CONFLICT"}}

// 资源耗尽
{"event":"resource_exhausted","timestamp":"2025-10-02T10:30:00Z","orchestrationId":"orc_1","seq":11,"data":{"reason":"memory","action":"reject_new_tasks"}}

// 编排完成
{"event":"orchestration_completed","timestamp":"2025-10-02T12:00:00Z","orchestrationId":"orc_1","seq":100,"data":{"successRate":0.9,"totalDurationMs":7200000,"patchFailed":0,"exitCode":0}}
```

---

## 技术选型

### 核心依赖（复用 MVP1）

| 依赖 | 版本 | 用途 |
|------|------|------|
| TypeScript | ^5.3.0 | 类型安全 |
| Node.js | >=18.0.0 | 运行时 |
| vitest | ^1.6.1 | 测试框架 |
| zod | ^3.24.1 | 运行时类型验证 |
| uuid | ^11.0.3 | ID 生成 |

### 新增依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| p-queue | ^8.0.0 | 任务队列管理 |
| p-limit | ^5.0.0 | 并发控制 |
| systeminformation | ^5.21.0 | 系统资源监控 |
| yaml | ^2.3.0 | YAML 配置解析 |

### Codex 调用方式

- LLM 调用通道：仅使用 Codex CLI 内部 LLM；编排器不直接访问任何外部网络端点。
- Orchestrator 进程保持禁网；无需配置网络白名单。

使用 `codex exec` 无头模式（非 MCP 模式）：

```bash
# 基本调用
codex exec --sandbox workspace-write --ask-for-approval never --json <prompt>

# 角色配置示例
codex exec \
  --sandbox workspace-write \
  --ask-for-approval never \
  --json \
  --base-instructions "你是一位专业开发者..." \
  <prompt>

# 会话恢复（长任务）
codex exec resume <SESSION_ID> --json <prompt>
```

---

## 风险与缓解

### 风险 1：LLM 任务分解不准确

**风险描述**：LLM 自动分解任务可能不准确，导致任务划分不合理

**影响**：中等（编排失败）

**缓解措施**：
1. **提供示例**：在 LLM 提示词中提供任务分解示例
2. **验证机制**：验证任务的完整性和依赖关系
3. **手动兜底**：支持手动任务分解模式
4. **人工审核**：可配置是否需要人工确认 LLM 分解结果

### 风险 2：补丁应用冲突

**风险描述**：即使采用 SWW 策略，仍可能出现补丁应用冲突

**影响**：中等（任务失败）

**缓解措施**：
1. **快速校验**：每次应用后运行 lint 和 type check
2. **失败上报**：补丁应用失败立即上报用户
3. **不阻塞**：补丁失败不阻塞其他读/分析任务
4. **回滚机制**：保留 git 历史，支持回滚

### 风险 3：资源耗尽

**风险描述**：10 个并行 Codex 进程可能导致资源耗尽

**影响**：高（系统崩溃）

**缓解措施**：
1. **资源监控**：实时监控 CPU 和内存使用
2. **自动降并发**：资源不足时自动降低并发数
3. **队列机制**：超出并发限制的任务进入队列
4. **硬性限制**：最低并发降至 1，仍不足则拒绝新任务

### 风险 4：任务超时

**风险描述**：某些任务可能超过 30 分钟超时阈值

**影响**：中等（任务失败）

**缓解措施**：
1. **可配置超时**：支持用户配置超时时间
2. **超时终止**：超时自动终止并标记失败
3. **日志记录**：记录超时原因和执行日志
4. **上报建议**：上报用户并建议调整（拆分任务或增加超时）

### 风险 5：优雅停止失败

**风险描述**：60 秒内进程无法完成保存

**影响**：低（部分产物丢失）

**缓解措施**：
1. **强制终止**：60 秒后强制终止
2. **部分产物**：保存已完成的产物
3. **状态记录**：记录未完成任务列表
4. **汇总报告**：生成详细的汇总报告

### 风险 6：Codex CLI 限制

**风险描述**：Codex CLI 本身的能力限制（如不支持某些特性）

**影响**：高（功能受限）

**缓解措施**：
1. **提前验证**：阅读 Codex 官方文档验证能力边界
2. **降级方案**：准备外部脚本兜底
3. **持续跟进**：关注 Codex 版本更新
4. **社区反馈**：向 Codex 团队反馈需求

---

## 下一步行动

### Phase 1: MVP2 基础（2-3 周）

- [ ] 实现 `ProcessOrchestrator`（多进程池管理）
- [ ] 实现 `ResourceMonitor`（资源监控 & 自动降并发）
- [ ] 实现会话恢复机制（基于 rollout 文件）
- [ ] 单元测试覆盖率 ≥ 80%

### Phase 2: 编排系统核心（2-3 周）

- [ ] 实现 `TaskDecomposer`（任务分解，手动 + LLM）
- [ ] 实现 `RoleAssigner`（角色分配，规则表 + LLM 兜底）
- [ ] 实现 `TaskScheduler`（任务调度，拓扑排序）
- [ ] 实现 `StateManager`（全局状态管理 + Stream-JSON 输出）
- [ ] 集成测试：并行执行 10 个任务

### Phase 3: 冲突协调与容错（1-2 周）

- [ ] 实现 `SWWCoordinator`（单写者窗口 + 补丁应用）
- [ ] 实现优雅停止流程
- [ ] 实现超时检测和处理
- [ ] 实现 JSONL 审计日志

### Phase 4: 优化和文档（1 周）

- [ ] 性能优化（并发调度、资源占用）
- [ ] 完整文档和示例
- [ ] 用户指南

---

**总计**: 6-9 周开发周期

---

## 附录

### A. 与 MVP1 的兼容性

| MVP1 模块 | 复用方式 | 改动 |
|----------|---------|------|
| SessionManager | 复用 | 扩展为管理多会话 |
| EventLogger | 复用 | 扩展支持 Stream-JSON |
| BridgeLayer | 废弃 | 不使用 MCP 模式，改用 `codex exec` |
| SingleProcessManager | 升级 | 升级为 ProcessOrchestrator（多进程池） |
| ApprovalPolicy | 简化 | 默认 `--ask-for-approval never` |

### B. 与 PRD-006 的对齐

| PRD-006 要求 | 设计对应 | 状态 |
|-------------|---------|------|
| 非交互模式 | `--ask-for-approval never` | ✅ |
| 安全参数 | `allowedTools`, `permission-mode`, `sandbox` | ✅ |
| Stream-JSON 输出 | StateManager.emitEvent() | ✅ |
| JSONL 审计日志 | EventLogger 扩展 | ✅ |
| 优雅停止 | ProcessOrchestrator.gracefulShutdown() | ✅ |
| 资源降级 | ResourceMonitor.monitorResources() | ✅ |
| SWW 并发写 | SWWCoordinator | ✅ |

---

**设计完成** ✅
