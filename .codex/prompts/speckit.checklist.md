---
description:
  Generate a custom checklist for the current feature based on user
  requirements.
---

## Checklist Purpose: "Unit Tests for English"

**CRITICAL CONCEPT**: Checklists are **UNIT TESTS FOR REQUIREMENTS WRITING** -
they validate the quality, clarity, and completeness of requirements in a given
domain.

**NOT for verification/testing**:

- ❌ NOT "Verify the button clicks correctly"
- ❌ NOT "Test error handling works"
- ❌ NOT "Confirm the API returns 200"
- ❌ NOT checking if code/implementation matches the spec

**FOR requirements quality validation**:

- ✅ "Are visual hierarchy requirements defined for all card types?"
  (completeness)
- ✅ "Is 'prominent display' quantified with specific sizing/positioning?"
  (clarity)
- ✅ "Are hover state requirements consistent across all interactive elements?"
  (consistency)
- ✅ "Are accessibility requirements defined for keyboard navigation?"
  (coverage)
- ✅ "Does the spec define what happens when logo image fails to load?" (edge
  cases)

**Metaphor**: If your spec is code written in English, the checklist is its unit
test suite. You're testing whether the requirements are well-written, complete,
unambiguous, and ready for implementation - NOT whether the implementation
works.

## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Execution Steps

1. **Setup**: Run `.specify/scripts/bash/check-prerequisites.sh --json` from
   repo root and parse JSON for FEATURE_DIR and AVAILABLE_DOCS list.
   - All file paths must be absolute.

