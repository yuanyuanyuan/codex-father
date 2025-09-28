# 阶段一设计文档：非交互模式修复与对齐（CLI/MCP）

## 概述

目标是将 CLI（start.sh/job.sh）与 MCP（TS 服务器）的“非交互模式（approval=never）”行为与文档
`docs/codex-non-interactive.md` 对齐：

- 三种模式：只读（read-only）、工作区可写（workspace-write, 默认禁网）、容器全权限（danger-full-access/YOLO）。
- 冲突与规范化：明确 `--dangerously-bypass-approvals-and-sandbox` 与
  `--ask-for-approval/--full-auto` 互斥；在 `never + danger-full-access`
  下提供“自动降级/显式 YOLO 环境变量”两种路径。
- MCP 默认安全注入与网络开关。

## 现状综述（代码参考）

- CLI
  - 参数集合与冲突检测：start.sh:87, start.sh:274, start.sh:288
  - 规范化：`normalize_sandbox_and_approvals()`（start.sh:298 起）
    - 行为：
      - 当 `--sandbox danger-full-access` 且未传 `--ask-for-approval`
        时，自动附加 `--ask-for-approval on-request`（或由
        `DEFAULT_APPROVAL_FOR_DFA` 覆盖）。
      - 当 `--sandbox danger-full-access` 且 `--ask-for-approval never`：
        1. 若 `ALLOW_DFA_WITH_NEVER=1` → 自动追加
           `--dangerously-bypass-approvals-and-sandbox`（危险）；
        2. 否则若 `DFA_DEGRADE_ON_NEVER=1` → 自动降级 sandbox（默认行为）；
        3. 否则报错并退出（提供替代建议）。
  - 输出/产物：日志与 meta（尾部 `classify_exit()`）；`--json`
    输出 meta 到 STDOUT。
- MCP（mcp/codex-mcp-server/src/index.ts:1）
  - `applyConvenienceOptions()`：
    - 默认注入 `--sandbox workspace-write`（若用户未显式指定或未 YOLO）。
    - `dangerouslyBypass=true` → 注入 bypass 并补上
      `--sandbox danger-full-access`。
    - `approvalPolicy` → 注入 `--ask-for-approval <policy>`（若未 bypass）。
    - `network=true` → 注入
      `--codex-config sandbox_workspace_write.network_access=true`。
  - `codex.exec` 同步执行并解析 `Exit Code:`；产物路径位于
    `.codex-father/sessions/<runId>/`。

## 行为定义与矩阵

- 只读（CI 推荐）
  - 命令：`codex exec --sandbox read-only --ask-for-approval never`（由
    `start.sh` 透传）
  - MCP：工具入参未指定 sandbox → 注入
    `--sandbox workspace-write`；如需只读，调用端显式传入。
- 工作区可写（默认禁网）
  - 命令：`codex exec --sandbox workspace-write --ask-for-approval never`
  - 网络开启：`--codex-config sandbox_workspace_write.network_access=true`
- 容器全权限（容器隔离前提）
  - 推荐：容器内运行并使用 YOLO（不建议宿主机）。
  - `never + danger-full-access`：
    - `ALLOW_DFA_WITH_NEVER=1` → 注入 YOLO。
    - 默认：`DFA_DEGRADE_ON_NEVER=1` → 降级为 `workspace-write`（或错误终止）。

## 规范化与冲突处理（CLI）

伪代码（start.sh 已实现，保持不变，仅补充测试）：

```
if has(--dangerously-bypass) and (has(--ask-for-approval) or has(--full-auto)) then error
if sandbox==danger-full-access and not has(--dangerously-bypass):
  if not has(--ask-for-approval): add --ask-for-approval ${DEFAULT_APPROVAL_FOR_DFA:-on-request}
  elif approval==never:
    if ALLOW_DFA_WITH_NEVER==1: add --dangerously-bypass-approvals-and-sandbox
    elif DFA_DEGRADE_ON_NEVER==1: downgrade sandbox to workspace-write
    else error with guidance
```

## 产物、日志与 JSON 输出

- 日志结构包含 Begin/End、Exit Code、回显合成指令（可限制行数）。
- 元数据（meta.json）：`id/timestamp/tag/classification/control_flag/reason/tokens_used/cwd/log_file/instructions_file/exit_code/title`。
- MCP `codex.exec` 同步返回
  `{ runId, exitCode, logFile, instructionsFile, metaFile, lastMessageFile }`。

## 测试计划

- 单元/Smoke（已有或补充）
  - `tests/smoke_start_conflicts.sh`：bypass 与 ask/full-auto 冲突 → 退出码 2。
  - 新增：`never + danger-full-access` 在 `ALLOW_DFA_WITH_NEVER=1`
    下注入 YOLO，日志含 bypass 与 danger-full-access。
- MCP E2E
  - `tests/mcp_ts_e2e.sh`：initialize → list → codex.exec(dry-run) →
    codex.start/status/logs。
  - `tests/mcp_injection_bypass_e2e.sh`：确认 bypass 注入与 sandbox=
    danger-full-access。

## 向后兼容

- 保持现有参数与默认值；仅增强文档与测试。
- MCP 默认注入仅在调用方未显式指定 sandbox 时生效；避免覆盖用户意图。

## 安全与合规

- 默认安全优先：不默认 YOLO；never+full-access 需显式环境开关或降级。
- 脱敏（`--redact`）保持可用，避免日志泄露凭据。

## 开放问题

- 不同平台的沙箱实现差异：在 docs 中强调容器隔离优先。
- MCP 客户端超时策略由客户端控制；建议文档提示增大超时。
