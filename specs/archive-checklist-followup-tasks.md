# Tasks: Archive Checklist Follow-up

**Context**: specs/archive-requirements-checklist.md, specs/archive-requirements-checklist-status.md  
**Last Updated**: 2025-10-08  
**Current Status**: 报告/日志导出、资源降级闭环与统一脱敏已完成；主路径与取消/恢复在推进中；T006 指标与报告摘要增强已完成（含 `--duration-format` 与 `--duration-precision` 及契约测试）；T007 诊断工具默认开启与端到端示例已落地，其余任务按计划推进

说明：以下任务从归档清单的未实现/部分实现项提炼，优先恢复仍需回流的核心能力、补齐观测与测试覆盖，并确保状态文件在演进过程中保持同步。

## 优先级与必要性澄清（结合 codex-father 用途与官方能力）

- 高优先｜必须实现（直接影响核心价值与互通）
  - T001 编排主路径：提交→分解→执行→写入→汇总；落地 orchestrate 的真实执行与事件流。理由：没有主路径，CLI/MCP 价值无法闭环（对齐 CHK024）。
  - T002 汇总报告与导出：成功率/失败清单/整改建议与导出接口。理由：支撑验收、审计与回归（CHK075–077）。
  - T005 脱敏与边界统一：事件写入统一脱敏、限制敏感环境变量落盘。理由：安全基线（CHK078–080）。
  - T007 MCP 工具矩阵与异常诊断：≥归档方法、405/通信降级。理由：与官方 JSON‑RPC/MCP 对齐的关键（CHK016、CHK032）。

- 中优先｜应当实现（增强可靠性与可观测性，主路径之后尽快补齐）
  - T003 资源监控降级/恢复闭环：记录 resource_downscale/resource_restore。理由：可观测与稳定性（CHK027、CHK049）。
  - T004 取消/恢复完善：写入窗口/补丁冲突/重放。理由：可控性与容错（CHK060–062）。
  - T006 指标聚合与追溯：成功率、平均时长、FR/NFR 回指。理由：报告可用性与追溯（CHK020、CHK036、CHK072–074）。

- 低优先｜可选（流程优化类，非功能必需）
  - T008 状态文件与清单自动同步：脚本/CI 提醒保持台账更新。理由：流程改进，非运行时能力。

不建议在代码中“实现”的文档质量类条目（保留在文档层即可）：
- CHK001–CHK008（背景/MVP/研究记录等）、CHK069–071（术语/歧义澄清）、CHK072–074（文档内回指矩阵）、CHK019（手册步骤编号一致性）、CHK028（Structured Instructions 示例耦合）、CHK037（容器镜像/端口默认，当前非优先）、CHK040（监控告警接口，后续可接入运维体系）。这些侧重文档工程，不属于运行时能力。

参考与依据（官方能力）：
- Codex JSON‑RPC/MCP 流程与通知示例：`refer-research/openai-codex/codex-rs/app-server/tests/suite/create_conversation.rs:1`
- 事件/Schema 契约资产（本仓与归档测试引用）：`tests/contract/codex-event.contract.test.ts:1`

## P0 — 恢复核心编排与报告能力

- **T001** `[P0|blocking | 必须实现 | 高]` 编排主路径落地（提交→分解→执行→写入→汇总）  
  - **Status**: 已完成 — 已打通 manual 任务文件 → orchestrate 执行 → 事件落盘 → report.json 汇总；Quickstart 与 Spec 主路径对照已补，并提供最小可复现样例与验收用例。  
  - **Scope**: 
    - 运行时：巩固 `core/orchestrator/process-orchestrator.ts:332` 起的执行波次与 `state-manager.ts` 事件流水；确保 `fallbackStats` 与 `successRateThreshold` 对齐。  
    - 文档：Quickstart 与 Spec 中给出“主路径 vs 手动分解准绳（评分/人工确认流程）”的一致说明，并提供最小可复现样例任务文件（`docs/user/quick-start.md`、`specs/orchestrate-main-path.spec.md`）。  
  - **Exit**: 
    - 功能：`orchestrate --mode manual --tasks-file <file> --output-format stream-json` 连通执行；`.codex-father/sessions/<id>/events.jsonl` 含 start/执行/完成/失败 事件；`.codex-father/sessions/<id>/report.json` 含成功率、失败清单与整改建议。  
    - 测试：`tests/acceptance/orchestrate-manual-path.contract.test.ts` 覆盖最小手工任务与成功/失败两分支；`tests/acceptance/quickstart-acceptance.test.ts` 保持一致。  
  - **Evidence**: 
    - `core/cli/commands/orchestrate-command.ts:332`（start 事件、run 统计与报告写入）  
    - `core/orchestrator/process-orchestrator.ts:900`（资源/失败/完成态的状态快照与统计汇总）  
  - **Links**: CHK024（已实现）；官方参照 `refer-research/.../create_conversation.rs:1`