2. **Clarify intent (dynamic)**: Derive up to THREE initial contextual
   clarifying questions (no pre-baked catalog). They MUST:
   - Be generated from the user's phrasing + extracted signals from
     spec/plan/tasks
   - Only ask about information that materially changes checklist content
   - Be skipped individually if already unambiguous in `$ARGUMENTS`
   - Prefer precision over breadth

   Generation algorithm:
   1. Extract signals: feature domain keywords (e.g., auth, latency, UX, API),
      risk indicators ("critical", "must", "compliance"), stakeholder hints
      ("QA", "review", "security team"), and explicit deliverables ("a11y",
      "rollback", "contracts").
   2. Cluster signals into candidate focus areas (max 4) ranked by relevance.
   3. Identify probable audience & timing (author, reviewer, QA, release) if not
      explicit.
   4. Detect missing dimensions: scope breadth, depth/rigor, risk emphasis,
      exclusion boundaries, measurable acceptance criteria.
   5. Formulate questions chosen from these archetypes:
      - Scope refinement (e.g., "Should this include integration touchpoints
        with X and Y or stay limited to local module correctness?")
      - Risk prioritization (e.g., "Which of these potential risk areas should
        receive mandatory gating checks?")
      - Depth calibration (e.g., "Is this a lightweight pre-commit sanity list
        or a formal release gate?")
      - Audience framing (e.g., "Will this be used by the author only or peers
        during PR review?")
      - Boundary exclusion (e.g., "Should we explicitly exclude performance
        tuning items this round?")
      - Scenario class gap (e.g., "No recovery flows detected—are rollback /
        partial failure paths in scope?")

   Question formatting rules:
   - If presenting options, generate a compact table with columns: Option |
     Candidate | Why It Matters
   - Limit to A–E options maximum; omit table if a free-form answer is clearer
   - Never ask the user to restate what they already said
   - Avoid speculative categories (no hallucination). If uncertain, ask
     explicitly: "Confirm whether X belongs in scope."

   Defaults when interaction impossible:
   - Depth: Standard
   - Audience: Reviewer (PR) if code-related; Author otherwise
   - Focus: Top 2 relevance clusters

   Output the questions (label Q1/Q2/Q3). After answers: if ≥2 scenario classes
   (Alternate / Exception / Recovery / Non-Functional domain) remain unclear,
   you MAY ask up to TWO more targeted follow‑ups (Q4/Q5) with a one-line
   justification each (e.g., "Unresolved recovery path risk"). Do not exceed
   five total questions. Skip escalation if user explicitly declines more.

3. **Understand user request**: Combine `$ARGUMENTS` + clarifying answers:
   - Derive checklist theme (e.g., security, review, deploy, ux)
   - Consolidate explicit must-have items mentioned by user
   - Map focus selections to category scaffolding
   - Infer any missing context from spec/plan/tasks (do NOT hallucinate)

4. **Load feature context**: Read from FEATURE_DIR:
   - spec.md: Feature requirements and scope
   - plan.md (if exists): Technical details, dependencies
   - tasks.md (if exists): Implementation tasks

   **Context Loading Strategy**:
   - Load only necessary portions relevant to active focus areas (avoid
     full-file dumping)
   - Prefer summarizing long sections into concise scenario/requirement bullets
   - Use progressive disclosure: add follow-on retrieval only if gaps detected
   - If source docs are large, generate interim summary items instead of
     embedding raw text

5. **Generate checklist** - Create "Unit Tests for Requirements":
   - Create `FEATURE_DIR/checklists/` directory if it doesn't exist
   - Generate unique checklist filename:
     - Use short, descriptive name based on domain (e.g., `ux.md`, `api.md`,
       `security.md`)
     - Format: `[domain].md`
     - If file exists, append to existing file
   - Number items sequentially starting from CHK001
   - Each `/speckit.checklist` run creates a NEW file (never overwrites existing
     checklists)

   **CORE PRINCIPLE - Test the Requirements, Not the Implementation**: Every
   checklist item MUST evaluate the REQUIREMENTS THEMSELVES for:
   - **Completeness**: Are all necessary requirements present?
   - **Clarity**: Are requirements unambiguous and specific?
   - **Consistency**: Do requirements align with each other?
   - **Measurability**: Can requirements be objectively verified?
   - **Coverage**: Are all scenarios/edge cases addressed?

   **Category Structure** - Group items by requirement quality dimensions:
   - **Requirement Completeness** (Are all necessary requirements documented?)
   - **Requirement Clarity** (Are requirements specific and unambiguous?)
   - **Requirement Consistency** (Do requirements align without conflicts?)
   - **Acceptance Criteria Quality** (Are success criteria measurable?)
   - **Scenario Coverage** (Are all flows/cases addressed?)
   - **Edge Case Coverage** (Are boundary conditions defined?)
   - **Non-Functional Requirements** (Performance, Security, Accessibility,
     etc. - are they specified?)
   - **Dependencies & Assumptions** (Are they documented and validated?)
   - **Ambiguities & Conflicts** (What needs clarification?)

   **HOW TO WRITE CHECKLIST ITEMS - "Unit Tests for English"**:

   ❌ **WRONG** (Testing implementation):
   - "Verify landing page displays 3 episode cards"
   - "Test hover states work on desktop"
   - "Confirm logo click navigates home"

   ✅ **CORRECT** (Testing requirements quality):
   - "Are the exact number and layout of featured episodes specified?"
     [Completeness]
   - "Is 'prominent display' quantified with specific sizing/positioning?"
     [Clarity]
   - "Are hover state requirements consistent across all interactive elements?"
     [Consistency]
   - "Are keyboard navigation requirements defined for all interactive UI?"
     [Coverage]
   - "Is the fallback behavior specified when logo image fails to load?" [Edge
     Cases]
   - "Are loading states defined for asynchronous episode data?" [Completeness]
   - "Does the spec define visual hierarchy for competing UI elements?"
     [Clarity]

   **ITEM STRUCTURE**: Each item should follow this pattern:
   - Question format asking about requirement quality
   - Focus on what's WRITTEN (or not written) in the spec/plan
   - Include quality dimension in brackets
     [Completeness/Clarity/Consistency/etc.]
   - Reference spec section `[Spec §X.Y]` when checking existing requirements
   - Use `[Gap]` marker when checking for missing requirements

   **EXAMPLES BY QUALITY DIMENSION**:

   Completeness:
   - "Are error handling requirements defined for all API failure modes? [Gap]"
   - "Are accessibility requirements specified for all interactive elements?
     [Completeness]"
   - "Are mobile breakpoint requirements defined for responsive layouts? [Gap]"

   Clarity:
   - "Is 'fast loading' quantified with specific timing thresholds? [Clarity,
     Spec §NFR-2]"
   - "Are 'related episodes' selection criteria explicitly defined? [Clarity,
     Spec §FR-5]"
   - "Is 'prominent' defined with measurable visual properties? [Ambiguity, Spec
     §FR-4]"

   Consistency:
   - "Do navigation requirements align across all pages? [Consistency, Spec
     §FR-10]"
   - "Are card component requirements consistent between landing and detail
     pages? [Consistency]"

   Coverage:
   - "Are requirements defined for zero-state scenarios (no episodes)?
     [Coverage, Edge Case]"
   - "Are concurrent user interaction scenarios addressed? [Coverage, Gap]"
   - "Are requirements specified for partial data loading failures? [Coverage,
     Exception Flow]"

   Measurability:
   - "Are visual hierarchy requirements measurable/testable? [Acceptance
     Criteria, Spec §FR-1]"
   - "Can 'balanced visual weight' be objectively verified? [Measurability, Spec
     §FR-2]"

   **Scenario Classification & Coverage** (Requirements Quality Focus):
   - Check if requirements exist for: Primary, Alternate, Exception/Error,
     Recovery, Non-Functional scenarios
   - For each scenario class, ask: "Are [scenario type] requirements complete,
     clear, and consistent?"
   - If scenario class missing: "Are [scenario type] requirements intentionally
     excluded or missing? [Gap]"
   - Include resilience/rollback when state mutation occurs: "Are rollback
     requirements defined for migration failures? [Gap]"

   **Traceability Requirements**:
   - MINIMUM: ≥80% of items MUST include at least one traceability reference
   - Each item should reference: spec section `[Spec §X.Y]`, or use markers:
     `[Gap]`, `[Ambiguity]`, `[Conflict]`, `[Assumption]`
   - If no ID system exists: "Is a requirement & acceptance criteria ID scheme
     established? [Traceability]"

   **Surface & Resolve Issues** (Requirements Quality Problems): Ask questions
   about the requirements themselves:
   - Ambiguities: "Is the term 'fast' quantified with specific metrics?
     [Ambiguity, Spec §NFR-1]"
   - Conflicts: "Do navigation requirements conflict between §FR-10 and §FR-10a?
     [Conflict]"
   - Assumptions: "Is the assumption of 'always available podcast API'
     validated? [Assumption]"
   - Dependencies: "Are external podcast API requirements documented?
     [Dependency, Gap]"
   - Missing definitions: "Is 'visual hierarchy' defined with measurable
     criteria? [Gap]"

   **Content Consolidation**:
   - Soft cap: If raw candidate items > 40, prioritize by risk/impact
   - Merge near-duplicates checking the same requirement aspect
   - If >5 low-impact edge cases, create one item: "Are edge cases X, Y, Z
     addressed in requirements? [Coverage]"

   **🚫 ABSOLUTELY PROHIBITED** - These make it an implementation test, not a
   requirements test:
   - ❌ Any item starting with "Verify", "Test", "Confirm", "Check" +
     implementation behavior
   - ❌ References to code execution, user actions, system behavior
   - ❌ "Displays correctly", "works properly", "functions as expected"
   - ❌ "Click", "navigate", "render", "load", "execute"
   - ❌ Test cases, test plans, QA procedures
   - ❌ Implementation details (frameworks, APIs, algorithms)

   **✅ REQUIRED PATTERNS** - These test requirements quality:
   - ✅ "Are [requirement type] defined/specified/documented for [scenario]?"
   - ✅ "Is [vague term] quantified/clarified with specific criteria?"
   - ✅ "Are requirements consistent between [section A] and [section B]?"
   - ✅ "Can [requirement] be objectively measured/verified?"
   - ✅ "Are [edge cases/scenarios] addressed in requirements?"
   - ✅ "Does the spec define [missing aspect]?"

