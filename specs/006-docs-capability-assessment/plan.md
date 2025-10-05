# Implementation Plan: Multi-Agent Parallel Task Orchestration

**Branch**: `006-docs-capability-assessment` | **Date**: 2025-10-03 | **Spec**:
spec.md **Input**: Feature specification
from `specs/006-docs-capability-assessment/spec.md`

## Execution Flow (/plan command scope)

```
1. Load feature spec from Input path → OK
2. Fill Technical Context → OK（无澄清覆盖，采用现有设计与仓库栈）
3. Fill Constitution Check → OK
4. Evaluate Constitution Check → OK（无阻断项）
5. Execute Phase 0 → research.md → DONE
6. Execute Phase 1 → contracts, data-model.md, quickstart.md → DONE（生成到 specs/006-*）
7. Re-evaluate Constitution Check → OK（与 NFR/安全基线一致）
8. Plan Phase 2（不创建 tasks.md）→ DONE（方案已写入文末）
9. STOP - Ready for /tasks command
```

## Progress Tracking

- Phase 0 (Research): Completed
- Phase 1 (Design & Contracts): Completed
- Constitution Check (Initial/Post-Design): Passed
- Phase 2 (Planning Approach): Documented (not executed)

## Summary

在单机内编排最多 10 个 Codex 实例并行执行：依赖图拓扑调度并发、SWW 单写者窗口串行写入、两阶段写与快速校验保证一致性；编排器禁网，仅经 Codex
CLI 通道使用 LLM；以 Stream-JSON 输出可观测性事件与 JSONL 审计日志。并发调度复用
`core/lib/queue/*`，进程池由 `ProcessOrchestrator` 管理，配置/安全沿用
`ConfigLoader` 与默认 `workspace-write` 沙箱。

## Technical Context

**Language/Version**: Node.js >=18 + TypeScript ^5  
**Primary Dependencies**: commander, fs-extra, yaml, zod, winston  
**Storage**: Files (.codex-father/sessions/<id>/)  
**Testing**: vitest（单元/集成），契约测试以文档规范先行  
**Target Platform**: 本地 CLI（Linux/macOS/容器），禁网 orchestrator  
**Project Type**: single（monorepo 内核心为 `core/*` + `src/*` 工具）  
**Performance Goals**: 启动 <1s；最大并发 10；写窗口补丁应用+快速校验常见情形 <15s  
**Constraints**:
sandbox=workspace-write；默认网络关闭；任务超时 30 分钟；SWW 仅 1 个写者；成功率阈值 90%  
**Scale/Scope**: 单机执行；并发进程 1-10；事件流稳定输出；失败自动重试 1 次

## Constitution Check

### 代码质量与可维护性

- [x] 设计遵循 DRY、KISS、YAGNI（复用 queue/日志/配置，谨慎新增依赖）
- [x] 命名规范：Shell snake_case，TS camelCase（延续现有约定）
- [x] 复杂逻辑有清晰文档（SWW、进程/并发、事件流均在 design.md/本计划中描述）

### 测试优先开发（TDD - 非协商项）

- [x] 规划测试优先流程（契约→用例→实现）
- [x] 契约测试覆盖 CLI 行为与事件流格式（先文档化，后编写测试）
- [x] 覆盖率目标：核心 ≥80%，关键路径 100%（集成阶段落实）

### 用户体验一致性

- [x] CLI 参数命名遵循现有模式（对齐现有 `core/cli` 风格）
- [x] 支持 `--help` 与清晰错误消息（沿用 commander）
- [x] 输出统一（人类可读 + 机器可解析：Stream-JSON + JSON 摘要）

### 性能与效率要求

- [x] CLI 启动 < 1s（常驻依赖最小化）
- [x] 资源目标：编排器 <200MB；并发由监控降级
- [x] 基准测试计划：并发调度与写窗口路径后置补充

### 安全与可靠性

- [x] 默认 `--sandbox workspace-write`，编排器禁网
- [x] 输入验证/脱敏：zod 校验 + 日志摘要
- [x] 错误恢复与审计：JSONL 事件（append-only）+ 重试策略

## Project Structure

### Documentation (this feature)

```
specs/006-docs-capability-assessment/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── orchestrate.cli.md
    └── events.md
```

### Source Code (repository root)

```
core/
├── cli/
│   ├── commands/
│   │   └── orchestrate-command.ts   # 新增：编排 CLI 入口
│   └── start.ts
├── lib/
│   └── queue/                       # 并发/重试/调度复用
├── session/                         # 事件日志、会话持久化
└── mcp/                             # 可选演进：替代进程直连

specs/006-docs-capability-assessment/  # 本特性设计与契约
docs/schemas/                          # 事件 Stream-JSON schema（已存在）
```

**Structure Decision**: 单项目结构（monorepo 内模块分层），核心代码集中在
`core/*`，CLI 扩展一个 `orchestrate` 子命令；文档与契约集中在 `specs/006-*` 与
`docs/schemas/`。

## Phase 0: Outline & Research

已完成，详见 `research.md`：

- LLM 通道仅经 Codex CLI；编排器禁网（安全/一致性）
- 并发调度复用 `core/lib/queue`，不引入第三方并发库（DRY/YAGNI）
- 资源监控优先用 Node 内置 `os`/`process` 指标，必要时再扩展
- SWW 补丁应用优先 `git apply`，失败回退 `native`；快速校验为强制
- 事件与审计沿用既有 Schema 与 JSONL 记录

## Phase 1: Design & Contracts

输出物：

- 数据模型：`data-model.md`（Orchestration/Task/Agent/Role/Patch/Feedback）
- 契约：`contracts/orchestrate.cli.md`（CLI 行为与参数）、`contracts/events.md`（事件类型与样例，指向现有 schema）
- 快速上手：`quickstart.md`（运行示例、事件流说明、成功判定）
- Agent 文件：将通过脚本增量更新 `docs/developer/DEVELOPMENT.md`

## Phase 2: Task Planning Approach（不在本命令执行）

当运行 `/tasks` 时：

- 载入 `.specify/templates/tasks-template.md`
- 从 `data-model.md`、`contracts/*`、`quickstart.md` 抽取任务生成清单
- 任务分组：CLI 接口、编排核心、进程池、SWW、事件与日志、资源监控、测试与文档
- 每项任务给出验收条件与相关文档引用

—— End of /plan ——
