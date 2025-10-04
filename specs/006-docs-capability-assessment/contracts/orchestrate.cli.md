# Contract — CLI: codex-father orchestrate

本契约定义 `codex-father orchestrate`
子命令的接口与行为，适用于单机并行多 Agent 编排。

## 命令

```
codex-father orchestrate <requirement> [options]
```

## 选项

- `--mode <manual|llm>`：任务分解模式（默认 `llm`）
- `--tasks-file <path>`：手动任务列表（JSON），与 `--mode manual` 搭配
- `--max-concurrency <n>`：最大并发数（默认 10，上限 10）
- `--task-timeout <minutes>`：单任务超时（默认 30）
- `--success-threshold <0-1>`：成功率阈值（默认 0.9）
- `--output-format <json|stream-json>`：输出格式（默认 `stream-json`）
- `--config <path>`：加载 YAML 配置（合并覆盖）

安全基线：

- 默认 `--ask-for-approval never`，`--sandbox workspace-write`
- 编排器禁网；仅经 Codex CLI 使用 LLM

## 输出

### 人类可读摘要

- 启动信息：任务数、并发、阈值
- 结束汇总：成功率、失败任务清单、事件文件路径

### 流式机器事件（推荐）

- 事件格式：`docs/schemas/stream-json-event.schema.json`
- 事件类型：`start` / `task_scheduled` / `task_started` / `tool_use` /
  `task_completed` / `task_failed` / `orchestration_completed` /
  `orchestration_failed`
- 示例：见 `../quickstart.md`

附注：扩展运营类事件（`patch_applied`、`patch_failed`、`task_retry_scheduled`、`concurrency_reduced` 等）仅写入 JSONL 审计；如需在流式输出中提示，使用 `tool_use` 或将信息并入 `task_*` 事件的 `data`。

## 退出码

- `0`：成功率 ≥ 阈值 且 无 `patch_failed`
- `1`：不满足成功条件（含任一补丁失败或成功率不足）
- 非 0 非 1：进程级异常（配置/环境错误等）

注：`patch_failed` 为 JSONL 审计中的扩展事件，流式事件不包含该枚举。

## 约束与行为

- 依赖排序：拓扑执行，支持波次并行
- 并发上限：10；资源不足自动降并发（最低 1）
- 写入策略：SWW 单写者窗口 + 两阶段写；每次写入后快速校验
- 重试：失败任务自动重试 1 次（指数退避）

## 示例

```
codex-father orchestrate "实现用户管理模块" --mode llm --max-concurrency 5 --output-format stream-json

codex-father orchestrate --tasks-file specs/006-docs-capability-assessment/sample.tasks.json --mode manual
```
