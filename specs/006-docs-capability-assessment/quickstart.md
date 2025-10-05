# Quickstart — Multi-Agent Parallel Task Orchestration

## 前置条件

- Node.js >= 18，已安装本项目依赖并完成构建（如需）
- 本地环境默认禁网，沙箱 `workspace-write`

## 基本用法

```
codex-father orchestrate "将需求拆分为10个并行子任务并执行" \
  --mode llm \
  --max-concurrency 5 \
  --output-format stream-json
```

或使用手动任务列表：

```
codex-father orchestrate --tasks-file ./tasks.json --mode manual
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

```
{"event":"start","timestamp":"2025-10-02T10:00:00Z","orchestrationId":"orc_1","seq":1,"data":{"totalTasks":10}}
{"event":"task_started","timestamp":"2025-10-02T10:00:05Z","orchestrationId":"orc_1","taskId":"t2","role":"developer","agentId":"agent_3","seq":12,"data":{}}
{"event":"task_completed","timestamp":"2025-10-02T10:03:05Z","orchestrationId":"orc_1","taskId":"t2","role":"developer","seq":48,"data":{"durationMs":180000,"outputsCount":1}}
{"event":"orchestration_completed","timestamp":"2025-10-02T10:20:00Z","orchestrationId":"orc_1","seq":200,"data":{"successRate":1.0}}
```

## 故障与恢复

- 超时：单任务超过 30 分钟即终止并标记 `timeout`
- 重试：失败任务自动重试 1 次（指数退避），仍失败则上报
- 优雅停止：Ctrl+C → 保存 60 秒 → 强制终止 → 输出汇总
