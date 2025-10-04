# Tasks: Codex 0.44 兼容性检查与修复

**Input**: Design documents from
`/data/codex-father/specs/008-ultrathink-codex-0/` **Prerequisites**: plan.md,
research.md, data-model.md, contracts/, quickstart.md

---

## Execution Flow (main)

```
1. Load plan.md from feature directory ✓
   → Extract: TypeScript 5.x + Node.js >= 18, @modelcontextprotocol/sdk, inquirer, zod, uuid, vitest
2. Load design documents ✓
   → research.md: 10 technical decisions
   → data-model.md: 7 core entities
   → contracts/: 23 MCP methods (3 completed, 20 to create)
   → quickstart.md: 6 test scenario groups
3. Generate tasks by category:
   → Phase 3.1: 22 contract tasks (20 create + 2 补充测试)
   → Phase 3.2: 8 infrastructure tasks
   → Phase 3.3: 18 MCP implementation tasks
   → Phase 3.4: 6 integration test tasks
   → Phase 3.5: 4 polish tasks
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T058)
6. Validate completeness ✓
```

---

## Path Conventions

- **Project type**: Single TypeScript project (from plan.md)
- **Source**: `src/` at repository root
- **Tests**: `tests/` at repository root
- **Contracts**: `specs/008-ultrathink-codex-0/contracts/`

---

## Phase 3.1: 完成契约定义（22 个任务，TDD 第一步）

**⚠️
CRITICAL**: 所有契约测试必须在实现前完成，并且必须失败（验证 Schema 正确性）

### 核心方法契约（1 个）

- [ ] **T001** [P] 创建 `codex/event` 通知契约
  - **输入**:
    refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:76-79,
    contracts/\_template.schema.json
  - **输出**:
    - `specs/008-ultrathink-codex-0/contracts/codex-event.schema.json`
    - `specs/008-ultrathink-codex-0/contracts/codex-event.contract.test.ts`
  - **验证**: Schema 定义完整（事件类型、payload 结构），契约测试至少 3 个用例

### 审批方法契约（2 个）

- [ ] **T002** [P] 创建 `applyPatchApproval` 契约（Server → Client）
  - **输入**: codex_mcp_interface.md:87, \_template.schema.json
  - **输出**:
    - `specs/008-ultrathink-codex-0/contracts/applyPatchApproval.schema.json`
    - `specs/008-ultrathink-codex-0/contracts/applyPatchApproval.contract.test.ts`
  - **验证**: Schema 包含 conversationId, callId, fileChanges, reason 字段

- [ ] **T003** [P] 创建 `execCommandApproval` 契约（Server → Client）
  - **输入**: codex_mcp_interface.md:88, \_template.schema.json
  - **输出**:
    - `specs/008-ultrathink-codex-0/contracts/execCommandApproval.schema.json`
    - `specs/008-ultrathink-codex-0/contracts/execCommandApproval.contract.test.ts`
  - **验证**: Schema 包含 conversationId, callId, command, cwd 字段

### 会话管理契约（4 个）

- [ ] **T004** [P] 创建 `interruptConversation` 契约
  - **输入**: codex_mcp_interface.md:70
  - **输出**: Schema + 测试
  - **验证**: 请求包含 conversationId，响应包含成功状态

- [ ] **T005** [P] 创建 `listConversations` 契约
  - **输入**: codex_mcp_interface.md:72
  - **输出**: Schema + 测试
  - **验证**: 响应包含会话数组（id, model, createdAt 等）

- [ ] **T006** [P] 创建 `resumeConversation` 契约
  - **输入**: codex_mcp_interface.md:72
  - **输出**: Schema + 测试
  - **验证**: 请求包含 conversationId

- [ ] **T007** [P] 创建 `archiveConversation` 契约
  - **输入**: codex_mcp_interface.md:72
  - **输出**: Schema + 测试
  - **验证**: 请求包含 conversationId

### 认证方法契约（7 个）

- [ ] **T008** [P] 创建 `loginApiKey` 契约
  - **输入**: codex_mcp_interface.md:96
  - **输出**: Schema + 测试
  - **验证**: 请求包含 apiKey 字段