- **T002** `[P0|blocking | 必须实现 | 高]` 汇总报告与日志导出链路  
  - **Status**: 已完成 — `codex-father logs <sessionId>` 支持导出/跟随 events.jsonl 至默认或自定义路径；`orchestrate:report` 提供报告摘要与事件日志定位；契约测试覆盖默认与 JSON 输出。（已在 `archive-requirements-checklist-status.md` 同步“已实现”）  
  - **Scope**: 保持 orchestrator 收尾成功率/失败详情/整改建议；通过 `report.json` + `logs` CLI 形成闭环；验证 `core/cli/tests/logs-export.command.test.ts`、`core/cli/tests/orchestrate-report.command.test.ts`。  
  - **Exit**: `core/cli` 输出与 JSONL 报告字段与归档契约一致。  
  - **Links**: CHK075–077、CHK036

## P1 — 强化降级/恢复与安全边界

- **T003** `[P1 | 应当实现 | 中]` 扩展资源监控与降级恢复闭环  
  - **Status**: 已完成 — `handleResourcePressure` 记录 `resource_downscale`/`resource_restore` 与 CPU 快照（兼容 `concurrency_*`）；`core/orchestrator/tests/resource-upscale.linkage.test.ts`、`core/orchestrator/tests/resource-timeout.integration.test.ts` 校验降级与恢复。  
  - **Scope**: 将 `resource-monitor` 快照联动到执行路径，降级/恢复事件完整落盘。  
  - **Exit**: 新枚举事件生效；`CHK027`、`CHK049` 标记为“已实现”。  
  - **Links**: CHK027、CHK049
- **T004** `[P1 | 应当实现 | 中]` 完整实现取消/恢复策略  
  - **Status**: 进行中 — 已具备取消事件序列与状态快照；并已补齐 SWW 写入链路能力：单写窗口、补丁冲突判定（目标文件在补丁创建后被修改即冲突）、中止丢弃队列与补丁重放（更新时间戳重试）。已将中止策略与 `ProcessOrchestrator.requestCancel()` 打通。  
  - **Scope**: 
    - 运行时：细化 `ProcessOrchestrator.requestCancel()` 与 SWW 的联动（中止未开始补丁，允许当前写窗口自然完成）；在恢复路径中补充会话重放与冲突检测（SWW 已提供 `requestAbort()/resetAbort()` 与冲突检测）。  
    - 接口：明确 `resumeSession` 所需 rollout/state 输入的优先级与校验。  
  - **Exit**: 
    - 测试：补充用例覆盖 冲突→失败→重放成功（`core/orchestrator/tests/sww-conflict.replay.test.ts:1`）；中止丢弃未处理补丁（`core/orchestrator/tests/sww-abort-pending.test.ts:1`）；取消→失败链路（`core/orchestrator/tests/cancel-handling.contract.test.ts:1`）与恢复（`core/orchestrator/tests/session-recovery.integration.test.ts:30`）；取消联动 SWW（`core/orchestrator/tests/cancel-sww.linkage.test.ts:1`）。  
    - 证据：`core/orchestrator/sww-coordinator.ts:100`（detectConflict）、`core/orchestrator/sww-coordinator.ts:154`（drain 中止）、`core/orchestrator/sww-coordinator.ts:232`（requestAbort/resetAbort）、`core/orchestrator/process-orchestrator.ts:586`（取消时调用 sww.requestAbort）、`core/orchestrator/process-orchestrator.ts:1048`（恢复时调用 sww.resetAbort）。新增用例：`sww-reset-abort.requeue.test.ts`、`cancel-then-resume.chain.integration.test.ts`、`sww-interleaved-replay.order.test.ts`、`sww-three-patch.chain-conflict-replay.test.ts`、`sww-cross-dir.order.test.ts`、`sww-heavy-cross-dir.order.test.ts`、`sww-mixed-cross-dir.same-basename.order.test.ts`。  
    - 备注：跨目录写窗口顺序保持与无跨目录冲突，均在上述 *cross-dir* 与 *mixed* 用例中得到验证。
  - **Links**: CHK060–062
- **T005** `[P1 → 上调至 P0 | 必须实现 | 高]` 统一脱敏与环境边界  
  - **Status**: 已完成 — `core/lib/security/redaction.ts` 提供统一脱敏；`EventLogger` 默认掩码敏感字段/环境快照；`StateManager` 落盘前复用同一 redactor；安全回归见 `core/session/tests/event-logger.test.ts`、`core/orchestrator/tests/redaction.security.test.ts`。  
  - **Scope**: 在 `EventLogger`、`StateManager` 启用并透传配置开关。  
