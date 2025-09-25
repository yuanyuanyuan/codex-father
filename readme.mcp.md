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

参数定义（JSON Schema 简述）
- codex.exec：`{ args?: string[], tag?: string, cwd?: string }`
- codex.start：`{ args?: string[], tag?: string, cwd?: string }`
- codex.status：`{ jobId: string, cwd?: string }`
- codex.logs：`{ jobId: string, mode?: 'bytes'|'lines', offset?: number, limit?: number, offsetLines?: number, limitLines?: number, tailLines?: number, grep?: string, cwd?: string }`
- codex.stop：`{ jobId: string, force?: boolean, cwd?: string }`
- codex.list：`{ cwd?: string }`

## 作为子进程调用（stdio/JSON‑RPC）
- 初始化 + 列表：
  ```bash
  printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"demo","version":"0.0.1"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | ./mcp/server.sh
  ```
- 同步执行：
  ```bash
  printf '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"codex.exec","arguments":{"args":["--task","Sync via MCP","--dry-run","--approvals","never","--sandbox","workspace-write"],"tag":"mcp-sync"}}}\n' | ./mcp/server.sh
  ```
返回 JSON 含：`runId, exitCode, processExit, cwd, logFile, instructionsFile, metaFile, lastMessageFile, tag`。
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

补丁模式（只输出改动，不改盘）
- 目的：在受限环境（只读/免审批）下，模型只给出可应用的补丁（patch/diff），而不尝试直接改文件。
- 开关：`--patch-mode`（会自动注入 policy-note 提示）。
- 建议与只读搭配：`--sandbox read-only --approvals never`。
- 示例（stdio）：
  ```bash
  printf '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"codex.exec","arguments":{"args":["--task","修复TS类型","--patch-mode","--sandbox","read-only","--approvals","never"],"tag":"patch-run","cwd":"'$PWD'"}}}\n' | ./mcp/server.sh
  ```

## 产物与路径
- 所有会话产物均位于：`<项目根>/.codex-father/sessions/<job-id>/`
- 同步（exec）：`job.log | job.instructions.md | job.meta.json | *.last.txt | aggregate.*`
- 异步（start）：`job.log | *.instructions.md | *.meta.json | state.json | pid | aggregate.*`
- 建议为远程调用显式传入 `cwd` 指向你的项目根，以确保产物落在预期目录。

会话目录结构（示例）
```text
<项目根>/.codex-father/sessions/
  cdx-20240925_120001-demo/        # 异步任务（job.sh/codex.start）
    job.log
    job.instructions.md
    state.json
    aggregate.txt
    aggregate.jsonl
    pid
  exec-20240925_120501-demo/       # 同步执行（codex.exec 或直接 start.sh）
    job.log
    job.instructions.md
    job.meta.json
    aggregate.txt
```

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

## 分发与安装（GH Packages）
- 包名：`@yuanyuanyuan/codex-father-mcp-server`
- 通过 GitHub Packages 安装/运行（需要配置 `~/.npmrc`）：
  - `@yuanyuanyuan:registry=https://npm.pkg.github.com`
  - `//npm.pkg.github.com/:_authToken=<YOUR_GITHUB_TOKEN>`
  - `npx @yuanyuanyuan/codex-father-mcp-server`

## 安全与故障排查
- 默认安全：若未在 `arguments.args` 中显式提供，MCP 会为 `codex.exec`/`codex.start` 注入 `--sandbox workspace-write --approvals on-request`。
- 覆盖方式：在 args 中显式设置 `--approvals`（如 `never|on-request`）与 `--sandbox`（如 `read-only|workspace-write`）；需要脱敏时使用 `--redact`/`--redact-pattern`。
- 故障排查：若 `exec`/`start` 失败，查看 `<项目根>/.codex-father/sessions/<job-id>/job.log`（末尾含 `Exit Code:`）；元数据见 `*.meta.json`；可运行 `tests/mcp_ts_e2e.sh` 做端到端自检。

注意与建议
- 不要在 MCP 中使用 STDIN（`-f -`/`-F -`）；请用 `-c` 传文本或将内容写入文件后用 `-f/--docs` 传入。
- 通过 `tag` 标注任务（如 `--tag demo`）便于按目录检索与排错。
- 需要自定义会话目录时，可在直接调用 start.sh 时设置 `CODEX_SESSION_DIR=/abs/dir`。
