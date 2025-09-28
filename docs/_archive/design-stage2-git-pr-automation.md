# 阶段二设计文档：Git 分支与 PR 自动化（CLI/MCP）

## 概述

在 `start.sh`
中实现可选的 Git/PR 自动化：运行前可切换/创建分支；运行成功后可自动 push 并创建 PR。`job.sh status`
将 PR 字段暴露到 state.json。MCP 继续沿用参数透传（无需协议变更）。

## 目标行为

1. 运行前置：
   - 若 `--git-create-branch`：
     - 计算分支名（`--git-branch auto` →
       `codex/<tag-or-timestamp>`；显式指定则使用该值）。
     - `git rev-parse --is-inside-work-tree`
       校验 git 仓库；否则记录 warning 并跳过 Git 自动化。
     - `git checkout -B <branch>` 切换/创建分支。
2. 运行后置：
   - 成功判定：`exit_code == 0` 或 `classification == 'done'`（借助
     `classify_exit()` 或 meta 字段）；
   - `--git-push-on-done`：
     - 检测远端（`--git-remote`，默认 origin）；若不存在则 warning；
     - 首次 push：`git push -u <remote> <branch>`；之后
       `git push <remote> <branch>`；记录成功与否。
   - `--git-create-pr`：
     - 优先 gh
       CLI：`gh pr create --title <t> --body <b> --base <base> --head <branch> [--draft] -R <owner/repo>`；
     - 兜底 REST：`POST /repos/{owner}/{repo}/pulls`，需
       `GH_TOKEN/GITHUB_TOKEN`；参数 `{title, head, base, body, draft}`；
     - 解析 `pr_url/pr_number`，写入 meta。

## 参数与默认值（CLI）

- `--git-create-branch`
- `--git-branch <name|auto>`：默认 `auto` → `codex/<tag-or-ts>`
- `--git-remote <name>`：默认 `origin`
- `--git-base <branch>`：默认自动检测远端默认分支（`git remote show <remote>` /
  `git symbolic-ref refs/remotes/<remote>/HEAD`），失败时回退 `main|master`。
- `--git-push-on-done`
- `--git-create-pr`、`--pr-title <s>`、`--pr-body <s>`、`--pr-draft`

## 元数据与状态

- meta.json 增补字段：
  - `git_branch`, `git_remote`, `git_base`, `git_pushed`(bool),
  - `pr_url`, `pr_number`, `pr_state`, `pr_error`（失败原因可选）。
- job 状态填充（job.sh status）：
  - 解析最近一次 `*.meta.json`，将上述字段写入 `state.json` 对应键。

## 关键实现点（文件与位置）

- start.sh：
  - 参数解析区：为新 flags 加 case 分支（与既有风格一致）。
  - 前置执行：在 codex 调用前，进行 git 仓库检测与 `checkout -B`。
  - 后置执行：在写入尾部日志与 meta 前，完成 push 与 PR 创建，并将结果合并至
    `META_JSON`。
  - 错误处理：所有 Git/PR 步骤采用“软失败”，仅落日志与 meta。
- job.sh：
  - `status_compute_and_update()` 中读取 meta 文件的 PR 字段；若存在则写入
    `state.json`。
- MCP：无代码改动（说明文档中标注通过 `arguments.args` 透传）。

## 外部依赖与凭证

- gh CLI：若可用优先；`gh auth login` 之后 `gh pr create` 生效。
- REST 兜底：需要 `GH_TOKEN` 或 `GITHUB_TOKEN`；调用
  `https://api.github.com/repos/{owner}/{repo}/pulls`，Headers：`Authorization: token $TOKEN`，`Accept: application/vnd.github+json`。

## 失败与回退策略

- 非 git 仓库/未初始化远端：记录 warning，跳过。
- push/PR 失败：在 meta/state 增加
  `pr_error`，并在日志写明原因；不更改 codex 运行的 exit_code。

## 测试方案

- 单元：参数解析与默认值回退；`auto` 分支命名；meta 字段存在性。
- 集成（mock）：
  - 本地初始化仓库 + bare 远端，验证 push 成功；
  - `gh` stub/REST stub，验证 PR 创建并解析到 `pr_url/pr_number`。
- 异步：`job.sh start/status` 能读回 PR 字段。
- MCP：通过 `codex.start` 传 flags，`codex.status` 返回的 JSON 中包含 PR 字段。

## 兼容性与影响

- 默认不启用 Git/PR；仅当显式传参时生效。
- 不修改既有产物命名与路径。

## 安全

- 避免在日志中输出 token；建议使用 `--redact` 与默认脱敏模式。
- 对 gh/REST 错误信息进行适度截断与脱敏。

## 交付与里程碑

- 里程碑对齐阶段二需求文档：D1 → D3。
