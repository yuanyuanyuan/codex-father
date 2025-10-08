# Requirements Quality Checklist Verification: Archived Specifications Portfolio

> 说明：遍历了仓库的运行时代码与测试（核心位置：`core/**`, `src/**`, `lib/**`, `tests/**`），逐项核对 `archive-requirements-checklist.md` 中的 80 条需求。每条结论均基于实际源码/测试结果，而非仅依赖归档文档。

## Requirement Completeness

- CHK001 未实现 — 检查 `core/cli/start.ts`、`core/session/**` 等模块后，没有任何机制记录归档特性的保留原因或背景，该信息仅存在于 `specs/__archive/**/spec.md`。
- CHK002 未实现 — `core/orchestrator/types.ts` 与 `core/orchestrator/role-assigner.ts` 仅提供运行时角色配置，未包含归档文档中描述的 Persona/责任追溯模型。
- CHK003 未实现 — `tests/acceptance/**` 与 `core/orchestrator/process-orchestrator.ts` 只覆盖现行 CLI 占位流程，未枚举归档验收场景的主/支线路径。
- CHK004 未实现 — 虽然 `core/cli/start.ts` 输出当前 Phase，但代码没有保留下归档阶段目标或完成条件的映射。
- CHK005 未实现 — `core/cli/config-loader.ts`、`core/cli/scripts.ts` 中不存在宪章校验或 Phase gate 逻辑；归档计划中的步骤未在代码中实现。
- CHK006 未实现 — `core/orchestrator/process-orchestrator.ts` 未读取 `specs/__archive/**/tasks.md`，也没有将任务依赖/并串行标记转化为运行时代码。
- CHK007 未实现 — 核查 `core/research`（不存在）与 `src/**` 后确认没有模块加载归档 `research.md` 的决策或校验条目。
- CHK008 已实现 — `tests/contract/codex-event.contract.test.ts`、`core/mcp/event-mapper.ts` 等使用归档 Schema 验证事件格式，契约资产仍被代码引用。

## Requirement Clarity

- CHK009 已实现 — `core/orchestrator/types.ts` 与 `core/cli/commands/orchestrate-command.ts` 对并发上限、成功率、超时等阈值进行校验与默认值约束。
- CHK010 已实现 — `core/cli/config-loader.ts`、`core/session/session-manager.ts` 对 Node 版本、沙箱模式、审批策略等环境假设提供默认值与校验。
- CHK011 已实现 — `src/lib/versionDetector.ts`、`src/lib/degradationStrategy.ts` 和 `src/lib/parameterMapping.ts` 实现 Codex 版本检测与参数降级策略。
- CHK012 已实现 — `core/mcp/codex-client.ts`、`core/mcp/bridge-layer.ts` 与 `core/mcp/tests/**` 定义并校验 MCP/Codex 请求响应字段。
- CHK013 已实现 — `core/cli/parser.ts`、`core/cli/commands/orchestrate-command.ts` 与 `core/cli/tests/**` 定义 CLI 选项、默认值与取值范围。
- CHK014 已实现 — `core/orchestrator/types.ts`、`core/lib/types.ts` 与对应测试覆盖核心实体字段语义、约束和状态机。

## Requirement Consistency

- CHK015 未实现 — `core/cli/start.ts` 的阶段文案与 `tests/acceptance` 的流程提示并未与归档 Quickstart/Plan 的阶段编号做一致性校验。
 - CHK016 已实现 — MCP 工具矩阵已扩展至 15+（只读诊断为主）：`list-tools`、`ping-bridge`、`echo`、`exists`、`stat-path`、`list-dir`、`resolve-path`、`list-sessions`、`get-latest-session`、`read-session-artifacts`、`read-report-file`、`read-report-metrics`、`read-events-preview`、`grep-events`、`call-with-downgrade` 等；测试覆盖：`core/mcp/tests/diagnostic-tools.test.ts`；文档：`docs/user/mcp-diagnostic-tools.md`。