- **T006** `[P1 | 应当实现 | 高]` 指标聚合与追溯（报告摘要增强）  
  - **Status**: 已完成 — 报告 `failureBreakdown` + `remediationByCategory`，摘要“失败分类/建议摘要（Top‑2）”与中文别名；新增 `--duration-format <auto|ms|s|m>` 与 `--duration-precision <0|1|2>`；契约测试覆盖范围/计数与格式化显示；文档补示例 JSON 与参数说明。  
  - **Scope**: `orchestrate:report` 摘要展示（时长友好化+精度开关、失败分类别名）、指标边界用例（零任务、失败路径含重试统计）、文档样例与字段说明。  
  - **Exit（完成）**: 指标字段范围正确（0≤rate≤1，总数一致）；摘要包含中文别名与建议摘要；`--duration-precision` 通过契约测试；文档含样例 JSON 与映射说明（见 `docs/user/orchestrate-report.md`）。  
  - **Links**: CHK020、CHK036、CHK072–074
  - **Evidence**: `core/cli/tests/orchestrate-report.command.test.ts`；`docs/user/orchestrate-report.md`。
 

- **T010** `[P1 | 应当实现 | 中]` Stream-JSON 文件化导出与工具链对接  
  - **Status**: 已完成（本批次）  
  - **Scope**: 新增 `--save-stream <path>` 将 `start`/`orchestration_completed` 两行 stream-json 同步落盘；在 `report.json` 中保留事件路径，便于 `logs`/`report` 联动展示。  
  - **Exit**: CHK050 转“已实现”，契约测试覆盖文件化输出。  
  - **Links**: CHK050、CHK077

- **T009** `[P1 | 应当实现 | 中]` CLI 退出码矩阵与 STDOUT 契约加固  
  - **Status**: 已完成（本批次）— orchestrate 在 `stream-json` 下仅两行事件（无额外摘要）；orchestrate:report 无参数=2/缺文件=3/JSON 解析失败=4；logs 缺会话或读取失败=1；新增契约测试覆盖无效 JSON/缺文件等路径。  
  - **Scope**: 维持退出码矩阵并补充文档示例。  
  - **Exit**: CHK052 转“已实现”，CHK055 转“部分实现”。  
  - **Links**: CHK052、CHK055、CHK050

  
- **T007** `[P2 → 上调至 P0 | 必须实现 | 高]` MCP 工具矩阵与异常诊断完善  
  - **Status**: 进行中 — 诊断只读工具默认开启（`enableDiagnosticTools=true`）；已提供 `read-report-file`/`read-events-preview`/`read-session-artifacts` 等≥15 只读工具，并附端到端示例（`docs/user/mcp-diagnostic-tools.md`、`scripts/rmcp-client.mjs`）；文档新增“Troubleshooting”一节；降级原因枚举扩展为 `method_not_allowed|invalid_arguments|timeout|server_error|communication_error` 并有契约测试（对应 CHK016/CHK032）。  
  - **Scope**: 在 `core/mcp/bridge-layer.ts` 扩充分发工具（≥归档 15 条），补 405/通信异常诊断与自动降级策略；完善契约测试。  
  - **Exit**: MCP 契约测试覆盖新增方法；故障输出可指向修复建议；`CHK016`、`CHK032` 标记为“已实现”。  
  - **Links**: CHK016、CHK032；官方参照 `refer-research/.../create_conversation.rs:1`
- **T008** `[P2 | 可选 | 低]` 状态文件与归档清单维护流程  
  - **Status**: 进行中 — 新增 `npm run checklist:sync` 输出 JSON 摘要（done/inProgress/todo 与条目列表）；`--strict`/`CHECKLIST_STRICT=1` 下打印软警告；当 `CHECKLIST_STRICT_LEVEL>=2` 且出现“任务已完成但关联 CHK 未标为已实现”时强失败（退出码 1）。  
  - **Scope**: 比对 `Links: CHKxxx` 与 `archive-requirements-checklist-status.md` 中 CHK 状态：
    - 任务“已完成”→ 关联 CHK 应为“已实现”；否则记为 mismatch。  
    - 任务“进行中/待启动”→ 关联 CHK 可为“部分实现/未实现”。  
  - **Exit**: 文档/代码更新后自动提示同步 status 文件；提供强失败开关用于 CI 收敛质量门。

---
必要但不在代码中“实现”的条目（维持文档层治理）
- `specs/archive-requirements-checklist.md`：保留为需求写作质量自检清单；不转换为代码能力。低优先，但发布前建议对关键 CHK 做人工复核。
- `specs/archive-requirements-checklist-status.md`：状态台账；低优先持续维护/CI 提醒即可，不纳入运行时代码实现范围。

---
执行以上任务后，请同步更新 `archive-requirements-checklist-status.md` 中对应项的实现状态与证据链接。

---
诊断备注（影响优先级/实现策略）
- STDOUT 契约现已通过 `core/cli/tests/orchestrate-exit.contract.test.ts:1` 在 `stream-json` 模式校验“两行输出”。需要在 `orchestrate:report` 与 `logs` 的所有失败路径保持一致性，并避免在 `outputFormat=stream-json` 时输出额外摘要。  
- 取消/恢复链路已有事件序列与状态快照，但写入窗口与补丁冲突仍缺回归用例。建议以“写入窗口 vs 子进程退出”与“补丁冲突重试”两个场景补齐。  
- MCP 工具矩阵建议先实现只读型工具以扩充覆盖（状态/日志/诊断），再引入变更类工具，并附带 405/降级策略契约测试。
