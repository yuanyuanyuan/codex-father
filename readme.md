# codex-command

面向 Codex CLI 的“指令编排与运行”小工具。`start.sh` 支持将多来源文本/文件组合为规范化指令片段，按需开启多轮迭代执行，并在本地产生日志、指令快照与运行元数据，便于复盘与审计。默认提供脱敏与直通 Codex CLI 的安全开关。

> 目录结构：
>
> - `start.sh`：主入口脚本（Bash）
> - `lib/common.sh`：公共函数（JSON 转义、分段组合、上下文压缩、退出分类等）
> - `lib/presets.sh`：内置预设（`sprint`/`analysis`/`secure`/`fast`）
> - `logs/`：默认日志根目录（按日期与标签分层）
> - `config.yaml`、`instructions.md`：可自用的示例/占位（非强制）

## 快速开始

- 单次运行（最小示例）

```bash
./codex-command/start.sh --task "请总结 docs 目录中的关键点"
```

- 叠加多个文档与内联文本

```bash
./codex-command/start.sh \
  --docs 'docs/**/*.md' \
  -f keywords/registry.json schemas/*.json \
  -c "仅输出中文要点" -c "给出 5 条行动建议"
```

- 使用预设（多轮冲刺，直到出现 `CONTROL: DONE`）

```bash
./codex-command/start.sh \
  --preset sprint \
  --docs 'docs/**/*.md' \
  --task "审阅现有 CLI 与数据契约，给出修订 PR 计划"
```

- 从 STDIN 提供基底（`-` 只能出现一次）

```bash
cat brief.md | ./codex-command/start.sh -F - --task "根据上述简报生成实施方案"
```

- 仅生成日志与指令（不实际调用 Codex）

```bash
./codex-command/start.sh --task "演示" --dry-run
```

## 主要功能

- 指令组合：
  - 基底来源：内置默认、`~/.codex/instructions.md`、`-F/--file-override <path|- >`、`INSTRUCTIONS` 环境变量、STDIN。
  - 叠加来源：`-f/--file`（可多次，支持通配符与多值，且可用 `--docs` 简写）、`-c/--content`（可多次）。
  - 前后模板：`--prepend/--append` 与 `--prepend-file/--append-file`。
  - 所有片段均包裹为 `<instructions-section type=...>`，便于复盘与解析。
- 迭代执行：
  - 核心参数：`--repeat-until <regex>`、`--max-runs <N>`、`--sleep-seconds <N>`、`--no-carry-context`、`--no-compress-context`、`--context-head <N>`、`--context-grep <re>`。
  - 预设：
    - `sprint`：多轮直至 `CONTROL: DONE`，默认 `--full-auto` 与较高步数/时限。
    - `analysis`：单轮、日志更精简（适合快速分析）。
    - `secure`：默认启用脱敏。
    - `fast`：缩短 timebox 与步数上限。
- 日志与产物：
  - 日志：`codex-command/logs/.../codex-YYYYmmdd_HHMMSS[-tag].log`
  - 指令快照：同名 `*.instructions.md`，多轮还会生成 `*.r<N>.instructions.md`
  - 最后一条消息：`*.r<N>.last.txt`
  - 元数据：`*.meta.json` 与每轮 `*.r<N>.meta.json`
  - 根部汇总：`codex_run_recording.txt` 与 `codex_run_recording.jsonl`
- 脱敏：
  - `--redact` 启用；`--redact-pattern <regex>` 追加自定义规则。
  - 默认覆盖常见令牌与密钥格式（见 `start.sh` 的 `REDACT_PATTERNS_DEFAULT`）。
- 直通 Codex CLI：
  - `--sandbox`、`--approvals`、`--profile`、`--full-auto`、`--dangerously-bypass-approvals-and-sandbox`、`--codex-config key=value`、`--codex-arg "..."`。

## 常用参数速览

- 来源与组合：`-F/--file-override`、`-f/--file`、`--docs`、`-c/--content`、`--prepend[/-file]`、`--append[/-file]`
- 运行与循环：`--preset`、`--repeat-until`、`--max-runs`、`--sleep-seconds`、`--no-carry-context`、`--no-compress-context`、`--context-head`、`--context-grep`
- 日志与回显：`--log-dir`、`--log-file`、`--tag`、`--log-subdirs/--flat-logs`、`--echo-instructions/--no-echo-instructions`、`--echo-limit`
- 合规与完成判定：`--require-change-in <glob>`（可多次）、`--require-git-commit`、`--auto-commit-on-done`、`--auto-commit-message`
- 安全与脱敏：`--redact`、`--redact-pattern <regex>`
- 直通参数：`--sandbox`、`--approvals`、`--profile`、`--full-auto`、`--dangerously-bypass-approvals-and-sandbox`、`--codex-config`、`--codex-arg`
- 其他：`--dry-run`、`-h/--help`

> 运行 `./codex-command/start.sh --help` 可查看完整帮助与参数说明。