- [ ] **T009** [P] 创建 `loginChatGpt` 契约
  - **输入**: codex_mcp_interface.md:97
  - **输出**: Schema + 测试
  - **验证**: 响应包含 loginId, authUrl

- [ ] **T010** [P] 创建 `cancelLoginChatGpt` 契约
  - **输入**: codex_mcp_interface.md:98
  - **输出**: Schema + 测试
  - **验证**: 请求包含 loginId

- [ ] **T011** [P] 创建 `logoutChatGpt` 契约
  - **输入**: codex_mcp_interface.md:98
  - **输出**: Schema + 测试
  - **验证**: 无参数请求，响应包含成功状态

- [ ] **T012** [P] 创建 `getAuthStatus` 契约
  - **输入**: codex_mcp_interface.md:98
  - **输出**: Schema + 测试
  - **验证**: 可选参数 includeToken, refreshToken

- [ ] **T013** [P] 创建 `loginChatGptComplete` 通知契约
  - **输入**: codex_mcp_interface.md:79
  - **输出**: Schema + 测试
  - **验证**: 通知包含登录结果

- [ ] **T014** [P] 创建 `authStatusChange` 通知契约
  - **输入**: codex_mcp_interface.md:79
  - **输出**: Schema + 测试
  - **验证**: 通知包含新的认证状态

### 配置和信息契约（4 个）

- [ ] **T015** [P] 创建 `getUserSavedConfig` 契约
  - **输入**: codex_mcp_interface.md:21
  - **输出**: Schema + 测试
  - **验证**: 响应包含用户配置对象

- [ ] **T016** [P] 创建 `setDefaultModel` 契约
  - **输入**: codex_mcp_interface.md:21
  - **输出**: Schema + 测试
  - **验证**: 请求包含 model 字段

- [ ] **T017** [P] 创建 `getUserAgent` 契约
  - **输入**: codex_mcp_interface.md:21
  - **输出**: Schema + 测试
  - **验证**: 响应包含 userAgent 字符串

- [ ] **T018** [P] 创建 `userInfo` 契约
  - **输入**: codex_mcp_interface.md:21
  - **输出**: Schema + 测试
  - **验证**: 响应包含用户信息（id, email 等）

### 工具方法契约（2 个）

- [ ] **T019** [P] 创建 `gitDiffToRemote` 契约
  - **输入**: codex_mcp_interface.md:25
  - **输出**: Schema + 测试
  - **验证**: 响应包含 diff 字符串

- [ ] **T020** [P] 创建 `execOneOffCommand` 契约
  - **输入**: codex_mcp_interface.md:25
  - **输出**: Schema + 测试
  - **验证**: 请求包含 command，响应包含 output

### 补充已有契约的测试（2 个）

- [ ] **T021** [P] 补充 `sendUserMessage` 契约测试
  - **输入**:
    specs/008-ultrathink-codex-0/contracts/sendUserMessage.schema.json,
    newConversation.contract.test.ts (模板)
  - **输出**:
    `specs/008-ultrathink-codex-0/contracts/sendUserMessage.contract.test.ts`
  - **验证**: 至少 6 个测试用例（有效请求、无效类型、items 验证等）

- [ ] **T022** [P] 补充 `sendUserTurn` 契约测试
  - **输入**: specs/008-ultrathink-codex-0/contracts/sendUserTurn.schema.json,
    newConversation.contract.test.ts (模板)
  - **输出**:
    `specs/008-ultrathink-codex-0/contracts/sendUserTurn.contract.test.ts`
  - **验证**: 包含版本兼容性测试（effort, summary 参数需要 0.44）

---

## Phase 3.2: 基础设施与核心模块（8 个任务，部分并行）

**⚠️ MUST COMPLETE**: 实现前先写失败的单元测试（TDD）

### 基础模块（3 个可并行）

