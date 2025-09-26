### 使用指南（start.sh / job.sh / MCP）

- 前置依赖
  - Bash >= 5
  - Node.js >= 18（仅 MCP 服务器需要）

- start.sh 常用
  - 单次运行：`./start.sh --task "总结 docs 的关键点"`
  - 合并文件：`./start.sh --docs 'docs/**/*.md' -f refer-research/openai-codex/README.md`
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
- 常配合只读与免审批：`--sandbox read-only --ask-for-approval never`。
- 示例：
  - `./start.sh --task "修复 lint 错误" --patch-mode --sandbox read-only --approval-mode never`
  - MCP：在 `codex.exec` 的 `arguments.args` 中加入 `"--patch-mode"`（必要时同时传 `"--sandbox","read-only","--codex-config","approval_policy=never"`）。

示例（CLI）
- 用 STDIN 覆盖基底并叠加多文件与尾部模板：
  - `cat prompt.md | ./start.sh -F - --docs 'docs/**/*.md' -f refer-research/openai-codex/README.md --append '\n请给出最终要点'`
- 直接追加一段文本作为任务：
  - `./start.sh -c "请审阅 README 并给出改进点" --dry-run`

- 参数速览
  - 来源与组合：`-F/--file-override`、`-f/--file`、`--docs`、`-c/--content`、`--prepend[/-file]`、`--append[/-file]`
  - 上下文与预设：`--preset`、`--no-carry-context`、`--no-compress-context`、`--context-head`、`--context-grep`
  - 日志：`--log-dir`、`--log-file`、`--tag`、`--flat-logs`、`--echo-instructions[*]`、`--echo-limit`
  - 输出：`--json`（将最终 meta.json 打印到 STDOUT）
  - 安全：`--redact`、`--redact-pattern <regex>`
  - 直通：`--sandbox`、`--ask-for-approval <policy>`、`--profile`、`--full-auto`、`--dangerously-bypass-approvals-and-sandbox`、`--codex-config`、`--codex-arg`

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
  - 默认安全：若未在 `arguments.args` 中显式传入，MCP 会注入 `--sandbox workspace-write`（不默认注入危险绕过；网络默认关闭）。

MCP 全自动（不询问）用法
- 便捷字段（在 `tools/call` 的 `arguments` 内）：
  - `approvalPolicy`: `untrusted|on-failure|on-request|never`（相当于 `--approval-mode`）
  - `sandbox`: `read-only|workspace-write|danger-full-access`（相当于 `--sandbox`）
  - `network`: `true|false`（在 `workspace-write` 模式下启用网络，等价 `--codex-config 'sandbox_workspace_write.network_access=true'`）
  - `fullAuto`: `true|false`（等价 `--full-auto`）
  - `dangerouslyBypass`: `true|false`（等价 `--dangerously-bypass-approvals-and-sandbox`，会显式设置 `--sandbox danger-full-access`）
  - `profile`: `string`（等价 `--profile <name>`）
  - `codexConfig`: `object`（将每个 `k: v` 映射为 `--codex-config 'k=v'`；字符串会自动加 TOML 引号）

- 同步 exec（推荐：工作区写 + 网络 + 从不询问）
  - `printf '{
      "jsonrpc":"2.0","id":300,"method":"tools/call",
      "params":{
        "name":"codex.exec",
        "arguments":{
          "cwd":"'"$PWD"'",
          "tag":"mcp-fullauto",
          "approvalPolicy":"never",
          "sandbox":"workspace-write",
          "network":true,
          "fullAuto":true,
          "args":["--task","一次性完成任务示例"]
        }
      }
    }\n' | ./mcp/server.sh`

- 完全放开（容器或受控环境下使用）
  - `printf '{
      "jsonrpc":"2.0","id":301,"method":"tools/call",
      "params":{
        "name":"codex.exec",
        "arguments":{
          "cwd":"'"$PWD"'",
          "tag":"mcp-yolo",
          "dangerouslyBypass":true,
          "args":["--task","危险示例，仅在可信环境使用"]
        }
      }
    }\n' | ./mcp/server.sh`

- 只读补丁模式（产出 diff，不改盘）
  - `printf '{
      "jsonrpc":"2.0","id":302,"method":"tools/call",
      "params":{
        "name":"codex.exec",
        "arguments":{
          "cwd":"'"$PWD"'",
          "tag":"mcp-patch",
          "approvalPolicy":"never",
          "sandbox":"read-only",
          "args":["--task","修复 lint 错误","--patch-mode"]
        }
      }
    }\n' | ./mcp/server.sh`

提示与排查
- MCP 客户端（如 MCP Inspector）默认超时时间较短，长任务请将请求/总超时调大到 600000ms（10 分钟）。
- 日志若出现 `approval_required/sandbox_denied`，这是策略阻止的提示，并非弹窗等待；如需自动化继续，请放宽 `sandbox` 或开启 `network`/`dangerouslyBypass`。

在 MCP 中传递指令参数
- 所有 start.sh 选项均可通过 `arguments.args` 传入，例如：
  - 叠加文件：`{"args":["--docs","docs/**/*.md","-f","readme.md"]}`
  - 追加文本：`{"args":["-c","请给出最终要点"]}`
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
  - 单轮：默认执行一次后退出，其退出码为 Codex 执行退出码（`--dry-run` 为 0）。`--preset sprint` 为单轮低摩擦推进（自动连续执行、合理时限与步数上限）。
  - 溢出重试：默认开启“上下文溢出自动重试”，可用 `--no-overflow-retry` 关闭或用 `--overflow-retries N` 调整重试次数。
  - 完成前置校验：可选 `--require-change-in <glob>` 与 `--require-git-commit` 在结束前校验“有匹配变更且已提交”；未满足时可用 `--auto-commit-on-done` 自动提交后再结束。
- 异步/队列（job.sh）
  - 启动：`job.sh start ...` 立即返回 `jobId`，后台运行 `start.sh`。
  - 状态：`job.sh status <jobId> [--json]` 会解析 `job.log`/`*.meta.json` 推导 `state/exit_code/classification/tokens_used`。
  - 日志：`job.sh logs <jobId> [--tail N] [--follow]`
  - 停止：`job.sh stop <jobId> [--force]`（优先 SIGTERM，`--force` 为 SIGKILL）。
- MCP（同步/异步）
  - 同步：`codex.exec`（返回 `exitCode/logFile/instructionsFile/metaFile/lastMessageFile` 等路径；支持 `cwd`）
  - 异步：`codex.start` / `codex.status` / `codex.logs` / `codex.stop` / `codex.list`（均支持 `cwd`）

安全与审批
- 推荐使用：`--sandbox` 与 `--ask-for-approval` 组合；`--full-auto` 等价于 `--sandbox workspace-write` + `--ask-for-approval on-failure`。
- YOLO：`--dangerously-bypass-approvals-and-sandbox`（不推荐），与 `--ask-for-approval`、`--full-auto` 互斥（脚本内会前置阻断）。
- 网络开关：`workspace-write` 默认禁网；如需启用网络，使用 `--codex-config 'sandbox_workspace_write.network_access=true'`，或在配置文件 `[sandbox_workspace_write] network_access = true`。
