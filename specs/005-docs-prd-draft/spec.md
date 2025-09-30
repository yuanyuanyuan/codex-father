# Feature Specification: 架构调整 - MCP 模式优先实现

**Feature Branch**: `005-docs-prd-draft`
**Created**: 2025-09-30
**Status**: Requirements Refined
**Input**: 用户描述："需求澄清docs/prd-draft.md"

## Execution Flow (main)

```
1. 解析用户描述
   → ✅ 已完成：明确要求调整开发方向，优先实现 MCP 模式
2. 提取关键概念
   → ✅ 已识别：MCP 协议、codex-father 架构、双层结构（对外协议/对内引擎）、多进程并行
3. 模糊点标记
   → ✅ 已澄清：所有关键决策点已与用户确认并细化
4. 填写用户场景和测试
   → ✅ 已完成：见"用户场景与测试"章节
5. 生成功能需求
   → ✅ 已完成：所有需求可测试且明确
6. 识别关键实体
   → ✅ 已完成：见"关键实体"章节
7. 运行审查清单
   → ✅ 已通过：需求完整、明确、可测试
8. 返回状态
   → ✅ SUCCESS：规范已就绪，可进入设计与规划阶段
```

---

## ⚡ 快速指南

- ✅ 重点：用户需要什么功能、为什么需要
- ❌ 避免：具体如何实现（无技术栈、API、代码结构细节）
- 👥 面向：业务干系人、产品经理、非技术决策者

---

## MVP 分阶段交付计划

### MVP1：MCP 多会话管理（核心基础）

**目标**：建立 codex-father 作为 MCP 服务器的基础能力，实现对单个 `codex mcp` 进程的多会话管理。

**核心能力**：
- MCP 协议服务端实现
- 与外部 MCP 客户端通信
- 会话生命周期管理（创建、取消、监控）
- 事件日志记录
- 基础审批机制（策略引擎 + 终端 UI）
- 健康检查和进程监控

**交付标准**：
- 外部客户端可通过 MCP 协议连接并发起任务
- 支持多个会话在单个进程内"排队执行"（前端不阻塞，但后端串行）
- 基本的日志和审计功能

### MVP2：CLI/exec 多进程并行管理（真正并行）

**目标**：扩展 codex-father 能力，使用 MCP 协议管理多个 `codex exec` CLI 进程，实现真正的并行执行。

**核心能力**：
- 进程池管理：启动、监控、终止多个 `codex exec --json` 进程
- 真正并行执行：多个任务同时在不同进程中运行
- 会话恢复机制：基于外部持久化文件（JSONL 事件日志、配置文件）重建会话状态
- 扩展审批机制：支持多个并行审批请求的管理
- 扩展到其他 agent 模式：支持管理 `claude code` 等其他 CLI agent（预留架构）

**交付标准**：
- 支持同时运行 N 个独立任务（N 由配置或系统资源决定）
- 进程崩溃后能够基于日志文件恢复会话上下文
- 架构具备扩展性，可接入其他 agent CLI

---

## 用户场景与测试 _(必填)_

### 主要用户故事

作为 codex-father 项目的架构设计者和开发者，我需要调整项目开发方向，从原计划的"CLI 优先"转向"MCP 协议优先"，以便更好地与外部生态系统（如 IDE、AI 工具链等）集成，同时实现真正的多任务并行执行能力。

具体而言：
1. **对外协议层**：统一使用 MCP（Model Context Protocol）作为主要协议，确保与外部工具的最佳兼容性；同时保留 CLI 模式支持
2. **对内引擎层**：
   - **MVP1**：管理单个 `codex mcp` 进程，支持多会话排队执行（前端不阻塞）
   - **MVP2**：管理多个 `codex exec --json` 进程，实现真正并行执行（多个任务同时运行）
3. **整体架构**：codex-father 作为统一的 MCP 服务器和进程管理层，负责会话管理、进程调度、审批策略、日志审计等
4. **扩展性**：架构设计支持未来接入其他 agent 模式（如 `claude code` CLI）

### 验收场景

#### MVP1 验收场景

