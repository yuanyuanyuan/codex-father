# Implementation Plan: Codex 0.44 兼容性检查与修复

**Branch**: `008-ultrathink-codex-0` | **Date**: 2025-10-03 | **Spec**:
[spec.md](./spec.md) **Input**: Feature specification from
`/data/codex-father/specs/008-ultrathink-codex-0/spec.md`

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

**主要需求**: 实现 codex-father 对 Codex
0.42 和 0.44 双版本的兼容性支持，修复 405 Method Not
Allowed 错误，并提供智能降级机制。

**技术方案**:

1. 实现版本检测机制（`codex --version`），根据版本启用/禁用功能
2. 实现 MCP 方法完整性（100% 协议覆盖，15+ 方法）
3. 实现配置验证与自动修正（交互式确认 + Codex Profile 持久化）
4. 实现三层降级策略（CLI 报错、配置警告、MCP 错误响应）
5. 维护参数-版本映射表，便于排查和维护

## Technical Context

**Language/Version**: TypeScript 5.x + Node.js >= 18 **Primary Dependencies**:
@modelcontextprotocol/sdk ^1.0.4, inquirer ^9.3.7, zod ^3.24.1, uuid ^11.0.3,
vitest ^1.6.1 **Storage**: 文件系统（Codex
Profile：`~/.codex/config.toml`，状态文件：`.codex-father/`） **Testing**:
vitest（单元测试、集成测试、契约测试、性能基准测试） **Target Platform**:
Node.js CLI + MCP Server（支持 Linux/macOS/Windows） **Project Type**:
single（TypeScript 项目，统一 src/ 和 tests/ 结构） **Performance Goals**:

- 版本检测 < 1s
- MCP 方法响应 < 500ms
- 配置验证 < 2s **Constraints**:
- 离线配置验证（不进行真实 API 调用）
- 不修改用户原始 Codex 配置文件（使用 Profile 机制）
- 100% MCP 协议兼容性 **Scale/Scope**:
- 支持 2 个 Codex 版本（0.42, 0.44）
- 34+ 参数映射条目
- 15+ MCP 方法实现
- 7 个功能需求（FR-001 到 FR-007）

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

基于 Codex Father 项目宪章 v1.1.0 的合规性检查：

### 一、代码质量与可维护性

- [x] 设计遵循 DRY、KISS、YAGNI 原则
  - 使用参数映射表避免硬编码重复
  - 版本检测逻辑简洁，使用 Codex 原生 `--version` 命令
  - 仅实现当前明确需要的功能（无过度设计）
- [x] 命名规范：TypeScript 使用 camelCase
  - 模块：`versionDetector.ts`, `configValidator.ts`, `mcpBridge.ts`
  - 函数：`detectCodexVersion()`, `validateConfig()`, `createProfile()`
- [x] 复杂逻辑有清晰的文档说明
  - 版本检测流程有详细注释
  - 配置验证逻辑有完整文档（包括映射表）
  - 降级策略有明确的行为说明

### 二、测试优先开发（TDD - 非协商项）

- [x] 所有新功能都规划了测试优先的开发流程
  - Phase 3.2：先写失败的测试（版本检测、配置验证、MCP 方法）
  - Phase 3.3：实现功能使测试通过
- [x] 契约测试覆盖所有 MCP 工具接口和 CLI 命令
  - 15+ MCP 方法的契约测试（与官方文档对比）
  - CLI 参数的契约测试
- [x] 测试覆盖率目标：核心功能 ≥80%，关键路径 100%
  - 核心：版本检测、配置验证、MCP 桥接（100%）
  - 关键路径：降级策略、错误处理（100%）

### 三、用户体验一致性

- [x] CLI 参数命名遵循现有模式
  - 保持与 Codex 官方参数一致（`--model`, `--profile`, `--sandbox` 等）
  - 添加 `--codex-version` 参数用于手动指定版本（可选）
- [x] 支持 `--help` 参数和清晰的错误消息
  - 所有版本不兼容错误都包含：版本信息、建议操作、升级命令
  - 示例：`参数 '--profile' 需要 Codex >= 0.44 (当前: 0.42.5)。升级：npm install -g @openai/codex@latest`
