# Feature Specification: Multi-Agent Parallel Task Orchestration

**Feature Branch**: `006-docs-capability-assessment`
**Created**: 2025-10-02
**Status**: Ready for Design ✅
**Input**: User description: "docs/capability-assessment-2025-10-02.md 澄清需求,要ultrathink的"


## ⚡ Quick Guidelines

- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing _(mandatory)_

### Primary User Story

**作为项目管理者**，我希望能够将一个大型开发需求提交给 codex-father，系统自动将其分解为多个可并行执行的子任务，并协调多个 AI 助手（Codex 实例）同时工作，从而**大幅缩短项目交付时间**，并在遇到问题时及时获得反馈和调整建议。

**业务价值**：
- **效率提升**：将串行执行改为并行执行，理论上可将 10 个任务的总耗时从 10 小时降至 1-2 小时
- **自动化**：减少手动任务分配和协调的工作量，项目管理者只需关注整体进度
- **质量保障**：系统自动检查任务理解度和上下文完整性，降低执行错误风险
- **快速响应**：问题发现后自动上报并建议调整策略，避免错误蔓延

### Acceptance Scenarios

1. **Given** 用户提交一个包含 10 个独立子任务的开发需求，**When** 系统分解并分配任务给 10 个 AI 助手，**Then** 系统应在“每任务超时阈值 30 分钟（可配置）”约束下完成任务；默认成功率阈值应 ≥ 90%（可配置），低于阈值则判定本次编排失败并输出失败任务清单与整改建议

2. **Given** 系统正在执行并行任务，**When** 用户查看整体进度，**Then** 系统应实时显示每个任务的状态（待执行/进行中/已完成/失败）、完成百分比、预计剩余时间

3. **Given** 某个 AI 助手在执行任务时遇到问题（如依赖缺失、权限不足），**When** 该助手向系统反馈问题，**Then** 系统应向上反馈给用户并记录问题详情

4. **Given** 系统检测到某个任务的上下文信息不足，**When** 准备分配该任务给 AI 助手，**Then** 系统应拒绝执行并向上反馈，直到获取足够的上下文才可以继续

5. **Given** 任务之间存在依赖关系（如任务 B 依赖任务 A 的输出），**When** 系统编排执行顺序，**Then** 系统应确保任务 A 完成后再启动任务 B

6. **Given** 用户定义了三种角色（开发者、审查者、测试工程师），**When** 系统分配任务，**Then** 系统应基于“规则表优先、LLM 兜底”的方式自动选择合适的角色（可选开启人工确认）

7. **Given** 系统正在执行 10 个并行任务，**When** 其中 3 个任务失败，**Then** 系统应通知上级找到失败的原因，并由上级重新规划

### Edge Cases

- **边界情况 1**：如果用户提交的需求无法自动分解为子任务，系统应拒绝执行并向上反馈给用户

- **边界情况 2**：如果某个任务执行时间超过 30 分钟（超时阈值），系统应终止该任务并标记为超时失败，记录日志并上报

- **边界情况 3**：如果系统资源不足（CPU/内存/网络），系统应自动降并发（最低降至 1）并将其余任务排队；如仍不足，则拒绝新任务并上报由用户调整

- **边界情况 4**：如果用户在任务执行过程中取消整个编排，系统应执行优雅停止：广播停止信号→等待 60 秒保存状态与产物→终止未完成任务→生成汇总报告并上报

- **边界情况 5**：如果某个任务需要的上下文信息在另一个任务的输出中，但后者尚未完成，系统应等待依赖任务完成

- **边界情况 6**：并发写入采用“单写者窗口（Single Writer Window, SWW）+ 补丁顺序应用”策略：任意时刻仅调度 1 个写任务；写任务必须产出补丁，编排器按提交顺序应用并执行快速校验/测试；若应用失败或冲突，则标记该补丁失败并上报，不阻塞读/分析任务

---

## Requirements _(mandatory)_

### Functional Requirements

#### 任务分解与编排