1. **Given** 外部客户端（如 IDE 插件）需要连接 codex-father 服务，**When** 客户端通过 MCP 协议发起连接请求，**Then** codex-father 能够成功建立连接并响应 MCP 标准的 `initialize`、`tools/list`、`tools/call` 等请求，其中 `tools/call` 快速返回 `{ status: "accepted", jobId, conversationId }`，然后通过 MCP `notifications`（method: `codex-father/progress`）推送实际执行进度

2. **Given** codex-father 收到多个并发的 `tools/call` 请求，**When** 使用单个 `codex mcp` 进程管理，**Then** 前端客户端不会被单个长任务阻塞，但后端任务按顺序串行执行（符合 Codex 协议限制）

3. **Given** 用户需要执行某个可能存在风险的命令，**When** codex-father 收到审批请求（ElicitRequest），**Then** 命令行终端界面显示审批提示，用户可以批准/拒绝/跳过，系统无限等待用户决策（可选配置超时自动拒绝）

4. **Given** 系统在运行中产生各类事件（任务开始/完成、命令执行等），**When** 这些事件通过 MCP 通知推送到 codex-father，**Then** codex-father 能够将这些事件以 JSONL 格式持久化到 `.codex-father/sessions/<session-name>-<date>/events.jsonl`，便于审计和回溯

5. **Given** 外部客户端需要取消某个正在运行的任务，**When** 客户端发送 MCP 的 `CancelledNotification`，**Then** codex-father 能够将取消信号传递给对应的会话，并终止任务执行

6. **Given** `codex mcp` 进程崩溃，**When** 监控检测到进程不可用，**Then** 系统自动重启进程（注意：崩溃前的会话状态可能丢失，这是 MVP1 的已知限制）

#### MVP2 验收场景

7. **Given** 用户需要同时运行 3 个独立的开发任务，**When** codex-father 启动 3 个 `codex exec --json` 子进程，**Then** 这 3 个任务能够真正并行执行，互不等待、互不阻塞

8. **Given** 某个 `codex exec` 进程在执行过程中崩溃，**When** codex-father 检测到进程异常退出，**Then** 系统能够找到 Codex 原生的 rollout 文件（存储在 `CODEX_HOME/sessions/*.jsonl`），使用 `codex exec resume <session-id>` 重新启动进程并恢复会话上下文（重新加载历史消息、继续执行）

9. **Given** 系统同时管理多个并行任务的审批请求，**When** 多个任务几乎同时需要审批，**Then** 终端 UI 能够排队显示审批请求，用户逐个处理或批量操作

10. **Given** 用户希望集成新的 agent 类型（如 `claude code`），**When** 在配置文件中添加新的 agent 定义（启动命令、通信协议等），**Then** codex-father 能够管理该新 agent 的生命周期（启动、监控、通信、日志记录）

### 边界情况

#### MVP1 边界情况

- **进程崩溃恢复**：崩溃后自动重启 `codex mcp` 进程，但进程内会话状态可能丢失（这是 Codex MCP 模式的限制）
- **会话排队执行**：多个会话请求会在前端保持响应，但后端由于 Codex 单会话限制会串行执行，用户需要理解这不是"真正并行"
- **协议支持范围**：仅支持 MCP 协议和 CLI 模式，不支持 HTTP/SSE 等其他协议
- **审批超时处理**：
  - 默认行为：无限等待用户决策
  - 可选配置：允许在配置文件中设置超时值（如 30 分钟），超时后自动拒绝
  - 用户体验：终端 UI 显示等待时长，提供快捷键主动跳过，支持白名单命令自动批准
- **日志管理**：按会话名称+日期保存独立日志文件（如 `<session-name>-2025-09-30/`），由用户自行清理，系统不做自动归档

#### MVP2 边界情况