- [x] 输出格式统一（人类可读 + 机器可解析）
  - 版本检测输出：`✓ Codex 版本检测：0.42.5`
  - 配置警告：结构化警告 + 建议
  - MCP 错误响应：标准 JSON-RPC 错误格式

### 四、性能与效率要求

- [x] CLI 命令启动时间 < 1s，MCP 工具响应 < 500ms
  - 版本检测缓存：首次检测后缓存结果（< 100ms 后续调用）
  - 配置验证：纯静态检查，无网络调用（< 200ms）
  - MCP 方法响应：简单转发，无阻塞（< 500ms）
- [x] 内存占用：MCP 服务器 < 200MB（空闲时）
  - 参数映射表：内存常驻（< 1MB）
  - 版本缓存：单一对象（< 1KB）
- [x] 性能关键路径有基准测试计划
  - 版本检测性能测试（< 1s 要求）
  - 配置验证性能测试（< 2s 要求）
  - MCP 响应时间基准（< 500ms 要求）

### 五、安全与可靠性

- [x] 默认使用安全策略
  - 配置修正仅写入 Codex Profile（不修改原配置文件）
  - 版本检测使用 `child_process.execFile` 而非 `exec`（防止注入）
- [x] 输入验证和敏感信息脱敏设计
  - 所有配置项通过 Zod Schema 验证
  - API Key 仅验证存在性，不记录值
- [x] 错误恢复和审计日志机制
  - 版本检测失败：立即报错并提示解决方案
  - 配置验证失败：交互式确认 + 用户选择记录
  - 所有操作记录到会话日志

### 六、协议与架构决策

- [x] MCP 协议优先
  - 对外接口统一使用 MCP 标准方法
  - 实现所有 Codex 0.44 MCP 方法（15+ 方法）
- [x] 协议桥接层
  - `core/mcp/codex-bridge.ts`：MCP ↔ Codex JSON-RPC 协议转换
  - 事件映射：Codex Event → MCP Notification
- [x] 异步响应机制
  - 所有 MCP 方法快速返回（< 500ms）
  - 长时间操作通过 `codex/event` 通知推送进度
- [x] 进程管理策略
  - MVP1：单进程管理，排队执行（与现有架构一致）
  - 版本检测在进程启动时执行一次
- [x] 扩展性设计
  - 参数映射表支持轻松添加新版本
  - 版本检测逻辑支持扩展到 0.45+

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

<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

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

### 任务生成策略

**输入来源**:

1. `.specify/templates/tasks-template.md` - 任务模板
2. `specs/008-ultrathink-codex-0/contracts/` - 23 个 MCP 方法契约
3. `specs/008-ultrathink-codex-0/data-model.md` - 7 个核心实体定义
4. `specs/008-ultrathink-codex-0/quickstart.md` - 6 组用户验收场景
5. `specs/008-ultrathink-codex-0/research.md` - 10 个技术决策点

### 任务类别与生成规则

#### 1. Phase 3.1: 完成契约定义（20 个任务，可并行）

**规则**: contracts/contracts-checklist.md 中标记为 "📋 待创建" 的方法

```
T001 [P] 创建 interruptConversation 契约 (Schema + 测试)
T002 [P] 创建 listConversations 契约 (Schema + 测试)
...
T020 [P] 创建 execOneOffCommand 契约 (Schema + 测试)
```

**并行标记**: [P] - 所有契约创建任务独立，可并行执行

---

#### 2. Phase 3.2: 基础设施与核心模块（8 个任务，部分并行）

**规则**: 基于 data-model.md 的实体和 research.md 的技术决策

