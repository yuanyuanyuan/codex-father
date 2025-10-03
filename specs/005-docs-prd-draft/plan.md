# Implementation Plan: 架构调整 - MCP 模式优先实现

**Branch**: `005-docs-prd-draft` | **Date**: 2025-09-30 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/data/codex-father/specs/005-docs-prd-draft/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from file system structure or context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Fill the Constitution Check section based on the content of the constitution document.
4. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
5. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
6. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, `GEMINI.md` for Gemini CLI, `QWEN.md` for Qwen Code or `AGENTS.md` for opencode).
7. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
8. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
9. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by
other commands:

- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

本特性将 codex-father 项目的开发方向从"CLI 优先"调整为"MCP 协议优先"，以实现更好的外部生态集成和多任务并行能力。

**核心需求**：
- **对外协议层**：统一使用 MCP（Model Context Protocol）作为主协议，确保与 IDE、AI 工具链的兼容性
- **对内引擎层**：分两个 MVP 阶段实现
  - **MVP1**：管理单个 `codex mcp` 进程，支持多会话排队执行（前端不阻塞，后端串行）
  - **MVP2**：管理多个 `codex exec --json` 进程，实现真正并行执行（多任务同时运行）
- **架构扩展性**：设计支持未来接入其他 agent CLI（如 `claude code`）

**技术方法**：
- 实现 MCP 协议桥接层，将标准 MCP 工具调用转换为 Codex 自定义 JSON-RPC 方法
- 采用异步响应机制：`tools/call` 快速返回 + 事件通知推送，避免阻塞客户端
- 基于 Codex 原生 rollout 文件实现会话恢复机制（MVP2）
- 构建进程池管理器，支持真正的多任务并行（MVP2）

## Technical Context

**Language/Version**: TypeScript 5.3+ with Node.js 18+
**Primary Dependencies**:
- MCP 协议库（@modelcontextprotocol/sdk 或自研实现）
- Node.js 进程管理（child_process, process monitoring）
- JSON-RPC 2.0 库（用于 Codex 自定义方法调用）
- winston（日志）
- zod（数据验证）
- fs-extra（文件系统操作）
- existing: commander, chalk, yaml

**Storage**: 文件系统（JSONL 事件日志、JSON 配置、Codex 原生 rollout 文件引用）
**Testing**: vitest（单元测试、集成测试、契约测试）
**Target Platform**: Linux server / macOS / Docker containers / VSCode Devcontainer
**Project Type**: single（CLI + MCP Server 架构，统一代码库）
**Performance Goals**:
- MCP 工具响应 < 500ms（constitution 要求）
- CLI 命令启动时间 < 1s（constitution 要求）
- 事件通知延迟 < 100ms
- 支持并发会话数：MVP1 单进程排队，MVP2 根据 CPU 核数（默认 4-8 个进程）

**Constraints**:
- Codex 单会话限制：同一时间只能运行一个 turn（MVP1 限制）
- 会话恢复依赖：必须使用 Codex 原生 rollout 文件（`CODEX_HOME/sessions/*.jsonl`）
- 内存占用：MCP 服务器 < 200MB（constitution 要求）
- 沙箱限制：容器环境下 Codex 原生沙箱（Landlock/seccomp）可能不可用

**Scale/Scope**:
- MVP1：单用户、低并发场景（1 个进程，排队执行）
- MVP2：多用户/高并发场景（N 个进程，真正并行，N 由配置或 CPU 核数决定）
- 单个任务超时：默认 1 小时
- 日志保留：由用户自行管理（无自动归档）

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

基于 Codex Father 项目宪章 v1.1.0 的合规性检查：

### 代码质量与可维护性

- [x] 设计遵循 DRY、KISS、YAGNI 原则
  - 桥接层统一转换逻辑（DRY）
  - 使用标准 MCP 协议，不重新发明轮子（KISS）
  - MVP1 仅实现单进程管理，MVP2 再扩展并行（YAGNI）
