# 阶段一需求文档：非交互模式修复与对齐（CLI/MCP）

## 背景与目标
- 背景：目前项目已提供 `start.sh`（同步/迭代）、`job.sh`（异步队列）与 TS MCP 服务器，但“非交互模式（approval=never）”在多种组合（含容器 YOLO）下需要更清晰与一致的行为，与 docs/codex-non-interactive.md 对齐。
- 目标：
  - 基于 `docs/codex-non-interactive.md` 的三类模式（只读、工作区可写、容器全权限）校准 CLI/MCP 行为与默认值。
  - 明确并实现对于“never + danger-full-access”的策略：默认安全降级；容器可通过环境变量开启 YOLO（危险）或改用 on-request。
  - 默认安全（MCP 注入 `--sandbox workspace-write`），网络默认关闭；可显式开启。
  - 完整日志与 meta 文件，机器可读（--json），并补充测试用例覆盖。

## 范围（In‑Scope）
- CLI：参数校验、规范化与行为（`--ask-for-approval`、`--sandbox`、`--dangerously-bypass-approvals-and-sandbox`、`--patch-mode` 等）。
- MCP：工具参数透传与默认安全注入；network 与 YOLO 注入逻辑；同步执行 `codex.exec` 与后台 `codex.start` 的产物路径。
- 文档：使用说明与非交互模式指南的补充说明（容器/DevContainer）。
- 测试：单元、smoke、MCP E2E 的覆盖与补强。

## 非目标（Out‑of‑Scope）
- Git 分支/PR 自动化（阶段二）。
- DevContainer/Docker 改造与集成测试（阶段三）。

## 需求细项
- CLI 行为
  - 支持并验证以下组合：
    - 只读浏览：`--sandbox read-only --ask-for-approval never`
    - 工作区可写（默认禁网）：`--sandbox workspace-write --ask-for-approval never`
    - 容器全权限：在 `ALLOW_DFA_WITH_NEVER=1` 下允许 `never + danger-full-access` 并自动注入 `--dangerously-bypass-approvals-and-sandbox`；否则默认降级到 `workspace-write`（或报错，见实现策略）。
  - 冲突检测：`--dangerously-bypass-approvals-and-sandbox` 与 `--ask-for-approval|--full-auto` 互斥，报错并退出码 2。
  - `--patch-mode`：在只读/never 组合下应可用，不写盘，仅输出补丁；日志与 meta 正常。
  - JSON 输出：`--json` 输出最终 meta.json 内容到 STDOUT，包含 `exit_code/log_file/instructions_file` 等字段。
  - TypeScript CLI 同步提供 `task` 与 `config` 命令：
    - `task`：Create/List/Status/Cancel/Retry/Logs/Stats，写入 `.codex-father/queue/`。
    - `config`：Init/Get/Set/List/Validate，写入 `.codex-father/config/config.json` 并支持环境隔离。

- MCP 行为
  - 默认注入 `--sandbox workspace-write`（若未显式传入也未 YOLO）；`network=true` 时注入 `--codex-config sandbox_workspace_write.network_access=true`。
  - `dangerouslyBypass=true` 时注入 `--dangerously-bypass-approvals-and-sandbox` 并补上 `--sandbox danger-full-access`。
  - `approvalPolicy` 透传为 `--ask-for-approval <policy>`（YOLO 生效时不强制注入 approval）。
  - `codex.exec` 输出：`{ runId, exitCode, logFile, instructionsFile, metaFile, lastMessageFile }`。

- 日志与产物
  - 产物路径稳定且与 `docs/usage.md` 描述一致：`.codex-father/sessions/<job-id>/` 内生成 `job.log`、`*.instructions.md`、`*.meta.json`、`*.last.txt`。
  - 在 `--json` 模式下，stdout 仅输出 meta JSON；日志中包含“Begin/End Codex Output”“Exit Code: N”。

- 文档
  - 补充 `docs/codex-non-interactive.md` 与 `docs/usage.md` 的“容器 YOLO 与 never”说明、MCP 默认注入、network 开关示例。

## 验收标准
- 命令样例（本地）：
  - `./start.sh --task '只读' --sandbox read-only --ask-for-approval never --dry-run --json` → 退出码 0；log 含 Exit Code；meta JSON 合法。
  - `./start.sh --task '写盘' --sandbox workspace-write --ask-for-approval never --dry-run --json` → 同上。
  - `ALLOW_DFA_WITH_NEVER=1 ./start.sh --task '容器全权' --sandbox danger-full-access --ask-for-approval never --dry-run` → 自动加入 YOLO；退出码 0；日志包含 bypass 与 `--sandbox danger-full-access`。
  - 冲突：`./start.sh --task x --dangerously-bypass-approvals-and-sandbox --ask-for-approval on-request` → 退出码 2；错误信息包含两个标志名。
- MCP（stdio 流）：
  - `tests/mcp_ts_e2e.sh` 通过：initialize、tools/list、codex.exec(dry-run)、codex.start/status/logs。
  - `tests/mcp_injection_bypass_e2e.sh` 通过：确认 YOLO 注入与 `--sandbox danger-full-access`。
- 现有 smoke 单测：
  - `tests/smoke_start_args_forwarding.sh`、`tests/smoke_start_conflicts.sh`、`tests/smoke_double_dash_passthrough.sh` 通过。

## 影响范围（代码与文件）
- start.sh（参数解析、冲突校验、`normalize_sandbox_and_approvals()`）：start.sh:274, start.sh:298, start.sh:536
- lib/common.sh（分类/上下文压缩/compose）：lib/common.sh:1
- mcp/codex-mcp-server/src/index.ts（默认注入逻辑）：mcp/codex-mcp-server/src/index.ts:1
- docs：`docs/codex-non-interactive.md`、`docs/usage.md`
- tests：`tests/mcp_ts_e2e.sh`、`tests/mcp_injection_bypass_e2e.sh`、smoke/unit-codex 覆盖

## 里程碑与交付
- D1：行为核对与测试补强（smoke/MCP E2E）；
- D2：文档更新；
- 完成标识：上述验收命令与测试全部通过，文档合并。

## 风险与缓解
- 容器/宿主沙箱差异导致 YOLO 误用：通过文档强调容器内使用 YOLO；默认降级保护。
- MCP 客户端超时：文档建议延长超时时间（600s）。
