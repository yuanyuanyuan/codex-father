# Tasks: 架构调整 - MCP 模式优先实现

**Input**: Design documents from `/data/codex-father/specs/005-docs-prd-draft/`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), contracts/
(✓), quickstart.md (✓)

## Execution Flow (main)

```
1. Load plan.md from feature directory
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Validate task completeness
7. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions

Single project structure at repository root:

- **Source**: `core/mcp/`, `core/process/`, `core/approval/`, `core/session/`
- **Tests**: `tests/contract/`, `tests/integration/`, module-level `*/tests/`

---

## Phase 3.1: Setup

- [x] **T001** 创建项目结构 ✅
  - 创建 `core/mcp/`, `core/process/`, `core/approval/`, `core/session/` 目录
  - 创建 `tests/contract/`, `tests/integration/` 目录
  - 创建 `.codex-father/sessions/` 运行时目录（.gitignore）

- [x] **T002** 安装依赖 ✅
  - 安装 `@modelcontextprotocol/sdk`（MCP 官方 SDK）
  - 安装 `inquirer@^9.x`（终端交互 UI）
  - 验证现有依赖：`winston`, `zod`, `fs-extra`, `commander`, `chalk`, `yaml`
  - 更新 `package.json` devDependencies（如需）

- [x] **T003** [P] 配置 linting 和格式化 ✅
  - 验证 ESLint 和 Prettier 配置适用于新模块
  - 添加 MCP 和审批相关的类型检查规则
  - 运行 `npm run lint:check` 确保无错误

---

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3

**CRITICAL: These tests MUST be written and MUST FAIL before ANY
implementation**

### 契约测试（并行执行）

- [x] **T004** [P] MCP initialize 契约测试 ✅
  - 文件：`tests/contract/mcp-initialize.test.ts`
  - 验证：
    - `initialize` 请求/响应格式符合 `contracts/mcp-protocol.yaml:14-98`
    - 协议版本协商（`protocolVersion: '2024-11-05'`）
    - 服务端 capabilities 包含 `tools` 和 `notifications`
    - serverInfo.name = 'codex-father'
  - **期望**：测试失败（未实现服务端）

- [x] **T005** [P] MCP tools/list 契约测试 ✅
  - 文件：`tests/contract/mcp-tools-list.test.ts`
  - 验证：
    - `tools/list` 响应格式符合 `contracts/mcp-protocol.yaml:100-163`
    - 工具列表包含 `start-codex-task`, `send-message`, `interrupt-task`
    - 每个工具的 inputSchema 完整性（required 字段）
  - **期望**：测试失败（工具未定义）

- [x] **T006** [P] MCP tools/call 契约测试 ✅
  - 文件：`tests/contract/mcp-tools-call.test.ts`
  - 验证：
    - `tools/call` 快速返回（< 500ms）符合 `contracts/mcp-protocol.yaml:165-235`
    - 响应包含 `status`, `jobId`, `conversationId` 字段
    - 后续接收 `codex-father/progress` 通知
    - 通知包含正确的 jobId 关联
  - **期望**：测试失败（桥接层未实现）

- [x] **T007** [P] Codex JSON-RPC 契约测试 ✅
  - 文件：`tests/contract/codex-jsonrpc.test.ts`
  - 验证：
    - `newConversation` 请求/响应符合 `contracts/codex-jsonrpc.yaml:15-94`
    - `sendUserTurn` 请求/响应符合 `contracts/codex-jsonrpc.yaml:158-232`
    - `interruptConversation` 请求/响应符合
      `contracts/codex-jsonrpc.yaml:234-282`
    - 审批请求处理（`applyPatchApproval`, `execCommandApproval`）
  - **期望**：测试失败（Codex 客户端未实现）

---

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### 第一层：基础设施（无外部依赖，可并行）

- [x] **T008** [P] 类型定义和 Schema ✅
  - 文件：`core/lib/types.ts`
  - 实现：
    - 定义 Job, JobStatus, JobMetrics（参考 `data-model.md:63-101`）
    - 定义 Session, SessionStatus（参考 `data-model.md:103-133`）
    - 定义 ApprovalRequest, ApprovalPolicy（参考 `data-model.md:355-423`）
    - 定义 Event, EventType（参考 `data-model.md:269-322`）
    - 使用 Zod 定义验证 schema（JobSchema, SessionSchema 等）
  - **验收**：TypeScript 编译通过，所有类型可被其他模块引用

- [x] **T009** [P] 事件日志记录器 ✅
  - 文件：`core/session/event-logger.ts`
  - 实现（参考 `data-model.md:269-322`）：
    - JSONL 格式事件日志写入（`events.jsonl`）
    - 流式写入，避免内存缓存
    - 日志脱敏功能（FR-029：屏蔽敏感信息如密钥、令牌）
    - 方法：`logEvent(event: Event): Promise<void>`
  - **验收**：单元测试通过（T021）

- [x] **T010** [P] 配置持久化器 ✅
  - 文件：`core/session/config-persister.ts`
  - 实现（参考 `data-model.md:135-183`）：
    - 会话配置 JSON 持久化（`config.json`）
    - rollout-ref.txt 写入和读取
    - 方法：`saveConfig(config: SessionConfig): Promise<void>`,
      `loadConfig(sessionDir: string): Promise<SessionConfig>`
  - **验收**：单元测试通过（T022）

- [x] **T011** [P] 审批策略引擎 ✅
  - 文件：`core/approval/policy-engine.ts`
  - 实现（参考 `data-model.md:355-423`）：
    - 白名单规则匹配（支持正则表达式 pattern）
    - 审批决策逻辑（auto-approve vs manual）
    - 配置文件加载（YAML 格式，参考 `quickstart.md:43-63`）
    - 方法：`evaluate(request: ApprovalRequest): Promise<'allow' | 'deny' | 'require-manual'>`
  - **注意**：默认白名单仅包含只读命令（`git status`, `git diff`, `git log`,
    `ls`, `cat`），npm install 已移除
  - **验收**：单元测试通过（T023）

### 第二层：核心组件（依赖第一层）

- [x] **T012** MCP 协议类型定义 ✅
  - 文件：`core/mcp/protocol/types.ts`
  - 实现：
    - MCP 协议类型（InitializeRequest, InitializeResponse, ToolsListResponse,
      ToolsCallRequest 等）
    - 基于 `contracts/mcp-protocol.yaml` 定义
    - 使用 Zod schema 验证
    - 兼容 @modelcontextprotocol/sdk 类型
  - **验收**：TypeScript 编译通过，T004-T006 测试使用这些类型

- [x] **T013** Codex JSON-RPC 客户端 ✅
  - 文件：`core/mcp/codex-client.ts`
  - 实现（参考 `research.md:82-133`）：
    - child_process.spawn 封装（`codex mcp`）
    - line-delimited JSON 解析（使用 readline 模块）
    - JSON-RPC 请求/响应映射（`request_id → Promise`）
    - 通知处理（EventEmitter）
    - 方法：`newConversation()`, `sendUserTurn()`, `interruptConversation()`
  - **验收**：单元测试通过（T024），T007 契约测试通过

- [x] **T014** 审批终端 UI ✅
  - 文件：`core/approval/terminal-ui.ts`
  - 实现（参考 `research.md:325-366`）：
    - inquirer 交互式 UI
    - 审批提示显示（命令、CWD、原因）
    - 等待时长计时器（实时更新）
    - 快捷操作支持（✅ Approve, ❌ Deny, ⏭️ Skip/Whitelist）
    - 方法：`promptApproval(request: ApprovalRequest): Promise<'allow' | 'deny' | 'whitelist'>`
  - **验收**：单元测试通过（T019，使用 mock 输入）

### 第三层：桥接层和进程管理（依赖第二层）

- [x] **T015** 事件映射器 ✅
  - 文件：`core/mcp/event-mapper.ts`
  - 实现（参考 `data-model.md:269-322`）：
    - Codex `codex/event` → MCP `codex-father/progress` 映射
    - jobId 关联逻辑（conversationId → jobId 查找）
    - 事件类型转换（TaskStarted → task-started）
    - 方法：`mapEvent(codexEvent: CodexEvent, jobId: string): MCPProgressNotification`
  - **验收**：单元测试通过（T020）

- [x] **T016** MCP 桥接层 ✅
  - 文件：`core/mcp/bridge-layer.ts`
  - 实现（参考 `data-model.md:185-267`）：
    - MCP 工具定义（`start-codex-task`, `send-message`, `interrupt-task`）
    - tools/call 快速返回逻辑（< 500ms）
    - Codex JSON-RPC 方法调用封装
    - 审批请求转发（`applyPatchApproval`, `execCommandApproval` → policy-engine
      → terminal-ui）
    - 方法：`handleToolsCall(name: string, args: object): Promise<ToolCallResult>`
  - **验收**：单元测试通过（T021），T005-T006 契约测试通过

- [x] **T017** 会话管理器 ✅
  - 文件：`core/session/session-manager.ts`
  - 实现（参考 `data-model.md:103-183`）：
    - 会话生命周期管理（INITIALIZING → ACTIVE → IDLE → TERMINATED）
    - 会话目录创建（`.codex-father/sessions/<session-name>-<date>/`）
    - 协调 CodexClient、EventLogger、ConfigPersister、PolicyEngine、TerminalUI
    - 方法：`createSession()`, `sendUserMessage()`, `handleApprovalRequest()`
  - **验收**：单元测试通过（T022）

- [x] **T018** 进程管理器 MVP1 ✅
  - 文件：`core/process/manager.ts`
  - 实现（参考 `data-model.md:324-383`）：
    - 单进程管理（`codex mcp`）
    - 健康检查和自动重启
    - 进程生命周期管理
    - 方法：`start()`, `stop()`, `restart()`, `getClient()`, `isReady()`
  - **验收**：单元测试通过（T023）

- [x] **T019** MCP 服务器 MVP1 ✅
  - 文件：`core/mcp/server.ts`
  - 实现：
    - 使用 @modelcontextprotocol/sdk 实现标准 MCP 协议
    - 处理 initialize、tools/list、tools/call 请求
    - 整合 ProcessManager、SessionManager、BridgeLayer
    - 转发 Codex 事件为 MCP 进度通知
    - 方法：`start()`, `stop()`
  - **验收**：单元测试通过（T024），T004-T006 契约测试通过

### 第四层：CLI 和入口（依赖第三层）

- [ ] **T020** CLI mcp 命令
  - 配置和日志持久化集成（使用 T009, T010）
  - 方法：`createSession()`, `getSession()`, `terminateSession()`
  - **验收**：单元测试通过（T022）

- [ ] **T018** 进程管理器（MVP1 单进程）
  - 文件：`core/process/manager.ts`
  - 实现（参考 `research.md:188-227`）：
    - 单进程 `codex mcp` 管理
    - conversationMap 维护（`request_id ↔ conversationId`）
    - 健康检查定时器（每 5s，检测进程存活）
    - 自动重启逻辑（进程崩溃时）
    - 方法：`start()`, `handleToolsCall()`, `restart()`
  - **验收**：单元测试通过（T023）

### 第四层：MCP 服务器（依赖第三层）

- [ ] **T019** MCP 服务器实现（MVP1）
  - 文件：`core/mcp/server.ts`
  - 实现（参考 `plan.md:436-443`）：
    - MCP 协议服务端（使用 @modelcontextprotocol/sdk）
    - stdio 传输（StdioServerTransport）
    - `initialize`, `tools/list`, `tools/call` 处理
    - `notifications/cancelled` 处理（调用 interruptConversation）
    - 通知推送（`codex-father/progress`，使用 T015 事件映射器）
    - 集成 T016 桥接层和 T018 进程管理器
  - **验收**：单元测试通过（T024），T004-T006 契约测试通过

### 第五层：CLI 命令（依赖第四层）

- [x] **T020** CLI mcp 命令 ✅
  - 文件：`core/cli/commands/mcp-command.ts`
  - 实现（参考 `plan.md:445-450`）：
    - ✅ `codex-father mcp` 命令（注册到 CLIParser）
    - ✅ 启动 MCP 服务器（调用 MCPServer）
    - ✅ 配置选项解析（--debug, --server-name, --timeout 等）
    - ✅ 优雅关闭处理（SIGINT, SIGTERM, uncaughtException, unhandledRejection）
    - ✅ 用户友好的输出界面（启动信息、进度、错误提示）
  - **实现细节**：
    - 使用 `registerMCPCommand(parser)` 注册命令
    - 支持 JSON 输出模式（--json 选项）
    - 实现 `keepServerAlive()` 阻塞函数保持服务器运行
    - 添加 CommandContext 和 CommandResult 类型到 types.ts
  - **验收**：单元测试通过（T031），编译无错误

---

## Phase 3.4: Unit Tests (配对测试，TDD 验证)

**注意**：这些测试必须在对应实现完成后立即执行，验证实现正确性。

- [ ] **T021** [P] 事件日志记录器单元测试
  - 文件：`core/session/tests/event-logger.test.ts`
  - 测试：JSONL 写入、日志脱敏、流式写入
  - **验收**：T009 实现通过所有测试

- [ ] **T022** [P] 配置持久化器单元测试
  - 文件：`core/session/tests/config-persister.test.ts`
  - 测试：JSON 写入/读取、rollout-ref.txt 处理
  - **验收**：T010 实现通过所有测试

- [ ] **T023** [P] 审批策略引擎单元测试
  - 文件：`core/approval/tests/policy-engine.test.ts`
  - 测试：白名单匹配、审批决策、配置加载
  - **验收**：T011 实现通过所有测试

- [ ] **T024** Codex 客户端单元测试
  - 文件：`core/mcp/tests/codex-client.test.ts`
  - 测试：进程启动、JSON-RPC 通信、请求/响应映射、通知处理
  - **验收**：T013 实现通过所有测试

- [ ] **T025** 审批终端 UI 单元测试
  - 文件：`core/approval/tests/terminal-ui.test.ts`
  - 测试：inquirer 交互（使用 mock 输入）、计时器显示
  - **验收**：T014 实现通过所有测试

- [ ] **T026** 事件映射器单元测试
  - 文件：`core/mcp/tests/event-mapper.test.ts`
  - 测试：Codex event → MCP notification 转换、jobId 关联
  - **验收**：T015 实现通过所有测试

- [ ] **T027** MCP 桥接层单元测试
  - 文件：`core/mcp/tests/bridge-layer.test.ts`
  - 测试：工具调用处理、快速返回（< 500ms）、审批转发
  - **验收**：T016 实现通过所有测试

- [ ] **T028** 会话管理器单元测试
  - 文件：`core/session/tests/session-manager.test.ts`
  - 测试：会话生命周期、目录创建、持久化集成
  - **验收**：T017 实现通过所有测试

- [ ] **T029** 进程管理器单元测试
  - 文件：`core/process/tests/manager.test.ts`
  - 测试：进程启动/重启、conversationMap 维护、健康检查
  - **验收**：T018 实现通过所有测试

- [ ] **T030** MCP 服务器单元测试
  - 文件：`core/mcp/tests/server.test.ts`
  - 测试：协议处理、通知推送、组件集成
  - **验收**：T019 实现通过所有测试

- [ ] **T031** CLI mcp 命令单元测试
  - 文件：`core/cli/tests/mcp-command.test.ts`
  - 测试：命令解析、服务器启动、配置加载、优雅关闭
  - **验收**：T020 实现通过所有测试

---

## Phase 3.5: Integration Tests (集成验证)

**注意**：这些测试验证完整的端到端流程，基于 `quickstart.md` 的验收场景。

- [ ] **T032** MVP1 单进程基本流程集成测试
  - 文件：`tests/integration/mvp1-single-process.test.ts`
  - 测试场景（参考 `quickstart.md:68-283`）：
    - MCP 连接和 initialize
    - tools/list 响应验证（包含 3 个工具）
    - tools/call 快速返回验证（< 500ms）
    - 通知接收和 jobId 关联验证
    - 日志文件创建和格式验证（`events.jsonl`, `config.json`, `rollout-ref.txt`）
  - **验收**：所有步骤通过，与 quickstart.md 场景 1 一致

- [ ] **T033** 审批机制集成测试
  - 文件：`tests/integration/approval-flow.test.ts`
  - 测试场景（参考 `quickstart.md:285-425`）：
    - 白名单自动批准验证（`git status`, `git diff`）
    - 非白名单触发审批（使用 mock 输入自动响应）
    - 审批决策传递验证（deny → Codex 收到拒绝）
    - 审批事件日志验证（`approval-required` 事件记录）
  - **验收**：所有步骤通过，与 quickstart.md 场景 2 一致

---

## Phase 3.6: Polish

- [ ] **T034** [P] 性能基准测试
  - 文件：`tests/benchmark/mcp-response-time.bench.ts`
  - 测试（参考 `research.md:411-421`）：
    - tools/call 响应时间 < 500ms
    - 事件通知延迟 < 100ms
    - 内存占用 < 200MB（使用 process.memoryUsage()）
  - **验收**：所有性能目标达标

- [ ] **T035** [P] 代码复用检查
  - 运行 ESLint 检查重复代码模式
  - 使用 jscpd 或 SonarQube 检测重复代码
  - 重构重复逻辑（如 JSON-RPC 请求构建）
  - **验收**：重复代码率 < 5%

- [ ] **T036** [P] 更新文档
  - 更新 `README.md`：添加 MCP 服务器使用说明
  - 更新 `CLAUDE.md`：记录新增技术栈（MCP SDK, inquirer）
  - 创建 `docs/mcp-integration.md`：MCP 集成指南
  - **验收**：文档与代码实现一致

- [ ] **T037** 手动验收测试
  - 执行 `quickstart.md` 中的所有场景：
    - 场景 1: MVP1 单进程基本流程（手动使用 MCP Inspector）
    - 场景 2: 审批机制验证（手动触发审批）
  - 记录任何发现的问题
  - **验收**：所有场景手动通过

- [ ] **T038** 代码审查和重构
  - 审查所有新增代码的可读性和可维护性
  - 确保符合 SOLID 原则和项目 constitution
  - 优化性能关键路径（如事件映射器）
  - **验收**：代码审查通过，无重大技术债务

---

## Dependencies

**TDD 约束**：

- T004-T007（契约测试）必须在 T008-T020（实现）之前完成
- T021-T031（单元测试）必须在对应实现任务完成后立即执行

**实现依赖**：

- T008 (types) → T009-T011 (第一层)
- T009-T011 (第一层) → T012-T014 (第二层)
- T012-T014 (第二层) → T015-T018 (第三层)
- T015-T018 (第三层) → T019 (第四层)
- T019 (第四层) → T020 (第五层)

**测试依赖**：

- T032-T033（集成测试）必须在 T020（CLI 命令）完成后执行
- T034-T038（Polish）必须在所有实现和测试完成后执行

---

## Parallel Execution Guidance

### 阶段 1: 契约测试（全部并行）

```bash
# 同时启动 4 个契约测试任务
npm run test -- tests/contract/mcp-initialize.test.ts &
npm run test -- tests/contract/mcp-tools-list.test.ts &
npm run test -- tests/contract/mcp-tools-call.test.ts &
npm run test -- tests/contract/codex-jsonrpc.test.ts &
wait
```

### 阶段 2: 第一层实现 + 类型定义（并行）

```bash
# T008-T011 可并行（不同文件，无依赖）
# 实现 core/lib/types.ts
# 实现 core/session/event-logger.ts
# 实现 core/session/config-persister.ts
# 实现 core/approval/policy-engine.ts
```

### 阶段 3: 第一层单元测试（并行）

```bash
# T021-T023 可并行
npm run test -- core/session/tests/event-logger.test.ts &
npm run test -- core/session/tests/config-persister.test.ts &
npm run test -- core/approval/tests/policy-engine.test.ts &
wait
```

### 阶段 4-7: 串行执行

```bash
# T012-T020, T024-T031, T032-T033 必须串行（依赖关系）
# 每个实现完成后立即运行对应单元测试
```

### 阶段 8: Polish（部分并行）

```bash
# T034-T036 可并行（不同文件）
npm run benchmark &
npm run lint &
# 更新文档（并行）
wait

