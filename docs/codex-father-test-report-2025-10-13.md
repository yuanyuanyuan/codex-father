# Codex-Father 预览版综合测试报告（核实与修订）

- 测试日期：2025-10-13
- 覆盖范围：CF-01 ～ CF-07（CF-06 略过）
- 仓库：codex-father（本仓）

---

## 一、核实结论（与原报告差异）

> 结论以本仓实测为准；对不一致之处给出修订与可复现命令。

- CF-01 细粒度进度反馈：属实
  - 现状：`status --json` 含 `progress{current,total,percentage,currentTask,etaSeconds,etaHuman,estimatedTimeLeft}`。
  - 复现：`./job.sh status <jobId> --json` 或 `GET /api/v1/jobs/:id/status`（需先 `node bin/codex-father http:serve`）。

- CF-02 Checkpoint 恢复：属实（并增强）
  - 现状：`checkpoints.jsonl` 按 `in_progress/completed/failed` 记录；失败步带 `error`；每步记录 `durationMs`；`state.json.resume_from` 给出建议恢复点。
  - 复现：启动多轮任务或故意制造失败后查看 `<session>/checkpoints.jsonl` 与 `<session>/state.json`。

- CF-07 批量操作 API：属实（CLI + Node SDK 均已提供）
  - 现状：
    - CLI：`bulk:status|stop|resume`（默认 dry‑run，`--execute` 才执行）。
    - SDK：`core/sdk/bulk.ts` 暴露 `codex_bulk_status|codex_bulk_stop|codex_bulk_resume`（与 CLI 返回结构一致）。
  - 复现：
    - CLI：`node bin/codex-father bulk:status job-1 job-2 --json`
    - SDK：参见 README “Programmatic Bulk API（Node）” 示例。

- CF-04 跨 Job 通信：部分属实（需降级说明）
  - 现状：报告中提到的 `codex_message`/`mailbox.jsonl` 属于外部工程的演示；本仓未提供同名工具。当前已提供的能力是“只读事件流 + HTTP/SSE”，方便外部系统订阅进度与状态，但不含 Job 间消息 API。
  - 修订：本仓暂不将 CF‑04 计为“完全实现”。建议按“文件队列最小可用”路线补：`codex_send_message` + `codex_check_messages` + 简单依赖等待（待排期）。

- CF-05 动态审批策略：未核实（文档与策略引擎存在，但缺少完整用例校验）
  - 现状：策略引擎已实现白名单/自动批准等能力；尚未覆盖“目录作用域 ask‑once/log‑only”等场景的端到端复测与文档示例。
  - 修订：将“完全实现”更正为“未核实（需补端到端用例与文档示例后标记完成）”。

---

## 二、可复现证据（示例）

- 进度/ETA/当前任务
  ```bash
  node bin/codex-father http:serve --port 7070
  curl -s http://127.0.0.1:7070/api/v1/jobs/<jobId>/status | jq .progress
  ```

- Checkpoint 核心字段（含失败与耗时）
  ```bash
  tail -n +1 .codex-father/sessions/<jobId>/checkpoints.jsonl
  jq '.resume_from' .codex-father/sessions/<jobId>/state.json
  ```

- 批量 CLI（只读/预演）
  ```bash
  node bin/codex-father bulk:status job-1 job-2 --json
  node bin/codex-father bulk:stop job-1 job-2 --json     # 预演
  node bin/codex-father bulk:stop job-1 job-2 --execute   # 执行
  node bin/codex-father bulk:resume job-3 --json          # 预演
  ```

- 批量 SDK（Node）
  ```ts
  import { codex_bulk_status, codex_bulk_stop, codex_bulk_resume } from 'codex-father/dist/core/sdk/bulk.js';
  ```

---

## 三、修订小结（适配本仓现状）

- 将“CF‑04 完全实现(95%)”调整为“部分实现（只读事件流具备；消息与依赖声明待实现）”。
- 将“CF‑05 完全实现(100%)”调整为“未核实（需补端到端用例与文档示例）”。
- 保持 CF‑01/CF‑02/CF‑07 为“已实现”。

---

## 四、后续建议（最小可用清单）

- CF‑04（建议 P1）：
  - 工具：`codex_send_message`（JSONL 投递）、`codex_check_messages`（seq 轮询）。
  - 依赖声明：`job.sh start --depends-on <jobId>...` 在未满足时置 `pending`，监听依赖完成事件再开始。
  - 文档：`docs/operations/job-messages.(md|en.md)` + Schema（job-message.schema.json）。

- CF‑05（建议 P2）：
  - 增补“目录作用域 ask‑once/log‑only”用例与交互截图；在用户手册加入“审批策略样例”。

---

## 五、附录：状态字段速查

- `progress`: `current|total|percentage|currentTask|etaSeconds|etaHuman|estimatedTimeLeft`
- `resource_usage`: `tokens|tokensUsed|apiCalls|filesModified`
- `checkpoints[]`: `step|status|timestamp|artifact|error|durationMs|context`

> 以上字段契约详见 `docs/schemas/codex-status-response.schema.json` 与 `docs/schemas/checkpoint.schema.json`。