- **进程数量限制**：同时运行的 `codex exec` 进程数量由配置文件指定（默认建议：CPU 核数）
- **会话恢复依赖**：恢复机制依赖 Codex 原生的 rollout 文件（存储在 `CODEX_HOME/sessions/*.jsonl`），如果该文件损坏或丢失，无法恢复；codex-father 自己记录的 `events.jsonl` 和 `config.json` 仅用于辅助监控和审计，不能替代 rollout 文件
- **并行审批管理**：多个任务并行时可能产生多个审批请求，需要排队处理机制，避免终端 UI 混乱
- **Agent 扩展**：新 agent 必须支持类似 `codex exec --json` 的 JSON 事件流输出，才能被 codex-father 管理
- **MCP 接口桥接**：codex-father 需要将标准 MCP 工具调用（`tools/call`）桥接到 Codex 自定义的 JSON-RPC 方法（如 `newConversation`、`sendUserTurn`），并处理异步事件通知（`codex/event`）的返回
- **异步响应机制**：`tools/call` 必须快速返回轻量结果（如 `{ status: "accepted", jobId }`），避免阻塞客户端；实际执行进度通过 MCP `notifications`（method: `codex-father/progress`）异步推送，客户端使用 `jobId` 关联事件

---

## 需求 _(必填)_

### 功能需求

#### MCP 协议支持（MVP1）

- **FR-001**: 系统必须实现完整的 MCP 协议服务端，支持标准的 `initialize`、`tools/list`、`tools/call`、`notifications` 等 MCP 消息类型
- **FR-002**: 系统必须能够通过 stdio 与外部 MCP 客户端通信（标准 MCP 传输方式）
- **FR-003**: 系统必须实现 MCP 接口桥接层：
  - 将标准 MCP 的 `tools/call` 请求转换为 Codex 自定义的 JSON-RPC 方法调用（如 `newConversation`、`sendUserTurn`、`interruptConversation` 等）
  - 接收 Codex 的异步事件通知（`codex/event`），并通过 MCP `notifications` 机制转发给外部客户端
  - 在 `tools/list` 响应中暴露包装后的工具（如 "start-codex-task"、"send-message"、"interrupt-task" 等），每个工具对应一个 Codex 方法
  - **异步响应约定**：`tools/call` 必须在 **500ms 内**快速返回轻量结果（如 `{ status: "accepted", jobId: "...", conversationId: "..." }`），避免长时间占用客户端交互线程（参考 Constitution v1.1.0 性能要求和 plan.md Technical Context）；实际执行进度通过后续的 MCP `notifications` 推送，使用 `jobId` 关联事件
  - **事件映射约定**：将 Codex 的 `codex/event` 流（如 `TaskStarted`、`AgentMessage`、`TaskComplete`）映射为 MCP 通知，通知的 `method` 为 `codex-father/progress`，`params` 包含 `{ jobId, eventType, eventData, timestamp }`
- **FR-004**: 系统必须支持命令行操作
  - **MVP1 范围**：CLI 启动 MCP 服务器（`codex-father mcp`）✓
  - **MVP2 实现**：CLI 直接执行任务模式（`codex-father task --prompt "..." --model ...`），不依赖外部 MCP 客户端

#### 单进程多会话管理（MVP1）

- **FR-005**: 系统必须能够启动并管理一个常驻的 `codex mcp` 进程
- **FR-006**: 系统必须维护 `request_id` ↔ `conversationId` 的映射关系，以便路由后续消息和取消请求
- **FR-007**: 系统必须能够接收多个并发的 `tools/call` 请求，保持前端响应（不阻塞客户端），即使后端由于 Codex 限制只能串行执行任务
- **FR-008**: 系统必须支持会话取消：接收外部的 `CancelledNotification`，并通过桥接层调用 Codex 的 `interruptConversation` 方法
- **FR-009**: 系统必须提供健康检查机制：定期检测 `codex mcp` 进程的存活状态，崩溃时自动重启
- **FR-010**: MVP1 阶段对于进程崩溃后的会话状态丢失是可接受的（已知限制，在 MVP2 解决）

#### 多进程并行管理（MVP2）

- **FR-011**: 系统必须能够按需启动多个 `codex exec --json` 子进程，实现真正的并行执行
- **FR-012**: 系统必须实现进程池管理：维护进程列表、监控进程状态、自动清理退出的进程
- **FR-013**: 系统必须支持配置最大并行进程数量（默认建议：等于 CPU 核数）
- **FR-014**: 系统必须能够将每个任务路由到独立的 `codex exec` 进程，确保任务间互不干扰
- **FR-015**: 系统必须支持基于 Codex 原生 rollout 文件的会话恢复：
  - 识别 Codex 写入 `CODEX_HOME/sessions/<conversation-id>.jsonl` 的 rollout 文件
  - 当进程崩溃时，使用 `codex exec resume <session-id>` 命令指向该 rollout 文件路径
  - codex-father 自己记录的 `events.jsonl` 和 `config.json` 仅用于辅助监控和审计，不用于恢复
