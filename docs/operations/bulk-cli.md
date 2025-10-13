# 批量操作 CLI（最小可用）

- 子命令：`bulk:status`（建议别名，轻量包装现有 API）
- 目的：减少多 Job 查询时的调用次数、便于脚本化。

用法
- 列表作为位置参数：
  - `codex-father bulk:status job-1 job-2 job-3 --json`
- 或通过 `--jobs` 多次传入：
  - `codex-father bulk:status --jobs job-1 --jobs job-2 --json`

选项
- `--sessions <path>`：自定义 sessions 根目录（默认自动发现仓库内 `.codex-father/sessions` 或 `.codex-father-sessions`）
- `--repo-root <path>`：仓库根目录（默认 CWD）

返回示例（`--json`，status）：
```
{
  "success": true,
  "data": [
    { "jobId": "job-1", "status": { "id": "job-1", "state": "running", "progress": {"current":2,"total":5,"percentage":40} } },
    { "jobId": "job-2", "status": null, "error": "state.json not found: .../job-2/state.json" }
  ]
 }
```

备注
- 该命令只读：不会改变任何作业状态。
- 实现细节：会优先调用 `job.sh status --json` 获取最新快照；若不可用或输出为空，则回退读取 `<session>/state.json`。

## 批量停止（预演为默认）

```bash
# 预演：不会真的停止，只返回哪些 job 将被停止
node bin/codex-father bulk:stop job-1 job-2 --json

# 执行：真正发送 SIGTERM；如需强制，追加 --force（SIGKILL）
node bin/codex-father bulk:stop job-1 job-2 --execute --json
node bin/codex-father bulk:stop job-1 job-2 --execute --force --json
```

返回（预演）：
```
{
  "success": true,
  "data": {
    "dryRun": true,
    "force": false,
    "preview": [
      { "jobId": "job-1", "state": "running", "eligible": true },
      { "jobId": "job-2", "state": "done", "eligible": false, "reason": "not_running" }
    ]
  }
}
```

失败回滚/重试策略提示（仅文案与返回结构，不改变行为）：
- 返回体包含 `advice` 字段：
  - `advice.retry.suggested` ∈ {`none`, `retry_failed_only`}；`cooldownSeconds` 为建议等待秒数。
  - `advice.rollback.supported=false`（当前不支持自动回滚，仅提示“手动”）。
  - 执行态还会包含 `summary`（总数/成功/失败）。
  - 统一 Schema：`docs/schemas/bulk-stop-response.schema.json`、`docs/schemas/bulk-resume-response.schema.json`。

## 批量恢复（预演为默认）

```bash
# 预演：根据 state.json 的 resume_from 建议给出恢复步
node bin/codex-father bulk:resume job-3 job-4 --json

# 执行：从建议步或指定步恢复；可选 --skip-completed 增量恢复
node bin/codex-father bulk:resume job-3 job-4 --execute --json
node bin/codex-father bulk:resume job-3 --execute --resume-from 7 --skip-completed --json
```

返回（预演）：
```
{
  "success": true,
  "data": {
    "dryRun": true,
    "preview": [
      { "jobId": "job-3", "state": "failed", "resumeFrom": 7, "eligible": true },
      { "jobId": "job-4", "state": "running", "eligible": false, "reason": "running" }
    ]
  }
}
```