- **FR-001**: 系统 MUST 接受用户提交的完整开发需求描述（自然语言文本）

- **FR-002**: 系统 MUST 将开发需求分解为多个可独立执行的子任务，支持用户手动分解或使用 LLM 自动分解两种方式

- **FR-003**: 系统 MUST 识别子任务之间的依赖关系（如任务 B 依赖任务 A 的输出）

- **FR-004**: 系统 MUST 根据依赖关系生成任务执行计划（拓扑排序），确保依赖任务先执行

- **FR-005**: 系统 MUST 支持最多 10 个任务的并行执行

#### 角色与能力管理

- **FR-006**: 系统 MUST 支持预定义的角色类型（至少包括：开发者、审查者、测试工程师）

- **FR-007**: 系统 MUST 允许用户通过配置文件为每个角色配置专属的工作指令和能力范围

- **FR-008**: 系统 MUST 按“规则表优先、LLM 兜底”的方式为任务自动选择角色；当规则无法决定时允许使用 LLM 兜底，并可选开启人工确认

- **FR-009**: 不同角色 MUST 具有不同的权限和可用工具集，具体权限由用户在配置文件中定义

#### 上下文管理与验证

- **FR-010**: 系统 MUST 在分配任务前检查上下文信息是否完整（如依赖文件、环境变量、配置等）

- **FR-011**: 系统 MUST 验证 AI 助手是否正确理解了任务需求，通过让 AI 复述任务来验证理解

- **FR-012**: 系统 MUST 在上下文不足时拒绝执行，向上反馈并提示用户补充

#### 并行执行与监控

- **FR-013**: 系统 MUST 同时启动多个 AI 助手实例来执行并行任务

- **FR-014**: 系统 MUST 实时追踪每个任务的状态（待执行/进行中/已完成/失败）

- **FR-015**: 系统 MUST 提供整体进度视图，显示已完成任务数、进行中任务数、失败任务数

- **FR-016**: 系统 MUST 记录每个任务的开始时间、结束时间、执行日志

- **FR-017**: 系统 MUST 检测任务执行异常（如超时、崩溃、资源耗尽）

#### 问题反馈与策略调整

- **FR-018**: AI 助手 MUST 能够向系统反馈执行过程中遇到的问题（如依赖缺失、权限不足、逻辑错误）

- **FR-019**: 系统 MUST 接收并记录所有 AI 助手的反馈信息

- **FR-020**: 系统 MUST 将问题反馈上报给用户，反馈内容应包括：问题描述、影响范围（impact）、建议的解决方案

- **FR-021**: 系统 MUST 支持用户根据反馈进行人工介入调整执行策略

- **FR-022**: 系统 MUST 在遇到问题时采用人工介入模式，由用户决定如何处理

#### 结果汇总与报告

- **FR-023**: 系统 MUST 在所有任务完成后生成汇总报告，包括成功任务数、失败任务数、总耗时

- **FR-024**: 系统 MUST 记录每个任务的输出文件和变更内容

- **FR-025**: 系统 MUST 提供任务执行日志的查看和导出功能

### Non-Functional Requirements

- **NFR-001（运行模式）**：系统默认以非交互模式运行，等效于 `--ask-for-approval never`；默认沙箱为 `workspace-write` 且网络关闭，网络访问需通过配置显式开启或切换至受控环境

- **NFR-002（安全与角色）**：角色必须在配置中声明 `allowedTools`、`permission-mode`、`sandbox` 等安全参数；编排器在创建会话时必须使之生效

- **NFR-003（输出格式）**：系统必须支持 JSON 与 Stream-JSON 两种输出格式；Stream-JSON 至少包含 start、tool_use、completion、error 事件

- **NFR-004（审计与可观测性）**：系统必须以 JSONL 形式记录关键事件日志，至少包含 sessionId、taskId、timestamp、eventType、工具/命令摘要与结果摘要