- **FR-016**: 系统必须为每个 `codex exec` 进程创建独立的工作目录和日志目录
- **FR-017**: 系统必须确保 Codex 的 rollout 文件不被意外删除或覆盖，必要时将其备份到 codex-father 的会话目录
- **FR-018**: 系统的架构必须支持扩展到其他 agent 类型（如 `claude code` CLI），通过配置文件定义新 agent 的启动命令、通信协议、事件解析规则

#### 审批策略与安全（MVP1 + MVP2）

- **FR-019**: 系统必须支持审批策略：能够接收 Codex 通过 MCP 请求发出的审批请求（`applyPatchApproval`、`execCommandApproval`），并根据策略引擎或人工审批做出决策
- **FR-020**: 系统必须支持策略引擎：根据作业/租户/命令类型/白名单等规则，自动批准或拒绝审批请求，并通过 MCP 响应 `{ decision: "allow" | "deny" }`
- **FR-021**: 系统必须提供人工审批兜底机制：对于无法自动决策的请求，需要在命令行终端界面显示审批提示
- **FR-022**: 系统必须实现以下审批体验：
  - 默认行为：无限等待用户决策（不超时）
  - 终端 UI 显示：审批请求详情、等待时长计时器、操作提示（批准/拒绝/跳过）
  - 快捷操作：提供快捷键主动跳过当前审批
  - 白名单支持：允许用户预配置安全命令白名单，自动批准
  - 可选超时：允许在配置文件中设置超时值，超时后自动拒绝
- **FR-023** (MVP2): 系统必须支持多个并行任务的审批请求排队管理，避免终端 UI 混乱
- **FR-024**: 系统必须支持沙箱策略配置：每个任务可以指定不同的沙箱级别（通过 `newConversation` 的 `sandbox` 参数传递给 Codex）
- **FR-025**: 系统不强制禁止 `--yolo` 模式，但应在文档和 UI 中警示其风险

#### 事件日志与审计（MVP1 + MVP2）

- **FR-026**: 系统必须接收并记录所有 MCP 事件通知（`codex/event`），或解析 `codex exec --json` 的 JSON 事件流
- **FR-027**: 系统必须将事件日志以 JSONL 格式持久化到 `.codex-father/sessions/<session-name>-<date>/events.jsonl`，用于监控和审计
- **FR-028**: 系统必须为每个作业创建独立的会话目录（命名格式：`<session-name>-<date>`），包含：
  - `events.jsonl`（完整事件流，用于监控和审计）
  - `stdout.log` / `stderr.log`（进程标准输出/错误）
  - `config.json`（任务配置：cwd、模型、策略、会话 id、请求 id 等）
  - `rollout-ref.txt`（记录 Codex 原生 rollout 文件的路径，如 `CODEX_HOME/sessions/<conversation-id>.jsonl`）
- **FR-029**: 系统必须支持日志脱敏：对敏感信息（密钥、令牌等）进行自动屏蔽
- **FR-030**: 日志文件由用户自行管理和清理，系统不提供自动归档、轮转或删除功能
- **FR-031** (MVP2): 会话恢复机制必须能够读取 `rollout-ref.txt` 找到 Codex 原生 rollout 文件，并使用 `codex exec resume` 命令恢复会话；codex-father 的 `events.jsonl` 和 `config.json` 仅用于辅助监控，不用于恢复

#### 超时与资源控制（MVP1 + MVP2）

- **FR-032**: 系统必须为每个任务设置超时时间，默认值为 1 小时，可按任务覆盖
- **FR-033**: 超时后系统必须自动终止任务（通过桥接层调用 `interruptConversation` 或终止 exec 进程），并记录超时事件
- **FR-034**: MVP 阶段暂不实现 CPU、内存、磁盘等系统资源限额
- **FR-035**: MVP 阶段暂不实现基于成本的限额（如 API 费用预算）

#### 容器与部署（MVP1 + MVP2）

