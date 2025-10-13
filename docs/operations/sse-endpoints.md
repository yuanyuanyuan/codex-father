# HTTP / SSE 接口（最小可用稿）

目标：在不破坏 CLI 两行 stdout 契约的前提下，提供只读 HTTP 接口与 SSE 实时推送，便于 UI/外部系统订阅进度与事件。

约定
- 基础路径：`/api/v1`。
- 返回 JSON 结构遵循 `docs/schemas/*.json`。
- 仅提供只读/查询接口；写操作仍由 CLI 负责（后续如需可补充）。

接口
- `GET /api/v1/version` → 返回当前服务版本、Node 版本、平台等。
- `GET /api/v1/jobs/:id/status` → 返回 `codex-status-response.schema.json` 结构。
- `GET /api/v1/jobs/:id/events` → SSE 通道，事件结构为 `stream-json-event.schema.json`；支持断点续订：
  - Query: `?fromSeq=<number>`（可选），从指定 `seq` 开始推送（含）。
  - 心跳：`event: heartbeat` 每 15s。
  - 幂等：事件包含 `orchestrationId` 与单调递增 `seq`，客户端应去重。
- `GET /api/v1/jobs/:id/checkpoints` → 返回 `checkpoint.schema.json[]`。

SSE 事件类型
- 新增：`plan_updated`、`progress_updated`、`checkpoint_saved`（详见 `stream-json-event.schema.json`）。

错误
- 统一错误载荷：`{ code, message, hint }`。

示例（SSE）
```
GET /api/v1/jobs/abc-123/events

event: progress_updated
data: {"orchestrationId":"orc_1","seq":42,"timestamp":"2025-10-13T10:34:20Z","data":{"progress":{"current":3,"total":10,"percentage":30,"currentTask":"重构 SimulateForm.tsx","etaHuman":"4m 20s"}}}

event: checkpoint_saved
data: {"orchestrationId":"orc_1","seq":43,"timestamp":"2025-10-13T10:34:30Z","data":{"step":3,"status":"in_progress","artifact":"components/mvp/SimulateForm.tsx"}}
```

实现最小要求
- 文件队列：从 `.codex-father/sessions/<id>/events.jsonl` 逐行推送；服务端保持文件偏移量。
- 断线重连：客户端带 `fromSeq` 继续；找不到则从最近 1000 条回放。
- 资源保护：连接数上限与速率限制见 `express-rate-limit` 默认配置；可在 `config/` 提供模板。
