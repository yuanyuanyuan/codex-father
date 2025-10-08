# Orchestrate 报告与指标说明

本页介绍 `codex-father orchestrate` 生成的 `report.json` 字段与指标含义，并给出通过 `orchestrate:report` 查看摘要与 JSON 的方法。

## 生成与位置
- 运行 `codex-father orchestrate <requirement> --mode manual --tasks-file <path> --output-format stream-json` 时：
  - stdout 仅输出两行 Stream-JSON：`start` 与 `orchestration_completed`（契约约束）。
  - 报告默认写入 `.codex-father/sessions/<orchestrationId>/report.json`。
  - 事件日志写入 `.codex-father/sessions/<orchestrationId>/events.jsonl`。

## report.json 结构（核心字段）
- `status`: `succeeded | failed`
- `successRate`: 成功率（0~1）
- `totalTasks|completedTasks|failedTasks|failedTaskIds`: 任务计数与失败列表
- `remediationSuggestions`: 整改建议（基于失败任务的定位）
- `eventsFile`: 事件日志路径
- `metrics`（新增）
  - `totalExecutionMs`: 编排总时长
  - `avgTaskDurationMs`: 平均任务时长
  - `avgAttempts`: 平均尝试次数
  - `avgRetryDelayMs`: 平均重试等待时间
  - `totalRetries`: 总重试次数
  - `failureRate`: 失败占比（0~1）
- `failureBreakdown`（新增）
  - `insufficient_context|permission_denied|dependency_not_ready|other`：按失败日志/命令启发式分类计数（总和≈`failedTasks`）
  - `orchestration_error`：仅当整体编排错误且没有逐任务失败明细时为 1，否则为 0
- `remediationByCategory`（新增）
  - 针对每个分类给出常见整改建议列表，用于快速定位修复方向（如权限问题、上下文不足、依赖未就绪等）
- `references`（新增）
  - 自动从 `requirement` 中提取 `FR-<id>`/`NFR-<id>` 并回指（便于与需求/非功能需求对齐）
  
### 任务级映射（新增）
- `referencesByTask`: 将 `FR-<id>`/`NFR-<id>` 映射到每个任务（以 `task.id` 为键）。
  - 提取来源：任务 `title/description` 与全局 `requirement` 的并集，去重后写入。
  - 用途：便于在报告或后续工具中快速定位“哪些任务与哪些 FR/NFR 相关”。

### 覆盖概览（新增）
- `referencesCoverage`: 汇总视角（按 FR/NFR ID）查看由哪些任务覆盖：
  - 结构：`{ fr: { 'FR-123': { coveredByTasks: ['t_setup','t_implement'] } }, nfr: { 'NFR-7': { coveredByTasks: [...] } } }`
  - 与 `referencesByTask` 互为镜像，便于“自上而下”审阅覆盖。

## 查看摘要/JSON
- 人类摘要：
  - `codex-father orchestrate:report --path .codex-father/sessions/<id>/report.json`
  - 摘要包含“指标”与“引用（FR/NFR）”行，便于快速评估质量与定位文档条目。
  - 当存在失败任务时，会附带“失败分类”行（按上述 `failureBreakdown` 汇总）。
  - 可根据 `remediationByCategory` 选择对应的修复建议执行回归。
  - 可选参数：
    - `--duration-format <auto|ms|s|m>`：控制“指标”行时长单位（默认 auto）。
    - `--duration-precision <0|1|2>`：与 s/m 模式配合使用的小数精度（默认 1）。
- JSON 输出：
  - `codex-father --json orchestrate:report --session-id <id>`
  - `data.report.metrics`/`data.report.references` 即上述字段。

## 契约与测试
- 两行 Stream-JSON 契约（成功与失败路径）
- 退出码矩阵（无参=2、缺文件=3、JSON 解析失败=4、成功=0、失败=1）
- 指标/引用字段的存在与类型校验（见 `core/cli/tests/orchestrate-report.command.test.ts`）

## 主路径与手动分解（最小示例）
- 主路径：提交 → 分解 → 执行 → 写入 → 汇总；使用 `--mode manual` 与任务文件驱动执行。
- 最小样例任务文件：
  - 成功分支：`core/cli/tests/fixtures/manual.tasks.json`
  - 失败分支：`core/cli/tests/fixtures/manual.failure.tasks.json`
- 运行示例：
  - `codex-father orchestrate "测试报告 FR-123" --mode manual --tasks-file core/cli/tests/fixtures/manual.tasks.json --output-format stream-json`
  - stdout 仅两行（`start`/`orchestration_completed`）；报告与事件路径见第 2 行数据。

## 示例 report.json（节选）
```
{
  "orchestrationId": "orc_123...",
  "requirement": "测试报告 FR-123 NFR-7",
  "mode": "manual",
  "maxConcurrency": 3,
  "taskTimeoutMinutes": 30,
  "successRate": 1,
  "successThreshold": 0.9,
  "status": "succeeded",
  "totalTasks": 3,
  "completedTasks": 3,
  "failedTasks": 0,
  "failedTaskIds": [],
  "remediationSuggestions": [],
  "eventsFile": ".codex-father/sessions/orc_123.../events.jsonl",
  "generatedAt": "2025-10-08T12:00:00.000Z",
  "executionTimeMs": 420,
  "metrics": {
    "totalExecutionMs": 420,
    "avgTaskDurationMs": 120,
    "avgAttempts": 1,
    "totalRetries": 0,
    "failureRate": 0
  },
  "referencesByTask": {
    "t_setup": { "fr": ["FR-123"], "nfr": ["NFR-7"] },
    "t_implement": { "fr": ["FR-123"], "nfr": ["NFR-7"] }
  },
  "referencesCoverage": {
    "fr": { "FR-123": { "coveredByTasks": ["t_setup", "t_implement"] } },
    "nfr": { "NFR-7": { "coveredByTasks": ["t_setup", "t_implement"] } }
  },
  "failureBreakdown": {
    "insufficient_context": 0,
    "permission_denied": 0,
    "dependency_not_ready": 0,
    "other": 0,
    "orchestration_error": 0
  },
  "remediationByCategory": {
    "insufficient_context": ["补充缺失文件/变量/路径，完善任务输入描述"],
    "permission_denied": ["检查审批/沙箱与目录权限，必要时调整角色配置"],
    "dependency_not_ready": ["等待依赖就绪或调整重试/退避参数"],
    "other": ["根据日志最小化复现并逐步定位"],
    "orchestration_error": ["检查 orchestrator 版本/错误详情并重试或降级"]
  },
  "references": {
    "fr": ["FR-123"],
    "nfr": ["NFR-7"]
  }
}
```

### 建议映射（摘要）
- insufficient-context → 补充上下文（文件/路径/变量），完善任务输入说明
- permission-denied → 检查审批策略/沙箱与目录权限，必要时调整角色配置
- dependency-not-ready → 等待依赖或调整重试退避参数
- orchestration-error → 先查看错误详情，必要时回滚/降级