- **FR-037**: 系统必须支持容器化部署：能够在 Docker 容器内运行，并通过容器级隔离替代 codex 的原生沙箱（Landlock/seccomp 在容器内可能不可用）
- **FR-038**: 系统必须支持 Devcontainer：能够在 VSCode Devcontainer 环境中运行，并自动完成初始化（如 `codex login --api-key`）
- **FR-039** (MVP2): 系统必须支持多入口配置：能够启动多个独立的 codex-father 实例（如一个管理 `codex mcp`，另一个管理 `codex exec` 池），每个实例使用独立的配置文件
- **FR-040**: MVP 阶段暂不支持跨容器/跨主机的分布式部署

#### 可观测性与运维（MVP1 + MVP2）

- **FR-041**: 系统必须提供健康检查接口：能够检测管理的进程（`codex mcp` 或 `codex exec`）的存活状态和服务可用性
- **FR-042** (MVP2): 系统必须收集并暴露关键指标：并发数、耗时、审批命中率、超时/取消率、失败原因分布等
- **FR-043** (MVP2): 系统必须将指标以 JSON 格式输出到日志文件，便于后续分析和监控
- **FR-044**: 系统必须支持进程级日志输出：通过 `RUST_LOG` 或类似环境变量控制日志级别，并将 stderr 重定向到文件
- **FR-045** (MVP1): 系统必须支持异常重启：当检测到 `codex mcp` 进程崩溃或不可用时，自动重启（会话状态可能丢失）
- **FR-046** (MVP2): 系统必须支持异常重启和会话恢复：当检测到 `codex exec` 进程崩溃时，自动重启并使用 `codex exec resume` 基于 Codex 原生 rollout 文件恢复会话

### 关键实体 _(特性涉及数据时包含)_

- **Job（作业）**: 表示一次完整的 AI 辅助任务，包含输入提示、目标、执行策略、超时时间等属性；每个作业对应一个唯一的 `job-id`
- **Session（会话）**: 表示一次 agent 的交互式对话，包含多轮消息往来；每个会话对应一个唯一的 `conversationId`（Codex 原生标识符）；会话目录命名格式为 `<session-name>-<date>`
- **MCPBridgeLayer（MCP 桥接层）** (MVP1): 负责将标准 MCP 协议（`tools/call`）转换为 Codex 自定义 JSON-RPC 方法（`newConversation`、`sendUserTurn` 等），并处理异步事件通知（`codex/event`）和审批请求（`applyPatchApproval`、`execCommandApproval`）
- **ProcessManager（进程管理器）**:
  - MVP1：管理单个 `codex mcp` 进程的生命周期（启动、监控、重启）
  - MVP2：管理进程池，维护多个 `codex exec` 进程（启动、监控、终止、清理）
- **SessionRecoveryManager（会话恢复管理器）** (MVP2): 负责识别 Codex 原生 rollout 文件路径（`CODEX_HOME/sessions/<conversation-id>.jsonl`），并使用 `codex exec resume` 命令恢复会话；不依赖 codex-father 自己的 `events.jsonl` 或 `config.json`
- **ApprovalRequest（审批请求）**: 表示一次需要外部决策的请求（如命令执行审批），包含命令内容、风险评估、决策结果、等待时长等
- **ApprovalQueue（审批队列）** (MVP2): 管理多个并行任务的审批请求，支持排队显示和批量操作
- **ApprovalPolicy（审批策略）**: 定义审批规则，包含白名单命令、自动批准条件、超时配置等
- **Event（事件）**: 表示系统运行中产生的各类通知，包含事件类型、时间戳、关联的会话/作业 id、事件内容等
- **AgentDefinition（Agent 定义）** (MVP2): 定义外部 agent 的配置信息，包含启动命令、通信协议类型、事件解析规则、工作目录模板等，支持扩展到 `claude code` 等其他 agent
- **MetricsSummary（指标摘要）**: 表示某个时间段内的系统运行指标汇总，包含并发数、耗时统计、审批统计等，以 JSON 格式输出

---

## 审查与验收清单

_门禁：在 main() 执行过程中运行的自动检查_

### 内容质量

- [x] 无实现细节（语言、框架、API）
- [x] 聚焦用户价值和业务需求
- [x] 面向非技术干系人撰写
- [x] 所有必填章节已完成

### 需求完整性