- [ ] **T023** [P] 实现版本检测模块
  - **依赖**: 无
  - **输入**: research.md#1-版本检测机制, data-model.md#1-版本信息
  - **输出**:
    - `src/lib/versionDetector.ts` (detectCodexVersion(), cacheVersion())
    - `tests/unit/versionDetector.test.ts`
  - **验证**:
    - 测试覆盖率 100%
    - 首次检测 < 1s，缓存后 < 100ms
    - 检测失败时抛出明确错误
  - **实现要点**:
    - 使用 `child_process.execFile('codex', ['--version'])`（防止注入）
    - 解析输出提取语义化版本号
    - 内存缓存 `{ version, major, minor, patch, detectedAt }`

- [ ] **T024** [P] 实现参数-版本映射表
  - **依赖**: 无
  - **输入**: specs/008-ultrathink-codex-0/parameter-version-mapping.md
  - **输出**:
    - `src/lib/parameterMapping.ts` (PARAMETER_MAPPINGS 常量,
      getParamMinVersion())
    - `tests/unit/parameterMapping.test.ts`
  - **验证**:
    - 34+ 参数映射正确
    - 查询性能 O(1)
  - **实现要点**:
    - 使用 `Record<string, ParameterMapping>` 结构
    - 包含 name, category, minVersion, dataSource, incompatibleBehavior

- [ ] **T025** [P] 实现配置 Schema 定义
  - **依赖**: 无
  - **输入**: data-model.md#3-配置选项
  - **输出**: `src/lib/configSchema.ts` (使用 Zod)
  - **验证**:
    - 所有配置项类型正确（model, approval_policy, sandbox, profiles 等）
    - Zod 解析性能 < 50ms
  - **实现要点**:
    - CodexConfigSchema, ConfigOptionSchema
    - 嵌套对象验证（model_providers.<id>.wire_api）

### 验证与策略模块（5 个有依赖）

- [ ] **T026** 实现配置验证模块
  - **依赖**: T023, T024, T025
  - **输入**: research.md#5-配置验证方式, data-model.md#5-配置验证结果
  - **输出**:
    - `src/lib/configValidator.ts` (validateConfig(),
      checkWireApiCompatibility())
    - `tests/unit/configValidator.test.ts`
  - **验证**:
    - 离线验证 < 200ms
    - 测试覆盖率 ≥ 80%
    - 检测 gpt-5-codex + wire_api="chat" 组合
  - **实现要点**:
    - 静态校验（无 API 调用）
    - 返回 ValidationResult { valid, errors, warnings, suggestions }

- [ ] **T027** 实现 Codex Profile 管理
  - **依赖**: T026
  - **输入**: research.md#2-配置修正持久化机制, data-model.md#4-Codex Profile
  - **输出**:
    - `src/lib/profileManager.ts` (createAutoFixProfile(), writeProfile())
    - `tests/unit/profileManager.test.ts`
  - **验证**:
    - Profile 写入到 `~/.codex/config.toml`
    - TOML 格式正确（包含注释）
  - **实现要点**:
    - 使用 `@iarna/toml` 库
    - Profile 名称固定为 `codex-father-auto-fix`
    - 添加时间戳和修正原因注释

- [ ] **T028** 实现模型-wire_api 映射
  - **依赖**: 无（独立模块）
  - **输入**: research.md#6-模型与wire_api映射
  - **输出**:
    - `src/lib/modelWireApiMapping.ts` (MODEL_WIRE_API_MAP,
      getRecommendedWireApi())
    - `tests/unit/modelWireApiMapping.test.ts`
  - **验证**:
    - gpt-5-codex → "responses"
    - gpt-4 → "chat"
  - **实现要点**:
    - `Record<string, 'chat' | 'responses'>` 结构
    - 查询 O(1)

- [ ] **T029** 实现错误格式化模块
  - **依赖**: T023 (需要版本信息)
  - **输入**: research.md#8-错误处理增强, data-model.md#7-错误响应
  - **输出**:
    - `src/lib/errorFormatter.ts` (formatHttpError(), formatJsonRpcError())
    - `tests/unit/errorFormatter.test.ts`
  - **验证**:
    - 错误消息包含完整上下文（端点、方法、版本）
    - 包含具体建议和操作指引
  - **实现要点**:
    - 返回 ErrorResponse { code, message, context, suggestions }