6. **Structure Reference**: Generate the checklist following the canonical
   template in `.specify/templates/checklist-template.md` for title, meta
   section, category headings, and ID formatting. If template is unavailable,
   use: H1 title, purpose/created meta lines, `##` category sections containing
   `- [ ] CHK### <requirement item>` lines with globally incrementing IDs
   starting at CHK001.

7. **Report**: Output full path to created checklist, item count, and remind
   user that each run creates a new file. Summarize:
   - Focus areas selected
   - Depth level
   - Actor/timing
   - Any explicit user-specified must-have items incorporated

**Important**: Each `/speckit.checklist` command invocation creates a checklist
file using short, descriptive names unless file already exists. This allows:

- Multiple checklists of different types (e.g., `ux.md`, `test.md`,
  `security.md`)
- Simple, memorable filenames that indicate checklist purpose
- Easy identification and navigation in the `checklists/` folder

To avoid clutter, use descriptive types and clean up obsolete checklists when
done.

## Example Checklist Types & Sample Items

**UX Requirements Quality:** `ux.md`

Sample items (testing the requirements, NOT the implementation):

- "Are visual hierarchy requirements defined with measurable criteria? [Clarity,
  Spec §FR-1]"
- "Is the number and positioning of UI elements explicitly specified?
  [Completeness, Spec §FR-1]"