- [x] 命名规范：Shell 使用 snake_case，TypeScript 使用 camelCase
  - 现有代码库已遵循该规范
- [x] 复杂逻辑有清晰的文档说明
  - MCP 桥接层、异步响应机制、会话恢复机制均在 spec.md 详细说明

### 测试优先开发（TDD - 非协商项）

- [x] 所有新功能都规划了测试优先的开发流程
  - Phase 1 将生成契约测试（基于 MCP 协议接口和 Codex JSON-RPC 方法）
  - 测试将在实现前编写，确保失败（红灯），然后实现功能使测试通过（绿灯）
- [x] 契约测试覆盖所有 MCP 工具接口和 CLI 命令
  - MCP 标准方法：`initialize`, `tools/list`, `tools/call`, `notifications`
  - Codex 自定义方法：`newConversation`, `sendUserTurn`, `interruptConversation`
  - 审批请求：`applyPatchApproval`, `execCommandApproval`
- [x] 测试覆盖率目标：核心功能 ≥80%，关键路径 100%
  - 关键路径：MCP 桥接层、进程管理器、会话恢复（MVP2）、审批策略引擎

### 用户体验一致性

- [x] CLI 参数命名遵循现有模式（--task、--dry-run、--json）
  - 沿用现有 commander 配置，保持一致性
  - MCP 模式使用 stdio，不涉及额外 CLI 参数
- [x] 支持 --help 参数和清晰的错误消息
  - FR-022: 终端 UI 显示审批请求详情、等待时长、操作提示
  - 错误恢复机制在 FR-009, FR-045, FR-046 中明确定义
- [x] 输出格式统一（人类可读 + 机器可解析）
  - MCP 通知使用标准 JSON 格式（`codex-father/progress`）
  - 日志使用 JSONL 格式（FR-027）
  - 指标输出 JSON 格式（FR-043）

### 性能与效率要求

- [x] CLI 命令启动时间 < 1s，MCP 工具响应 < 500ms
  - Technical Context 已明确：MCP 工具响应 < 500ms，事件通知延迟 < 100ms
  - FR-003: 异步响应机制确保快速返回（< 500ms），避免阻塞
- [x] 内存占用：Shell 脚本 < 100MB，MCP 服务器 < 200MB
  - Technical Context 已明确：MCP 服务器 < 200MB
  - 使用文件系统持久化，避免大量内存缓存
- [x] 性能关键路径有基准测试计划
  - Phase 1 将为 MCP 桥接层、进程启动、事件通知生成性能测试
  - 基准测试覆盖：协议转换延迟、进程启动时间、并发会话数

### 安全与可靠性

- [x] 默认使用安全策略（--sandbox workspace-write）
  - FR-024: 沙箱策略配置通过 `newConversation` 的 `sandbox` 参数传递给 Codex
  - FR-037: 容器化部署支持容器级隔离
- [x] 输入验证和敏感信息脱敏设计
  - FR-029: 日志脱敏，对敏感信息（密钥、令牌）自动屏蔽
  - 使用 zod 进行数据验证（现有依赖）
- [x] 错误恢复和审计日志机制
  - FR-027~FR-031: 完整的事件日志和审计机制（JSONL 格式）
  - FR-015, FR-046: 基于 Codex 原生 rollout 文件的会话恢复
  - FR-009, FR-045: 进程崩溃自动重启

### 协议与架构决策（新增 - Constitution v1.1.0）

- [x] MCP 协议优先，确保外部生态兼容性
  - FR-001: 实现完整的 MCP 协议服务端
  - FR-002: 通过 stdio 与外部 MCP 客户端通信
- [x] 协议桥接层明确定义
  - FR-003: MCP 接口桥接层，转换标准 MCP 到 Codex 自定义 JSON-RPC
  - 清晰的事件映射约定（`codex/event` → `codex-father/progress`）
- [x] 异步响应机制设计
  - FR-003: `tools/call` 快速返回 + MCP `notifications` 推送进度
  - 使用 `jobId` 关联请求和事件