- **NFR-005（取消/优雅停止）**：系统必须支持优雅停止流程：广播停止信号→最多等待 60 秒保存状态与产物→终止未完成任务→输出汇总报告

- **NFR-006（资源不足降级）**：当资源不足时，系统必须自动降并发（最低降至 1）并队列等待；如仍不足，则拒绝新任务并上报

- **NFR-007（并发写策略）**：系统必须采用“单写者窗口（SWW）+ 补丁顺序应用”：任意时刻仅调度 1 个写任务；写任务以补丁形式提交并按顺序应用，每次应用后执行快速校验/测试；失败则标记并上报

### Key Entities _(include if feature involves data)_

- **Orchestration（编排会话）**: 代表一次完整的多任务编排执行过程
  - 属性：唯一标识、用户需求描述、任务列表、整体状态、创建时间、完成时间
  - 关系：包含多个 Task

- **Task（任务）**: 代表一个可独立执行的子任务
  - 属性：唯一标识、任务描述、角色类型、状态、依赖任务列表、优先级、预计耗时、超时阈值（30分钟）
  - 关系：属于一个 Orchestration，可能依赖其他 Task，分配给一个 Agent

- **Role（角色）**: 代表一种预定义的工作角色（如开发者、审查者、测试工程师）
  - 属性：角色名称、工作指令、可用工具列表、权限范围、资源限制
  - 关系：可被多个 Task 引用

- **Agent（AI 助手实例）**: 代表一个正在运行的 Codex 实例
  - 属性：实例标识、角色类型、状态、当前任务、启动时间、资源使用情况
  - 关系：承担一个或多个 Task（按顺序执行）

- **Feedback（反馈）**: 代表 AI 助手上报的问题或状态更新
  - 属性：反馈类型、问题描述、影响范围、建议解决方案、严重程度、来源任务
  - 关系：关联到一个 Task 和一个 Agent

---

## Review & Acceptance Checklist

_GATE: Automated checks run during main() execution_

### Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness

- [x] **No [NEEDS CLARIFICATION] markers remain** ✅ **所有问题已澄清**
- [x] **Requirements are testable and unambiguous** ✅ **所有需求明确且可测试**
- [x] Success criteria are measurable
- [x] **Scope is clearly bounded** ✅ **范围明确：最多 10 并行、每任务超时 30 分钟、默认成功率阈值 90%、非交互运行、SWW 并发写策略**
- [x] Dependencies and assumptions identified

---

## Execution Status

_Updated by main() during processing_

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] All clarifications completed
- [x] Review checklist passed ✅

**Status**: ✅ **Specification Complete - Ready for Design Phase**

---

## 📋 Notes

本规范已将关键决策固化为可测试条款，并补充非功能性要求（非交互、安全、输出、审计、资源降级、并发写策略）。建议在设计阶段细化角色规则表与事件字段清单。

---

## Appendices

### A. 角色规则表（示例）

- 配置位置建议：`.codex-father/config/role-rules.yaml`
- 匹配原则：
  - 优先使用关键词规则匹配任务描述/标题；命中即确定角色
  - 多规则命中时：按“更长关键词优先，其次按规则顺序”决策，保证确定性
  - 无规则命中时：回退到 LLM 兜底；可配置是否需要人工确认

示例配置：

```
# .codex-father/config/role-rules.yaml
version: "1.0"
rules:
  - role: developer
    keywords: ["实现", "开发", "编码", "接口", "重构", "修复"]
  - role: reviewer
    keywords: ["审查", "review", "规范", "代码质量", "diff", "建议"]
  - role: tester
    keywords: ["测试", "单元测试", "集成测试", "覆盖率", "CI"]

fallback:
  type: "llm"           # 兜底方式：llm | deny
  requireConfirmation: false
```

最小可测算法（用于 FR-008 验证）：
- 输入：`task.description`（必要）、`task.title`（可选）
- 过程：对每条规则的每个关键词做子串匹配；命中记录（含命中位置/长度）
- 决策：先比较命中关键词长度（长者优先），再比较规则在列表中的先后（先者优先）
- 输出：确定角色或触发 fallback；记录匹配依据以供审计