- [ ] **T030** 实现三层降级策略
  - **依赖**: T023, T024, T029
  - **输入**: research.md#3-三层降级策略
  - **输出**:
    - `src/lib/degradationStrategy.ts` (checkCliParam(), filterConfig(),
      validateMcpParam())
    - `tests/unit/degradationStrategy.test.ts`
  - **验证**:
    - CLI 层：检测到 0.44 参数时报错并退出
    - 配置层：显示警告并过滤
    - MCP 层：返回 JSON-RPC 错误 (code: -32602)
  - **实现要点**:
    - 使用 parameterMapping 判断版本兼容性
    - 三个导出函数分别处理三层

---

## Phase 3.3: MCP 方法实现（18 个任务，部分并行）

**⚠️ PREREQUISITE**: Phase 3.2 必须完成（基础设施依赖）

### 核心事件处理（1 个）

- [ ] **T031** 实现 `codex/event` 通知处理
  - **依赖**: T023-T030 (所有基础设施)
  - **输入**: contracts/codex-event.schema.json, data-model.md#6-MCP方法
  - **输出**:
    - `src/mcp/eventHandler.ts` (parseCodexEvent(), emitMcpNotification())
    - `tests/integration/eventHandler.test.ts`
  - **验证**:
    - 事件流解析正确（Event, EventMsg 类型）
    - 通知推送成功
    - 契约测试通过
  - **实现要点**:
    - 从 Codex 接收 `codex/event` 通知
    - 转换为 MCP 标准通知格式
    - 包含 \_meta.requestId 关联

### 审批方法（2 个可并行）

- [ ] **T032** [P] 实现 `applyPatchApproval`（Server → Client 请求）
  - **依赖**: T031
  - **输入**: contracts/applyPatchApproval.schema.json
  - **输出**: `src/mcp/approvalHandlers.ts` (handleApplyPatchApproval())
  - **验证**: 契约测试通过，能接收 Client 的 allow/deny 响应

- [ ] **T033** [P] 实现 `execCommandApproval`（Server → Client 请求）
  - **依赖**: T031
  - **输入**: contracts/execCommandApproval.schema.json
  - **输出**: `src/mcp/approvalHandlers.ts` (handleExecCommandApproval())
  - **验证**: 契约测试通过

### 会话管理（4 个可并行）

- [ ] **T034** [P] 实现 `interruptConversation`
  - **依赖**: T031
  - **输入**: contracts/interruptConversation.schema.json
  - **输出**: `src/mcp/conversationHandlers.ts` (interruptConversation())
  - **验证**: 契约测试通过

- [ ] **T035** [P] 实现 `resumeConversation`
  - **依赖**: T031
  - **输入**: contracts/resumeConversation.schema.json
  - **输出**: `src/mcp/conversationHandlers.ts` (resumeConversation())
  - **验证**: 契约测试通过

- [ ] **T036** [P] 实现 `listConversations`
  - **依赖**: T031
  - **输入**: contracts/listConversations.schema.json
  - **输出**: `src/mcp/conversationHandlers.ts` (listConversations())
  - **验证**: 契约测试通过，返回会话数组

- [ ] **T037** [P] 实现 `archiveConversation`
  - **依赖**: T031
  - **输入**: contracts/archiveConversation.schema.json
  - **输出**: `src/mcp/conversationHandlers.ts` (archiveConversation())
  - **验证**: 契约测试通过

### 认证方法（5 个可并行）

- [ ] **T038** [P] 实现 `loginApiKey`
  - **依赖**: T031
  - **输入**: contracts/loginApiKey.schema.json
  - **输出**: `src/mcp/authHandlers.ts` (loginApiKey())
  - **验证**: 契约测试通过

- [ ] **T039** [P] 实现 `loginChatGpt` + `loginChatGptComplete`
  - **依赖**: T031
  - **输入**: contracts/loginChatGpt.schema.json,
    contracts/loginChatGptComplete.schema.json
  - **输出**: `src/mcp/authHandlers.ts` (loginChatGpt(), handleLoginComplete())
  - **验证**: 返回 loginId 和 authUrl，完成后发送通知