- CHK017 已实现 — `core/orchestrator/types.ts` 的角色默认值、`core/orchestrator/tests/sandbox-approvals.defaults.test.ts`、`core/cli/config-loader.ts` 共同确保权限与脱敏策略一致。
- CHK018 已实现 — `core/session/event-logger.ts`、`core/session/config-persister.ts` 与 `core/orchestrator/state-manager.ts` 固定 `.codex-father/sessions/<id>/events.jsonl` 等目录/文件命名。
- CHK019 未实现 — 现有 CLI 输出（`core/cli/commands/status-command.ts` 等）与归档报告/手册并无步骤编号或格式对照逻辑。

## Acceptance Criteria Quality

- CHK020 已实现 — `core/orchestrator/process-orchestrator.ts` 聚合成功率与平均指标（`avgTaskDurationMs`、`avgAttempts`、`totalExecutionMs`、`avgRetryDelayMs`、`totalRetries`、`failureRate`）；`core/cli/commands/orchestrate-command.ts` 输出至 `report.json.metrics` 并在摘要中展示“指标”；FR/NFR 回指与失败分类/建议亦在摘要中呈现。测试：`core/cli/tests/orchestrate-report.command.test.ts`；文档：`docs/user/orchestrate-report.md`。
- CHK021 未实现 — `core/orchestrator/process-orchestrator.ts:203` 等的失败路径仅抛错或返回 `orchestration_failed`，未覆盖归档要求的“上下文不足/权限不足/依赖未就绪”外显提示。
- CHK022 部分实现 — `core/cli/commands/orchestrate-command.ts` 的 manual 模式接受结构化任务文件并交给 `TaskDecomposer.validate` 校验依赖；但归档提到的完整手动分解准绳（评分标准、人工确认流程）仍未覆盖。
- CHK023 未实现 — `core/orchestrator/process-orchestrator.ts:120` 初始化后仅读取 `maxConcurrency`/`taskTimeoutMs`，缺少运行时阈值覆写；测试 `core/orchestrator/tests/resource-timeout.integration.test.ts:9` 仍仅模拟固定参数，无配置变更验证。

## Scenario Coverage

- CHK024 已实现 — CLI 可加载 manual 任务文件驱动 `ProcessOrchestrator.orchestrate()` 主路径执行（生成事件与报告）；Quickstart 与 Spec 已提供主路径对照与最小示例；验收用例：`tests/acceptance/orchestrate-manual-path.contract.test.ts`。
- CHK025 未实现 — 角色分配流程 (`core/orchestrator/role-assigner.ts`) 仅提供基础规则/兜底逻辑，未覆盖人工确认场景。
- CHK026 部分实现 — `src/lib/versionDetector.ts` 与 `src/lib/degradationStrategy.ts` 处理 Codex 版本差异，但工具缺失/参数不匹配的完整异常链路尚未覆盖。
- CHK027 已实现 — `core/orchestrator/process-orchestrator.ts` 的 `handleResourcePressure` 在资源压力下触发 `resource_downscale`（兼容 `concurrency_reduced`）并记录 CPU 快照；`core/orchestrator/tests/resource-upscale.linkage.test.ts`、`core/orchestrator/tests/resource-timeout.integration.test.ts` 确认降级与恢复链路。
- CHK028 未实现 — 代码未消费 `specs/__archive/structured-instructions/examples/*` 中的自动化约束示例。

## Edge Case Coverage

- CHK029 未实现 — `core/cli/config-loader.ts` & `core/orchestrator/process-orchestrator.ts` 仅支持 workspace-write 默认，没有实现归档所述容器/禁网回退策略。
- CHK030 未实现 — `core/orchestrator/state-manager.ts` 与 `core/orchestrator/process-orchestrator.ts` 尚无任务冲突/多会话锁的处置逻辑。
- CHK031 未实现 — `core/cli/config-loader.ts` 校验配置格式，仍缺少失败时的自动恢复/修复流程。
- CHK032 已实现 — 提供 `call-with-downgrade` 工具用于 405/未知方法与通信异常的降级诊断：返回 `{ degraded: true, reason: method_not_allowed|invalid_arguments|timeout|server_error|communication_error, result: <fallback|null>, error? }`；测试：`core/mcp/tests/diagnostic-tools.test.ts`；文档：`docs/user/mcp-diagnostic-tools.md`（示例与故障排查）。
- CHK033 未实现 — 权限拒绝或人工审批失败仅抛出错误，`core/orchestrator/process-orchestrator.ts` 未提供归档中描述的详细记录/提示。