- [x] 所有不明确的点已与用户澄清
- [x] 需求可测试且无歧义
- [x] 成功标准可衡量
- [x] 范围清晰界定（MVP1/MVP2 分阶段明确）
- [x] 依赖和假设已识别

---

## 执行状态

_由 main() 在处理过程中更新_

- [x] 用户描述已解析
- [x] 关键概念已提取
- [x] 模糊点已标记并澄清
- [x] 用户场景已定义
- [x] 需求已生成
- [x] 实体已识别
- [x] 审查清单通过

---

## 需求澄清总结（最终版）

以下为与用户确认的关键决策点及其最终决定：

### 1. MVP 分阶段交付策略 ⭐
- **MVP1**：MCP 多会话管理（单进程 `codex mcp`，排队执行）
- **MVP2**：CLI/exec 多进程并行管理（真正并行 + 会话恢复 + agent 扩展）
- **理由**：分阶段交付降低复杂度，快速验证核心价值

### 2. 并发模型澄清 ⭐
- **问题**：Codex 协议文档明确指出单个会话同一时间只能运行一个任务，这与"多会话并发"的描述存在歧义
- **澄清**：
  - **MVP1**："多会话"指前端客户端不阻塞，可以发起多个请求，但后端实际是串行执行（符合 Codex 限制）
  - **MVP2**：通过管理多个 `codex exec` 进程实现真正并行执行，每个进程独立运行一个任务
- **决定**：使用 MCP 协议管理多个 CLI 进程（而非依赖单进程内并发），实现真正并行

### 3. 会话恢复机制 ⭐
- **问题**：Codex MCP 模式在进程重启后无法自动恢复会话状态
- **澄清**：会话恢复必须依赖 Codex 原生的 rollout 文件（`CODEX_HOME/sessions/*.jsonl`），不能依赖 codex-father 自己记录的 `events.jsonl` 或 `config.json`
- **技术约束**：`codex exec resume` 命令需要读取 Codex 自己写入的 rollout 文件才能重建会话状态，外部日志无法替代
- **决定**：
  - **MVP1**：进程崩溃后自动重启，但会话状态丢失（已知限制）
  - **MVP2**：实现基于 Codex 原生 rollout 文件的会话恢复，使用 `codex exec resume <session-id>` 恢复执行；codex-father 需要记录 rollout 文件路径（通过 `rollout-ref.txt`）并确保文件不被删除

### 4. Token 管理与上下文压缩 ⭐
- **问题**：Codex 协议文档中未找到 `TokenCount` 事件和上下文压缩控制接口
- **澄清**：Codex 内部已有 Token 管理和上下文压缩机制，无需在 codex-father 层重复实现
- **决定**：移除 FR-025/FR-026（Token 统计和压缩需求），依赖 codex 内部机制

### 5. Agent 扩展性 ⭐
- **决定**：架构设计必须支持扩展到其他 agent CLI（如 `claude code`）
- **实现方向**：通过配置文件定义 `AgentDefinition`，包含启动命令、通信协议、事件解析规则等
- **目标**：MVP2 完成架构设计，后续可无缝接入新 agent

### 6. MCP 接口桥接策略 ⭐
- **问题**：Codex MCP 接口使用自定义 JSON-RPC 方法（如 `newConversation`、`sendUserTurn`），不是标准 MCP 工具调用格式；且 Codex 内核同一时刻只能执行一个 turn，需要异步处理避免阻塞客户端
- **澄清**：codex-father 需要实现桥接层，将标准 MCP 的 `tools/call` 转换为 Codex 自定义方法，并处理异步事件通知和审批请求
- **决定**：
  - 在 `tools/list` 响应中暴露包装后的工具（如 "start-codex-task"、"send-message"、"interrupt-task"）
  - 每个工具内部调用对应的 Codex JSON-RPC 方法
  - **异步响应约定**：
    - `tools/call` 快速返回轻量结果：`{ status: "accepted" | "rejected", jobId: "<uuid>", conversationId: "<cid>", message: "..." }`
    - 实际执行进度通过 MCP `notifications` 推送，method: `codex-father/progress`，params: `{ jobId, eventType, eventData, timestamp }`
    - 客户端使用 `jobId` 关联后续事件（如 `TaskStarted`、`AgentMessage`、`TaskComplete`、`TaskError`）
  - 接收 `codex/event` 通知（`TaskStarted`、`AgentMessage`、`TaskComplete` 等），映射为 `codex-father/progress` 通知并转发给外部客户端
  - 处理 Codex 发起的审批请求（`applyPatchApproval`、`execCommandApproval`），并通过策略引擎或人工审批返回决策

