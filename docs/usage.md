### 使用指南（start.sh / job.sh / MCP）

- 前置依赖
  - Bash >= 5
  - Node.js >= 18（仅 MCP 服务器需要）

- start.sh 常用
  - 单次运行：`./start.sh --task "总结 docs 的关键点"`
  - 合并文件：`./start.sh --docs 'docs/**/*.md' -f refer-research/openai-codex/README.md`
  - 多轮冲刺：`./start.sh --preset sprint --task "审阅 CLI 并给出 PR 计划"`
  - 仅生成产物：`./start.sh --task "演示" --dry-run`
  - 机器可读输出：在上述任一命令追加 `--json`（输出最终 meta.json 到 STDOUT）

覆盖与追加（Instructions 组合）
- 基底覆盖：
  - `-F/--file-override <p>` 使用指定文件替换默认基底；支持 `-` 表示从 STDIN 读取一次。
  - 若未显式提供，基底按优先级：`~/.codex/instructions.md` > `INSTRUCTIONS` 环境变量（当无其它输入）> STDIN（当无其它输入且有管道输入）> 内置默认文本。
- 叠加与顺序：
  - `-f/--file <path...>` 追加一个或多个文件内容（可多次，保持命令行顺序）。支持：
    - 通配符（含 `**`，已启用 globstar）
    - 目录（递归收集 `*.md|*.markdown`）
    - 列表文件（使用 `@list.txt` 语法，逐行读取路径/通配；支持 `#` 注释）
  - `-c/--content <text>` 追加一段文本（可多次，保持顺序）。
  - `--docs <glob...>` 为常用的“批量文档”简写，等价为一组 `-f`；同样支持通配、目录、`@列表`。
  - `--docs-dir <dir>` 递归添加目录下的 Markdown 文档（`*.md|*.markdown`）。
- 前后模板：
  - `--prepend <txt>` / `--prepend-file <p>` 在最终指令前追加文本/文件。
  - `--append <txt>` / `--append-file <p>` 在最终指令后追加文本/文件。
- STDIN 约束：
  - `-` 仅允许出现一次（在 `-f` 或 `-F` 中择一使用），否则报错。
- 可复盘边界：
  - 所有来源均被包裹为 `<instructions-section type=...>`（base|file|text|prepend-*|append-* 等），快照保存在 `*.instructions.md`。

补丁模式（只输出改动，不改盘）
- 启用方式：`--patch-mode`（自动注入 policy-note，要求模型“仅输出补丁（patch/diff），不执行写命令/不直接改仓库”）。
- 常配合只读与免审批：`--sandbox read-only --codex-config approval_policy=never`（或 `--approval-mode never`）。
- 示例：
  - `./start.sh --task "修复 lint 错误" --patch-mode --sandbox read-only --approval-mode never`
  - MCP：在 `codex.exec` 的 `arguments.args` 中加入 `"--patch-mode"`（必要时同时传 `"--sandbox","read-only","--codex-config","approval_policy=never"`）。

示例（CLI）
- 用 STDIN 覆盖基底并叠加多文件与尾部模板：
  - `cat prompt.md | ./start.sh -F - --docs 'docs/**/*.md' -f refer-research/openai-codex/README.md --append '\n请最终输出 CONTROL: DONE'`
- 直接追加一段文本作为任务：
  - `./start.sh -c "请审阅 README 并给出改进点" --dry-run`

- 参数速览
  - 来源与组合：`-F/--file-override`、`-f/--file`、`--docs`、`-c/--content`、`--prepend[/-file]`、`--append[/-file]`
  - 循环与上下文：`--preset`、`--repeat-until`、`--max-runs`、`--sleep-seconds`、`--no-carry-context`、`--no-compress-context`、`--context-head`、`--context-grep`
  - 日志：`--log-dir`、`--log-file`、`--tag`、`--flat-logs`、`--echo-instructions[*]`、`--echo-limit`
  - 输出：`--json`（将最终 meta.json 打印到 STDOUT）
  - 安全：`--redact`、`--redact-pattern <regex>`
  - 直通：`--sandbox`、`--approval-mode <policy>`（等价 `-c approval_policy=<policy>`）、`--profile`、`--full-auto`、`--dangerously-bypass-approvals-and-sandbox`、`--codex-config`、`--codex-arg`

- 产物与日志
  - 默认写入 `<项目根>/.codex-father/sessions/<job-id>/`（同步/异步一致）
  - 会话内包含：`job.log`、`*.instructions.md`、`*.meta.json`、`*.last.txt`、（异步）`state.json`、聚合 `aggregate.*`

