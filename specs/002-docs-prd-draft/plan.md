# Implementation Plan: PRD Draft Documentation System

**Branch**: `002-docs-prd-draft` | **Date**: 2025-09-28 | **Spec**:
[spec.md](./spec.md) **Input**: Feature specification from
`/specs/002-docs-prd-draft/spec.md`

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

PRD Draft Documentation
System: 为产品经理和架构师提供结构化的PRD草稿创建、编辑、审查工具。支持Markdown格式、技术架构字段、决策追踪、角色权限管理和Mermaid图表集成。核心工作流程：架构师主导编写 → 团队评审反馈 → 修订完善 → 状态确认。

## Technical Context

**Language/Version**: TypeScript 5.x + Node.js 18+
(统一技术栈，符合项目现有规范) **Primary Dependencies**: Markdown
parser/renderer, Mermaid图表库, 文件系统操作, 权限管理框架
**Storage**: 文件系统 - JSON/YAML配置文件 + 结构化文本日志 + Markdown文档存储
**Testing**: Jest/Vitest (TypeScript测试框架), 契约测试 (MCP工具接口) **Target
Platform**: Linux/macOS/Windows (跨平台桌面环境) **Project Type**: single
(文档管理工具，集成到codex-father主项目) **Performance Goals**: 文档加载 <
100ms, 编辑响应 < 50ms, 大文档渲染 < 500ms **Constraints**: 内存占用 <
100MB, 文件监听不阻塞主进程, 本地文件系统存储
**Scale/Scope**: 单用户/小团队使用, 支持数百个PRD文档, 每个文档最大10MB

**Additional
Context**: 基于完善的规格创建详细的实施计划 - 需要支持架构师主导的技术文档编写流程，集成现有codex-father工具链

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

基于 Codex Father 项目宪章 v1.0.0 的合规性检查：

### 代码质量与可维护性

- [x] 设计遵循 DRY、KISS、YAGNI 原则 (单一PRD管理职责，简洁模块化设计)
- [x] 命名规范：TypeScript 使用 camelCase (prdDraft, documentTemplate,
      reviewStatus)
- [x] 复杂逻辑有清晰的文档说明 (Markdown解析、权限管理、版本历史)

### 测试优先开发（TDD - 非协商项）

- [x] 所有新功能都规划了测试优先的开发流程 (契约测试 → 实现 → 集成测试)
- [x] 契约测试覆盖所有 MCP 工具接口和 CLI 命令 (PRD CRUD、权限验证、状态管理)
- [x] 测试覆盖率目标：核心功能 ≥80%，关键路径 100% (文档创建、编辑、审查流程)

### 用户体验一致性

- [x] CLI 参数命名遵循现有模式 (--template, --draft-id, --json, --help)
- [x] 支持 --help 参数和清晰的错误消息 (权限拒绝、文件不存在、格式错误)
- [x] 输出格式统一 (human-readable状态 + JSON API响应)

### 性能与效率要求

- [x] CLI 命令启动时间 < 1s，MCP 工具响应 < 500ms (文档操作响应 < 100ms)
- [x] 内存占用：MCP 服务器 < 200MB (文档缓存管理，大文件流式处理)
- [x] 性能关键路径有基准测试计划 (文档加载、Mermaid渲染、搜索性能)

### 安全与可靠性

- [x] 默认使用安全策略 (文档写入限制在指定目录，权限验证)
- [x] 输入验证和敏感信息脱敏设计 (Markdown安全解析，用户输入验证)
- [x] 错误恢复和审计日志机制 (操作日志、版本回滚、状态恢复)

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
src/
├── models/
│   ├── prd-draft.ts          # PRD文档数据模型
│   ├── template.ts           # 模板配置模型
│   ├── user-role.ts          # 用户角色权限模型
│   └── review-status.ts      # 审查状态模型
├── services/
│   ├── document-service.ts   # PRD文档CRUD操作
│   ├── template-service.ts   # 模板管理服务
│   ├── permission-service.ts # 权限验证服务
│   ├── version-service.ts    # 版本历史服务
│   └── diagram-service.ts    # Mermaid图表渲染服务
├── cli/
│   ├── prd-commands.ts       # CLI命令定义
│   └── prd-handlers.ts       # 命令处理器
└── lib/
    ├── markdown-parser.ts    # Markdown解析器
    ├── file-manager.ts       # 文件系统操作
    └── utils.ts              # 工具函数

