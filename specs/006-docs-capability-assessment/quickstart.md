# Quickstart — Multi-Agent Parallel Task Orchestration

## 前置条件

- Node.js >= 18，已安装本项目依赖并完成构建（如需）
- 本地环境默认禁网，沙箱 `workspace-write`

## 基本用法

```
codex-father orchestrate "将需求拆分为10个并行子任务并执行" \
  --mode llm \
  --max-concurrency 5 \
  --task-timeout 45 \
  --success-threshold 0.9 \
  --output-format stream-json
```

- 核心选项（契约详见 `contracts/orchestrate.cli.md`）：`--mode <manual|llm>` 控制任务拆分模式；`--max-concurrency` 限制并发（上限 10）；`--task-timeout` 以分钟为单位设置单任务超时；`--success-threshold` 要求的最小成功率；`--output-format` 需与流式事件契约保持一致。
- 默认禁用人工审批（`--ask-for-approval never`）且沙箱保持 `workspace-write`，与契约安全基线对齐。

或使用手动任务列表：

```
codex-father orchestrate --tasks-file ./tasks.json --mode manual --output-format stream-json
```

## 输出与判定

- Stream-JSON：连续输出事件（见 `contracts/events.md` 与
  `docs/schemas/stream-json-event.schema.json`）
- 终止判定：
  - 退出码 `0`：成功率 ≥ 阈值 且无 `patch_failed`
  - 退出码 `1`：不满足成功条件（或存在补丁失败）

注意（STDOUT 规约）：

- 对外 stdout 仅由编排器输出统一的 Stream-JSON 事件；`codex exec` 子进程即使开启
  `--json`，其 stdout 会被编排器捕获解析，不会直通 stdout，以避免双路 JSON 冲突。

## 常见配置

YAML 示例（与 `ConfigLoader` 合并）：

```yaml
version: '1.0'
orchestration:
  maxConcurrency: 10
  taskTimeout: 1800000
  successRateThreshold: 0.9
  outputFormat: stream-json
retryPolicy:
  maxAttempts: 2
  backoff: exponential
  initialDelayMs: 2000
  maxDelayMs: 30000
quickValidate:
  steps: ['npm run typecheck', 'npm run test:run -- --silent']
  failOnMissing: true
applyPatchStrategy: git
applyPatchFallbackOnFailure: true
```

## 事件示例（截断）

与 `contracts/events.md` 保持一致的流式输出示例：

```
{"event":"start","timestamp":"2025-10-02T10:00:00Z","orchestrationId":"orc_1","seq":1,"data":{"totalTasks":10}}
{"event":"task_scheduled","timestamp":"2025-10-02T10:00:03Z","orchestrationId":"orc_1","taskId":"t2","seq":8,"data":{"retries":0}}
{"event":"task_started","timestamp":"2025-10-02T10:00:05Z","orchestrationId":"orc_1","taskId":"t2","role":"developer","agentId":"agent_3","seq":12,"data":{}}
{"event":"tool_use","timestamp":"2025-10-02T10:01:40Z","orchestrationId":"orc_1","taskId":"t2","seq":30,"data":{"tool":"codex exec","summary":"git apply 成功"}}
{"event":"task_completed","timestamp":"2025-10-02T10:03:05Z","orchestrationId":"orc_1","taskId":"t2","role":"developer","seq":48,"data":{"durationMs":180000,"outputsCount":1}}
{"event":"task_failed","timestamp":"2025-10-02T10:05:00Z","orchestrationId":"orc_1","taskId":"t4","role":"reviewer","seq":90,"data":{"error":"测试失败","retry":true}}
{"event":"orchestration_completed","timestamp":"2025-10-02T10:20:00Z","orchestrationId":"orc_1","seq":200,"data":{"successRate":1.0}}
```

示例中的 `task_failed` 事件会触发一次自动重试；若所有补救后仍存在失败或出现 `patch_failed` 扩展事件，退出码将落在契约定义的失败分支。

## 审计日志与 logs 命令

- 编排事件按序写入 `.codex-father/sessions/<orchestrationId>/events.jsonl`，便于后续重放与审计。
- 可使用 `codex-father logs <orchestrationId> --format json --limit 50` 导出最近 50 条事件，或追加 `--follow` 进行实时追踪；命令会校验上述 JSONL 路径并保持与流式事件一致的 Schema。
- 若需对比实时输出与审计日志，可结合 `docs/schemas/stream-json-event.schema.json` 校验结构。

## 故障与恢复

- 超时：单任务超过 30 分钟即终止并标记 `timeout`
- 重试：失败任务自动重试 1 次（指数退避），仍失败则上报
- 优雅停止：Ctrl+C → 保存 60 秒 → 强制终止 → 输出汇总
