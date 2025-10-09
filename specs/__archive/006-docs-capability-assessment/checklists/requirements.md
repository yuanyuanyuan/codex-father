# Requirements Quality Checklist: Multi-Agent Parallel Task Orchestration (006)

**Purpose**: 从规范与设计文档角度验证本特性（多 Agent 并行编排）的需求质量（完整性、清晰性、一致性、可测性、覆盖度），而非验证实现行为。
**Created**: 2025-10-07  
**Feature**: specs/006-docs-capability-assessment/spec.md  
**Sources**: specs/006-docs-capability-assessment/{design.md,plan.md,tasks.md,quickstart.md}, specs/006-docs-capability-assessment/contracts/orchestrate.cli.md, docs/schemas/stream-json-event.schema.json

说明：以下条目均以“测试英文需求”的方式提出问题。若条目无法在文档中找到明确回答，请标记为 Gap 并回填链接或结论。

## Requirement Completeness

- [ ] CHK001 是否同时明确手动与 LLM 两种任务分解模式的输入、输出与失败处理？[Completeness, Spec §FR-002, §Edge Cases 1]
- [ ] CHK002 是否明确识别任务依赖与拓扑排序的要求与边界？[Completeness, Spec §FR-003, §FR-004]
- [ ] CHK003 是否明确并发上限（≤10）及其可配置性？[Completeness, Spec §FR-005]
- [ ] CHK004 是否完整定义角色集合与配置结构（工作指令、工具、权限范围）？[Completeness, Spec §FR-006–FR-009]
- [ ] CHK005 是否在分配前要求上下文完整性检查与“理解门控”（复述确认）？[Completeness, Spec §FR-010–FR-012]
- [ ] CHK006 是否定义结果汇总、失败清单与日志导出能力？[Completeness, Spec §FR-023–FR-025]
- [ ] CHK007 是否定义人工介入/升级路径及触发条件？[Completeness, Spec §FR-021–FR-022]
- [ ] CHK008 是否将 SWW 单写者窗口与快速校验纳入写策略的强制约束？[Completeness, Spec §Edge Case 6, §NFR-007]

## Requirement Clarity

- [ ] CHK009 成功判定阈值（成功率≥0.9）与单任务超时（默认30分钟）是否量化且可配置？[Clarity, Spec §Acceptance Scenarios 1]
- [ ] CHK010 “默认非交互运行”是否以具体标志量化（`--ask-for-approval never`、`workspace-write`）？[Clarity, Spec §NFR-001]
- [ ] CHK011 流式事件类型是否以枚举与 Schema 清单方式明确？[Clarity, Spec §NFR-003, Schema docs/schemas/stream-json-event.schema.json]
- [ ] CHK012 进度展示所含字段（状态、完成百分比、预计剩余时间）是否有明确口径与计算方式？[Clarity, Spec §Acceptance Scenarios 2, Gap]
- [ ] CHK013 资源不足时“自动降并发”的触发指标与下限（≥1）是否表述清晰？[Clarity, Spec §NFR-006]
- [ ] CHK014 优雅停止流程的时序（广播→等待≤60s→终止→汇总）是否清晰、可执行？[Clarity, Spec §NFR-005]

## Requirement Consistency

- [ ] CHK015 角色安全默认值（approval=never、sandbox=workspace-write）是否与 NFR 与 Quickstart/Contracts 一致？[Consistency, Spec §NFR-001–NFR-002, Quickstart, Contract §orchestrate.cli]
- [ ] CHK016 流式事件枚举在 Spec/Contracts/Schema/Quickstart 示例间是否一致？[Consistency, Spec §NFR-003, Contract, Schema, Quickstart]
- [ ] CHK017 SWW 与补丁顺序应用的描述在 Edge Case 与 NFR-007 间是否一致？[Consistency, Spec §Edge Case 6, §NFR-007]
- [ ] CHK018 成功/失败退出条件（成功率阈值与无 patch_failed）在各文档间是否一致？[Consistency, Contract §Exit Codes, Quickstart]
- [ ] CHK019 并发上限（10）与配置项范围在 Spec 与 Contracts/Quickstart 间是否一致？[Consistency, Spec §FR-005, Contract, Quickstart]

## Acceptance Criteria Quality

- [ ] CHK020 是否为关键场景提供可度量验收标准（阈值、时间、比例、可复核输出）？[Acceptance Criteria, Spec §Acceptance Scenarios]
- [ ] CHK021 失败路径（上下文不足、权限不足、依赖未就绪）是否有明确验收标准与对外表现？[Acceptance Criteria, Spec §FR-010–FR-012, §Acceptance Scenarios 3–4]
- [ ] CHK022 手动分解模式是否具有明确的输入格式与通过/拒绝判定标准？[Acceptance Criteria, Spec §FR-002, Gap]
- [ ] CHK023 并发/超时阈值变化是否定义了可测试的配置覆盖策略？[Acceptance Criteria, Spec §FR-005, §NFR-001, Gap]