- "Are interaction state requirements (hover, focus, active) consistently
  defined? [Consistency]"
- "Are accessibility requirements specified for all interactive elements?
  [Coverage, Gap]"
- "Is fallback behavior defined when images fail to load? [Edge Case, Gap]"
- "Can 'prominent display' be objectively measured? [Measurability, Spec §FR-4]"

**API Requirements Quality:** `api.md`

Sample items:

- "Are error response formats specified for all failure scenarios?
  [Completeness]"
- "Are rate limiting requirements quantified with specific thresholds?
  [Clarity]"
- "Are authentication requirements consistent across all endpoints?
  [Consistency]"
- "Are retry/timeout requirements defined for external dependencies? [Coverage,
  Gap]"
- "Is versioning strategy documented in requirements? [Gap]"

**Performance Requirements Quality:** `performance.md`

Sample items:

- "Are performance requirements quantified with specific metrics? [Clarity]"
- "Are performance targets defined for all critical user journeys? [Coverage]"
- "Are performance requirements under different load conditions specified?
  [Completeness]"
- "Can performance requirements be objectively measured? [Measurability]"
- "Are degradation requirements defined for high-load scenarios? [Edge Case,
  Gap]"

**Security Requirements Quality:** `security.md`

Sample items:

- "Are authentication requirements specified for all protected resources?
  [Coverage]"
- "Are data protection requirements defined for sensitive information?
  [Completeness]"
- "Is the threat model documented and requirements aligned to it?
  [Traceability]"
- "Are security requirements consistent with compliance obligations?
  [Consistency]"
- "Are security failure/breach response requirements defined? [Gap, Exception
  Flow]"

## Anti-Examples: What NOT To Do

**❌ WRONG - These test implementation, not requirements:**

```markdown
- [ ] CHK001 - Verify landing page displays 3 episode cards [Spec §FR-001]
- [ ] CHK002 - Test hover states work correctly on desktop [Spec §FR-003]
- [ ] CHK003 - Confirm logo click navigates to home page [Spec §FR-010]
- [ ] CHK004 - Check that related episodes section shows 3-5 items [Spec
      §FR-005]
```

**✅ CORRECT - These test requirements quality:**

```markdown
- [ ] CHK001 - Are the number and layout of featured episodes explicitly
      specified? [Completeness, Spec §FR-001]
- [ ] CHK002 - Are hover state requirements consistently defined for all
      interactive elements? [Consistency, Spec §FR-003]
- [ ] CHK003 - Are navigation requirements clear for all clickable brand
      elements? [Clarity, Spec §FR-010]
- [ ] CHK004 - Is the selection criteria for related episodes documented? [Gap,
      Spec §FR-005]
- [ ] CHK005 - Are loading state requirements defined for asynchronous episode
      data? [Gap]
- [ ] CHK006 - Can "visual hierarchy" requirements be objectively measured?
      [Measurability, Spec §FR-001]
```

**Key Differences:**

- Wrong: Tests if the system works correctly
- Correct: Tests if the requirements are written correctly
- Wrong: Verification of behavior
- Correct: Validation of requirement quality
- Wrong: "Does it do X?"
- Correct: "Is X clearly specified?"

---

# Requirements Quality Checklist: Multi-Agent Parallel Task Orchestration (006)

**Purpose**: 从规范与设计文档角度验证本特性（多 Agent 并行编排）的需求质量（完整性、清晰性、一致性、可测性、覆盖度），而非验证实现行为。
**Created**: 2025-10-07  
**Feature**: specs/006-docs-capability-assessment/spec.md  
**Sources**: specs/006-docs-capability-assessment/{design.md,plan.md,tasks.md,quickstart.md},
specs/006-docs-capability-assessment/contracts/orchestrate.cli.md,
docs/schemas/stream-json-event.schema.json

说明：以下条目均以“测试英文需求”的方式提出问题。若条目无法在文档中找到明确回答，请标记为 Gap 并回填链接或结论。

## Requirement Completeness

- [ ] CHK001 是否同时明确手动与 LLM 两种任务分解模式的输入、输出与失败处理？[Completeness,
      Spec §FR-002, §Edge Cases 1]
