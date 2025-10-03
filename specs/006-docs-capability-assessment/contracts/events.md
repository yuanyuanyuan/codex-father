# Contract — Stream Events

本契约描述编排事件的类型、语义与样例，数据格式与 Schema 对齐：

- Schema 路径：`docs/schemas/stream-json-event.schema.json`

## 事件类型与语义

- `start`：编排开始，包含总任务数
- `task_scheduled`：任务已进入调度队列
- `task_started`：任务开始执行（含 `agentId` / `role`）
- `tool_use`：下游工具/命令调用摘要（敏感信息脱敏）
- `task_completed`：任务完成，附带耗时与输出数
- `task_failed`：任务失败，附带错误摘要
- `cancel_requested`：收到用户取消信号
- `orchestration_completed`：整体成功完成（含成功率）
- `orchestration_failed`：整体失败（含失败清单）

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
