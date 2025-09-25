# codex-command 异步 CLI / MCP 设计方案（不阻塞、可后台运行）

本文档描述如何在仅修改 `codex-command/` 目录的前提下，为 Codex 提供：
- 非阻塞的 CLI 调用：启动后立即返回句柄，后台继续运行。
- 作为 MCP 被 Claude Code 调用：以工具（tools）形式启动/查询/停止任务，不阻塞调用方。
- 可观测性：统一的日志、元数据与快照，便于人读与机读。

不修改 codex-rs，不触碰任何 `CODEX_SANDBOX*` 相关路径。严格遵循本目录 `AGENTS.md` 的“薄封装、仅依赖 Bash/GNU 基本工具、git”的约束。

---

## 目标与约束
- 目标
  - CLI：提供“启动任务 + 查询进度/日志/结果”的非阻塞体验。
  - MCP：以工具形式暴露 start/status/logs/stop/list，立即返回 Job 句柄，后续可查询进度。
  - 后台运行：任务在本机后台执行，不占用前台会话；日志实时写入文件。
  - 可观测：规范化 `state.json`、`.log`、`.rN.*` 快照与元数据。
- 约束
  - 仅在 `codex-command/` 内新增文件与目录；不改动仓库其它模块与数据契约。
  - 不引入复杂运行时或非必要依赖；优先纯 Bash + 核心 GNU 工具（参考 `AGENTS.md`）。
  - 保持 `start.sh` 现有同步行为与产物命名稳定。

---

## 总体思路
在本仓库新增“任务管理器 + 运行目录布局”，将现有同步执行脚本 `start.sh` 封装为后台任务：
- `job.sh`：异步任务管理 CLI，支持 `start/status/logs/stop/list`；后台调用 `start.sh`。
- `.codex-father/sessions/<job-id>/`：每次运行的独立目录，集中保存 PID、状态、日志与快照。
- MCP（可选组件）：提供最小 JSON-RPC/stdio 服务器脚本，工具映射到 `job.sh` 子命令；不阻塞返回。

---

## 目录与产物布局
- `job.sh`：异步任务管理入口（Bash）。
- `.codex-father/sessions/`：运行根目录（首次使用时创建）。
- `.codex-father/sessions/<job-id>/`：单任务目录，包含：
  - `pid`：后台进程 PID。
  - `state.json`：标准化任务状态（见下文）。
  - `job.log`：任务日志（`start.sh` 通过 `--log-file` 指向此处）。
  - `*.rN.instructions.md | *.rN.meta.json | *.rN.last.txt`：按轮次生成的快照与元数据（沿用 `start.sh`）。
  - `aggregate.txt | aggregate.jsonl`：可选汇总，便于一次性归档。

说明：为避免产物分散，`job.sh start` 会强制将 `start.sh` 的日志与聚合文件定向到 `<job-id>` 目录（通过 `--log-file` 与环境变量覆写）。

---

## 与 `start.sh` 的衔接
- 保持 `start.sh` 的输入与产出不变，仅在 `job.sh` 中：
- 生成 `job-id`（如 `cdx-YYYYmmdd_HHMMSS-<tag>`），创建 `.codex-father/sessions/<job-id>/`。
- 追加或覆写参数，使所有产物写入 `.codex-father/sessions/<job-id>/`：
  - `--log-file .codex-father/sessions/<job-id>/job.log` 与 `--flat-logs`
  - 环境变量：
    - `CODEX_LOG_DIR=.codex-father/sessions/<job-id>`（冗余保障）
    - `CODEX_LOG_AGGREGATE=1`
    - `CODEX_LOG_AGGREGATE_FILE=.codex-father/sessions/<job-id>/aggregate.txt`
    - `CODEX_LOG_AGGREGATE_JSONL_FILE=.codex-father/sessions/<job-id>/aggregate.jsonl`
- 后台启动：`setsid nohup ./codex-command/start.sh ... >/dev/null 2>&1 &`；写入 `pid` 与初始 `state.json`，立即返回。

---

## `job.sh` 子命令设计
- `start [start.sh 同参…] [--tag <t>] [--cwd <dir>] [--json]`
  - 行为：创建 `<job-id>` 目录；强制设置日志/聚合位置；后台运行 `start.sh`；保存 `pid/state.json`；非阻塞返回。
  - 返回（默认人类可读；`--json` 为机器可读）：
    - `{ jobId, pid, cwd, logFile, metaGlob, lastMessageGlob, tag }`
- `status <job-id> [--json]`
  - 读取 `pid/state.json` 与磁盘产物：PID 存活 → `state=running`；否则通过 `job.log` 最后一行 `Exit Code:` 与最新 `*.rN.meta.json` 推断 `completed|failed|stopped`、`exitCode`、`classification/tokensUsed`，并回写 `state.json`。
- `logs <job-id> [--tail N] [--follow]`
  - 输出 `job.log` 最近 N 行；`--follow` 便于人工临时查看（MCP 端推荐轮询接口）。