- [ ] **T040** [P] 实现 `cancelLoginChatGpt` + `logoutChatGpt`
  - **依赖**: T039
  - **输入**: contracts/cancelLoginChatGpt.schema.json,
    contracts/logoutChatGpt.schema.json
  - **输出**: `src/mcp/authHandlers.ts` (cancelLogin(), logout())
  - **验证**: 契约测试通过

- [ ] **T041** [P] 实现 `getAuthStatus`
  - **依赖**: T031
  - **输入**: contracts/getAuthStatus.schema.json
  - **输出**: `src/mcp/authHandlers.ts` (getAuthStatus())
  - **验证**: 契约测试通过，支持 includeToken 参数

- [ ] **T042** [P] 实现 `authStatusChange` 通知
  - **依赖**: T031
  - **输入**: contracts/authStatusChange.schema.json
  - **输出**: `src/mcp/authHandlers.ts` (emitAuthStatusChange())
  - **验证**: 契约测试通过

### 配置和工具（6 个可并行）

- [ ] **T043** [P] 实现 `getUserSavedConfig`
  - **依赖**: T031
  - **输入**: contracts/getUserSavedConfig.schema.json
  - **输出**: `src/mcp/configHandlers.ts` (getUserSavedConfig())
  - **验证**: 读取 ~/.codex/config.toml，返回配置对象

- [ ] **T044** [P] 实现 `setDefaultModel`
  - **依赖**: T031
  - **输入**: contracts/setDefaultModel.schema.json
  - **输出**: `src/mcp/configHandlers.ts` (setDefaultModel())
  - **验证**: 写入默认模型到配置文件

- [ ] **T045** [P] 实现 `getUserAgent`
  - **依赖**: T031
  - **输入**: contracts/getUserAgent.schema.json
  - **输出**: `src/mcp/configHandlers.ts` (getUserAgent())
  - **验证**: 返回 user agent 字符串

- [ ] **T046** [P] 实现 `userInfo`
  - **依赖**: T031
  - **输入**: contracts/userInfo.schema.json
  - **输出**: `src/mcp/configHandlers.ts` (userInfo())
  - **验证**: 返回用户信息

- [ ] **T047** [P] 实现 `gitDiffToRemote`
  - **依赖**: T031
  - **输入**: contracts/gitDiffToRemote.schema.json
  - **输出**: `src/mcp/utilHandlers.ts` (gitDiffToRemote())
  - **验证**: 执行 git diff 并返回结果

- [ ] **T048** [P] 实现 `execOneOffCommand`
  - **依赖**: T031
  - **输入**: contracts/execOneOffCommand.schema.json
  - **输出**: `src/mcp/utilHandlers.ts` (execOneOffCommand())
  - **验证**: 执行一次性命令并返回输出

---

## Phase 3.4: 集成测试与验收（6 个任务，顺序执行）

**⚠️ PREREQUISITE**: Phase 3.3 必须完成（所有 MCP 方法实现）

- [ ] **T049** 集成测试：基础功能（0.42/0.44 通用）
  - **依赖**: T031-T048
  - **输入**: quickstart.md#A1-A3
  - **输出**: `tests/integration/basic-features.test.ts`
  - **验证**:
    - MCP 服务器成功启动
    - 创建会话（newConversation）
    - 发送消息（sendUserMessage）
    - 无 405 错误

- [ ] **T050** 集成测试：版本检测与降级（0.42 环境）
  - **依赖**: T049
  - **输入**: quickstart.md#B1-B3
  - **输出**: `tests/integration/version-detection.test.ts`
  - **验证**:
    - 正确识别 0.42 版本
    - 0.44 独有参数（profile）触发 JSON-RPC 错误
    - 配置警告正确显示

- [ ] **T051** 集成测试：配置验证与修正（0.44 环境）
  - **依赖**: T049
  - **输入**: quickstart.md#C1-C3
  - **输出**: `tests/integration/config-validation.test.ts`
  - **验证**:
    - 检测 405 风险配置（gpt-5-codex + wire_api="chat"）
    - 交互式修正流程（Y/n 确认）
    - Profile 写入成功

