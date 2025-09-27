
# Implementation Plan: 基于分阶段实施方案的规范和技术架构更新

**Branch**: `001-docs-readme-phases` | **Date**: 2025-09-27 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/home/stark/codex-father/specs/001-docs-readme-phases/spec.md`

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

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary

**主要需求**: 基于三阶段实施方案（非交互模式→Git PR自动化→容器集成）更新 Codex Father 项目的技术架构规范、代码质量标准、目录结构和文档体系，确保项目按既定路线图有序推进。

**技术方案**:
- 全栈 TypeScript/Node.js 统一技术栈，最大化代码复用和开发效率
- 基于文件系统的简洁数据存储（JSON/YAML配置 + 文本日志）
- 文件队列系统实现可靠的异步任务管理，支持优先级和重试机制
- Vitest 测试框架支持现代化测试开发流程
- 严格的测试覆盖率要求：核心功能≥80%，关键路径100%

## Technical Context

**双轨技术策略**：
- **现阶段**：CLI 仍为 Bash（start.sh/job.sh）；MCP 为 TypeScript 5.x + Node.js 18+；新增 TS 组件不得破坏 start.sh/job.sh 行为与产物
- **长期目标**：在 core/cli-ts/ 探索 TS 包装器，但通过 start.sh 统一入口兼容切换

**TypeScript 技术栈** (仅限MCP和新组件):
- Core: @types/node, typescript, tsx (runtime)
- Testing: vitest, @vitest/coverage-v8
- Quality: eslint, prettier, @typescript-eslint/*
- Build: tsup (bundling), npm-run-all (scripts)
- Queue: 复用 job.sh + .codex-father/sessions/ 架构，扩展 TS 组件

**Bash 技术栈** (现有CLI):
- Style: Google Shell Style Guide
- Quality: bash -n, shellcheck 静态分析
- Testing: bats, smoke 测试 (保留现有 tests/smoke_start_args_forwarding.sh, tests/mcp_ts_e2e.sh)

**Storage**: 文件系统 - JSON/YAML配置文件 + 结构化文本日志
**Testing**: Bash(bats+smoke) + TypeScript(Vitest) 双重测试策略
**Target Platform**: 跨平台CLI工具 (Linux/macOS/Windows + Node.js)
**Project Type**: 单一项目 - CLI工具包装器架构，支持MCP服务器模块
**Performance Goals**:
- CLI启动 <1s，MCP响应 <500ms
- 任务队列处理延迟 <2s
- 并发支持 ≥10 异步任务

**Constraints**:
- 内存占用：CLI <100MB，MCP服务器 <200MB
- 文件系统依赖：需要工作区读写权限
- 向后兼容：渐进迁移，保持现有脚本功能，新组件不破坏现有接口
- 产物路径：遵循AGENTS.md规范，所有 TS 生成的产物必须写入 .codex-father/sessions/<job-id>/
- 安全默认值：--redact 生效、--sandbox workspace-write

**Scale/Scope**:
- 3个实施阶段的架构重组
- ~50个配置/脚本文件迁移
- 完整测试覆盖率建立（核心≥80%，关键路径100%）

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

基于 Codex Father 项目宪章 v1.0.0 的合规性检查：

### 代码质量与可维护性
- [x] 设计遵循 DRY、KISS、YAGNI 原则（TypeScript模块化，文件队列简洁设计）
- [x] 命名规范：全栈 TypeScript camelCase，ESLint+Prettier强制规范
- [x] 复杂逻辑有清晰的文档说明（异步队列、三阶段依赖关系文档化）

### 测试优先开发（TDD - 非协商项）
- [x] 所有新功能都规划了测试优先的开发流程（Vitest + 严格覆盖率）
- [x] 契约测试覆盖所有 MCP 工具接口和 CLI 命令（接口规范先行）
- [x] 测试覆盖率目标：核心功能 ≥80%，关键路径 100%（已明确要求）

### 用户体验一致性
- [x] CLI 参数命名遵循现有模式（commander.js标准化，--help、--json等）
- [x] 支持 --help 参数和清晰的错误消息（统一错误处理机制）
- [x] 输出格式统一（chalk样式 + JSON模式支持）

### 性能与效率要求
- [x] CLI 命令启动时间 < 1s，MCP 工具响应 < 500ms（TypeScript编译优化）
- [x] 内存占用：CLI <100MB，MCP服务器 <200MB（文件系统轻量化）
- [x] 性能关键路径有基准测试计划（任务队列、启动时间基准）

### 安全与可靠性
- [x] 默认使用安全策略（沙箱策略规范化，workspace-write默认）
- [x] 输入验证和敏感信息脱敏设计（TypeScript类型安全 + 日志脱敏）
- [x] 错误恢复和审计日志机制（任务队列重试 + 结构化日志）

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

### Source Code (repository root) - 目标结构

**重要说明**：以下为目标蓝图，非立即变更。实际落地时遵循阶段零映射和不破坏性迁移说明。

**阶段零映射**（现状保留）：
- 保留 start.sh/job.sh/lib/mcp/docs/tests 现状
- 仅新增 specs/phases/ 目录
- TS 代码置于 mcp/codex-mcp-server 或新建 core 但不影响现有路径
- 产物路径遵循 .codex-father/sessions/<job-id>/ 规范

```
codex-father/
├── 🔧 core/                           # 核心功能模块（TypeScript）
│   ├── cli/                           # CLI 包装器组件
│   │   ├── start.ts                   # 主入口脚本
│   │   ├── task-queue.ts              # 异步任务队列管理
│   │   └── utils/                     # CLI 工具函数
│   ├── mcp/                           # MCP 服务器模块
│   │   ├── server.ts                  # MCP 入口
│   │   ├── codex-mcp-server/          # TypeScript MCP 实现
│   │   └── protocols/                 # MCP 协议定义
│   └── lib/                           # 共享库
│       ├── common.ts                  # 通用函数
│       ├── presets.ts                 # 预设配置
│       └── validation/                # 参数验证

