# Orchestrate 主路径规范（MVP）

最后更新：2025-10-08

目标：定义 CLI `orchestrate` 的主路径契约，用于验收与回归。

## 主路径定义
- 提交流程：提交 → 分解 → 执行 → 写入 → 汇总
- 入口：`codex-father orchestrate <requirement> --mode manual --tasks-file <path> --output-format stream-json`
- STDOUT 契约：仅两行 Stream‑JSON（`start`、`orchestration_completed`）
- 事件与审计：完整事件写入 `.codex-father/sessions/<id>/events.jsonl`（追加式）
- 报告：`.codex-father/sessions/<id>/report.json`（含成功率、失败清单、整改建议、metrics 与 FR/NFR 引用）

## 成功/失败判定
- 成功：`!orchestrationError && successRate >= successThreshold`
- 失败：其余情况；当 `orchestrationError` 存在时包含 `error` 与 `failureReason`。
- `successRate` 范围保护：[0,1]；`failureRate = 1 - successRate`（同样受 [0,1] 约束）。

## 分解准绳（LLM vs 手动）
- 手动分解：
  - 任务具备清晰的 `id/description/role/dependencies/timeout`；
  - 复杂任务拆为若干可并行子任务（依赖拓扑正确，避免环）；
  - 可选 `command/logSnippet/simulateFailure` 便于复现与诊断；
  - 评分要点（示例）：覆盖完整性（0.4）、可并行性（0.3）、可观测性（0.2）、一致性（0.1）。
- LLM 分解（规划中）：
  - 在分解前进行理解一致性验证（requirement vs restatement）；
  - 输出遵循与手动一致的任务形状，并满足上述评分要点；
  - 人工确认流程：当 `manualIntervention.enabled=true & requireAck=true` 时，需显式 ack 后方可继续（否则终止并写入 `manual_intervention_requested`）。

### 配置示例（集中式 understanding + 人工确认）
```json
{
  "orchestrator": {
    "maxConcurrency": 4,
    "taskTimeout": 1800000,
    "successRateThreshold": 0.9,
    "manualIntervention": { "enabled": true, "requireAck": true, "ack": false },
    "understanding": {
      "requirement": "实现登录与会话恢复",
      "restatement": "用户可登录，并在异常后恢复会话继续执行",
      "evaluateConsistency": "builtin"
    }
  }
}
```
备注：CLI 当前未直接暴露上述配置项；测试中通过 `new ProcessOrchestrator({ ... })` 注入；后续可由配置加载器映射。

### 评分示例（0–1 标准化）
- 覆盖完整性（0.4）：是否覆盖需求的关键路径与异常分支（示例：0.8）
- 可并行性（0.3）：是否尽量拆解为并行子任务，依赖拓扑清晰（示例：0.7）
- 可观测性（0.2）：是否提供命令/日志片段，便于复现与定位（示例：1.0）
- 一致性（0.1）：restatement 与 requirement 是否一致（示例：0.9）
- 加权总分 = 0.4*0.8 + 0.3*0.7 + 0.2*1.0 + 0.1*0.9 = 0.83（通过）

提示：评分为文档与人工流程指导，不直接影响运行时；可结合 `manualIntervention` 要求人工确认后继续。

## 报告字段（节选）
- `status`: `succeeded | failed`
- `successRate`、`successThreshold`
- `totalTasks|completedTasks|failedTasks|failedTaskIds`
- `remediationSuggestions`
- `eventsFile`
- `metrics`: `totalExecutionMs`, `avgTaskDurationMs?`, `avgAttempts?`, `avgRetryDelayMs?`, `totalRetries?`, `failureRate`
- `references`: `fr[]`, `nfr[]`（从 `<requirement>` 自动提取）

## 任务文件最小准绳
- 必填：`id`, `description`, `role`, `dependencies[]`, `timeout`
- 可选：`command`, `logSnippet`, `simulateFailure`（用于失败分支演练）
- 样例：`core/cli/tests/fixtures/manual.tasks.json`（成功）与 `core/cli/tests/fixtures/manual.failure.tasks.json`（失败）

## 相关测试
- 成功/失败两分支仅两行 stdout：`tests/acceptance/orchestrate-manual-path.contract.test.ts`
- 报告/指标契约：`core/cli/tests/orchestrate-report.command.test.ts`
- 取消/恢复链路：`core/orchestrator/tests/cancel-handling.contract.test.ts`、`core/orchestrator/tests/cancel-then-resume.chain.integration.test.ts`
 - SWW 中止/恢复：`core/orchestrator/tests/sww-abort-pending.test.ts`、`core/orchestrator/tests/sww-reset-abort.requeue.test.ts`
