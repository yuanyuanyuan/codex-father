# Tasks: Archive Checklist Follow-up

**Context**: specs/archive-requirements-checklist.md, specs/archive-requirements-checklist-status.md  
**Last Updated**: 2025-10-08  
**Current Status**: 报告/日志导出链路已完成，其余任务待排期

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
  - **Status**: 进行中（已支持 manual 任务文件→调度→事件写入）  
  - **Scope**: 扩展 `core/orchestrator/process-orchestrator.ts`、`core/orchestrator/state-manager.ts`，支持真实任务队列、角色派发、SWW 写入与事件流水。  
  - **Exit**: CLI `orchestrate` 命令可处理非空任务集，事件 JSONL 覆盖开始、执行、完成、失败四类节点，`tests/acceptance` 补充正向用例。  
  - **Links**: CHK024；官方参照 `refer-research/.../create_conversation.rs:1`
- **T002** `[P0|blocking | 必须实现 | 高]` 汇总报告与日志导出链路  
  - **Status**: 已完成 — 新增 `codex-father logs <sessionId>` 导出会话日志至 `.codex-father/logs/`（支持自定义路径），`orchestrate:report` 摘要补充事件日志定位，并新增契约测试覆盖默认导出/JSON 模式。（对应 CHK075/CHK076/CHK077，已在 `specs/archive-requirements-checklist-status.md` 同步标记为“已实现”）  
  - **Scope**: 保持 orchestrator 收尾的成功率统计、失败任务详情、整改建议，并通过 `report.json` 与日志导出 CLI 形成闭环；持续验证 `core/cli/tests/logs-export.command.test.ts`、`core/cli/tests/orchestrate-report.command.test.ts`。  
  - **Exit**: `core/cli` 输出与 JSONL 报告字段与归档契约一致，状态文件对应条目标记为“已实现”。  
  - **Links**: CHK075–077、CHK036

## P1 — 强化降级/恢复与安全边界

- **T003** `[P1 | 应当实现 | 中]` 扩展资源监控与降级恢复闭环  
  - **Status**: 已完成 — `handleResourcePressure` 现同步记录 `resource_downscale`/`resource_restore` 事件（保留兼容的 `concurrency_*`），并写入 CPU 使用快照；`core/orchestrator/tests/resource-upscale.linkage.test.ts`、`core/orchestrator/tests/resource-timeout.integration.test.ts` 校验降级与恢复流程。  
  - **Scope**: 连接 `core/orchestrator/resource-monitor.ts` 返回值到 orchestrator 执行路径，记录降级事件并在资源恢复后生成恢复日志。  
  - **Exit**: 事件日志新增 `resource_downscale`/`resource_restore` 枚举，`CHK027`、`CHK049` 可转为“已实现”。  
  - **Links**: CHK027、CHK049
- **T004** `[P1 | 应当实现 | 中]` 完整实现取消/恢复策略  
  - **Status**: 进行中 — `ProcessOrchestrator` 现更新状态快照并将取消信息写入 `state.json`，取消事件与 `cancelled` 状态可追溯；后续需补充写入窗口/补丁冲突处理。  
  - **Scope**: 细化 `core/session/session-manager.ts`、`ProcessOrchestrator` cancel/resume 行为，覆盖写入窗口、补丁冲突与会话重放。  
  - **Exit**: 新增集成测试覆盖取消→补救→恢复流程，日志包含阶段性状态变更。  
  - **Links**: CHK060–062
- **T005** `[P1 → 上调至 P0 | 必须实现 | 高]` 统一脱敏与环境边界  
  - **Status**: 已完成 — 引入 `core/lib/security/redaction.ts` 统一脱敏管线，`EventLogger` 默认启用敏感字段/环境快照屏蔽，`StateManager` 在事件落盘前复用同一 redactor；新增 `core/session/tests/event-logger.test.ts`、`core/orchestrator/tests/redaction.security.test.ts` 作为安全回归。  
  - **Scope**: 在 `EventLogger`、`StateManager` 启用统一脱敏策略并限制敏感环境变量写入，保留配置开关。  
  - **Exit**: 所有事件输出经模式化脱敏，安全相关 CHK 项（078-080）转为“已实现”。  
  - **Links**: CHK078–CHK080

- **T006** `[P2 | 应当实现 | 中]` 成功率/指标计算与追溯  
  - **Status**: 待启动  
  - **Scope**: 实现成功率、失败率、平均执行时长等指标聚合，并在报告中回指 FR/NFR ID；扩展 `tests/acceptance` 及 `tests/integration`。  
  - **Exit**: CHK020、CHK036、CHK072-074 状态切换为“已实现”，状态文件更新。  
  - **Links**: CHK020、CHK036、CHK072–074
- **T007** `[P2 → 上调至 P0 | 必须实现 | 高]` MCP 工具矩阵与异常诊断完善  
  - **Status**: 待启动  
  - **Scope**: 在 `core/mcp/bridge-layer.ts` 扩充分发工具（≥归档 15 条），补充 405/通信异常诊断与自动降级策略，完善契约测试。  
  - **Exit**: MCP 契约测试覆盖新增方法，故障时输出指向修复建议，相关 CHK016、CHK032 标记为“已实现”。  
  - **Links**: CHK016、CHK032；官方参照 `refer-research/.../create_conversation.rs:1`
- **T008** `[P2 | 可选 | 低]` 状态文件与归档清单维护流程  
  - **Status**: 待启动  
  - **Scope**: 建立 `npm run checklist:sync`（或等效脚本）比较实现状态，CI 中提醒未更新条目。  
  - **Exit**: 文档/代码更新后自动提示同步 status 文件；手册中记录维护流程。

---
必要但不在代码中“实现”的条目（维持文档层治理）
- `specs/archive-requirements-checklist.md`：保留为需求写作质量自检清单；不转换为代码能力。低优先，但发布前建议对关键 CHK 做人工复核。
- `specs/archive-requirements-checklist-status.md`：状态台账；低优先持续维护/CI 提醒即可，不纳入运行时代码实现范围。

---
执行以上任务后，请同步更新 `archive-requirements-checklist-status.md` 中对应项的实现状态与证据链接。