├── 🎯 phases/                         # 三阶段实施模块
│   ├── phase1-non-interactive/        # 阶段一：非交互模式
│   ├── phase2-git-pr-automation/      # 阶段二：Git PR自动化
│   └── phase3-container-integration/  # 阶段三：容器集成

├── 🧪 tests/                          # 测试架构（Vitest）
│   ├── unit/                          # 单元测试
│   ├── integration/                   # 集成测试
│   ├── e2e/                          # 端到端测试
│   ├── fixtures/                      # 测试固件
│   └── utils/                         # 测试工具

├── 🐳 environments/                   # 环境配置
├── 📚 docs/                          # 文档体系
├── 🔒 security/                      # 安全与合规
├── 🛠️ tools/                         # 开发工具
├── 📊 config/                        # 配置管理
└── 📝 .specify/                      # 规范管理（现有）
```

**Structure Decision**: 采用单一项目结构，基于现有 codex-father 目录架构。**阶段零**：保留现有 Bash CLI 和 MCP 结构，仅新增 specs/ 和 phases/ 目录。**长期**：核心实现集中在 `core/` 目录（TypeScript），三阶段功能模块化在 `phases/` 目录，测试采用 Bash+TS 双重策略。该结构支持渐进式迁移和并行开发，不破坏现有接口与产物。

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
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Generate CLI/MCP interface contracts** from functional requirements:
   - CLI 命令接口 → TypeScript 类型定义 + CLI 手册/用法示例
   - MCP 工具接口 → JSON Schema + TypeScript 类型
   - Bash 脚本 → bats/shellcheck/smoke 测试策略
   - Output CLI 类型/Schema 合约到 `/contracts/`

3. **Generate contract tests** from contracts:
   - CLI: bats 测试文件 + smoke 测试用例
   - MCP: TypeScript 接口测试文件
   - Assert CLI 参数/输出格式 + MCP 请求/响应 Schema
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Each story → integration test scenario
   - Quickstart test = story validation steps

5. **Update agent file incrementally** (O(1) operation):
   - Run `.specify/scripts/bash/update-agent-context.sh claude`
     **IMPORTANT**: Execute it exactly as specified above. Do not add or remove any arguments.
   - If exists: Add only NEW tech from current plan
   - Preserve manual additions between markers
   - Update recent changes (keep last 3)
   - Keep under 150 lines for token efficiency
   - Output to repository root

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, agent-specific file

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**细颗粒度任务生成策略**:

1. **合约驱动任务生成**:
   - CLI Interface Contract (cli-interface.ts) → 8 个测试任务 [P]
   - MCP Service Contract (mcp-service.ts) → 12 个测试任务 [P]
   - Task Queue Contract (task-queue.ts) → 10 个测试任务 [P]
   - 每个合约接口 → 对应实现任务（串行，依赖测试）

2. **数据模型驱动任务**:
   - TechnicalArchitectureSpec → 模型+验证+存储任务 [P]
   - DirectoryArchitectureStandard → 模型+迁移+验证任务 [P]
   - CodeQualityStandard → 模型+配置+集成任务 [P]
   - TestArchitectureFramework → 模型+配置+运行器任务 [P]
   - TaskQueueSystem → 核心队列逻辑+文件系统+监控任务
   - ConfigurationManagement → 配置引擎+验证+环境管理任务
   - SecurityComplianceFramework → 安全策略+审计+沙箱任务

3. **三阶段实施任务分解**:

   **阶段一任务 (16-18 个任务)**:
   - 项目结构迁移: 5 个细分任务
   - TypeScript 配置: 3 个配置任务
   - CLI 核心框架: 6 个实现任务
   - 基础任务队列: 4 个核心功能任务

   **阶段二任务 (12-14 个任务)**:
   - Git 操作封装: 4 个工具任务
   - PR 自动化: 4 个工作流任务
   - 任务队列扩展: 4 个集成任务

   **阶段三任务 (10-12 个任务)**:
   - 容器支持: 5 个容器管理任务
   - 环境回退: 3 个回退机制任务
   - E2E 测试: 4 个容器测试任务

4. **测试优先任务排序**:

   **第一批 (并行) - 合约测试**:
   - T001-T030: 所有接口合约测试 [P]

   **第二批 (并行) - 模型层**:
   - T031-T045: 数据模型实现 [P]

   **第三批 (串行) - 核心逻辑**:
   - T046-T065: CLI 核心功能（依赖模型）
   - T066-T080: 任务队列系统（依赖 CLI）

   **第四批 (阶段实现)**:
   - T081-T100: 阶段一实现
   - T101-T115: 阶段二实现
   - T116-T128: 阶段三实现

5. **质量保证任务**:
   - 每个实现任务 → 对应单元测试任务
   - 每个阶段 → 集成测试任务
   - 关键路径 → E2E 测试任务
   - 性能基准 → 基准测试任务

**依赖关系管理**:
- 严格 TDD：测试任务必须在实现任务前完成
- 模块依赖：lib → cli → mcp → phases
- 阶段依赖：Phase1 → Phase2 → Phase3
- 基础设施：配置系统 → 所有其他模块

**并行化策略**:
- 合约测试：完全并行 [P]
- 模型实现：文件级并行 [P]
- 功能实现：模块级串行，方法级并行
- 阶段实现：严格串行

**颗粒度控制**:
- 单个任务执行时间 ≤ 2 小时
- 每个任务产出明确可测试
- 任务描述包含验收标准
- 失败任务可独立重试

**预期输出**: 120-130 个细颗粒度任务，分 4 个并行批次和 3 个串行阶段

**配置文件生成**:
- package.json: TypeScript + Vitest + 构建工具配置
- tsconfig.json: 严格模式 TypeScript 配置
- vitest.config.ts: 测试覆盖率和并行配置
- eslint.config.js: 代码质量规则配置

**IMPORTANT**: 此阶段由 /tasks 命令执行，/plan 命令仅描述策略

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |


## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [ ] Initial Constitution Check: 待执行（需smoke测试通过后验证）
- [ ] Post-Design Constitution Check: 待执行（需MCP E2E测试通过后验证）
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (无复杂度偏差)

---
*Based on Constitution v1.0.0 - See `.specify/memory/constitution.md`*