- [ ] CHK002 是否明确识别任务依赖与拓扑排序的要求与边界？[Completeness, Spec
      §FR-003, §FR-004]
- [ ] CHK003 是否明确并发上限（≤10）及其可配置性？[Completeness, Spec §FR-005]
- [ ] CHK004 是否完整定义角色集合与配置结构（工作指令、工具、权限范围）？[Completeness,
      Spec §FR-006–FR-009]
- [ ] CHK005 是否在分配前要求上下文完整性检查与“理解门控”（复述确认）？[Completeness,
      Spec §FR-010–FR-012]
- [ ] CHK006 是否定义结果汇总、失败清单与日志导出能力？[Completeness, Spec
      §FR-023–FR-025]
- [ ] CHK007 是否定义人工介入/升级路径及触发条件？[Completeness, Spec
      §FR-021–FR-022]
- [ ] CHK008 是否将 SWW 单写者窗口与快速校验纳入写策略的强制约束？[Completeness,
      Spec §Edge Case 6, §NFR-007]

## Requirement Clarity

- [ ] CHK009 成功判定阈值（成功率≥0.9）与单任务超时（默认30分钟）是否量化且可配置？[Clarity,
      Spec §Acceptance Scenarios 1]
- [ ] CHK010
      “默认非交互运行”是否以具体标志量化（`--ask-for-approval never`、`workspace-write`）？[Clarity,
      Spec §NFR-001]
- [ ] CHK011 流式事件类型是否以枚举与 Schema 清单方式明确？[Clarity, Spec
      §NFR-003, Schema docs/schemas/stream-json-event.schema.json]
- [ ] CHK012 进度展示所含字段（状态、完成百分比、预计剩余时间）是否有明确口径与计算方式？[Clarity,
      Spec §Acceptance Scenarios 2, Gap]
- [ ] CHK013 资源不足时“自动降并发”的触发指标与下限（≥1）是否表述清晰？[Clarity,
      Spec §NFR-006]
- [ ] CHK014 优雅停止流程的时序（广播→等待≤60s→终止→汇总）是否清晰、可执行？[Clarity,
      Spec §NFR-005]

## Requirement Consistency

- [ ] CHK015 角色安全默认值（approval=never、sandbox=workspace-write）是否与 NFR 与 Quickstart/Contracts 一致？[Consistency,
      Spec §NFR-001–NFR-002, Quickstart, Contract §orchestrate.cli]
- [ ] CHK016 流式事件枚举在 Spec/Contracts/Schema/Quickstart 示例间是否一致？[Consistency,
      Spec §NFR-003, Contract, Schema, Quickstart]
- [ ] CHK017 SWW 与补丁顺序应用的描述在 Edge
      Case 与 NFR-007 间是否一致？[Consistency, Spec §Edge Case 6, §NFR-007]
- [ ] CHK018 成功/失败退出条件（成功率阈值与无 patch_failed）在各文档间是否一致？[Consistency,
      Contract §Exit Codes, Quickstart]
- [ ] CHK019 并发上限（10）与配置项范围在 Spec 与 Contracts/Quickstart 间是否一致？[Consistency,
      Spec §FR-005, Contract, Quickstart]

## Acceptance Criteria Quality

- [ ] CHK020 是否为关键场景提供可度量验收标准（阈值、时间、比例、可复核输出）？[Acceptance
      Criteria, Spec §Acceptance Scenarios]
- [ ] CHK021 失败路径（上下文不足、权限不足、依赖未就绪）是否有明确验收标准与对外表现？[Acceptance
      Criteria, Spec §FR-010–FR-012, §Acceptance Scenarios 3–4]
- [ ] CHK022 手动分解模式是否具有明确的输入格式与通过/拒绝判定标准？[Acceptance
      Criteria, Spec §FR-002, Gap]
- [ ] CHK023 并发/超时阈值变化是否定义了可测试的配置覆盖策略？[Acceptance
      Criteria, Spec §FR-005, §NFR-001, Gap]

## Scenario Coverage

- [ ] CHK024 是否覆盖主路径：提交→分解→分配→并行执行→写入→汇总？[Coverage, Spec
      §User Scenarios]
- [ ] CHK025 是否覆盖角色分配的规则优先/LLM 兜底/可选人工确认三类场景？[Coverage,
      Spec §FR-006–FR-009]
