### 使用指南（start.sh / job.sh / MCP）

- 前置依赖
  - Bash >= 5
  - Node.js >= 18（仅 MCP 服务器需要）

- start.sh 常用
  - 单次运行：`./start.sh --task "总结 docs 的关键点"`
  - 合并文件：`./start.sh --docs 'docs/**/*.md' -f refer-research/openai-codex/README.md`
  - 多轮冲刺：`./start.sh --preset sprint --task "审阅 CLI 并给出 PR 计划"`
  - 仅生成产物：`./start.sh --task "演示" --dry-run`

- 参数速览
  - 来源与组合：`-F/--file-override`、`-f/--file`、`--docs`、`-c/--content`、`--prepend[/-file]`、`--append[/-file]`
  - 循环与上下文：`--preset`、`--repeat-until`、`--max-runs`、`--sleep-seconds`、`--no-carry-context`、`--no-compress-context`、`--context-head`、`--context-grep`
  - 日志：`--log-dir`、`--log-file`、`--tag`、`--flat-logs`、`--echo-instructions[*]`、`--echo-limit`
  - 安全：`--redact`、`--redact-pattern <regex>`
  - 直通：`--sandbox`、`--approvals`、`--profile`、`--full-auto`、`--dangerously-bypass-approvals-and-sandbox`、`--codex-config`、`--codex-arg`

- job.sh（异步）
  - 启动：`./job.sh start --task "审阅 CLI" --dry-run --tag demo --json`
  - 状态：`./job.sh status <job-id> --json`
  - 日志：`./job.sh logs <job-id> --tail 200` 或 `--follow`
  - 停止：`./job.sh stop <job-id>`（或 `--force`）
  - 列表：`./job.sh list --json`

- MCP（TS 实现）
  - 构建：`cd mcp/codex-mcp-server && npm install && npm run build`
  - 初始化 + 列表（stdio）：
    - `printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"demo","version":"0.0.0"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | ./mcp/server.sh`
  - 启动一次运行：
    - `printf '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"codex.start","arguments":{"args":["--task","TS MCP test","--dry-run"],"tag":"mcp-ts"}}}\n' | ./mcp/server.sh`

