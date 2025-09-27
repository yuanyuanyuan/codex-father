# 阶段二需求文档：Git 分支与 PR 自动化（CLI/MCP）

## 背景与目标
- 背景：为支持 Claude Code 或外部编排在本地/容器内通过 CLI/MCP 下达任务并形成“可审 PR”的闭环，需要提供分支创建、推送与 PR 创建的自动化能力。
- 目标：
  - 在 `start.sh` 中提供可选的 Git/PR 自动化开关与参数，确保在任务完成时自动 push 并创建 PR。
  - 将 PR 元信息写入 meta 与异步 state.json，便于调用方轮询状态并获取 PR 链接。
  - MCP 侧无需新增 schema 字段，复用 `arguments.args` 透传 CLI 参数即可。

## 范围（In‑Scope）
- CLI：新增 Git/PR 相关选项、执行流程、错误处理与日志。
- job 异步：status 将 meta 中的 PR 信息填充到 state.json。
- MCP：参数透传（`codex.start/exec`）；无额外协议改动。
- 文档与测试：使用说明、示例与单测/E2E。

## 非目标（Out‑of‑Scope）
- 复杂冲突解决与多分支策略；
- 审批策略与沙箱变更（阶段一）；
- DevContainer/Docker 构建与集成（阶段三）。

## 用户故事
1) 作为工程师，我希望通过 `./job.sh start ... --git-create-branch --git-push-on-done --git-create-pr` 启动任务，完成后自动创建 PR 并返回链接。
2) 作为 Claude Code，我希望周期检查 `codex-father` 的任务状态，当完成时能直接读取 PR 链接进行审查。

## 需求细项（CLI 新参数）
- 分支与远端
  - `--git-create-branch`：任务开始前创建并切换分支（如分支存在则切换）。
  - `--git-branch <name|auto>`：分支名（默认 `auto` → `codex/<tag-or-timestamp>`）。
  - `--git-remote <name>`：默认 `origin`。
  - `--git-base <branch>`：PR 目标分支（默认：检测远端默认分支或 `main/master`）。
- 推送与 PR
  - `--git-push-on-done`：任务成功（exit=0 或 classification=done）时 push 分支；首 push 使用 `-u`。
  - `--git-create-pr`：推送后创建 PR；优先使用 `gh pr create`；若无 gh 且存在 `GH_TOKEN/GITHUB_TOKEN` 则走 REST API 兜底。
  - 文案：`--pr-title <s>`、`--pr-body <s>`、`--pr-draft`。
- 失败与降级
  - 非 git 仓库或远端缺失：记录 warning，跳过 Git/PR 步骤但不影响任务退出码。
  - 推送/PR 失败：记录原因并在 meta/state 中标记；不影响已完成任务的退出码。

## 元数据与异步状态
- meta.json 新增：`git_branch`, `git_remote`, `git_base`, `git_pushed`(bool), `pr_url`, `pr_number`, `pr_state`。
- job state.json（`job.sh status`）同步增补上述字段，便于调用方通过 MCP/CLI 读取。

## 验收标准
- CLI（本地）
  - 在临时 git 仓库中：
    - `./start.sh --task X --git-create-branch --git-branch auto --git-push-on-done --dry-run`：不执行 push，但 meta 中正确填写分支名（dry-run 仅验证解析与路径）。
    - 使用 mock 远端（本地 bare 仓库）+ `git push` 成功，meta: `git_pushed=true`。
    - 提供 `gh` stub 或 REST stub，`--git-create-pr` 成功后 meta/state 含 `pr_url`、`pr_number`。
- 异步：
  - `./job.sh start ... --git-create-branch --git-push-on-done --git-create-pr --json` → 返回 jobId；
  - `./job.sh status <jobId> --json` → `state in {completed,failed}`, 且附带 PR 字段（如有）。
- MCP：
  - 通过 `codex.start` 传递上述 CLI 参数；`codex.status` 返回 JSON 中包含 PR 字段。

## 影响范围（代码与文件）
- start.sh：参数解析（新增 flags）、前置切分支、后置 push 与 PR、meta 写入。
- job.sh：status 读取最近 meta，写回 PR 字段到 state.json。
- mcp/codex-mcp-server/src/index.ts：无需改动（参数透传），仅补文档说明。
- 测试：新增/扩展 bats（unit + unit‑codex + e2e）。

## 里程碑
- D1：CLI 参数与最小路径（仅创建本地分支并在 meta 填充）
- D2：push（含本地 bare 远端）
- D3：PR 创建（gh 优先，REST 兜底）与异步状态填充

## 安全与凭据
- gh CLI：依赖用户已登录（`gh auth login`）。
- REST 兜底：需要 `GH_TOKEN` 或 `GITHUB_TOKEN`；文档提示勿打印 token；日志脱敏可复用 `--redact`。

## 风险与缓解
- 远端默认分支检测失败：回退到 `main/master` 探测或用户显式指定 `--git-base`。
- 网络/权限失败：不影响任务退出码，仅在 meta/state 标注失败原因。