```
T021 [P] 实现版本检测模块 (versionDetector.ts + 测试)
      - 输入: research.md#1-版本检测机制
      - 输出: src/lib/versionDetector.ts, tests/unit/versionDetector.test.ts
      - 验证: 测试覆盖率 100%, 性能 < 1s

T022 [P] 实现参数-版本映射表 (parameterMapping.ts + 测试)
      - 输入: parameter-version-mapping.md
      - 输出: src/lib/parameterMapping.ts, tests/unit/parameterMapping.test.ts
      - 验证: 34+ 参数映射正确

T023 [P] 实现配置 Schema 定义 (configSchema.ts)
      - 输入: data-model.md#3-配置选项
      - 输出: src/lib/configSchema.ts (Zod Schema)
      - 验证: 所有配置项类型正确

T024 实现配置验证模块 (configValidator.ts + 测试)
      - 依赖: T021, T022, T023
      - 输入: research.md#5-配置验证方式
      - 输出: src/lib/configValidator.ts, tests/unit/configValidator.test.ts
      - 验证: 离线验证 < 200ms, 测试覆盖率 ≥ 80%

T025 实现 Codex Profile 管理 (profileManager.ts + 测试)
      - 依赖: T024
      - 输入: research.md#2-配置修正持久化机制
      - 输出: src/lib/profileManager.ts, tests/unit/profileManager.test.ts
      - 验证: Profile 写入成功, 格式符合 TOML 规范

T026 实现模型-wire_api 映射 (modelWireApiMapping.ts + 测试)
      - 输入: research.md#6-模型与wire_api映射
      - 输出: src/lib/modelWireApiMapping.ts, tests/unit/modelWireApiMapping.test.ts
      - 验证: gpt-5-codex → "responses" 映射正确

T027 实现错误格式化模块 (errorFormatter.ts + 测试)
      - 输入: research.md#8-错误处理增强, data-model.md#7-错误响应
      - 输出: src/lib/errorFormatter.ts, tests/unit/errorFormatter.test.ts
      - 验证: 错误消息包含完整上下文和建议

T028 实现三层降级策略 (degradationStrategy.ts + 测试)
      - 依赖: T021, T022, T027
      - 输入: research.md#3-三层降级策略
      - 输出: src/lib/degradationStrategy.ts, tests/unit/degradationStrategy.test.ts
      - 验证: CLI/配置/MCP 三层行为正确
```

---

#### 3. Phase 3.3: MCP 方法实现（18 个任务，部分并行）

**规则**: contracts/ 中 "📋 待测试" 或 "📋 待创建" 的方法，优先级顺序实现

**核心方法** (优先级：核心，依赖基础设施):

```
T029 实现 codex/event 通知处理 (eventHandler.ts + 集成测试)
      - 依赖: T021-T028
      - 输入: contracts/codex-event.schema.json, data-model.md#6-MCP方法
      - 输出: src/mcp/eventHandler.ts, tests/integration/eventHandler.test.ts
      - 验证: 事件流解析正确, 通知推送成功

T030 补充 sendUserMessage 契约测试
      - 输入: contracts/sendUserMessage.schema.json
      - 输出: contracts/sendUserMessage.contract.test.ts
      - 验证: 契约测试通过

T031 补充 sendUserTurn 契约测试
      - 输入: contracts/sendUserTurn.schema.json
      - 输出: contracts/sendUserTurn.contract.test.ts
      - 验证: 契约测试通过
```

**审批方法** (优先级：高):

```
T032 实现 applyPatchApproval (Server → Client)
T033 实现 execCommandApproval (Server → Client)
```

**会话管理** (优先级：中):

```
T034 实现 interruptConversation
T035 实现 resumeConversation
T036 实现 listConversations
T037 实现 archiveConversation
```

**认证方法** (优先级：中):

```
T038 实现 loginApiKey
T039 实现 loginChatGpt + loginChatGptComplete
T040 实现 cancelLoginChatGpt + logoutChatGpt
T041 实现 getAuthStatus
T042 实现 authStatusChange (notification)
```

**配置和工具** (优先级：低):

```
T043 实现 getUserSavedConfig
T044 实现 setDefaultModel
T045 实现 getUserAgent
T046 实现 userInfo
T047 实现 gitDiffToRemote
T048 实现 execOneOffCommand
```

---

#### 4. Phase 3.4: 集成测试与验收（6 个任务）

**规则**: quickstart.md 的 6 组场景 → 集成测试