## Scenario Coverage

- [ ] CHK024 是否覆盖主路径：提交→分解→分配→并行执行→写入→汇总？[Coverage, Spec §User Scenarios]
- [ ] CHK025 是否覆盖角色分配的规则优先/LLM 兜底/可选人工确认三类场景？[Coverage, Spec §FR-006–FR-009]
- [ ] CHK026 是否覆盖异常：工具缺失、权限不足、上下文不足、依赖未完成？[Coverage, Spec §Acceptance Scenarios 3–5]
- [ ] CHK027 是否覆盖恢复类：失败重试、降并发恢复、取消后的报告生成？[Coverage, Spec §NFR-005–NFR-006, Gap: Retry]
- [ ] CHK028 是否覆盖非功能域：输出格式、审计日志、红线脱敏、安全基线？[Coverage, Spec §NFR-001–NFR-004, Gap: Redaction]

## Edge Case Coverage

- [ ] CHK029 六类边界情况是否逐一有明确预期与对外表现？[Edge Case Coverage, Spec §Edge Cases 1–6]
- [ ] CHK030 对依赖输出未就绪的等待策略（等待/超时/跳过）是否明确？[Edge Case Coverage, Spec §Edge Case 5, Gap]
- [ ] CHK031 对写入冲突或补丁失败的记录与后续处理是否明确？[Edge Case Coverage, Spec §Edge Case 6, §NFR-007]
- [ ] CHK032 快速校验失败（工具缺失/命令失败）时对写入的阻断策略是否明确？[Edge Case Coverage, Spec §NFR-007]
- [ ] CHK033 资源极限（CPU/内存/IO）时的降级与拒绝新任务策略是否明确？[Edge Case Coverage, Spec §NFR-006]

## Non-Functional Requirements

- [ ] CHK034 运行模式默认值（非交互、禁网、workspace-write）是否明确且可覆盖？[NFR, Spec §NFR-001]
- [ ] CHK035 角色安全参数（allowedTools/permission-mode/sandbox）是否强制在会话中生效？[NFR, Spec §NFR-002]
- [ ] CHK036 输出格式规约（仅编排器直出 Stream-JSON；子进程 stdout 不直通）是否明确？[NFR, Spec §NFR-003]
- [ ] CHK037 审计 JSONL 的最小字段集与追加式写入是否明确？[NFR, Spec §NFR-004]
- [ ] CHK038 优雅停止流程是否定义边界（最长等待 60s）与状态可恢复性？[NFR, Spec §NFR-005]
- [ ] CHK039 资源降级的触发阈值/滞回是否定义（或显式声明留空）？[NFR, Spec §NFR-006, Gap]
- [ ] CHK040 SWW 写策略是否明确要求每次应用后进行快速校验/测试？[NFR, Spec §NFR-007]

## Roles & Permissions

- [ ] CHK041 角色清单与其工具/权限边界是否可配置且可审计？[Roles, Spec §FR-006–FR-009]
- [ ] CHK042 角色落地到子进程的权限隔离（sandbox/approval）是否被明确要求？[Roles, Spec §NFR-001–NFR-002]
- [ ] CHK043 LLM 兜底的默认策略与人工确认的默认值是否明确？[Roles, Spec §FR-008, Gap]
- [ ] CHK044 角色分配的可追溯依据（规则命中/LLM 理由）是否需要记录？[Roles, Gap]

## Observability & Logging

- [ ] CHK045 流式事件公共字段与事件枚举是否与 Schema/Contracts 一致？[Observability, Spec §NFR-003, Schema, Contract]
- [ ] CHK046 JSONL 存储路径结构与与会话 ID 命名是否明确？[Observability, Spec §NFR-004, Appendix §C]
- [ ] CHK047 是否要求对敏感字段进行脱敏/掩码并定义规则范围？[Observability, Gap]
- [ ] CHK048 成功率的计算口径（分母、四舍五入、小数位）是否明确？[Observability, Gap]
- [ ] CHK049 降并发/升并发等运营事件是否明确归类为“仅审计 JSONL”？[Observability, Gap]
- [ ] CHK050 `tool_use` 事件用于汇总子进程输出的结构是否定义？[Observability, Spec §NFR-003, Gap: fields]

## CLI Contracts & Interfaces

