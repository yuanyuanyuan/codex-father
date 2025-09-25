# MCP 使用指南（Codex Father）

本项目提供一个基于 @modelcontextprotocol/sdk 的 MCP 服务器（stdio/JSON‑RPC）。它将 Codex CLI 的执行能力以工具（tools）形式暴露，既支持同步执行，也支持异步任务队列管理。

## 快速开始
- 依赖：Node.js ≥ 18，Bash ≥ 5
- 构建：`cd mcp/codex-mcp-server && npm install && npm run build`
- 启动（stdio）：`./mcp/server.sh`
- 可选环境变量：`CODEX_START_SH=/abs/path/start.sh`，`CODEX_JOB_SH=/abs/path/job.sh`

## 可用工具（tools）
- 同步：`codex.exec`（前台运行 `start.sh`，返回完成结果）
- 异步：`codex.start`、`codex.status`、`codex.logs`、`codex.stop`、`codex.list`（委托 `job.sh`）

## 作为子进程调用（stdio/JSON‑RPC）
- 初始化 + 列表：
  ```bash
  printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"demo","version":"0.0.1"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | ./mcp/server.sh
  ```
- 同步执行：
  ```bash
  printf '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"codex.exec","arguments":{"args":["--task","Sync via MCP","--dry-run","--approvals","never","--sandbox","workspace-write"],"tag":"mcp-sync"}}}\n' | ./mcp/server.sh
  ```
  返回 JSON 含：`runId, exitCode, processExit, logFile, instructionsFile, metaFile, lastMessageFile, tag`。
- 异步执行与管理：
  - 启动：`codex.start` → 返回 `{ jobId, logFile, ... }`
  - 状态：`codex.status` → `{ state: running|completed|failed, exit_code, classification, ... }`
  - 日志：`codex.logs`（两种模式）
    - 行模式：`{"jobId":"ID","mode":"lines","tailLines":200}` → `{ lines[], totalLines }`
    - 字节模式：`{"jobId":"ID","offset":0,"limit":4096}` → `{ chunk, nextOffset, eof, size }`
  - 停止：`codex.stop` → `{ jobId, ... }`
  - 列表：`codex.list` → 任务摘要数组

## 参数映射与指令组合（传给 `arguments.args`）
- 覆盖/叠加：`-F/--file-override`、`-f/--file`（支持通配）、`--docs`、`-c/--content`
- 模板：`--prepend[/-file]`、`--append[/-file]`
- 迭代与预设：`--preset sprint`、`--repeat-until 'CONTROL: DONE'`、`--max-runs N`、`--sleep-seconds S`
- 上下文压缩：`--no-carry-context`、`--no-compress-context`、`--context-head N`、`--context-grep REGEX`
- 直通 Codex：`--sandbox`、`--approvals`、`--profile`、`--full-auto`、`--codex-config key=value`、`--codex-arg "--flag value"`
- 注意：MCP 中不建议使用 STDIN（`-f -`/`-F -`）；改用 `-c` 或将内容落盘后用 `-f` 传入。

## 产物与路径
- 同步（exec）：`runs/exec-<timestamp>-<tag>/job.log | job.instructions.md | job.meta.json | *.last.txt`
- 异步（start）：`runs/<job-id>/job.log | *.instructions.md | *.meta.json | state.json | pid`
- `runs/` 已加入 `.gitignore`；可按需清理。

## 客户端集成示例
- VS Code/Claude 风格配置：
  ```json
  {"servers":{"codex-father":{"command":"node","args":["/abs/path/mcp/codex-mcp-server/dist/index.js"],"type":"stdio"}}}
  ```
- Node 最小客户端（伪代码）：
  ```js
  const { spawn } = require('node:child_process');
  const srv = spawn('node', ['/abs/.../dist/index.js']);
  srv.stdout.on('data', b => console.log('OUT', b.toString()));
  srv.stderr.on('data', b => console.error('ERR', b.toString()));
  srv.stdin.write(JSON.stringify({ jsonrpc:"2.0", id:1, method:"initialize", params:{ protocolVersion:"2024-09-18", capabilities:{}, clientInfo:{name:"demo",version:"0.0.1"} } })+"\n");
  srv.stdin.write(JSON.stringify({ jsonrpc:"2.0", id:2, method:"tools/call", params:{ name:"codex.exec", arguments:{ args:["--task","Sync via MCP","--dry-run"], tag:"demo" } } })+"\n");
  ```

## 安全与故障排查
- 安全：在 args 中显式设置 `--approvals`（如 `never|on-request`）与 `--sandbox`（如 `read-only|workspace-write`）；需要脱敏时使用 `--redact`/`--redact-pattern`。
- 故障排查：若 `exec`/`start` 失败，查看 `runs/.../job.log`（末尾含 `Exit Code:`）；元数据见 `*.meta.json`；可运行 `tests/mcp_ts_e2e.sh` 做端到端自检。