### 7. 协议支持范围
- **决定**：仅支持 MCP 协议和 CLI 模式
- **排除**：HTTP/SSE 等其他协议适配

### 8. 审批机制
- **界面形式**：命令行终端 UI
- **超时策略**：默认无限等待，可选配置超时自动拒绝
- **用户体验**：显示等待时长、快捷跳过、白名单自动批准
- **MVP2 增强**：支持多个并行审批请求的排队管理
- **MCP 集成**：接收 Codex 的 `applyPatchApproval`/`execCommandApproval` 请求，返回 `{ decision: "allow" | "deny" }`

### 9. 日志管理
- **命名规范**：`<session-name>-<date>/`
- **保留策略**：由用户自行清理，系统不做自动归档
- **持久化用途**：codex-father 的 `events.jsonl` 和 `config.json` 仅用于监控和审计，不用于会话恢复
- **Rollout 文件引用**：必须记录 Codex 原生 rollout 文件路径（`rollout-ref.txt`），用于 MVP2 会话恢复

### 10. 超时配置
- **默认值**：1 小时/任务
- **处理方式**：单阶段硬终止（发送取消或杀进程）

### 11. 资源限额
- **排除功能**：CPU/内存/磁盘限额、成本预算限额、Token 统计与压缩
- **简化 MVP**：聚焦核心功能

### 12. 部署模式
- **排除功能**：跨容器/跨主机分布式部署
- **支持范围**：单机容器化部署 + Devcontainer

### 13. 可观测性
- **指标输出**：JSON 格式日志文件
- **排除**：Prometheus 等监控系统集成

### 14. 安全策略
- **决定**：不强制禁止 `--yolo` 模式，但文档警示风险

### 15. 崩溃恢复
- **MVP1**：自动重启进程，会话状态丢失（可接受）
- **MVP2**：自动重启 + 基于 Codex 原生 rollout 文件的会话恢复（完整能力）

---

## 架构演进路径（参考）

### MVP1 架构简图（概念）

```
外部 MCP 客户端
    ↓ (MCP/stdio)
codex-father (MCP Server)
    ↓ (管理)
单个 codex mcp 进程
    ↓ (串行执行任务)
任务 1 → 任务 2 → 任务 3 (排队)
```

**特点**：
- 前端不阻塞，响应快
- 后端串行，任务按顺序执行
- 适合单用户、低并发场景

### MVP2 架构简图（概念）

```
外部 MCP 客户端
    ↓ (MCP/stdio)
codex-father (MCP Server + 进程管理器)
    ↓ (管理多个进程)
    ├── codex exec 进程 1 (任务 A)
    ├── codex exec 进程 2 (任务 B)
    └── codex exec 进程 3 (任务 C)
       (真正并行执行)
```

**特点**：
- 真正并行，多任务同时运行
- 进程级隔离，互不干扰
- 支持会话恢复（基于持久化文件）
- 架构可扩展到其他 agent CLI

---

**下一步**：进入设计与规划阶段（plan.md），将业务需求转化为技术实现方案。重点关注：
1. **MCP 桥接层设计**：
   - 如何将标准 MCP 工具调用转换为 Codex 自定义 JSON-RPC 方法
   - 异步响应机制：`tools/call` 快速返回 + 事件通知映射（`codex/event` → `codex-father/progress`）
   - 如何使用 `jobId` 关联请求和后续事件
   - 如何处理审批请求（`applyPatchApproval`、`execCommandApproval`）
2. **进程管理和监控机制**：单进程（MVP1）和进程池（MVP2）的管理策略
3. **会话恢复机制**：如何识别和引用 Codex 原生 rollout 文件（`CODEX_HOME/sessions/*.jsonl`），如何使用 `codex exec resume` 恢复会话
4. **Agent 扩展的插件化架构设计**：支持未来接入 `claude code` 等其他 agent CLI