## Non-Functional Requirements

- CHK034 部分实现 — `core/cli/start.ts` 输出内存/时间指标，`tests/benchmark/performance.bench.ts` 有占位，但覆盖范围和阈值比归档要求少。
- CHK035 已实现 — `core/cli/config-loader.ts` 的安全段落、`core/orchestrator/tests/sandbox-approvals.defaults.test.ts`、`core/session/tests/config-persister.test.ts` 强制审批策略与沙箱默认值。
- CHK036 已实现 — 报告除 `metrics.totalExecutionMs/avgTaskDurationMs/avgAttempts` 外，补充 `avgRetryDelayMs/totalRetries/failureRate`；增加 `references`（FR/NFR），并在 `report.json` 中输出 `failureBreakdown` 与 `remediationByCategory`；`orchestrate:report` 摘要展示“指标/引用/失败分类/建议摘要”。证据：
  - 代码：`core/cli/commands/orchestrate-command.ts`
  - 文档：`docs/user/orchestrate-report.md`
  - 测试：`core/cli/tests/orchestrate-report.command.test.ts`
- CHK037 未实现 — `core/process/manager.ts` 与 `core/orchestrator/process-orchestrator.ts` 未定义默认容器镜像/端口或本地回退流程。
- CHK038 未实现 — Sandbox/网络切换仅在 `core/cli/config-loader.ts` 做静态校验，没有实时风险告警实现。
- CHK039 已实现 — `core/orchestrator/types.ts` 默认 sandbox=workspace-write、`core/orchestrator/tests/sandbox-approvals.defaults.test.ts`、`core/cli/config-loader.ts` 一致约束运行模式默认值。
- CHK040 未实现 — 未找到监控上报/告警接口实现（检索 `core/**`、`src/**` 未见相关模块）。

## Roles & Governance

- CHK041 已实现 — `core/orchestrator/types.ts` 中 `RolesConfigurationSchema`、`core/orchestrator/tests/role-assigner.test.ts`、`core/orchestrator/process-orchestrator.ts` 保留角色与工具白名单。
- CHK042 未实现 — 审批流转记录未在 `core/session/session-manager.ts` 或事件日志中落地，缺少人工介入记录要求。
- CHK043 已实现 — 角色缺省配置由 `core/orchestrator/types.ts` 提供，并在 `core/orchestrator/tests/sandbox-approvals.defaults.test.ts`、`core/orchestrator/tests/permissions-enforcement.test.ts` 覆盖。
- CHK044 未实现 — `core/session/event-logger.ts` 只记录通用事件，无角色决策理由或审计轨迹。

## Observability & Logging

- CHK045 已实现 — `core/mcp/event-mapper.ts`、`core/lib/types.ts` 与 `tests/integration/eventHandler.test.ts` 使用归档 Schema 保持事件枚举一致。
- CHK046 已实现 — `core/session/event-logger.ts`、`core/orchestrator/state-manager.ts` 固化 `.codex-father/sessions/<id>/events.jsonl` 结构。
- CHK047 部分实现 — `core/cli/commands/orchestrate-command.ts` 默认注入脱敏正则，但 `core/session/event-logger.ts` 未对所有事件执行字段级脱敏。
- CHK048 未实现 — 代码未定义成功率/失败率等指标的正式计算口径（现有值为占位常量）。
- CHK049 已实现 — Stream JSON schema (`docs/schemas/stream-json-event.schema.json`) 新增 `resource_downscale`/`resource_restore` 枚举，`StateManager` 事件流包含资源降级/恢复记录，可用于运维可观测。
- CHK050 已实现 — 事件统一写入 JSONL（`core/session/event-logger.ts`）；CLI `orchestrate` 的 stdout 采用两行 `stream-json`（`start`/`orchestration_completed`），并通过 `--save-stream <path>` 支持将两行 `stream-json` 同步落盘；见 `core/cli/commands/orchestrate-command.ts:664` 与测试 `core/cli/tests/orchestrate-exit.contract.test.ts:120`。

