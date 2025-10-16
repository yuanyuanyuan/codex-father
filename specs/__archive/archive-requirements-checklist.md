# Requirements Quality Checklist: Archived Specifications Portfolio

**Purpose**: 对 `specs/__archive` 中保留的历史特性文档进行需求质量复盘，确保范围、角色、验收、契约与治理信息在归档后仍然清晰、完整、一致且可追溯。
**Created**: 2025-10-08  
**Feature Set**: specs/__archive/*  
**Sources**: specs/__archive/**/{spec.md,plan.md,tasks.md,quickstart.md,research.md,data-model.md}, specs/__archive/**/contracts/*, specs/__archive/**/T*report*.md, specs/__archive/structured-instructions/examples/*

说明：条目聚焦“英文需求的单元测试”视角。若在归档资料中找不到明确答案，请标记为 Gap 并补充定位链接或结论。

## Requirement Completeness

- [ ] CHK001 各归档特性是否在冒头章节明确说明保留原因、目标范围与关键背景？[Completeness, Spec: 001-docs-readme-phases/spec.md §Feature Specification；Spec: 002-docs-prd-draft-wrong-direction/spec.md §Feature Specification；Spec: 005-docs-prd-draft/spec.md §Feature Specification；Spec: 008-ultrathink-codex-0/spec.md §Feature Specification；Spec: 003-codex-mcp-integration/spec.md §Feature Specification]
- [ ] CHK002 用户画像、主要角色与责任划分是否在归档文档中保持可追溯？[Completeness, Spec: 001-docs-readme-phases/spec.md §User Scenarios & Testing；Spec: 005-docs-prd-draft/spec.md §用户场景与测试；Spec: 008-ultrathink-codex-0/spec.md §User Scenarios & Testing；Spec: 003-codex-mcp-integration/spec.md §用户场景与测试]
- [ ] CHK003 每个归档特性的验收场景是否仍然完整枚举主路径与关键分支？[Completeness, Spec: 001-docs-readme-phases/spec.md §Acceptance Scenarios；Spec: 002-docs-prd-draft-wrong-direction/spec.md §Acceptance Scenarios；Spec: 005-docs-prd-draft/spec.md §验收场景；Spec: 008-ultrathink-codex-0/spec.md §Acceptance Scenarios]
- [ ] CHK004 分阶段或 MVP 交付物是否在归档版本中仍保留目标、里程碑与完成条件？[Completeness, Spec: 001-docs-readme-phases/spec.md §Project Directory Architecture·三阶段支持；Spec: 005-docs-prd-draft/spec.md §MVP 分阶段交付计划；Spec: 008-ultrathink-codex-0/spec.md §Execution Flow；Spec: 003-codex-mcp-integration/spec.md §实施计划概要]
- [ ] CHK005 Implementation Plan 文档是否继续给出 Phase 划分、进入/退出标准与宪章校验步骤？[Completeness, Plan: 001-docs-readme-phases/plan.md §Constitution Check；Plan: 002-docs-prd-draft-wrong-direction/plan.md §Constitution Check；Plan: 005-docs-prd-draft/plan.md §Constitution Check；Plan: 008-ultrathink-codex-0/plan.md §Constitution Check]
- [ ] CHK006 归档任务清单是否完整标注依赖、并/串行属性及验收标准，便于复活时重新排期？[Completeness, Tasks: 001-docs-readme-phases/tasks.md §任务分类与标记说明；Tasks: 005-docs-prd-draft/tasks.md §任务分类；Tasks: 008-ultrathink-codex-0/tasks.md §批次结构；Tasks: 002-docs-prd-draft-wrong-direction/tasks.md §任务依赖]
- [ ] CHK007 研究记录是否覆盖当时的关键决策、备选方案与后续验证事项？[Completeness, Research: 005-docs-prd-draft/research.md §研究目标；Research: 008-ultrathink-codex-0/research.md §决策摘要；Research: 001-docs-readme-phases/research.md §决策清单；Research: 002-docs-prd-draft-wrong-direction/research.md §研究目标]
- [ ] CHK008 契约/Schema 资产是否为所有外部接口留存权威定义与版本边界？[Completeness, Contracts: 001-docs-readme-phases/contracts/cli-interface.ts；Contracts: 002-docs-prd-draft-wrong-direction/contracts/*.yaml；Contracts: 005-docs-prd-draft/contracts/*.yaml；Contracts: 008-ultrathink-codex-0/contracts/*.schema.json]

## Requirement Clarity

- [ ] CHK009 归档规范是否量化关键阈值（如兼容版本、性能指标、覆盖率要求）并保留默认值？[Clarity, Spec: 008-ultrathink-codex-0/spec.md §Functional Requirements; Spec: 001-docs-readme-phases/spec.md §Functional Requirements; Spec: 005-docs-prd-draft/spec.md §需求；Plan: 008-ultrathink-codex-0/plan.md §Technical Context]
- [ ] CHK010 各文档是否明确描述环境假设（Node 版本、沙箱模式、依赖工具）并量化？[Clarity, Spec: 001-docs-readme-phases/spec.md §FR-006；Quickstart: 001-docs-readme-phases/quickstart.md §前置条件；Plan: 008-ultrathink-codex-0/plan.md §Technical Context；Spec: 005-docs-prd-draft/spec.md §容器与部署]
- [ ] CHK011 兼容性与降级策略是否在归档资料中给出可执行的判定条件？[Clarity, Spec: 008-ultrathink-codex-0/spec.md §FR-007；Spec: 005-docs-prd-draft/spec.md §并发模型澄清；Plan: 008-ultrathink-codex-0/plan.md §Summary]
- [ ] CHK012 MCP 与 Codex 接口行为是否用明确的请求/响应字段描述？[Clarity, Contracts: 008-ultrathink-codex-0/contracts/*.schema.json；Spec: 003-codex-mcp-integration/spec.md §功能需求；Spec: 005-docs-prd-draft/spec.md §MCP 协议支持]
- [ ] CHK013 CLI 选项、默认值与限制是否在文档间一致陈述并可追溯？[Clarity, Contracts: 001-docs-readme-phases/contracts/cli-interface.ts；Quickstart: 001-docs-readme-phases/quickstart.md §CLI 基础功能；Spec: 001-docs-readme-phases/spec.md §Functional Requirements；Spec: 005-docs-prd-draft/spec.md §审批策略与安全]
- [ ] CHK014 归档数据模型是否为主要实体提供字段语义、约束与状态机？[Clarity, Data Model: 001-docs-readme-phases/data-model.md §核心实体模型；Data Model: 002-docs-prd-draft-wrong-direction/data-model.md §Entity Definitions；Data Model: 005-docs-prd-draft/data-model.md §核心实体；Data Model: 008-ultrathink-codex-0/data-model.md §核心实体]

## Requirement Consistency

- [ ] CHK015 规范中引用的阶段/状态名称是否与 Quickstart、Plan、Tasks 文件保持一致？[Consistency, Spec: 001-docs-readme-phases/spec.md §三阶段支持；Quickstart: 001-docs-readme-phases/quickstart.md §阶段一/二/三验证；Plan: 001-docs-readme-phases/plan.md §Phase 0-3；Tasks: 001-docs-readme-phases/tasks.md §批次结构]
- [ ] CHK016 Codex/MCP 方法列表是否在 Spec、Contracts 与测试报告之间同步？[Consistency, Spec: 005-docs-prd-draft/spec.md §MCP 接口桥接策略；Contracts: 008-ultrathink-codex-0/contracts/*.schema.json；Tests: 008-ultrathink-codex-0/contracts/contracts-checklist.md；Spec: 003-codex-mcp-integration/spec.md §FR-001-003]
- [ ] CHK017 角色权限与脱敏策略是否在 Spec、Plan、Quickstart 之间无冲突表述？[Consistency, Spec: 001-docs-readme-phases/spec.md §FR-011；Plan: 005-docs-prd-draft/plan.md §Constitution Check·安全与可靠性；Quickstart: 005-docs-prd-draft/quickstart.md §安全性验证；Spec: 008-ultrathink-codex-0/spec.md §FR-006]
- [ ] CHK018 数据目录、日志命名等结构性约束是否在 Spec/Plan/Quickstart 中保持一致？[Consistency, Spec: 001-docs-readme-phases/spec.md §Job/Session 状态模型；Plan: 001-docs-readme-phases/plan.md §Project Structure；Quickstart: 001-docs-readme-phases/quickstart.md §任务队列系统验证；Spec: 005-docs-prd-draft/spec.md §日志管理]
- [ ] CHK019 报告与手册类文档的步骤编号、输出格式是否与契约或 Schema 对应？[Consistency, Quickstart: 005-docs-prd-draft/quickstart.md §验证流程；Manual: 005-docs-prd-draft/manual-acceptance-test-results.md §验证摘要；Contracts: 002-docs-prd-draft-wrong-direction/contracts/cli-commands.yaml；Schema: 008-ultrathink-codex-0/contracts/*.schema.json]

## Acceptance Criteria Quality

- [ ] CHK020 验收场景是否列出可度量的阈值、状态或输出以支撑复验？[Acceptance Criteria, Spec: 008-ultrathink-codex-0/spec.md §Acceptance Scenarios；Spec: 005-docs-prd-draft/spec.md §验收场景；Spec: 001-docs-readme-phases/spec.md §Acceptance Scenarios]
- [ ] CHK021 错误处理、权限不足等失败路径是否具备明确的外部表现与记录要求？[Acceptance Criteria, Spec: 005-docs-prd-draft/spec.md §错误处理；Spec: 008-ultrathink-codex-0/spec.md §FR-006；Spec: 001-docs-readme-phases/spec.md §Edge Cases]
- [ ] CHK022 降级/Fallback 策略是否附带触发条件与验收判定？[Acceptance Criteria, Spec: 008-ultrathink-codex-0/spec.md §FR-007；Spec: 005-docs-prd-draft/spec.md §容器与部署；Plan: 008-ultrathink-codex-0/plan.md §Summary]
- [ ] CHK023 手动操作/审批路径是否有输入格式、判定准绳和记录要求？[Acceptance Criteria, Spec: 001-docs-readme-phases/spec.md §FR-011；Spec: 005-docs-prd-draft/spec.md §审批机制；Quickstart: 005-docs-prd-draft/quickstart.md §安全性验证]

## Scenario Coverage

- [ ] CHK024 主路径（初始化→配置→执行→验证）是否在 Quickstart 与 Spec 间互相覆盖？[Coverage, Quickstart: 001-docs-readme-phases/quickstart.md 全文；Quickstart: 005-docs-prd-draft/quickstart.md §阶段流程；Spec: 001-docs-readme-phases/spec.md §User Scenarios；Spec: 005-docs-prd-draft/spec.md §MVP1/2 验收场景]
- [ ] CHK025 归档资料是否覆盖多角色协作/审核的互动场景？[Coverage, Spec: 002-docs-prd-draft-wrong-direction/spec.md §User Scenarios；Spec: 005-docs-prd-draft/spec.md §审批机制；Plan: 005-docs-prd-draft/plan.md §Phase 1；Manual: 005-docs-prd-draft/code-review-report.md]
- [ ] CHK026 是否覆盖 Codex 版本差异、接口缺失、参数不匹配等异常情境？[Coverage, Spec: 008-ultrathink-codex-0/spec.md §Edge Cases；Appendix: 008-ultrathink-codex-0/parameter-version-mapping.md；Spec: 005-docs-prd-draft/spec.md §并发模型澄清；Research: 008-ultrathink-codex-0/research.md §决策]
- [ ] CHK027 资源约束或外部依赖不可用场景是否在文档中覆盖？[Coverage, Spec: 001-docs-readme-phases/spec.md §Edge Cases；Spec: 005-docs-prd-draft/spec.md §资源限额；Plan: 001-docs-readme-phases/plan.md §Phase 3+；Research: 005-docs-prd-draft/research.md §性能优化]
- [ ] CHK028 Structured Instructions 示例是否保留特殊格式/自动化约束说明？[Coverage, Structured Instructions: README.md；Examples: t032.json/yaml/xml]

## Edge Case Coverage

- [ ] CHK029 归档特性是否记录非交互/容器/禁网模式下的限制与Fallback？[Edge Case, Spec: 001-docs-readme-phases/spec.md §Edge Cases；Spec: 005-docs-prd-draft/spec.md §边界情况；Quickstart: 005-docs-prd-draft/quickstart.md §容器环境验证]
- [ ] CHK030 任务队列或多会话冲突的处理策略是否明确？[Edge Case, Spec: 001-docs-readme-phases/spec.md §Edge Cases；Spec: 005-docs-prd-draft/spec.md §并发模型澄清；Tasks: 001-docs-readme-phases/tasks.md §队列统计]
- [ ] CHK031 配置缺失或格式错误时的恢复行为是否记录？[Edge Case, Spec: 001-docs-readme-phases/spec.md §FR-003；Quickstart: 001-docs-readme-phases/quickstart.md §配置管理验证；Spec: 008-ultrathink-codex-0/spec.md §FR-004]
- [ ] CHK032 MCP 调用异常（405/通信中断）是否给出诊断与恢复策略？[Edge Case, Spec: 008-ultrathink-codex-0/spec.md §附录 405 错误诊断；Spec: 005-docs-prd-draft/spec.md §MCP 接口桥接策略；Research: 008-ultrathink-codex-0/research.md §决策]
- [ ] CHK033 归档资料是否对权限/审批拒绝、人工介入失败等场景做出说明？[Edge Case, Spec: 005-docs-prd-draft/spec.md §审批机制；Spec: 002-docs-prd-draft-wrong-direction/spec.md §Functional Requirements；Manual: 005-docs-prd-draft/manual-acceptance-test-results.md]

## Non-Functional Requirements

- [ ] CHK034 性能指标（启动耗时、并发数量、内存限制）是否在文档中量化并给出处置策略？[NFR, Spec: 001-docs-readme-phases/spec.md §FR-004；Spec: 005-docs-prd-draft/spec.md §性能策略；Plan: 008-ultrathink-codex-0/plan.md §Technical Context；Spec: 008-ultrathink-codex-0/spec.md §Performance Targets]
- [ ] CHK035 安全策略（沙箱模式、审批默认值、脱敏规则）是否保留下来并与最新策略匹配？[NFR, Spec: 001-docs-readme-phases/spec.md §FR-011；Spec: 005-docs-prd-draft/spec.md §安全策略；Quickstart: 005-docs-prd-draft/quickstart.md §安全性验证]
- [ ] CHK036 观测指标（成功率、事件流、审计字段）是否有明确的度量口径？[NFR, Spec: 005-docs-prd-draft/spec.md §事件日志与运维；Spec: 008-ultrathink-codex-0/spec.md §FR-006；Spec: 001-docs-readme-phases/spec.md §Job/Session 状态模型；Tests: 008-ultrathink-codex-0/T058_acceptance_report.md]
- [ ] CHK037 部署与容器策略是否说明默认镜像、所需端口和回退机制？[NFR, Spec: 001-docs-readme-phases/spec.md §容器集成；Spec: 005-docs-prd-draft/spec.md §容器与部署；Quickstart: 005-docs-prd-draft/quickstart.md §容器环境验证]
- [ ] CHK038 归档资料是否明确网络/沙箱切换的风险与告警？[NFR, Spec: 001-docs-readme-phases/spec.md §FR-006；Spec: 005-docs-prd-draft/spec.md §资源限额；Research: 005-docs-prd-draft/research.md §进程管理策略]
- [ ] CHK039 运行模式默认值（禁网、workspace-write、danger 模式）是否在多个文档中一致陈述？[NFR, Spec: 001-docs-readme-phases/spec.md §FR-006；Quickstart: 001-docs-readme-phases/quickstart.md §安全性验证；Spec: 005-docs-prd-draft/spec.md §审批机制；Spec: 008-ultrathink-codex-0/spec.md §FR-006]
- [ ] CHK040 归档资料是否说明监控告警或指标上报的接口？[NFR, Spec: 005-docs-prd-draft/spec.md §事件日志与运维；Spec: 003-codex-mcp-integration/spec.md §观测与调试；Plan: 005-docs-prd-draft/plan.md §Phase 5]

## Roles & Governance

- [ ] CHK041 角色目录、权限边界与工具白名单是否可追溯？[Roles, Spec: 001-docs-readme-phases/spec.md §Key Entities；Spec: 005-docs-prd-draft/spec.md §角色扩展性；Plan: 005-docs-prd-draft/plan.md §Constitution Check·安全；Data Model: 001-docs-readme-phases/data-model.md §Redaction 规则模型]
- [ ] CHK042 审批流转、人工介入或升级路径是否有明确记录要求？[Roles, Spec: 005-docs-prd-draft/spec.md §审批机制；Manual: 005-docs-prd-draft/manual-acceptance-test-results.md §审核流程；Spec: 002-docs-prd-draft-wrong-direction/spec.md §Functional Requirements]
- [ ] CHK043 角色缺省配置（权限模式、工具集）是否在归档资料中保持同步？[Roles, Spec: 001-docs-readme-phases/spec.md §FR-011；Quickstart: 001-docs-readme-phases/quickstart.md §安全性验证；Plan: 005-docs-prd-draft/plan.md §Phase 1；Spec: 008-ultrathink-codex-0/spec.md §FR-006]
- [ ] CHK044 角色决策与审计记录是否要求明确的理由或追踪信息？[Roles, Spec: 005-docs-prd-draft/spec.md §日志管理；Spec: 008-ultrathink-codex-0/spec.md §FR-006；Manual: 005-docs-prd-draft/manual-acceptance-test-results.md]

## Observability & Logging

- [ ] CHK045 事件枚举、字段清单与 Schema 是否在归档资料中对齐？[Observability, Spec: 005-docs-prd-draft/spec.md §事件日志与审计；Contracts: 008-ultrathink-codex-0/contracts/codex-event.schema.json；Spec: 003-codex-mcp-integration/spec.md §事件日志采集]
- [ ] CHK046 JSONL/会话目录结构与命名是否保持权威描述？[Observability, Spec: 001-docs-readme-phases/spec.md §Job/Session 状态模型；Plan: 001-docs-readme-phases/plan.md §Project Structure；Spec: 008-ultrathink-codex-0/spec.md §FR-006]
- [ ] CHK047 敏感字段脱敏策略是否在 Spec/Plan/Quickstart 中一致？[Observability, Spec: 001-docs-readme-phases/spec.md §FR-011；Plan: 005-docs-prd-draft/plan.md §安全与可靠性；Quickstart: 005-docs-prd-draft/quickstart.md §安全性验证]
- [ ] CHK048 成功率、错误率等指标的计算口径是否在文档中定义？[Observability, Spec: 005-docs-prd-draft/spec.md §事件日志与审计；Spec: 008-ultrathink-codex-0/spec.md §FR-006；Manual: 005-docs-prd-draft/T037-TEST-REPORT.md]
- [ ] CHK049 运维事件（降并发、回退、重试）是否归档在既定日志或报告渠道？[Observability, Spec: 005-docs-prd-draft/spec.md §资源限额；Spec: 008-ultrathink-codex-0/spec.md §FR-007；Manual: 005-docs-prd-draft/manual-acceptance-test-results.md]
- [ ] CHK050 MCP/CLI 输出与事件流是否定义唯一的落盘格式与示例？[Observability, Spec: 003-codex-mcp-integration/spec.md §事件日志采集；Quickstart: 005-docs-prd-draft/quickstart.md §JSON 输出；Contracts: 008-ultrathink-codex-0/contracts/codex-event.schema.json]

## CLI Contracts & Interfaces

- [ ] CHK051 CLI 命令/选项/默认值是否在 Spec、Contracts、Quickstart 中保持一致？[Contracts, Spec: 001-docs-readme-phases/spec.md §FR-002；Contracts: 001-docs-readme-phases/contracts/cli-interface.ts；Quickstart: 001-docs-readme-phases/quickstart.md §CLI 基础功能]
- [ ] CHK052 退出码、成功/失败条件是否在归档资料中定义并与验收一致？[Contracts, Spec: 001-docs-readme-phases/spec.md §Acceptance Scenarios；Manual: 005-docs-prd-draft/manual-acceptance-test-results.md；Plan: 005-docs-prd-draft/plan.md §Constitution Check]
- [ ] CHK053 PRD/MCP 协议文档是否为接口结构提供 Schema 或类型定义？[Contracts, Contracts: 002-docs-prd-draft-wrong-direction/contracts/prd-api.yaml；Contracts: 005-docs-prd-draft/contracts/*.yaml；Contracts: 008-ultrathink-codex-0/contracts/*.schema.json]
- [ ] CHK054 配置文件（YAML/TOML）键位及默认值是否留存一份权威清单？[Contracts, Spec: 001-docs-readme-phases/spec.md §目录结构规范；Data Model: 001-docs-readme-phases/data-model.md §ConfigurationManagement；Spec: 008-ultrathink-codex-0/spec.md §FR-004]
- [ ] CHK055 STDOUT/日志输出角色是否在多文档之间一致（仅 orchestrator 输出等）？[Contracts, Spec: 001-docs-readme-phases/spec.md §FR-008；Quickstart: 001-docs-readme-phases/quickstart.md §任务队列系统验证；Manual: 005-docs-prd-draft/manual-acceptance-test-results.md]

## Resource Management & Timeout

- [ ] CHK056 单任务超时、重试与放弃策略是否保留可量化要求？[Resources, Spec: 005-docs-prd-draft/spec.md §超时与资源控制；Spec: 001-docs-readme-phases/spec.md §FR-004；Plan: 005-docs-prd-draft/plan.md §Phase 1]
- [ ] CHK057 资源紧张时的降并发/资源配额策略是否记录触发条件？[Resources, Spec: 005-docs-prd-draft/spec.md §资源限额；Spec: 001-docs-readme-phases/spec.md §FR-008；Plan: 005-docs-prd-draft/plan.md §Constitution Check]
- [ ] CHK058 排队、拒绝或暂停执行的条件与对外反馈是否明确？[Resources, Spec: 001-docs-readme-phases/spec.md §Edge Cases；Spec: 005-docs-prd-draft/spec.md §边界情况；Tasks: 001-docs-readme-phases/tasks.md §Task Queue Contract Tests]
- [ ] CHK059 并行执行、资源上限与任务批次之间的关系是否在 Tasks/Plan 中保持一致？[Resources, Tasks: 001-docs-readme-phases/tasks.md §批次结构；Plan: 005-docs-prd-draft/plan.md §Phase 1；Spec: 005-docs-prd-draft/spec.md §并发模型澄清]

## Cancel & Resume

- [ ] CHK060 取消流程的时序、状态变化与记录是否留存规范描述？[Cancel, Spec: 005-docs-prd-draft/spec.md §取消与恢复机制；Spec: 008-ultrathink-codex-0/spec.md §FR-006；Plan: 003-codex-mcp-integration/plan.md §Phase 2（若存在）]
- [ ] CHK061 写入窗口或补丁阶段取消时的补救策略是否记录？[Cancel, Spec: 005-docs-prd-draft/spec.md §MVP2 边界情况；Spec: 001-docs-readme-phases/spec.md §Edge Cases；Tasks: 005-docs-prd-draft/tasks.md §补丁流]
- [ ] CHK062 会话恢复/重放（resume/replay）要求是否在归档资料中保留？[Cancel/Resume, Spec: 005-docs-prd-draft/spec.md §会话恢复机制；Spec: 003-codex-mcp-integration/spec.md §会话生命周期管理；Spec: 008-ultrathink-codex-0/spec.md §FR-007]

## Data Model & IDs

- [ ] CHK063 作业/任务/会话等核心实体的标识、关系与约束是否在 Data Model 中完整描述？[Data Model, 001-docs-readme-phases/data-model.md §核心实体模型；005-docs-prd-draft/data-model.md §核心实体；008-ultrathink-codex-0/data-model.md §核心实体；002-docs-prd-draft-wrong-direction/data-model.md §Entity Definitions]
- [ ] CHK064 事件与实体之间的关联键（taskId、sessionId、conversationId）是否一致？[Data Model, Spec: 001-docs-readme-phases/spec.md §Key Entities；Spec: 005-docs-prd-draft/spec.md §事件日志；Contracts: 008-ultrathink-codex-0/contracts/codex-event.schema.json]
- [ ] CHK065 会话/任务目录结构与命名规范是否留存权威示例？[Data Model, Spec: 001-docs-readme-phases/spec.md §目录结构规范；Plan: 001-docs-readme-phases/plan.md §Project Structure；Spec: 008-ultrathink-codex-0/spec.md §附录 参数-版本映射]

## Dependencies & Assumptions

- [ ] CHK066 环境、工具或第三方依赖的前置条件是否在 Plan/Quickstart 中声明？[Assumptions, Quickstart: 001-docs-readme-phases/quickstart.md §前置条件；Plan: 008-ultrathink-codex-0/plan.md §Technical Context；Plan: 005-docs-prd-draft/plan.md §Technical Context]
- [ ] CHK067 归档资料是否列出默认禁用网络或危险模式的运行假设？[Assumptions, Spec: 001-docs-readme-phases/spec.md §FR-006；Spec: 005-docs-prd-draft/spec.md §安全策略；Quickstart: 005-docs-prd-draft/quickstart.md §安全性验证]
- [ ] CHK068 对 Codex 版本、MCP SDK 或 CLI 依赖的兼容性假设是否有记录？[Assumptions, Spec: 008-ultrathink-codex-0/spec.md §Functional Requirements；Plan: 008-ultrathink-codex-0/plan.md §Summary；Research: 008-ultrathink-codex-0/research.md §决策]

## Ambiguities & Conflicts

- [ ] CHK069 成功率、并发上限等术语是否避免语义重复或冲突？[Ambiguity, Spec: 005-docs-prd-draft/spec.md §并发模型澄清；Spec: 001-docs-readme-phases/spec.md §FR-004；Spec: 008-ultrathink-codex-0/spec.md §FR-001]
- [ ] CHK070 “阶段”“MVP”“模式”等术语是否在不同文档中语义一致？[Ambiguity, Spec: 001-docs-readme-phases/spec.md §三阶段支持；Spec: 005-docs-prd-draft/spec.md §MVP 分阶段；Plan: 005-docs-prd-draft/plan.md §Phase 0-2]
- [ ] CHK071 快速校验/测试术语是否给出具体指标或范围，避免产生歧义？[Ambiguity, Spec: 001-docs-readme-phases/spec.md §FR-004；Quickstart: 001-docs-readme-phases/quickstart.md §测试覆盖率验证；Manual: 005-docs-prd-draft/T037-TEST-REPORT.md]

## Traceability

- [ ] CHK072 FR/NFR 与验收场景、任务、契约之间是否建立映射或可追踪引用？[Traceability, Spec: 001-docs-readme-phases/spec.md §Review & Acceptance Checklist；Spec: 005-docs-prd-draft/spec.md §审查与验收清单；Tasks: 001-docs-readme-phases/tasks.md §任务分类；Contracts: 005-docs-prd-draft/contracts/*.yaml]
- [ ] CHK073 文档中是否一致引用 FR-### / NFR-### 或其他标识，支持交叉定位？[Traceability, Spec: 001-docs-readme-phases/spec.md §Functional Requirements；Spec: 005-docs-prd-draft/spec.md §功能需求；Spec: 008-ultrathink-codex-0/spec.md §Functional Requirements]
- [ ] CHK074 验收报告或测试结果是否回指具体需求条目及测量口径？[Traceability, Manual: 005-docs-prd-draft/manual-acceptance-test-results.md §验证摘要；Report: 008-ultrathink-codex-0/T058_acceptance_report.md；Spec: 002-docs-prd-draft-wrong-direction/spec.md §Acceptance Scenarios]

## Reporting & Summary

- [ ] CHK075 汇总报告是否定义必须呈现的指标（成功率、故障、建议）？[Reporting, Spec: 005-docs-prd-draft/spec.md §事件日志与审计；Report: 005-docs-prd-draft/T037-TEST-REPORT.md；Spec: 001-docs-readme-phases/spec.md §Review & Acceptance Checklist]
- [ ] CHK076 失败清单或整改建议是否在报告中呈现并附带责任归属？[Reporting, Report: 005-docs-prd-draft/T037-TEST-REPORT.md；Manual: 005-docs-prd-draft/manual-acceptance-test-results.md；Spec: 005-docs-prd-draft/spec.md §审查与验收清单]
- [ ] CHK077 日志查看/导出或审计访问路径是否在 Quickstart/Spec/Contracts 中一致？[Reporting, Quickstart: 005-docs-prd-draft/quickstart.md §任务队列系统验证；Spec: 001-docs-readme-phases/spec.md §Job/Session 状态模型；Contracts: 008-ultrathink-codex-0/contracts/codex-event.schema.json]

## Security & Privacy

- [ ] CHK078 权限模式、沙箱策略与升级规则是否在归档资料中明确？[Security, Spec: 001-docs-readme-phases/spec.md §FR-006/FR-011；Spec: 005-docs-prd-draft/spec.md §安全策略；Plan: 005-docs-prd-draft/plan.md §安全与可靠性]
- [ ] CHK079 敏感信息脱敏、日志留存策略是否仍具备可执行要求？[Security, Spec: 005-docs-prd-draft/spec.md §日志管理；Plan: 005-docs-prd-draft/plan.md §安全与可靠性；Quickstart: 005-docs-prd-draft/quickstart.md §安全性验证]
- [ ] CHK080 环境变量、密钥管理及访问边界是否在 Spec/Plan/Quickstart 中说明？[Security, Spec: 001-docs-readme-phases/spec.md §安全与合规；Plan: 001-docs-readme-phases/plan.md §Constitution Check；Plan: 008-ultrathink-codex-0/plan.md §Technical Context]

— 请在勾选每一条后补充实际定位链接或章节号，确保归档需求在复盘时具备可审计性。