## 输出与退出

- 所有运行会在日志末尾打印：日志路径、指令文件、元数据、以及根部汇总位置。
- 元数据文件包含：`id`、`timestamp`、`tag`、`classification`（分类）、`control_flag`（如 `DONE`/`CONTINUE`）、`reason`、`tokens_used`、`iteration`、`log_file` 等。
- 分类由 `classify_exit()` 给出，常见值：`done|continue|context_overflow|approval_required|sandbox_denied|network_error|auth_error|rate_limited|tool_error|error|normal`。

## 注意事项

- STDIN 仅允许出现一次（用于 `-f -` 或 `-F -`）；多处请求将报错退出。
- 默认使用 `codex-command/logs`，建议结合 `--tag` 便于检索归档。
- `--dangerously-bypass-approvals-and-sandbox` 可能绕过沙箱与审批策略，请仅在可信环境下使用，并在审慎评估后启用。
- 如需调整默认行为（如日志目录、回显行数上限），可通过环境变量覆写：
  - `CODEX_LOG_DIR`、`CODEX_LOG_TAG`、`CODEX_LOG_SUBDIRS`、`CODEX_ECHO_INSTRUCTIONS`、`CODEX_ECHO_INSTRUCTIONS_LIMIT`、`CODEX_LOG_AGGREGATE[_JSONL_FILE]` 等。

## 异步/集成设计（不阻塞、后台运行）

- 设计文档：请参阅 `codex-command/DESIGN-async-mcp.md`。
- 概要：在不修改 codex-rs 的前提下，新增 `job.sh` 提供 `start/status/logs/stop/list`，将 `start.sh` 封装为后台任务；产物集中在 `codex-command/runs/<job-id>/`；可选提供轻量 MCP（JSON-RPC/stdio）以供 Claude Code 调用，调用即刻返回 `jobId`，后续通过 `status/logs` 轮询进度。

### 异步模式使用（job.sh）

- 启动（非阻塞，立即返回 jobId）：

```bash
./codex-command/job.sh start \
  --preset sprint \
  --docs 'docs/**/*.md' \
  --task '审阅 CLI 并给出 PR 计划' \
  --tag sprint-1 --json
```

- 查询状态：

```bash
./codex-command/job.sh status <job-id> --json
```

- 查看日志（最近 200 行或实时跟随）：

```bash
./codex-command/job.sh logs <job-id> --tail 200
./codex-command/job.sh logs <job-id> --follow
```

- 停止任务：

```bash
./codex-command/job.sh stop <job-id>
# 或强制： ./codex-command/job.sh stop <job-id> --force
```

- 列出任务：

```bash
./codex-command/job.sh list --json
```

### MCP（JSON-RPC/stdio）

- Bash 入口：`mcp/server.sh`
- 依赖：`bash` + `jq`（解析请求所需）
- 工具（tools）：`codex.start`、`codex.status`、`codex.logs`、`codex.stop`、`codex.list`
- 使用：参考 `codex-command/mcp/README.md` 示例（通过 `tools/list` 和 `tools/call` 调用）。

#### TypeScript 版 MCP 服务器（基于 @modelcontextprotocol/sdk）

- 路径：`mcp/codex-mcp-server`
- 用法：
  - 开发运行：在该目录执行 `npm install && npm run dev`
  - 构建运行：`npm run build && node dist/index.js`
  - 发布后：`npx codex-father-mcp-server`
- VS Code 配置示例（与 deepwiki 联用，便于随时查询 typescript-sdk 文档）：
  ```json
  {
    "servers": {
      "codex-father": { "command": "node", "args": ["/path/to/dist/index.js"], "type": "stdio" },
      "deepwiki": { "url": "https://mcp.deepwiki.com/sse", "type": "http" }
    }
  }
  ```

## E2E 测试

- 运行：

```bash
bash codex-command/tests/e2e.sh
```

- 覆盖范围：
  - job.sh：start/status/logs（使用 --dry-run，避免真实调用 codex）
  - MCP：tools/list、codex.start（dry-run）、codex.status、codex.logs（行模式）
  - 断言：产物落盘、状态 completed/failed、日志包含 Exit Code


## 与仓库其它模块的关系

- 本目录为 Codex CLI 的辅助工具，不直接参与“关键词检索 + 数据插件 + 外部 LLM 推理”的数据契约与 CLI 输出路径。
- 不应修改 `keywords/`、`schemas/`、`packages/spec-cli/` 的契约与行为；如确需联动，请先在议题中讨论并在 PR 详述影响面。

## 许可与贡献

- 贡献前请阅读根部 `AGENTS.md` 与本目录 `AGENTS.md`；遵循最小变更、默认安全与可复盘原则。
- 提交变更请附：代码 + 文档（本文件或 `usage()`）+ 最小验证步骤；建议附上一次 `--dry-run` 的日志片段以便审查。