### B. Stream-JSON 事件字段清单（最小集）

- 每行一条 JSON 事件，必须包含以下公共字段：
  - `event`：事件类型（见下）
  - `timestamp`：ISO8601 时间戳
  - `orchestrationId`：编排 ID
  - `seq`：整型，自增序号（按编排内单调递增）
  - `taskId`：可选；任务级事件时必须
  - `role`、`agentId`：可选；任务启动后可用
  - `data`：对象；事件特定字段

- 事件类型与最小字段：
  - `start`：`data.totalTasks`
  - `task_scheduled`：`data.dependencies`（string[]）
  - `task_started`：`data.role`
  - `tool_use`：`data.tool`，`data.argsSummary`
  - `task_completed`：`data.durationMs`，`data.outputsCount`
  - `task_failed`：`data.reason`（如 timeout/exception/conflict），`data.errorType`
  - `patch_applied`：`data.patchId`，`data.targetFiles`（string[]），`data.sequence`
  - `patch_failed`：`data.patchId`，`data.reason`，`data.errorType`
  - `concurrency_reduced`：`data.from`，`data.to`，`data.reason`
  - `concurrency_increased`：`data.from`，`data.to`，`data.reason`
  - `resource_exhausted`：`data.reason`（cpu/memory），`data.action`
  - `cancel_requested`：`data.reason`
  - `orchestration_completed`：`data.successRate`，`data.totalDurationMs`
  - `orchestration_failed`：`data.reason`

示例（逐行）：

```
{"event":"start","timestamp":"2025-10-02T10:00:00Z","orchestrationId":"orc_1","seq":1,"data":{"totalTasks":10}}
{"event":"task_started","timestamp":"2025-10-02T10:00:02Z","orchestrationId":"orc_1","taskId":"t2","role":"developer","seq":12,"data":{}}
{"event":"tool_use","timestamp":"2025-10-02T10:00:05Z","orchestrationId":"orc_1","taskId":"t2","role":"developer","seq":15,"data":{"tool":"apply_patch","argsSummary":"+12/-0 in src/x.ts"}}
{"event":"task_completed","timestamp":"2025-10-02T10:03:05Z","orchestrationId":"orc_1","taskId":"t2","role":"developer","seq":48,"data":{"durationMs":180000,"outputsCount":1}}
{"event":"concurrency_reduced","timestamp":"2025-10-02T10:10:00Z","orchestrationId":"orc_1","seq":49,"data":{"from":10,"to":9,"reason":"high_cpu"}}
{"event":"concurrency_increased","timestamp":"2025-10-02T10:20:00Z","orchestrationId":"orc_1","seq":50,"data":{"from":9,"to":10,"reason":"resources_recovered"}}
{"event":"patch_applied","timestamp":"2025-10-02T10:21:00Z","orchestrationId":"orc_1","taskId":"t3","role":"developer","seq":51,"data":{"patchId":"patch_12","targetFiles":["src/a.ts"],"sequence":12}}
{"event":"patch_failed","timestamp":"2025-10-02T10:22:00Z","orchestrationId":"orc_1","taskId":"t4","role":"developer","seq":52,"data":{"patchId":"patch_13","reason":"apply_conflict","errorType":"PATCH_CONFLICT"}}
{"event":"resource_exhausted","timestamp":"2025-10-02T10:30:00Z","orchestrationId":"orc_1","seq":53,"data":{"reason":"memory","action":"reject_new_tasks"}}
```

### C. JSONL 审计日志（对齐 NFR-004）

- 事件与 Stream-JSON 字段一致；存储路径建议：`.codex-father/sessions/<session>/events.jsonl`
- 额外建议字段：
  - `requestId`：跨组件关联 ID（可选）
  - `userAction`：人工介入动作摘要（如 confirm/cancel）（可选）
  - `patchId`：与补丁应用关联（写任务场景）（可选）