- [x] 进程管理策略分阶段实现
  - MVP1: FR-005~FR-010（单进程管理，排队执行）
  - MVP2: FR-011~FR-018（进程池管理，真正并行）
- [x] 会话恢复基于后端原生持久化
  - FR-015, FR-017: 依赖 Codex 原生 rollout 文件（`CODEX_HOME/sessions/*.jsonl`）
  - FR-031: codex-father 的日志仅用于监控和审计，不用于恢复
- [x] 架构支持多 agent 扩展
  - FR-018: 配置文件定义 agent 启动命令、通信协议、事件解析规则
- [x] 关注点分离和配置驱动
  - 协议层、桥接层、管理层、持久化层职责明确
  - 审批策略、超时时间、进程数量均可配置（FR-013, FR-020, FR-032）

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)

```
core/
├── mcp/                          # MCP 协议实现（新增 MVP1）
│   ├── server.ts                 # MCP 服务器主逻辑
│   ├── bridge-layer.ts           # MCP ↔ Codex JSON-RPC 桥接层
│   ├── protocol/                 # MCP 协议定义和验证
│   │   ├── types.ts
│   │   ├── initialize.ts
│   │   ├── tools.ts
│   │   └── notifications.ts
│   ├── codex-client.ts           # Codex JSON-RPC 客户端封装
│   ├── event-mapper.ts           # codex/event → codex-father/progress 映射
│   └── tests/
│       ├── contract/             # MCP 协议契约测试
│       ├── bridge-layer.test.ts  # 桥接层测试
│       └── event-mapper.test.ts
├── process/                      # 进程管理（新增 MVP1+MVP2）
│   ├── manager.ts                # MVP1: 单进程管理器
│   ├── pool-manager.ts           # MVP2: 进程池管理器
│   ├── process-monitor.ts        # 进程监控和健康检查
│   ├── session-recovery.ts       # MVP2: 基于 rollout 文件的会话恢复
│   └── tests/
│       ├── manager.test.ts
│       ├── pool-manager.test.ts
│       └── session-recovery.test.ts
├── approval/                     # 审批机制（新增 MVP1）
│   ├── policy-engine.ts          # 审批策略引擎
│   ├── terminal-ui.ts            # 终端 UI 审批界面
│   ├── approval-queue.ts         # MVP2: 审批队列管理
│   └── tests/
│       ├── policy-engine.test.ts
│       └── terminal-ui.test.ts
├── session/                      # 会话管理（新增 MVP1）
│   ├── session-manager.ts        # 会话生命周期管理
│   ├── event-logger.ts           # JSONL 事件日志记录
│   ├── config-persister.ts       # 会话配置持久化
│   └── tests/
│       └── session-manager.test.ts
├── lib/                          # 现有通用库（保留）
│   ├── queue/                    # 任务队列（保留，与 MCP 并行使用）
│   ├── storage/
│   ├── validation/
│   └── utils/
└── cli/                          # CLI 命令（保留，增强）
    ├── commands/
    │   ├── mcp-command.ts        # 新增：启动 MCP 服务器命令
    │   ├── queue-command.ts      # 保留
    │   ├── config-command.ts     # 保留
    │   └── meta-commands.ts      # 保留
    └── tests/
        └── mcp-command.test.ts   # 新增

tests/                            # 根级测试（新增）
├── contract/                     # MCP 契约测试
│   ├── mcp-initialize.test.ts
│   ├── mcp-tools-list.test.ts
│   ├── mcp-tools-call.test.ts
│   └── codex-jsonrpc.test.ts
├── integration/                  # 集成测试
│   ├── mvp1-single-process.test.ts
│   ├── mvp2-process-pool.test.ts
│   ├── session-recovery.test.ts
│   └── approval-flow.test.ts
└── e2e/                          # 端到端测试
    └── full-workflow.test.ts

.codex-father/                    # 会话数据目录（运行时生成）
└── sessions/
    └── <session-name>-<date>/
        ├── events.jsonl          # 事件日志（监控和审计）
        ├── config.json           # 会话配置
        ├── rollout-ref.txt       # Codex 原生 rollout 文件路径引用
        ├── stdout.log
        └── stderr.log
```