## CLI Contracts & Interfaces

- CHK051 已实现 — `core/cli/parser.ts` 注册命令选项，`core/cli/commands/**/*.ts` 与 `core/cli/tests/**` 验证默认值与范围。
- CHK052 已实现 — `core/cli/commands/orchestrate-command.ts` 已覆盖多类退出码（配置失败=2、任务准备失败=5、执行异常=3、成功=0、成功率未达标=1、恢复失败=4），测试 `core/cli/tests/orchestrate-exit.contract.test.ts:1` 验证两行 `stream-json`、缺文件/无效 JSON/失败/恢复的退出码；`orchestrate:report` 无参数时返回 2，缺文件=3，JSON 解析失败=4（见 `core/cli/tests/orchestrate-report.command.test.ts:1`）。
- CHK053 已实现 — MCP 与 PRD 契约 Schema 位于 `specs/__archive/**/contracts`，由 `tests/contract/**` 与 `core/mcp` 运行时代码消费。
- CHK054 未实现 — 虽有 `core/cli/config-loader.ts`，但仓库缺少 YAML/TOML 键位权威清单与自动同步逻辑。
- CHK055 已实现 — 在 `orchestrate` `outputFormat=stream-json` 时 CLI 严格仅输出两行事件（`start`/`orchestration_completed`），失败路径同样遵循；已由契约测试覆盖成功/失败分支与保存流至文件的场景。证据：
  - 代码：`core/cli/commands/orchestrate-command.ts`
  - 测试：`tests/acceptance/orchestrate-manual-path.contract.test.ts`、`core/cli/tests/orchestrate-report.command.test.ts`

## Resource Management & Timeout

- CHK056 部分实现 — `core/orchestrator/process-orchestrator.ts` 接受 `taskTimeout`，但缺少超时后终止/上报的完整流程。
- CHK057 已实现 — `core/orchestrator/resource-monitor.ts`、`core/orchestrator/tests/resource-monitor.test.ts` 定义 CPU/内存阈值与降级条件。
- CHK058 未实现 — 代码中未找到排队/拒绝新任务的反馈实现；降并发下限控制也未落地。
- CHK059 部分实现 — `core/orchestrator/process-orchestrator.ts:368` 基于 `currentPoolSize` 将同一波任务分批执行，并在 `handleResourcePressure` 中动态缩放 `currentPoolSize` 与并发事件（`resource_downscale`/`resource_restore`）；但未提供正式的上限联动策略与覆盖性测试。

## Cancel & Resume

- CHK060 部分实现 — `core/orchestrator/process-orchestrator.ts:561` 的 `requestCancel` 触发 `cancel_requested`/`orchestration_failed` 事件并写入 `state.json`，`core/session/session-manager.ts` 更新快照；但写入窗口补救、阶段观测仍缺失。
- CHK061 已实现 — SWW 写入链路具备单写窗口与中止丢弃队列（`core/orchestrator/sww-coordinator.ts:154`，`requestAbort/resetAbort`），支持补丁冲突判定与重放（`detectConflict`，见 `core/orchestrator/tests/sww-conflict.replay.test.ts:1`）；且已与 `ProcessOrchestrator.requestCancel()` 联动（见 `core/orchestrator/tests/cancel-sww.linkage.test.ts:1`）。
- CHK062 部分实现 — `core/cli/commands/orchestrate-command.ts:240`/`:249` 支持 `--resume`，`core/orchestrator/process-orchestrator.ts:964` 触发 `codex exec resume`，`core/session/config-persister.ts` 记录 rollout；但缺少归档规定的重放与审计日志。

## Data Model & IDs

- CHK063 已实现 — `core/orchestrator/types.ts`、`core/lib/types.ts` 定义任务/会话/补丁等实体及约束，并有测试覆盖。
- CHK064 部分实现 — 虽然 `core/lib/types.ts` 统一 `taskId/orchestrationId` 格式，但事件流 (`core/session/event-logger.ts`) 仍允许任意字符串。
- CHK065 已实现 — `core/session/config-persister.ts`、`core/orchestrator/state-manager.ts` 创建 `.codex-father/sessions/<id>` 目录结构，与归档示例一致。