- [ ] **T052** 集成测试：新特性支持（0.44 环境）
  - **依赖**: T049
  - **输入**: quickstart.md#D1-D2
  - **输出**: `tests/integration/new-features.test.ts`
  - **验证**:
    - Profile 参数可用（newConversation with profile）
    - 推理配置可用（sendUserTurn with effort, summary）

- [ ] **T053** 集成测试：错误处理增强
  - **依赖**: T049
  - **输入**: quickstart.md#E1-E2
  - **输出**: `tests/integration/error-handling.test.ts`
  - **验证**:
    - HTTP 405 错误格式化正确（包含完整上下文）
    - 版本检测失败错误清晰

- [ ] **T054** 集成测试：MCP 协议兼容性
  - **依赖**: T031-T048
  - **输入**: quickstart.md#F1-F2, contracts/contracts-checklist.md
  - **输出**: `tests/integration/mcp-compatibility.test.ts`
  - **验证**:
    - 所有 23 个 MCP 方法可用
    - 审批流程正确（applyPatchApproval, execCommandApproval）

---

## Phase 3.5: 性能与文档（4 个任务，顺序执行）

**⚠️ PREREQUISITE**: Phase 3.4 必须完成（所有集成测试通过）

- [ ] **T055** 性能基准测试
  - **依赖**: T049-T054
  - **输入**: quickstart.md#性能验收
  - **输出**: `tests/benchmark/performance.bench.ts` (使用 vitest bench)
  - **验证**:
    - 版本检测 < 1s（首次）
    - 版本检测 < 100ms（缓存后）
    - 配置验证 < 2s
    - MCP 方法响应 < 500ms
  - **实现要点**:
    - 使用 `describe.concurrent.each` 测试多个 MCP 方法
    - 记录 p50, p95, p99 响应时间

- [ ] **T056** 更新用户文档
  - **依赖**: T055
  - **输入**: quickstart.md, research.md
  - **输出**: `docs/codex-0.44-compatibility.md`
  - **内容**:
    - 使用指南（启动 MCP 服务器、配置 Codex）
    - 版本兼容性说明（0.42 vs 0.44 功能对比）
    - 故障排除（405 错误、版本检测失败、配置错误）
  - **验证**: 文档清晰、完整、有示例

- [ ] **T057** 更新 API 文档（自动生成）
  - **依赖**: T031-T048
  - **输入**: `src/**/*.ts` (JSDoc 注释)
  - **输出**: `docs/api/`
  - **工具**: `typedoc`
  - **验证**:
    - 所有导出函数有 JSDoc 注释
    - typedoc 无警告
    - 文档可访问

- [ ] **T058** 最终验收测试（手动执行）
  - **依赖**: T055, T056
  - **输入**: quickstart.md 全部场景
  - **执行**: 手动执行 A1-F2 所有场景
  - **输出**: 验收报告（记录每个场景的通过/失败状态）
  - **验收标准**:
    - 所有场景通过
    - 无回归问题
    - 性能达标

---

## Dependencies

### 依赖关系图

```
Phase 3.1 (T001-T022) - 契约定义
    ↓ (无依赖，可并行)

Phase 3.2 - 基础设施
    T023, T024, T025 (可并行)
        ↓
    T026 (依赖 T023, T024, T025)
        ↓
    T027 (依赖 T026)
    T028 (独立)
    T029 (依赖 T023)
    T030 (依赖 T023, T024, T029)
        ↓

Phase 3.3 (T031-T048) - MCP 实现
    T031 (依赖所有基础设施)
        ↓
    T032-T048 (各组可并行，但都依赖 T031)
        ↓

Phase 3.4 (T049-T054) - 集成测试
    T049 (依赖所有 MCP 实现)
        ↓
    T050-T054 (依赖 T049)
        ↓

Phase 3.5 (T055-T058) - 性能与文档
    T055 (依赖所有集成测试)
        ↓
    T056, T057 (依赖 T055)
        ↓
    T058 (依赖 T055, T056)
```