**Structure Decision**:

选择 **Option 1: Single project**，因为：
1. **项目类型**：CLI + MCP Server 统一架构，不涉及前后端分离或移动端
2. **代码组织**：按功能模块分层（`core/mcp/`, `core/process/`, `core/approval/`, `core/session/`）
3. **现有结构兼容**：保留 `core/lib/` 和 `core/cli/`，确保向后兼容
4. **测试分层**：单元测试在模块内（`*/tests/`），契约/集成/E2E 测试在根级 `tests/`
5. **扩展性**：新增模块清晰独立，易于 MVP2 扩展（如 `process/pool-manager.ts`）

## Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

## Phase 1: Design & Contracts

_Prerequisites: research.md complete_

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate API contracts** from functional requirements:
   - For each user action → endpoint
   - Use standard REST/GraphQL patterns
   - Output OpenAPI/GraphQL schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per endpoint
   - Assert request/response schemas
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude` **IMPORTANT**:
     Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/\*, failing tests, quickstart.md,
agent-specific file

## Phase 2: Task Planning Approach

_This section describes what the /tasks command will do - DO NOT execute during
/plan_

### Task Generation Strategy

**输入来源**：
1. **contracts/**：MCP 协议契约和 Codex JSON-RPC 契约
2. **data-model.md**：核心实体定义（Job, Session, MCPBridgeLayer, ProcessManager 等）
3. **quickstart.md**：4 个验收场景（MVP1 基本流程、审批机制、MVP2 并行执行、会话恢复）
4. **Project Structure**：代码目录结构（core/mcp/, core/process/, core/approval/, core/session/）

### Task Generation Rules

#### 1. 契约测试任务（优先级最高，TDD 基础）

**MCP 协议契约测试**（来自 `contracts/mcp-protocol.yaml`）：
- Task: 编写 `tests/contract/mcp-initialize.test.ts` [P]
  - 验证 `initialize` 请求/响应格式
  - 验证协议版本协商
  - 验证服务端 capabilities
- Task: 编写 `tests/contract/mcp-tools-list.test.ts` [P]
  - 验证工具列表响应格式
  - 验证 `start-codex-task`, `interrupt-task` 工具存在
  - 验证 inputSchema 完整性
- Task: 编写 `tests/contract/mcp-tools-call.test.ts` [P]
  - 验证快速返回（< 500ms）
  - 验证响应包含 `status`, `jobId`, `conversationId`
  - 验证异步通知接收（`codex-father/progress`）

**Codex JSON-RPC 契约测试**（来自 `contracts/codex-jsonrpc.yaml`）：
- Task: 编写 `tests/contract/codex-jsonrpc.test.ts` [P]
  - 验证 `newConversation` 请求/响应
  - 验证 `sendUserTurn` 请求/响应
  - 验证 `interruptConversation` 请求/响应
  - 验证审批请求处理（`applyPatchApproval`, `execCommandApproval`）

**估计任务数**：4 个契约测试任务（全部 [P] 并行）

#### 2. 实体创建任务（基于 data-model.md）

**核心类型定义**（来自 data-model.md）：
- Task: 创建 `core/lib/types.ts` [P]
  - 定义 Job, JobStatus, JobMetrics
  - 定义 Session, SessionStatus
  - 定义 ApprovalRequest, ApprovalPolicy
  - 定义 Event, EventType
  - 使用 Zod 定义 schema（JobSchema, SessionSchema 等）

**估计任务数**：1 个类型定义任务

#### 3. 模块实现任务（按依赖顺序）

**第一层：基础设施（无外部依赖，可并行）**：
- Task: 实现 `core/session/event-logger.ts` [P]
  - JSONL 格式事件日志写入
  - 流式写入，避免内存缓存
  - 日志脱敏功能（FR-029）
- Task: 实现 `core/session/config-persister.ts` [P]
  - 会话配置 JSON 持久化
  - rollout-ref.txt 写入和读取
- Task: 实现 `core/approval/policy-engine.ts` [P]
  - 白名单规则匹配
  - 审批决策逻辑（auto-approve vs manual）
  - 配置文件加载（YAML）

**第二层：核心组件（依赖第一层）**：
- Task: 实现 `core/mcp/protocol/types.ts`
  - MCP 协议类型定义（InitializeRequest, ToolsListResponse 等）
  - Zod schema 验证
- Task: 实现 `core/mcp/codex-client.ts`
  - child_process.spawn 封装
  - line-delimited JSON 解析（使用 readline）
  - JSON-RPC 请求/响应映射（request_id → Promise）
  - 通知处理（EventEmitter）
- Task: 实现 `core/approval/terminal-ui.ts`
  - inquirer 交互式 UI
  - 审批提示显示（命令、CWD、原因）
  - 等待时长计时器
  - 快捷操作支持

**第三层：桥接层和进程管理（依赖第二层）**：
- Task: 实现 `core/mcp/event-mapper.ts`
  - Codex `codex/event` → MCP `codex-father/progress` 映射
  - jobId 关联逻辑
  - 事件类型转换（TaskStarted → task-started）
- Task: 实现 `core/mcp/bridge-layer.ts`
  - MCP 工具定义（`start-codex-task`, `interrupt-task`）
  - tools/call 快速返回逻辑（< 500ms）
  - Codex JSON-RPC 方法调用封装
  - 审批请求转发（applyPatchApproval → policy-engine → terminal-ui）
- Task: 实现 `core/session/session-manager.ts`
  - 会话生命周期管理（INITIALIZING → ACTIVE → IDLE → TERMINATED）
  - 会话目录创建
  - 配置和日志持久化集成
- Task: 实现 `core/process/manager.ts` (MVP1)
  - 单进程 `codex mcp` 管理
  - conversationMap 维护（request_id ↔ conversationId）
  - 健康检查定时器
  - 自动重启逻辑

**第四层：MCP 服务器（依赖第三层）**：
- Task: 实现 `core/mcp/server.ts` (MVP1)
  - MCP 协议服务端实现（使用 @modelcontextprotocol/sdk）
  - stdio 传输
  - `initialize`, `tools/list`, `tools/call` 处理
  - `notifications/cancelled` 处理
  - 通知推送（`codex-father/progress`）

**第五层：CLI 命令（依赖第四层）**：
- Task: 实现 `core/cli/commands/mcp-command.ts`
  - `codex-father mcp` 命令
  - 启动 MCP 服务器
  - 配置加载和验证
  - 优雅关闭处理

**估计任务数**：12 个实现任务（第一层 3 个 [P]，其余依赖顺序）

#### 4. 单元测试任务（与实现任务配对）

每个实现任务后立即创建对应的单元测试任务：
- Task: 编写 `core/session/tests/event-logger.test.ts`
- Task: 编写 `core/session/tests/config-persister.test.ts`
- Task: 编写 `core/approval/tests/policy-engine.test.ts`
- Task: 编写 `core/mcp/tests/codex-client.test.ts`
- Task: 编写 `core/approval/tests/terminal-ui.test.ts` (使用 mock 输入)
- Task: 编写 `core/mcp/tests/event-mapper.test.ts`
- Task: 编写 `core/mcp/tests/bridge-layer.test.ts`
- Task: 编写 `core/session/tests/session-manager.test.ts`
- Task: 编写 `core/process/tests/manager.test.ts`
- Task: 编写 `core/mcp/tests/server.test.ts`
- Task: 编写 `core/cli/tests/mcp-command.test.ts`

**估计任务数**：11 个单元测试任务

#### 5. 集成测试任务（基于 quickstart.md）

**场景 1: MVP1 单进程基本流程**：
- Task: 编写 `tests/integration/mvp1-single-process.test.ts`
  - MCP 连接和初始化
  - tools/call 快速返回验证（< 500ms）
  - 通知接收和 jobId 关联验证
  - 日志文件创建和格式验证

**场景 2: 审批机制验证**：
- Task: 编写 `tests/integration/approval-flow.test.ts`
  - 白名单自动批准验证
  - 非白名单触发审批（使用 mock 输入）
  - 审批决策传递验证
  - 审批事件日志验证

**估计任务数**：2 个集成测试任务

#### 6. MVP2 任务（可选，作为后续迭代）

**进程池管理**（仅描述，不在 MVP1 tasks.md 中生成）：
- 实现 `core/process/pool-manager.ts`
- 实现 `core/process/session-recovery.ts`
- 编写集成测试（mvp2-process-pool.test.ts, session-recovery.test.ts）

**估计任务数**：8 个任务（MVP2 阶段）

### Ordering Strategy

**TDD 顺序**：
1. **契约测试优先**（4 个任务，全部 [P]）：定义接口规范，测试必须失败
2. **类型定义**（1 个任务，[P]）：为实现提供类型基础
3. **实现 + 单元测试配对**（23 个任务，按依赖层次）：
   - 第一层（3 个实现 + 3 个测试，[P]）
   - 第二层（3 个实现 + 3 个测试，串行）
   - 第三层（4 个实现 + 4 个测试，串行）
   - 第四层（1 个实现 + 1 个测试，串行）
   - 第五层（1 个实现 + 1 个测试，串行）
4. **集成测试**（2 个任务，串行）：验证完整流程

**依赖管理**：
- [P] 标记可并行执行的任务（同层且无依赖）
- 不同层之间必须串行（等待上层完成）
- 单元测试必须在实现任务完成后立即执行

**任务编号规则**：
- T001-T004: 契约测试（[P]）
- T005: 类型定义（[P]）
- T006-T016: 第一、二层实现 + 测试
- T017-T024: 第三层实现 + 测试
- T025-T026: 第四层实现 + 测试
- T027-T028: 第五层实现 + 测试
- T029-T030: 集成测试

### Estimated Output

**MVP1 总任务数**：30 个任务
- 契约测试：4 个（全部 [P]）
- 类型定义：1 个（[P]）
- 实现任务：12 个（第一层 3 个 [P]，其余串行）
- 单元测试：11 个（配对串行）
- 集成测试：2 个（串行）

**任务密度**：平均每个模块 2-3 个任务（1 实现 + 1 测试 + 可选契约测试）

**并行机会**：约 8 个任务可并行（契约测试 4 个 + 类型定义 1 个 + 第一层实现 3 个）

### IMPORTANT Reminder

**此 Phase 2 描述由 `/plan` 命令生成，仅用于规划。**
**实际的 tasks.md 文件由 `/tasks` 命令生成。**

执行 `/tasks` 命令时：
1. 加载 `.specify/templates/tasks-template.md` 作为基础
2. 根据上述策略生成 30 个具体任务
3. 每个任务包含：任务编号、任务描述、依赖关系、并行标记 [P]、验收标准
4. 输出到 `/data/codex-father/specs/005-docs-prd-draft/tasks.md`

## Phase 3+: Future Implementation

_These phases are beyond the scope of the /plan command_

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional
principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance
validation)

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |

## Progress Tracking

_This checklist is updated during execution flow_

**Phase Status**:

- [x] Phase 0: Research complete (/plan command) - ✓ research.md generated
- [x] Phase 1: Design complete (/plan command) - ✓ data-model.md, contracts/, quickstart.md, CLAUDE.md generated
- [x] Phase 2: Task planning complete (/plan command - describe approach only) - ✓ See below
- [ ] Phase 3: Tasks generated (/tasks command) - Ready for `/tasks` command
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS - All items checked, no violations
- [x] Post-Design Constitution Check: PASS - Phase 1 design符合所有宪章原则
- [x] All NEEDS CLARIFICATION resolved - Technical Context 无未解决问题
- [x] Complexity deviations documented - No deviations, design follows KISS/YAGNI

---

_Based on Constitution v1.1.0 - See `.specify/memory/constitution.md`_
