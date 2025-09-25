# Codex Father 工具集（精简版）

围绕 Codex CLI 的指令编排与异步运行工具，配套标准 MCP 服务器（TypeScript 实现）。本版本已清理不必要文件，仅保留核心能力、文档与 my-stark-scripts。

**核心模块**
- `start.sh`：组合多源文本/文件为规范化指令，执行一次或按预设多轮迭代
- `job.sh`：异步任务管理（start/status/logs/stop/list）
- `mcp/server.sh`：MCP 服务器入口（Node >= 18，TypeScript 实现）
- `mcp/codex-mcp-server`：基于 `@modelcontextprotocol/sdk` 的标准 MCP 服务器
- `lib/`：通用函数库
- `docs/`：文档（未清理范围）
- `my-stark-scripts/`：Git subtree 管理与实用脚本（未清理范围）
- `refer-research/`：外部参考仓库（以 subtree 形式纳入）

**系统要求**
- Bash >= 5（运行脚本）
- Node.js >= 18（运行 MCP 服务器）
- Git（subtree 维护）

## 快速开始

- 单次运行（最小示例）
  - `./start.sh --task "总结 docs 的关键点"`
- 合并多个文件与文本
  - `./start.sh --docs 'docs/**/*.md' -f refer-research/openai-codex/README.md -c "仅输出中文要点"`
  - 目录递归：`./start.sh --docs-dir docs/technical`
  - 列表文件：`./start.sh --docs @docs-list.txt`
- 多轮冲刺（直到 DONE）
  - `./start.sh --preset sprint --task "审阅 CLI 并给出 PR 计划"`
- 仅生成日志与指令（不实际调用 Codex）
  - `./start.sh --task "演示" --dry-run`

更多参数与示例见 `docs/usage.md`。

## 主要功能

- 指令组合
  - 基底：默认文件、`~/.codex/instructions.md`、`-F/--file-override`、`INSTRUCTIONS` 环境变量、STDIN（`-` 仅可出现一次）
  - 叠加：`-f/--file`（多次、支持通配/目录/@列表）、`--docs` 简写（等价一组 -f）、`--docs-dir`、`-c/--content`（多次）
  - 模板：`--prepend*` / `--append*`
  - 统一包裹 `<instructions-section type=...>`，便于复盘/解析
- 迭代执行
  - `--repeat-until`、`--max-runs`、`--sleep-seconds`、`--no-carry-context`、`--no-compress-context`、`--context-head`、`--context-grep`
  - 预设：`sprint` / `analysis` / `secure` / `fast`
- 产物与日志
  - `.codex-father/sessions/<job-id>/` 下产出：`job.log`、`*.instructions.md`、`*.meta.json`、（异步）`state.json` 等
  - 会话内聚合：`aggregate.txt`、`aggregate.jsonl`
- 脱敏与直通
  - `--redact`、`--redact-pattern <regex>`
  - 透传 Codex：`--sandbox`、`--approvals`、`--profile`、`--full-auto`、`--dangerously-bypass-approvals-and-sandbox`、`--codex-config`、`--codex-arg`

## MCP 服务器（标准 SDK 实现）

- 入口：`mcp/server.sh`（将启动 `mcp/codex-mcp-server/dist/index.js`）
- 工具（tools）：`codex.exec`（同步）、`codex.start`、`codex.status`、`codex.logs`、`codex.stop`、`codex.list`
- 详细文档：`readme.mcp.md`
 - 默认安全：未显式传入时，自动注入 `--sandbox workspace-write --approvals on-request`（可在 `arguments.args` 覆盖）。

快速使用（stdio）：
- 构建：`cd mcp/codex-mcp-server && npm install && npm run build`
- 初始化 + 列表：
  - `printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"demo","version":"0.0.1"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | ./mcp/server.sh`
- 同步执行：
  - `printf '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"codex.exec","arguments":{"args":["--task","Sync via MCP","--dry-run"],"tag":"mcp-sync"}}}\n' | ./mcp/server.sh`
- 异步执行：
  - `printf '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"codex.start","arguments":{"args":["--task","Async via MCP","--dry-run"],"tag":"mcp-async"}}}\n' | ./mcp/server.sh`

补丁模式（只输出改动，不改盘）
- 加参：`--patch-mode`（自动注入 policy-note，提示模型仅输出补丁）
- 常配：`--sandbox read-only --approvals never`
- 最小交互（stdio）：
  - `printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"demo","version":"0.0.0"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | ./mcp/server.sh`

构建运行（首次）
- `cd mcp/codex-mcp-server && npm install && npm run build`

## 异步模式（job.sh）

- 启动：`./job.sh start --task "审阅 CLI" --dry-run --tag demo --json`
- 状态：`./job.sh status <job-id> --json`
- 日志：`./job.sh logs <job-id> --tail 200` 或 `--follow`
- 停止：`./job.sh stop <job-id>`（或 `--force`）
- 列表：`./job.sh list --json`

## 注意事项

- STDIN 仅允许出现一次（用于 `-f -` 或 `-F -`）
- `--dangerously-bypass-approvals-and-sandbox` 风险较高，请慎用
- 可用环境变量调优日志与回显行为（详见 `docs/usage.md`）

## 设计与架构

- 设计文档：`docs/DESIGN-async-mcp.md`
- 核心思路：`job.sh` 将 `start.sh` 以“后台任务”封装，产物集中落盘；MCP 以标准 SDK 暴露工具，调用即刻返回 `jobId`，后续通过 `status/logs` 查询。

## refer-research 维护（Git Subtree）

- 添加：`bash my-stark-scripts/add-subtree.sh refer-research/<dir> <repo-url> [branch]`
- 更新：`bash my-stark-scripts/update-subtree.sh refer-research/<dir> <repo-url> [branch]`
- 已纳入：`openai-codex`、`openai-codex-mcp`、`codexMCP`、`codex-as-mcp`、`open-codex`

## 测试

- TS MCP 端到端：`bash tests/mcp_ts_e2e.sh`
  - 覆盖 initialize / tools/list / codex.start / codex.status / codex.logs
- start.sh 增强相关自检：`make smoke`
  - 覆盖未知参数建议、glob 成功/失败、目录与 @列表支持

## 发布与分发

- GitHub Packages（本仓库默认）：
  - 包名：`@yuanyuanyuan/codex-father-mcp-server`
  - 安装（需配置 `~/.npmrc`）：
    - `@yuanyuanyuan:registry=https://npm.pkg.github.com`
    - `//npm.pkg.github.com/:_authToken=<YOUR_GITHUB_TOKEN>`
    - `npm i -g @yuanyuanyuan/codex-father-mcp-server` 或 `npx @yuanyuanyuan/codex-father-mcp-server`
- npmjs（可选）：仓库配置了语义化发版工作流，设置 `NPM_TOKEN` 后自动同步。
- 详见：`docs/publish.md`

## 贡献与许可

- 贡献前请阅读根部 `AGENTS.md`；遵循最小变更、默认安全与可复盘原则
- PR 请附带：代码 + 文档 + 最小可复现步骤