## Dependencies & Assumptions

- CHK066 已实现 — `core/cli/config-loader.ts` 校验环境依赖（Node 版本、Codex CLI）、`tests/acceptance/quickstart-acceptance.test.ts` 也覆盖前置条件。
- CHK067 已实现 — 运行模式默认禁网/approve=never 在 `core/orchestrator/types.ts` 与 `core/orchestrator/tests/sandbox-approvals.defaults.test.ts` 中固化。
- CHK068 已实现 — `src/lib/versionDetector.ts` 和 `src/lib/parameterMapping.ts` 明确 Codex 0.42/0.44 兼容性假设。

## Ambiguities & Conflicts

- CHK069 部分实现 — `core/orchestrator/types.ts` 定义成功率/并发上限，但 `core/cli/commands/orchestrate-command.ts` 仍使用硬编码 0.92，占位阈值存在语义风险。
- CHK070 未实现 — 阶段/MVP/模式的语义未在代码中统一（`core/cli/start.ts` 文案与 orchestrator 状态不关联）。
- CHK071 未实现 — “快速校验/测试” 逻辑未在 `core/orchestrator/process-orchestrator.ts` 或 `core/orchestrator/state-manager.ts` 中实现，缺乏范围定义。

## Traceability

- CHK072 已实现 — 在 `report.json` 中提供 `referencesByTask`（任务→FR/NFR）与 `referencesCoverage`（FR/NFR→任务），形成可审计的自动化双向映射；`orchestrate:report` JSON 输出包含该结构；MCP 诊断工具 `read-report-metrics` 可直接读取。测试：`core/cli/tests/orchestrate-report.command.test.ts` 断言存在与覆盖数量；文档：`docs/user/orchestrate-report.md`。
- CHK073 已实现 — `core/cli/commands/orchestrate-command.ts` 中 `extractReferences()` 解析 FR-###/NFR-### 并写入 `report.json.references`，`orchestrate:report` 与 MCP 诊断工具可读取；测试：`core/cli/tests/orchestrate-report.command.test.ts` 断言 FR/NFR 存在。
- CHK074 已实现 — CLI 摘要输出“引用: FR-..；NFR-..”，并在 JSON 模式下返回 `data.report.references`；文档：`docs/user/orchestrate-report.md`（示例）。

## Reporting & Summary

- CHK075 已实现 — `core/cli/commands/orchestrate-command.ts:417` 生成 `report.json` 并在 `core/cli/commands/orchestrate-command.ts:445` 写入成功率、失败清单、阈值等字段；`core/cli/tests/orchestrate-report.command.test.ts:28` 验证报告输出与 CLI 命令读取。
- CHK076 已实现 — `core/cli/commands/orchestrate-command.ts:409` 根据失败任务生成整改建议（remediationSuggestions），测试 `core/cli/tests/orchestrate-report.command.test.ts:57` 确认摘要中包含失败任务定位信息。
- CHK077 已实现 — `core/cli/commands/logs-command.ts` 提供按会话导出/跟随日志的 CLI，`core/cli/tests/logs-export.command.test.ts:1` 覆盖默认与 JSON 输出；`core/cli/commands/orchestrate-command.ts` 在报告摘要中补充事件日志路径。

## Security & Privacy

- CHK078 已实现 — `core/orchestrator/role-assigner.ts`、`core/orchestrator/tests/sandbox-approvals.defaults.test.ts`、`core/cli/config-loader.ts` 固定权限模式与沙箱策略。
- CHK079 已实现 — `core/lib/security/redaction.ts` 统一脱敏逻辑，`core/session/event-logger.ts` 默认应用敏感字段/环境快照掩码，`core/orchestrator/state-manager.ts` 在事件落盘前复用同一 redactor；相关安全回归见 `core/session/tests/event-logger.test.ts` 与 `core/orchestrator/tests/redaction.security.test.ts`。
- CHK080 已实现 — `core/orchestrator/state-manager.ts` 与 `core/lib/security/redaction.ts` 对环境快照/变量数组执行 `[REDACTED]` 处理，`core/cli/commands/orchestrate-command.ts` 默认启用脱敏并透传配置，避免敏感环境变量落盘。