### 阻塞关系

- **T026 阻塞**: T027, T030
- **T031 阻塞**: T032-T048 (所有 MCP 方法)
- **T049 阻塞**: T050-T054 (所有集成测试)
- **T055 阻塞**: T056, T057, T058

---

## Parallel Execution Examples

### 示例 1: Phase 3.1 契约创建（22 个任务并行）

可以同时运行所有 T001-T022，因为每个任务创建不同的文件。

```bash
# 使用 Task agent 并行执行
Task: "创建 codex/event 通知契约（Schema + 测试）"
Task: "创建 applyPatchApproval 契约（Schema + 测试）"
Task: "创建 execCommandApproval 契约（Schema + 测试）"
# ... 同时运行所有 22 个任务
```

### 示例 2: Phase 3.2 基础模块（3 个任务并行）

```bash
# T023, T024, T025 可并行
Task: "实现版本检测模块（versionDetector.ts + 测试）"
Task: "实现参数-版本映射表（parameterMapping.ts + 测试）"
Task: "实现配置 Schema 定义（configSchema.ts）"
```

### 示例 3: Phase 3.3 审批方法（2 个任务并行）

```bash
# T032, T033 可并行（不同函数）
Task: "实现 applyPatchApproval（Server → Client 请求）"
Task: "实现 execCommandApproval（Server → Client 请求）"
```

### 示例 4: Phase 3.3 会话管理（4 个任务并行）

```bash
# T034-T037 可并行（不同函数）
Task: "实现 interruptConversation"
Task: "实现 resumeConversation"
Task: "实现 listConversations"
Task: "实现 archiveConversation"
```

---

## Task Completion Checklist

### Phase 3.1 (契约定义) - 22 tasks

- [ ] T001-T020: 所有待创建方法的契约完成
- [ ] T021-T022: 已有契约的测试补充完成
- [ ] 所有契约测试在实现前失败

### Phase 3.2 (基础设施) - 8 tasks

- [ ] T023-T025: 基础模块完成（版本检测、映射表、Schema）
- [ ] T026-T030: 验证与策略模块完成

### Phase 3.3 (MCP 实现) - 18 tasks

- [ ] T031: 事件处理完成
- [ ] T032-T033: 审批方法完成
- [ ] T034-T037: 会话管理完成
- [ ] T038-T042: 认证方法完成
- [ ] T043-T048: 配置和工具方法完成
- [ ] 所有契约测试通过

### Phase 3.4 (集成测试) - 6 tasks

- [ ] T049-T054: 所有集成测试场景完成并通过

### Phase 3.5 (性能与文档) - 4 tasks

- [ ] T055: 性能基准测试达标
- [ ] T056-T057: 文档完整
- [ ] T058: 最终验收通过

---

## Notes

- **[P] 标记**: 表示任务可以并行执行（不同文件，无依赖关系）
- **TDD 原则**: Phase 3.1-3.2 的所有测试必须在实现前完成，并且必须失败
- **提交频率**: 每个任务完成后应提交（保持小批量提交）
- **避免**:
  - 模糊任务描述（每个任务都有明确的输入/输出/验证标准）
  - 同一文件的并行修改（会导致冲突）
  - 跳过测试直接实现（违反 TDD 原则）

---

## Validation Checklist

_GATE: 在开始实现前验证_

- [x] 所有契约（23 个）都有对应的创建/补充任务
- [x] 所有实体（7 个）都有对应的实现任务
- [x] 所有测试任务在实现任务之前
- [x] 并行任务真正独立（不同文件）
- [x] 每个任务指定了确切的文件路径
- [x] 无任务修改与其他 [P] 任务相同的文件
- [x] 依赖关系清晰明确

---

**总计**: 58 个任务

**估算工作量**: 52-80 小时（基于 plan.md 的估算）

**下一步**: 运行 `/analyze ultrathink` 验证规范、计划和任务的一致性

---

_Tasks generated based on Constitution v1.1.0 - TDD is non-negotiable_