- [ ] CHK051 CLI 选项/默认值/范围是否完整、无冲突？[Contracts, specs/006-docs-capability-assessment/contracts/orchestrate.cli.md]
- [ ] CHK052 退出码与成功/失败条件是否定义清晰且与 Spec 一致？[Contracts, Contract §Exit Codes, Spec §Acceptance]
- [ ] CHK053 手动任务文件的 JSON 结构/Schema 是否定义？[Contracts, Gap]
- [ ] CHK054 配置 YAML 键位与默认值是否在文档中有权威列表？[Contracts, Quickstart, Gap]
- [ ] CHK055 STDOUT 规约（仅编排器发射）是否在多处文档中一致表达？[Contracts, Contract §STDOUT, Spec §NFR-003, Quickstart]

## Resource Management & Timeout

- [ ] CHK056 单任务超时的行为（终止/标记/上报）是否明确？[Resources, Spec §Edge Case 2]
- [ ] CHK057 资源不足触发降并发的监测指标（CPU/内存/IO）是否定义？[Resources, Spec §NFR-006, Gap]
- [ ] CHK058 降并发的下限（≥1）与恢复策略是否明确？[Resources, Spec §NFR-006]
- [ ] CHK059 排队/拒绝新任务的条件与对外反馈是否明确？[Resources, Spec §NFR-006]

## Cancel & Resume

- [ ] CHK060 取消流程各阶段的可观测输出与状态变更是否定义？[Cancel, Spec §NFR-005]
- [ ] CHK061 取消发生于写入窗口时的处理（回滚/放弃/跳过）是否定义？[Cancel, Spec §NFR-007, Gap]
- [ ] CHK062 会话恢复/重放（resume/replay）的需求是否在文档中定义？[Cancel/Resume, Gap]

## Data Model & IDs

- [ ] CHK063 Orchestration/Task/Role/Agent 等实体的标识、关系、约束是否完整？[Data Model, Spec §Key Entities]
- [ ] CHK064 事件与实体之间的关联键（taskId/orchestrationId/seq）是否统一？[Data Model, Spec §NFR-003–NFR-004]
- [ ] CHK065 会话目录结构（events.jsonl、workspaces、patches）是否在文档中明确？[Data Model, Appendix §C, Quickstart]

## Dependencies & Assumptions

- [ ] CHK066 编排器禁网、仅通过 Codex CLI 间接访问 LLM 的假设是否明确？[Assumptions, Spec §NFR-001]
- [ ] CHK067 对基础资源（磁盘、git 可用性）的先决条件是否声明？[Assumptions, Gap]
- [ ] CHK068 网络开启或跨环境运行的限制与注意是否明确？[Assumptions, Gap]

## Ambiguities & Conflicts

- [ ] CHK069 “成功率”的计算细则是否避免二义（分母、保留位数）？[Ambiguity, Gap]
- [ ] CHK070 “实时/预计剩余时间”的定义是否避免二义（采样窗口、估算算法）？[Ambiguity, Gap]
- [ ] CHK071 “快速校验/测试”的最小集合与失败分类是否避免二义？[Ambiguity, Spec §NFR-007, Gap]

## Traceability

- [ ] CHK072 是否存在 FR/NFR → 场景/契约/测试 的覆盖映射（矩阵/表）？[Traceability, Gap]
- [ ] CHK073 文档内是否一致引用 FR-### / NFR-### 标识以便交叉定位？[Traceability, Spec §FR/NFR]
- [ ] CHK074 验收场景是否回指具体 FR/NFR 条款并标注测量口径？[Traceability, Spec §Acceptance, Gap]

## Reporting & Summary

- [ ] CHK075 汇总报告的字段（成功率、失败清单、事件路径）是否明确？[Reporting, Spec §FR-023–FR-025]
- [ ] CHK076 失败清单是否要求附带整改建议与责任归属/原因分类？[Reporting, Spec §Acceptance Scenarios 1, Gap]
- [ ] CHK077 日志查看/导出的接口与格式是否与 Contracts/Quickstart 保持一致？[Reporting, Spec §FR-025, Quickstart, Contract]

## Security & Privacy

- [ ] CHK078 permission-mode/sandbox 的取值范围与行为是否在文档中定义？[Security, Spec §NFR-002, Gap]
- [ ] CHK079 对敏感信息（token/password/apiKey 等）的脱敏策略是否作为需求明确？[Security, Gap]
- [ ] CHK080 环境变量与文件访问边界（角色隔离）是否作为需求明确？[Security, Spec §NFR-002, Gap]

— 以上条目完成后，请在每项末尾补充“Spec/Design/Contract/Quickstart/Schema”中的定位链接或章节号，以便回溯与审计。