tests/
├── contract/
│   ├── prd-api.test.ts      # PRD API契约测试
│   └── cli-commands.test.ts  # CLI命令契约测试
├── integration/
│   ├── workflow.test.ts      # 完整工作流程测试
│   └── permission.test.ts    # 权限集成测试
└── unit/
    ├── models/               # 模型单元测试
    ├── services/             # 服务单元测试
    └── lib/                  # 工具库单元测试
```

**Structure
Decision**: 选择单项目结构，PRD文档系统作为codex-father的功能模块集成。使用TypeScript模块化设计，分离模型、服务、CLI和工具库，便于测试和维护。

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

**Task Generation Strategy**:

- Load `.specify/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (data-model.md, contracts/,
  quickstart.md)
- API contracts → contract test tasks [P] (prd-api.yaml, cli-commands.yaml)
- Data entities → model creation tasks [P] (PRDDraft, Template, Version,
  ReviewStatus, UserRole, TechnicalDecision, DiagramComponent)
- User scenarios from quickstart.md → integration test tasks
- CLI commands → command implementation and testing tasks [P]
- Implementation tasks following TDD principles to make all tests pass

**Ordering Strategy**:

- **TDD Order**: 契约测试 → 模型测试 → 服务测试 → 集成测试 → 实现代码
- **Dependency Order**:
  1. Core models (数据模型基础)
  2. Storage layer (文件系统操作)
  3. Services (业务逻辑服务)
  4. CLI interface (命令行接口)
  5. MCP tools (工具集成)
- **Parallel Execution**: Mark [P] for independent tasks
  (不同模型创建、独立服务开发、并行测试)

**Estimated Task Categories**:

- Contract tests: 8-10 tasks (API endpoints + CLI commands)
- Model implementation: 7 tasks (one per entity)
- Service layer: 8-10 tasks (document, template, permission, version, diagram
  services)
- CLI implementation: 12-15 tasks (command groups and handlers)
- Integration tests: 5-8 tasks (workflow scenarios from quickstart)
- Documentation: 3-5 tasks (API docs, CLI help, user guides)

**Total Estimated Output**: 43-55 numbered, prioritized tasks in tasks.md

**Special Considerations**:

- Mermaid图表渲染任务需要额外依赖设置
- 权限管理任务需要按角色分阶段实现
- 文件系统监听任务考虑跨平台兼容性
- CLI命令需要包含--help和错误处理验证

**Testing Strategy Integration**:

- 每个contract test必须先失败 (Red)
- 实现任务使contract test通过 (Green)
- 重构任务优化代码质量 (Refactor)
- Performance benchmarks验证符合宪章要求

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

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

- [x] Phase 0: Research complete (/plan command) - ✅ research.md generated
- [x] Phase 1: Design complete (/plan command) - ✅ data-model.md, contracts/,
      quickstart.md, CLAUDE.md updated
- [x] Phase 2: Task planning complete (/plan command - describe approach only) -
      ✅ Strategy documented below
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:

- [x] Initial Constitution Check: PASS - All宪章要求符合
- [x] Post-Design Constitution Check: PASS - 设计维持宪章合规性
- [x] All NEEDS CLARIFICATION resolved - 技术选择和架构已明确
- [x] Complexity deviations documented - 无复杂度违规

---

_Based on Constitution v2.1.1 - See `/memory/constitution.md`_
