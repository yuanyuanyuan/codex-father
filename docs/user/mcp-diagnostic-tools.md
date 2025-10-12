# MCP 诊断只读工具与端到端用法

本文档介绍如何在 MCP 服务器上启用诊断只读工具（默认已开启），并通过示例客户端 `scripts/rmcp-client.mjs` 执行 `tools/list` 与 `tools/call`。

## 工具一览（启用后）
- 基础：`list-tools`、`ping-bridge`、`echo`
- 文件/路径：`exists`、`stat-path`、`list-dir`、`resolve-path`
- 会话：`list-sessions`、`get-latest-session`、`read-session-artifacts`
- 报告/事件：`read-report-file`、`read-report-metrics`、`read-events-preview`、`grep-events`
- 降级/诊断：`call-with-downgrade`（遇到未知方法或通信异常时返回降级结果与原因）

> 提醒：会话相关工具默认遵循会话根目录环境变量：优先 `CODEX_SESSIONS_ROOT`（兼容 `CODEX_SESSIONS_HOME`），否则回退到 `.codex-father/sessions`。

## 启动服务器
使用 CLI 启动本仓 MCP 服务器（默认启用诊断工具）：

```
codex-father mcp --debug
```

或由示例客户端自动拉起（见下文）。

## 使用示例客户端（rMCP）列出工具

示例客户端会自动启动指定的 MCP 服务器并完成握手，随后发出 `tools/list`：

```
node scripts/rmcp-client.mjs \
  --server codex-father \
  --server-args mcp --verbose \
  list-tools
```

预期输出包含上述诊断工具名称。

## 端到端：调用诊断工具读取报告/事件

1) 先运行一次 orchestrate 生成报告与事件：

```
codex-father orchestrate "测试报告 FR-123" \
  --mode manual \
  --tasks-file core/cli/tests/fixtures/manual.tasks.json \
  --output-format stream-json
```

记录 stdout 第二行的 `orchestrationId`，形如 `orc_xxx`。

2) 通过 `read-session-artifacts` 解析路径：

```
node scripts/rmcp-client.mjs \
  --server codex-father \
  --server-args mcp \
  call-tool read-session-artifacts \
  --arguments '{"sessionId": "<替换为上面的 orchestrationId>"}'
```

如需在自定义位置检索会话，先设置根目录变量：

```bash
export CODEX_SESSIONS_ROOT="/abs/path/to/.codex-father/sessions"
# 或兼容方式：export CODEX_SESSIONS_HOME="/abs/path/to/.codex-father-sessions"
```

3) 使用解析出的 `reportPath` 读取报告内容：

```
node scripts/rmcp-client.mjs \
  --server codex-father \
  --server-args mcp \
  call-tool read-report-file \
  --arguments '{"path": "/绝对/路径/.codex-father/sessions/<id>/report.json"}'
```

4) 预览 `events.jsonl` 末尾行：

```
node scripts/rmcp-client.mjs \
  --server codex-father \
  --server-args mcp \
  call-tool read-events-preview \
  --arguments '{"path": "/绝对/路径/.codex-father/sessions/<id>/events.jsonl", "limit": 10}'
```

5) 演示 405/通信降级（未知工具名触发）：

```
node scripts/rmcp-client.mjs \
  --server codex-father \
  --server-args mcp \
  call-tool call-with-downgrade \
  --arguments '{"targetTool": "non-existent-tool", "fallback": {"ok": true}}'
```
返回示例：`{"degraded": true, "reason": "method_not_allowed", "result": {"ok": true}}`

### grep-events 参数
- `path`（必填，绝对路径）：events.jsonl 的绝对路径
- `q`（必填）：查询字符串；当 `regex=true` 时按正则解释
- `limit`（可选）：返回行数上限，正整数
- `ignoreCase`（可选，布尔）：大小写不敏感匹配
- `regex`（可选，布尔）：启用正则匹配

示例（大小写不敏感）：
```
node scripts/rmcp-client.mjs \
  --server codex-father \
  --server-args mcp \
  call-tool grep-events \
  --arguments '{"path":"/abs/path/events.jsonl","q":"start","ignoreCase":true}'
```

示例（正则+忽略大小写）：
```
node scripts/rmcp-client.mjs \
  --server codex-father \
  --server-args mcp \
  call-tool grep-events \
  --arguments '{"path":"/abs/path/events.jsonl","q":"\\"event\\":\\"(start|task_failed)\\"","regex":true,"ignoreCase":true}'
```

### 降级原因（reason）枚举
- `method_not_allowed`：目标工具不存在（未知方法）。
- `invalid_arguments`：参数校验失败（缺少必填、类型不匹配、相对路径等）。
- `not_found`：目标文件/路径不存在（ENOENT）。
- `permission_denied`：权限不足（EACCES/EPERM）。
- `timeout`：调用超时（如果上游设置超时策略）。
- `server_error`：上游返回错误但非以上几类（一般性错误）。
- `communication_error`：其余通信失败或未知原因。

示例（参数缺失触发 invalid_arguments）：
```
node scripts/rmcp-client.mjs \
  --server codex-father \
  --server-args mcp \
  call-tool call-with-downgrade \
  --arguments '{"targetTool": "read-report-file", "arguments": {}, "fallback": null}'
```
返回示例：`{"degraded": true, "reason": "invalid_arguments", "result": null}`

示例（不存在路径触发 not_found）：
```
node scripts/rmcp-client.mjs \
  --server codex-father \
  --server-args mcp \
  call-tool call-with-downgrade \
  --arguments '{"targetTool": "read-report-file", "arguments": {"path": "/abs/missing.json"}, "fallback": null}'
```
返回示例：`{"degraded": true, "reason": "not_found", "result": null}`

示例（权限不足触发 permission_denied）：
```
node scripts/rmcp-client.mjs \
  --server codex-father \
  --server-args mcp \
  call-tool call-with-downgrade \
  --arguments '{"targetTool": "read-report-file", "arguments": {"path": "/root/report.json"}, "fallback": null}'
```
返回示例：`{"degraded": true, "reason": "permission_denied", "result": null}`

> 注：示例通过 `--server codex-father --server-args mcp` 直接拉起本仓 MCP 服务器；也可手动先运行 `codex-father mcp` 后，仅传递 `--server` 为任意 no-op 命令并将 `--server-args` 留空，客户端会直接通过 stdio 连接现有进程。

## 故障排查（Troubleshooting）

- 连接失败/无输出：
  - 使用 `--verbose` 查看握手报文；若日志包含 `Connection closed`，确认服务器未提前退出。
  - 检查 Node 版本（建议 v18+）；`pnpm i` 或 `npm ci` 保证依赖完整。
  - Windows/WSL 路径：优先传入绝对路径，避免盘符/符号链接造成的解析失败。
- 权限不足（EACCES/EPERM）：
  - 诊断工具仅执行只读操作；若读取失败，确认文件权限与当前用户可读。
  - 在 CI 中运行时，必要时为会话目录 `.codex-father/sessions/` 添加缓存或读权限。
- 工具不可用（tools/list 缺少诊断工具）：
  - 本仓 MCP 服务器默认 `enableDiagnosticTools=true`。若以嵌入模式启动，请检查集成侧是否覆盖了该配置。
  - 也可在创建服务器时显式传参：`createMCPServer({ enableDiagnosticTools: true })`。