- [ ] CHK026 是否覆盖异常：工具缺失、权限不足、上下文不足、依赖未完成？[Coverage,
      Spec §Acceptance Scenarios 3–5]
- [ ] CHK027 是否覆盖恢复类：失败重试、降并发恢复、取消后的报告生成？[Coverage,
      Spec §NFR-005–NFR-006, Gap: Retry]
- [ ] CHK028 是否覆盖非功能域：输出格式、审计日志、红线脱敏、安全基线？[Coverage,
      Spec §NFR-001–NFR-004, Gap: Redaction]

## Edge Case Coverage

- [ ] CHK029 六类边界情况是否逐一有明确预期与对外表现？[Edge Case Coverage, Spec
      §Edge Cases 1–6]
- [ ] CHK030 对依赖输出未就绪的等待策略（等待/超时/跳过）是否明确？[Edge Case
      Coverage, Spec §Edge Case 5, Gap]
- [ ] CHK031 对写入冲突或补丁失败的记录与后续处理是否明确？[Edge Case Coverage,
      Spec §Edge Case 6, §NFR-007]
- [ ] CHK032 快速校验失败（工具缺失/命令失败）时对写入的阻断策略是否明确？[Edge
      Case Coverage, Spec §NFR-007]
- [ ] CHK033 资源极限（CPU/内存/IO）时的降级与拒绝新任务策略是否明确？[Edge Case
      Coverage, Spec §NFR-006]

## Non-Functional Requirements

- [ ] CHK034 运行模式默认值（非交互、禁网、workspace-write）是否明确且可覆盖？[NFR,
      Spec §NFR-001]
- [ ] CHK035 角色安全参数（allowedTools/permission-mode/sandbox）是否强制在会话中生效？[NFR,
      Spec §NFR-002]
- [ ] CHK036 输出格式规约（仅编排器直出 Stream-JSON；子进程 stdout 不直通）是否明确？[NFR,
      Spec §NFR-003]
- [ ] CHK037 审计 JSONL 的最小字段集与追加式写入是否明确？[NFR, Spec §NFR-004]
- [ ] CHK038 优雅停止流程是否定义边界（最长等待 60s）与状态可恢复性？[NFR, Spec
      §NFR-005]
- [ ] CHK039 资源降级的触发阈值/滞回是否定义（或显式声明留空）？[NFR, Spec
      §NFR-006, Gap]
- [ ] CHK040 SWW 写策略是否明确要求每次应用后进行快速校验/测试？[NFR, Spec
      §NFR-007]

## Roles & Permissions

- [ ] CHK041 角色清单与其工具/权限边界是否可配置且可审计？[Roles, Spec
      §FR-006–FR-009]
- [ ] CHK042 角色落地到子进程的权限隔离（sandbox/approval）是否被明确要求？[Roles,
      Spec §NFR-001–NFR-002]
- [ ] CHK043 LLM 兜底的默认策略与人工确认的默认值是否明确？[Roles, Spec §FR-008,
      Gap]
- [ ] CHK044 角色分配的可追溯依据（规则命中/LLM 理由）是否需要记录？[Roles, Gap]

## Observability & Logging

- [ ] CHK045 流式事件公共字段与事件枚举是否与 Schema/Contracts 一致？[Observability,
      Spec §NFR-003, Schema, Contract]
- [ ] CHK046 JSONL 存储路径结构与与会话 ID 命名是否明确？[Observability, Spec
      §NFR-004, Appendix §C]
- [ ] CHK047 是否要求对敏感字段进行脱敏/掩码并定义规则范围？[Observability, Gap]
- [ ] CHK048 成功率的计算口径（分母、四舍五入、小数位）是否明确？[Observability,
      Gap]
- [ ] CHK049 降并发/升并发等运营事件是否明确归类为“仅审计 JSONL”？[Observability,
      Gap]
- [ ] CHK050 `tool_use` 事件用于汇总子进程输出的结构是否定义？[Observability,
      Spec §NFR-003, Gap: fields]

## CLI Contracts & Interfaces

- [ ] CHK051 CLI 选项/默认值/范围是否完整、无冲突？[Contracts,
      specs/006-docs-capability-assessment/contracts/orchestrate.cli.md]
- [ ] CHK052 退出码与成功/失败条件是否定义清晰且与 Spec 一致？[Contracts,
      Contract §Exit Codes, Spec §Acceptance]