- `stop <job-id> [--force]`
  - `SIGTERM` 优雅停止；`--force` 时 `SIGKILL`；更新 `state.json`。
- `list [--json]`
  - 枚举 `.codex-father/sessions/*/state.json`；输出简表：`{ id,state,createdAt,updatedAt,tag,title? }`。

---

## `state.json` 模型（示例）
```json
{
  "id": "cdx-20240924_120001-mytag",
  "pid": 12345,
  "state": "running",              // running|completed|failed|stopped
  "exit_code": null,                // 完成/失败后填整数
  "classification": null,           // done|continue|context_overflow|...|normal
  "tokens_used": null,
  "cwd": "/path/to/repo",
  "created_at": "2024-09-24T12:00:01Z",
  "updated_at": "2024-09-24T12:00:01Z",
  "tag": "mytag",
  "log_file": ".codex-father/sessions/<job-id>/job.log",
  "meta_file": ".codex-father/sessions/<job-id>/*.rN.meta.json",
  "last_message_file": ".codex-father/sessions/<job-id>/*.rN.last.txt",
  "args": ["--preset","sprint", "--task","..."],
  "title": "<instructions first non-empty line>"
}
```

备注：`classification/tokens_used` 复用 `start.sh` 的 `classify_exit()` 逻辑（从 `*.rN.last.txt` 与 `job.log` 推导）。

---

## 错误处理与清理
- 启动失败：`start` 非零退出并输出错误原因。
- 进程消失但无退出码：`status` 尝试解析 `job.log` 的 `Exit Code: N`；无法解析则判定 `failed` 且 `exitCode=-1`，回写 `state.json`。
- 清理（可选后续）：`job.sh clean [--older-than 7d]` 清理陈旧任务目录。

---

## MCP 设计（轻依赖 Bash 版）
MCP Server 作为可选组件，遵循“薄封装”与“仅依赖 Bash/GNU 工具”的原则：
- 传输：`stdio` 上的 JSON-RPC 2.0（逐行 JSON）。
- 实现：`mcp.sh`（或 `mcp/server.sh`）最小实现，读取一行即处理一条请求；
  - 如系统存在 `jq`，优先使用以提升健壮性；无 `jq` 时退化为简单的行级解析（要求客户端发送一行一个完整 JSON 请求，字段名固定 `id`/`method`/`params`）。
  - 不阻塞：`codex.start` 立即返回 `jobId`；日志流通过轮询接口实现（见下）。

- 工具（Tools）
  - `codex.start(params)` → `jobId, pid, logFile, metaGlob, lastMessageGlob`
  - `codex.status({ jobId })` → `state, exitCode?, classification?, tokensUsed?, lastMessageFile?, meta?`
  - `codex.logs({ jobId, offset?, limit? })` → `chunk, nextOffset`（分页轮询；避免长时间阻塞）
  - `codex.stop({ jobId, force? })` → `{ ok: true }`
  - `codex.list()` → `[{ id, state, createdAt, tag, title? }]`

- 资源与订阅（可选增强）
  - 若需要近实时体验，可在客户端侧轮询 `codex.logs`；
  - 或在服务器端选择性实现 `tail -F job.log` 的后台 watcher，将增量行缓冲到 ring buffer，提供 `codex.logs` 的 `since=<cursor>` 读取；仍保持请求/响应不阻塞。

- 安全与权限
  - 完全复用 `start.sh` 的参数与 codex CLI 的 sandbox/approval 策略；MCP 端不增加额外权限。

---

## 使用示例
- CLI 非阻塞：
  - 启动：`./job.sh start --preset sprint --docs 'docs/**/*.md' --task '审阅 CLI 并给出 PR 计划' --tag sprint-1 --json`
  - 查询：`./job.sh status <job-id> --json`
  - 日志：`./job.sh logs <job-id> --tail 200`
  - 停止：`./job.sh stop <job-id>`
- MCP：
  - `codex.start(args)` → 即刻返回 `jobId`
  - 轮询 `codex.status(jobId)` 或 `codex.logs(jobId, offset, limit)` 获取进度

---

## 分阶段落地
1) Phase 1：CLI 异步
- 新增 `job.sh` 与 `.codex-father/sessions/` 布局；保证 start/status/logs/stop/list 可用。
- 更新 `readme.md`：新增“异步模式”章节与最小验证步骤。

2) Phase 2：MCP
- 新增 `mcp.sh`（或 `mcp/server.sh`）最小 JSON-RPC 实现，映射到 `job.sh`。
- 文档：`codex-command/mcp/README.md` 描述 Claude Code 端如何配置。

3) Phase 3：体验优化
- （可选）事件精炼与更友好 `status` 摘要；
- （可选）任务超时、自动清理与保留策略。

---

## 验收与回归
- `start.sh --dry-run` 仍然按预期工作；
- 异步模式下：产物集中落于 `.codex-father/sessions/<job-id>/`；`state.json` 与 `job.log` 一致。

---

如需我继续落地 Phase 1 的脚本实现，请在本目录下创建 `job.sh` 的任务。本文仅为设计说明，不包含实现代码改动。