# T037-T038 串行（需要完整系统）
```

---

## Notes

- **[P] 标记**：表示任务可并行执行（不同文件，无依赖）
- **TDD 严格执行**：契约测试必须先失败，实现后才能通过
- **提交策略**：每个任务完成后提交（不在 tasks.md 中执行 git 操作）
- **避免**：模糊任务、同文件冲突、跳过测试

---

## Validation Checklist

_验证任务完整性_

- [x] 所有契约文件有对应测试（2 个契约文件 → 4 个契约测试）
- [x] 所有实体有对应类型定义（Job, Session, ApprovalRequest, Event → T008）
- [x] 所有测试在实现之前定义（T004-T007 在 T008-T020 之前）
- [x] 并行任务真正独立（[P] 任务无文件冲突）
- [x] 每个任务指定精确文件路径（所有任务包含 `文件:` 字段）
- [x] 无任务修改同一文件（所有 [P] 任务操作不同文件）
- [x] 集成测试覆盖 quickstart 场景（2 个场景 → 2 个集成测试）

---

**Total Tasks**: 38 tasks

- Setup: 3 tasks (T001-T003)
- Contract Tests: 4 tasks (T004-T007, all [P])
- Type Definition: 1 task (T008, [P])
- Implementation Layer 1-3: 11 tasks (T009-T011 [P], T012-T018 serial)
- Implementation Layer 4-5: 2 tasks (T019-T020 serial)
- Unit Tests: 11 tasks (T021-T031, paired with implementations)
- Integration Tests: 2 tasks (T032-T033 serial)
- Polish: 5 tasks (T034-T036 [P], T037-T038 serial)

**Parallel Opportunities**: ~10 tasks can run in parallel
(契约测试 4 个 + 类型/第一层 4 个 + Polish 部分 3 个)

**Estimated MVP1 Duration**:

- Sequential path: ~30 tasks (假设每任务 2-4 小时) = 60-120 小时
- With parallelization: ~50-80 小时（基于 10 个并行任务的加速）