```
T049 集成测试：基础功能（0.42/0.44 通用）
      - 输入: quickstart.md#A1-A3
      - 输出: tests/integration/basic-features.test.ts
      - 验证: MCP 服务器启动, 创建会话, 发送消息

T050 集成测试：版本检测与降级（0.42 环境）
      - 输入: quickstart.md#B1-B3
      - 输出: tests/integration/version-detection.test.ts
      - 验证: 版本识别, 参数报错, 配置警告

T051 集成测试：配置验证与修正（0.44 环境）
      - 输入: quickstart.md#C1-C3
      - 输出: tests/integration/config-validation.test.ts
      - 验证: 405 风险检测, 自动修正, 保留原配置

T052 集成测试：新特性支持（0.44 环境）
      - 输入: quickstart.md#D1-D2
      - 输出: tests/integration/new-features.test.ts
      - 验证: Profile 参数, 推理配置

T053 集成测试：错误处理增强
      - 输入: quickstart.md#E1-E2
      - 输出: tests/integration/error-handling.test.ts
      - 验证: 405 错误诊断, 版本检测失败

T054 集成测试：MCP 协议兼容性
      - 输入: quickstart.md#F1-F2
      - 输出: tests/integration/mcp-compatibility.test.ts
      - 验证: 所有方法可用, 审批流程
```

---

#### 5. Phase 3.5: 性能与文档（4 个任务）

```
T055 性能基准测试
      - 输入: quickstart.md#性能验收
      - 输出: tests/benchmark/performance.bench.ts
      - 验证: 版本检测 < 1s, 配置验证 < 2s, MCP 响应 < 500ms

T056 更新用户文档 (README.md)
      - 输入: quickstart.md, research.md
      - 输出: docs/codex-0.44-compatibility.md
      - 内容: 使用指南, 版本兼容性说明, 故障排除

T057 更新 API 文档 (自动生成)
      - 输入: src/**/*.ts (JSDoc 注释)
      - 输出: docs/api/
      - 工具: typedoc

T058 最终验收测试
      - 输入: quickstart.md 全部场景
      - 执行: 手动验收测试（A1-F2）
      - 输出: 验收报告
```

---

### 任务排序策略

**TDD 顺序**:

1. 契约测试先行（T001-T020, T030-T031）
2. 基础模块实现（T021-T028）
3. MCP 方法实现（T029, T032-T048）
4. 集成测试验证（T049-T054）
5. 性能与文档（T055-T058）

**依赖关系**:

- T024-T028 依赖 T021-T023（基础模块）
- T029, T032-T048 依赖 T021-T028（MCP 方法需要基础设施）
- T049-T054 依赖所有实现任务（集成测试需要完整功能）

**并行执行标记** [P]:

- T001-T020: 所有契约创建任务可并行
- T021-T023: 版本检测、映射表、Schema 定义可并行
- T032-T048 中同优先级任务可并行（如 T032-T033, T034-T037）

---

### 预估输出

**任务总数**: 58 个任务

**分布**:

- Phase 3.1 (契约): 20 个任务（可并行）
- Phase 3.2 (基础): 8 个任务（部分并行）
- Phase 3.3 (实现): 18 个任务（部分并行）
- Phase 3.4 (集成): 6 个任务（顺序执行）
- Phase 3.5 (完善): 4 个任务（顺序执行）

**估算工作量**:

- Phase 3.1: 约 8-16 小时（并行执行）
- Phase 3.2: 约 12-16 小时
- Phase 3.3: 约 20-30 小时
- Phase 3.4: 约 8-12 小时
- Phase 3.5: 约 4-6 小时
- **总计**: 约 52-80 小时

---

**⚠️ 重要提示**: 此部分仅为 /tasks 命令的执行计划描述，实际 tasks.md 文件将由 /tasks 命令生成。/plan 命令到此结束。

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

- [x] Phase 0: Research complete (/plan command) ✓
- [x] Phase 1: Design complete (/plan command) ✓
- [x] Phase 2: Task planning complete (/plan command - describe approach only) ✓
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (无复杂性偏差)

---

_Based on Constitution v2.1.1 - See `/memory/constitution.md`_