- job.sh（异步）
  - 启动：`./job.sh start --task "审阅 CLI" --dry-run --tag demo --json`
  - 状态：`./job.sh status <job-id> --json [--cwd <dir>]`
  - 日志：`./job.sh logs <job-id> --tail 200 [--cwd <dir>]` 或 `--follow`
  - 停止：`./job.sh stop <job-id> [--cwd <dir>]`（或 `--force`）
  - 列表：`./job.sh list --json [--cwd <dir>]`

- MCP（TS 实现）
  - 构建：`cd mcp/codex-mcp-server && npm install && npm run build`
  - 初始化 + 列表（stdio）：
    - `printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"demo","version":"0.0.0"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | ./mcp/server.sh`
  - 同步执行（可选 `cwd` 指明项目根）：
    - `printf '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"codex.exec","arguments":{"args":["--task","Sync via MCP","--dry-run"],"tag":"mcp-sync","cwd":"$PWD"}}}\n' | ./mcp/server.sh`
  - 启动一次运行（可选 `cwd`）：
    - `printf '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"codex.start","arguments":{"args":["--task","TS MCP test","--dry-run"],"tag":"mcp-ts","cwd":"$PWD"}}}\n' | ./mcp/server.sh`
  - 默认安全：若未在 `arguments.args` 中显式传入，MCP 会注入 `--sandbox workspace-write`（不默认注入 `--approvals` 以兼容不同版本的 Codex CLI）。

在 MCP 中传递指令参数
- 所有 start.sh 选项均可通过 `arguments.args` 传入，例如：
  - 叠加文件：`{"args":["--docs","docs/**/*.md","-f","readme.md"]}`
  - 追加文本：`{"args":["-c","请输出 CONTROL: DONE"]}`
  - 注意：由于 MCP 采用后台/前台子进程执行，不建议使用 STDIN（`-F -`/`-f -`）。请用 `-c` 或落盘到文件再通过 `-f` 传入。

Glob / 目录 / 列表用法示例
- 通配符（含 **）：`./start.sh --docs "docs/**/*.md"`
- 目录递归：`./start.sh --docs-dir docs/technical`
- 列表文件：
  - `cat > docs-list.txt <<'EOF'
    # 每行一个路径或通配
    docs/technical/*.md
    refer-research/openai-codex/README.md
    EOF`
  - `./start.sh --docs @docs-list.txt`

错误与提示增强
- 未知参数时，CLI 会输出“猜你想用”的相近参数（含 `--task`/`--docs`/`--docs-dir` 等）并提示使用 `--help` 查看完整列表。
- 通配符未匹配时，错误信息包含调试块：工作目录、搜索模式、匹配数量与候选列表，并给出“改用具体文件或 --docs-dir”的建议。

任务开始与停止规则
  - 同步（start.sh）
  - 单轮：默认 `MAX_RUNS=1`，执行完成后立即退出，其退出码为 Codex 执行退出码（`--dry-run` 为 0）。
  - 多轮：通过 `--repeat-until <regex>`、`--max-runs <N>`、`--sleep-seconds <S>` 控制迭代；常用预设 `--preset sprint` 等价于“直到检测到 `CONTROL: DONE`”。
  - 控制标记：模型输出中的 `CONTROL: DONE` / `CONTROL: CONTINUE` 会被识别，用于退出分类（写入 `*.meta.json` 与会话内 `aggregate.jsonl`）。
  - 溢出重试：默认开启“上下文溢出自动重试”，可用 `--no-overflow-retry` 关闭或用 `--overflow-retries N` 调整重试次数。
  - 完成前置校验：可选 `--require-change-in <glob>` 与 `--require-git-commit` 强制在满足 `repeat-until` 前校验“有匹配变更且已提交”；未满足时可用 `--auto-commit-on-done` 自动提交后再结束。
- 异步/队列（job.sh）
  - 启动：`job.sh start ...` 立即返回 `jobId`，后台运行 `start.sh`。
  - 状态：`job.sh status <jobId> [--json]` 会解析 `job.log`/`*.meta.json` 推导 `state/exit_code/classification/tokens_used`。
  - 日志：`job.sh logs <jobId> [--tail N] [--follow]`
  - 停止：`job.sh stop <jobId> [--force]`（优先 SIGTERM，`--force` 为 SIGKILL）。
- MCP（同步/异步）
  - 同步：`codex.exec`（返回 `exitCode/logFile/instructionsFile/metaFile/lastMessageFile` 等路径；支持 `cwd`）
  - 异步：`codex.start` / `codex.status` / `codex.logs` / `codex.stop` / `codex.list`（均支持 `cwd`）

安全与审批
- 通过 `--sandbox`、`--approval-mode`（或 `--codex-config approval_policy=...`）、`--profile`、`--full-auto`、`--dangerously-bypass-approvals-and-sandbox`、`--codex-config`、`--codex-arg` 对 Codex CLI 进行透传；高危项默认不启用，请谨慎使用。