- [ ] CHK053 手动任务文件的 JSON 结构/Schema 是否定义？[Contracts, Gap]
- [ ] CHK054 配置 YAML 键位与默认值是否在文档中有权威列表？[Contracts,
      Quickstart, Gap]
- [ ] CHK055 STDOUT 规约（仅编排器发射）是否在多处文档中一致表达？[Contracts,
      Contract §STDOUT, Spec §NFR-003, Quickstart]

## Resource Management & Timeout

- [ ] CHK056 单任务超时的行为（终止/标记/上报）是否明确？[Resources, Spec §Edge
      Case 2]
- [ ] CHK057 资源不足触发降并发的监测指标（CPU/内存/IO）是否定义？[Resources,
      Spec §NFR-006, Gap]
- [ ] CHK058 降并发的下限（≥1）与恢复策略是否明确？[Resources, Spec §NFR-006]
- [ ] CHK059 排队/拒绝新任务的条件与对外反馈是否明确？[Resources, Spec §NFR-006]

## Cancel & Resume

- [ ] CHK060 取消流程各阶段的可观测输出与状态变更是否定义？[Cancel, Spec
      §NFR-005]
- [ ] CHK061 取消发生于写入窗口时的处理（回滚/放弃/跳过）是否定义？[Cancel, Spec
      §NFR-007, Gap]
- [ ] CHK062 会话恢复/重放（resume/replay）的需求是否在文档中定义？[Cancel/Resume,
      Gap]

## Data Model & IDs

- [ ] CHK063
      Orchestration/Task/Role/Agent 等实体的标识、关系、约束是否完整？[Data
      Model, Spec §Key Entities]
- [ ] CHK064 事件与实体之间的关联键（taskId/orchestrationId/seq）是否统一？[Data
      Model, Spec §NFR-003–NFR-004]
- [ ] CHK065 会话目录结构（events.jsonl、workspaces、patches）是否在文档中明确？[Data
      Model, Appendix §C, Quickstart]

## Dependencies & Assumptions

- [ ] CHK066 编排器禁网、仅通过 Codex
      CLI 间接访问 LLM 的假设是否明确？[Assumptions, Spec §NFR-001]
- [ ] CHK067 对基础资源（磁盘、git 可用性）的先决条件是否声明？[Assumptions,
      Gap]
- [ ] CHK068 网络开启或跨环境运行的限制与注意是否明确？[Assumptions, Gap]

## Ambiguities & Conflicts

- [ ] CHK069 “成功率”的计算细则是否避免二义（分母、保留位数）？[Ambiguity, Gap]
- [ ] CHK070
      “实时/预计剩余时间”的定义是否避免二义（采样窗口、估算算法）？[Ambiguity,
      Gap]
- [ ] CHK071 “快速校验/测试”的最小集合与失败分类是否避免二义？[Ambiguity, Spec
      §NFR-007, Gap]

## Traceability

- [ ] CHK072 是否存在 FR/NFR
      → 场景/契约/测试 的覆盖映射（矩阵/表）？[Traceability, Gap]
- [ ] CHK073 文档内是否一致引用 FR-### /
      NFR-### 标识以便交叉定位？[Traceability, Spec §FR/NFR]
- [ ] CHK074 验收场景是否回指具体 FR/NFR 条款并标注测量口径？[Traceability, Spec
      §Acceptance, Gap]

## Reporting & Summary

- [ ] CHK075 汇总报告的字段（成功率、失败清单、事件路径）是否明确？[Reporting,
      Spec §FR-023–FR-025]
- [ ] CHK076 失败清单是否要求附带整改建议与责任归属/原因分类？[Reporting, Spec
      §Acceptance Scenarios 1, Gap]
- [ ] CHK077 日志查看/导出的接口与格式是否与 Contracts/Quickstart 保持一致？[Reporting,
      Spec §FR-025, Quickstart, Contract]

## Security & Privacy

- [ ] CHK078
      permission-mode/sandbox 的取值范围与行为是否在文档中定义？[Security, Spec
      §NFR-002, Gap]
- [ ] CHK079 对敏感信息（token/password/apiKey 等）的脱敏策略是否作为需求明确？[Security,
      Gap]
- [ ] CHK080 环境变量与文件访问边界（角色隔离）是否作为需求明确？[Security, Spec
      §NFR-002, Gap]

— 以上条目完成后，请在每项末尾补充“Spec/Design/Contract/Quickstart/Schema”中的定位链接或章节号，以便回溯与审计。
