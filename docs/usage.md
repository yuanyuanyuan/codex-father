### 使用指南（start.sh / job.sh / MCP）

- 前置依赖
  - Bash >= 5
  - Node.js >= 18（仅 MCP 服务器需要）

- start.sh 常用
  - 单次运行：`./start.sh --task "总结 docs 的关键点"`
  - 合并文件：`./start.sh --docs 'docs/**/*.md' -f refer-research/openai-codex/README.md`
  - 多轮冲刺：`./start.sh --preset sprint --task "审阅 CLI 并给出 PR 计划"`
  - 仅生成产物：`./start.sh --task "演示" --dry-run`

覆盖与追加（Instructions 组合）
- 基底覆盖：
  - `-F/--file-override <p>` 使用指定文件替换默认基底；支持 `-` 表示从 STDIN 读取一次。
  - 若未显式提供，基底按优先级：`~/.codex/instructions.md` > `INSTRUCTIONS` 环境变量（当无其它输入）> STDIN（当无其它输入且有管道输入）> 内置默认文本。
- 叠加与顺序：
  - `-f/--file <glob...>` 追加一个或多个文件内容（可多次，保持命令行顺序；支持通配符）。
  - `-c/--content <text>` 追加一段文本（可多次，保持顺序）。
  - `--docs <glob...>` 为常用的“批量文档”简写，等价为一组 `-f`。
- 前后模板：
  - `--prepend <txt>` / `--prepend-file <p>` 在最终指令前追加文本/文件。
  - `--append <txt>` / `--append-file <p>` 在最终指令后追加文本/文件。
- STDIN 约束：
  - `-` 仅允许出现一次（在 `-f` 或 `-F` 中择一使用），否则报错。
- 可复盘边界：
  - 所有来源均被包裹为 `<instructions-section type=...>`（base|file|text|prepend-*|append-* 等），快照保存在 `*.instructions.md`。

示例（CLI）
- 用 STDIN 覆盖基底并叠加多文件与尾部模板：
  - `cat prompt.md | ./start.sh -F - --docs 'docs/**/*.md' -f refer-research/openai-codex/README.md --append '\n请最终输出 CONTROL: DONE'`
- 直接追加一段文本作为任务：
  - `./start.sh -c "请审阅 README 并给出改进点" --dry-run`

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
  - 同步执行：
    - `printf '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"codex.exec","arguments":{"args":["--task","Sync via MCP","--dry-run"],"tag":"mcp-sync"}}}\n' | ./mcp/server.sh`
  - 启动一次运行：
    - `printf '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"codex.start","arguments":{"args":["--task","TS MCP test","--dry-run"],"tag":"mcp-ts"}}}\n' | ./mcp/server.sh`

在 MCP 中传递指令参数
- 所有 start.sh 选项均可通过 `arguments.args` 传入，例如：
  - 叠加文件：`{"args":["--docs","docs/**/*.md","-f","readme.md"]}`
  - 追加文本：`{"args":["-c","请输出 CONTROL: DONE"]}`
  - 注意：由于 MCP 采用后台/前台子进程执行，不建议使用 STDIN（`-F -`/`-f -`）。请用 `-c` 或落盘到文件再通过 `-f` 传入。

任务开始与停止规则
- 同步（start.sh）
  - 单轮：默认 `MAX_RUNS=1`，执行完成后立即退出，其退出码为 Codex 执行退出码（`--dry-run` 为 0）。
  - 多轮：通过 `--repeat-until <regex>`、`--max-runs <N>`、`--sleep-seconds <S>` 控制迭代；常用预设 `--preset sprint` 等价于“直到检测到 `CONTROL: DONE`”。
  - 控制标记：模型输出中的 `CONTROL: DONE` / `CONTROL: CONTINUE` 会被识别，用于退出分类（写入 `*.meta.json` 与根部 `*.jsonl`）。
  - 溢出重试：默认开启“上下文溢出自动重试”，可用 `--no-overflow-retry` 关闭或用 `--overflow-retries N` 调整重试次数。
  - 完成前置校验：可选 `--require-change-in <glob>` 与 `--require-git-commit` 强制在满足 `repeat-until` 前校验“有匹配变更且已提交”；未满足时可用 `--auto-commit-on-done` 自动提交后再结束。
- 异步/队列（job.sh）
  - 启动：`job.sh start ...` 立即返回 `jobId`，后台运行 `start.sh`。
  - 状态：`job.sh status <jobId> [--json]` 会解析 `job.log`/`*.meta.json` 推导 `state/exit_code/classification/tokens_used`。
  - 日志：`job.sh logs <jobId> [--tail N] [--follow]`
  - 停止：`job.sh stop <jobId> [--force]`（优先 SIGTERM，`--force` 为 SIGKILL）。
- MCP（同步/异步）
  - 同步：`codex.exec`（返回 `exitCode/logFile/instructionsFile/metaFile/lastMessageFile` 等路径）
  - 异步：`codex.start` / `codex.status` / `codex.logs` / `codex.stop` / `codex.list`

安全与审批
- 通过 `--sandbox`、`--approvals`、`--profile`、`--full-auto`、`--dangerously-bypass-approvals-and-sandbox`、`--codex-config`、`--codex-arg` 对 Codex CLI 进行透传；高危项默认不启用，请谨慎使用。
