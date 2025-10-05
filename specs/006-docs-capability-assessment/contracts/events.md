# Contract — Stream Events

本契约描述编排事件的类型、语义与样例，数据格式与 Schema 对齐：

- Schema 路径：`docs/schemas/stream-json-event.schema.json`

## 事件类型与语义（Stream-JSON）

- `start`：编排开始，包含总任务数
- `task_scheduled`：任务已进入调度队列
- `task_started`：任务开始执行（含 `agentId` / `role`）
- `tool_use`：下游工具/命令调用摘要（敏感信息脱敏）
- `task_completed`：任务完成，附带耗时与输出数
- `task_failed`：任务失败，附带错误摘要
- `cancel_requested`：收到用户取消信号
- `orchestration_completed`：整体成功完成（含成功率）
- `orchestration_failed`：整体失败（含失败清单）

附注（与 008 对齐）：扩展运营类事件（如
`patch_applied`、`patch_failed`、`task_retry_scheduled`、`concurrency_reduced`
等）仅写入 JSONL 审计日志；如需对外提示，请通过 `tool_use` 或相关 `task_*`
事件的 `data` 字段表达。

## 来源与路由（STDOUT 规约）

- 对外 stdout 仅由编排器输出本契约定义的事件；子进程输出不直通 stdout。
- 子进程（如 `codex exec --json`）的事件流由编排器捕获并解析，必要时映射为
  `tool_use`/`task_*` 对外事件，同时完整写入 JSONL 审计。
- 子进程 stderr/非结构化输出：仅写入 JSONL 审计或摘要化为
  `tool_use`；输出前需按安全规则进行脱敏与截断。

## 样例（节选）

```json
{
  "event": "start",
  "timestamp": "2025-10-02T10:00:00Z",
  "orchestrationId": "orc_1",
  "seq": 1,
  "data": { "totalTasks": 10 }
}
```

```json
{
  "event": "task_completed",
  "timestamp": "2025-10-02T10:03:05Z",
  "orchestrationId": "orc_1",
  "taskId": "t2",
  "role": "developer",
  "seq": 48,
  "data": { "durationMs": 180000, "outputsCount": 1 }
}
```

## 审计日志（JSONL）

- 路径：`.codex-father/sessions/<orchestrationId>/events.jsonl`
- 语义：append-only；每行一个完整事件对象；时间序列可重放
