# MVP10 产品方案：免确认/单窗自动化与编排增强

更新时间：2025-10-07

## 背景与问题陈述

在实际使用中，用户反馈当前 codex-father 与直接使用 codex.exec 相比，优势不够直观：
- 常因审批策略/沙箱组合不当而触发“无穷确认”。
- 难以在同一终端窗口完成“启动→观测→收敛”的自动化闭环，依赖反复聊天驱动。
- 编排器能力尚未在 CLI 中形成可感知的端到端价值。

本方案（MVP10）聚焦用最小改动打通“免确认、单窗自动化、可检验收敛”的核心体验，同时为后续编排扩展（任务分解→并行执行→产出验证）预留接口。

## 现状不足清单

### 交互与体验
- 无原生 TUI/单窗面板；主要依赖 `job.sh logs --follow` 跟随日志。
- 参数传递存在“`--` 分隔”误用陷阱：对 `job.sh start` 使用 `--` 会让后续参数被透传到 `start.sh`，再被当成 Codex 全局参数而报错；应直接传给 `job.sh start`（已在演示中复现）。
- 多轮停止依赖模型输出 `CONTROL: DONE`，若模型未输出可能“跑不完”；需要用 `--max-runs` 防护。
- Patch 模式只捕获/保存 diff（`lib/common.sh:codex_publish_output`），不负责自动应用与验证（缺“生成→应用→测试”的全链路）。
- 指令拼装与日志虽完整，但缺“一条命令启动并内置日志跟随/摘要”的便捷命令（近似 TUI 的 UX）。

### 可靠性与兼容性
- 强依赖 Codex CLI 行为与版本（如 `--output-last-message` 需 >=0.44）；旧版降级会影响多轮能力。
- 大量 `grep/sed/awk` 解析 JSON/日志（如 `start.d/03_finalize.sh`、`job.d/00_bootstrap.sh`），在边界格式更易脆弱；未使用 `jq`。
- `job.sh resume` 解析 `state.json` 依赖 Node；无 Node 时功能降级且报错提示有限。
- Token 估算采用 bytes/4 粗略规则与固定阈值（`start.d/02_prepare.sh`），未基于实际模型上下文动态调整，可能误判阻断。
- 参数白名单/兼容性列表手工维护（`KNOWN_FLAGS`），Codex 新旗标出现时可能被误报为未知。

### 编排与能力覆盖
- `core/cli/commands/orchestrate-command.ts` 仍以 `orchestrate([])` 空任务占位，CLI 尚未串联真实任务分解与执行，编排器价值未充分暴露。
- `ProcessOrchestrator` 功能相对完整，但 CLI 侧默认未与 `start.sh`/自动 patch 流程打通（缺“分解→执行→收敛”的端到端路径）。
- MCP 服务器存在目录与框架，但与主 CLI/作业流整合程度有限（工具链调用路径不清晰）。
- 批量/并发能力与资源门控为 MVP，默认配置与资源适配不足。

### 安全与审计
- 默认未启用脱敏（`REDACT_ENABLE=0`），仅基于少量正则，易把敏感信息写入 `.codex-father/sessions/`。
- 存在 `--dangerously-bypass-approvals-and-sandbox`，但缺少“危险操作二次确认/审计门”，易被误用。
- 网络开关通过 `--codex-config sandbox_workspace_write.network_access=true`，跨沙箱行为不直观，可能造成“已联网”的误解。
- 会话/日志持续累积，虽有 `job.sh clean`，但默认未自动治理；长期存储与隐私风险并存。

### Git 与完成度
- 完成校验与自动提交依赖 Git；在非 Git 环境/CI 镜像下能力不可用，提示与降级策略有限。
- 自动提交范围基于 glob 与工作区快照，可能遗漏生成文件或未跟踪文件；提交信息较固定，不含变更摘要/签名策略。
- Shell 关键路径测试覆盖不足；TypeScript 侧有集成/契约测试，但 `start.sh`/`job.sh` 仍以烟雾级为主。

### 体验与文档
- 文档未突出“给 `job.sh start` 传参时不要带 `--` 分隔”的坑，易触发 Codex CLI 的 `unexpected argument`。
- `--docs/--docs-dir` 仅支持 Markdown，难以直接纳入 JSON/YAML/代码片段等多源材料。
- 缺少“一键全自动（含日志跟随）”的便捷命令别名（如 `codex-father auto ...`），需要用户自行组合。
- Windows 原生支持缺失（依赖 Bash），需 WSL/容器环境。

## 本期目标（MVP10）

1) 单命令“近 TUI”体验（单窗自动化）
- 新增 `core/cli` 子命令 `auto`：一条命令完成 start → 跟随日志 → 结束输出摘要；支持人类可读与 `--json`。
- 默认行为：
  - 使用 `workspace-write + on-failure` 并允许显式 `--ask-for-approval never`。
  - 自动检测 `CONTROL: DONE` 或到达 `--max-runs` 后收敛。

2) 免确认默认姿势与参数避坑
- 文档与 CLI 提示改进：明确 `job.sh start` 传参不要使用 `--` 分隔；检测到典型误用时给出修复建议。
- 在 `workspace-write` 下允许 `--ask-for-approval never` 无交互执行；`danger-full-access` 仍需显式确认或旁路环境变量。

3) 补丁全链路（可选）
- 在 `--patch-mode` 下新增可选自动应用与验证：
  - `--patch-apply --verify "<命令>"`：生成补丁后自动试用并运行验证命令（如 `npm test`）。
  - 失败回滚并在 `.meta.json` 标出失败原因与日志引用。

4) 脱敏与安全默认
- 在会话日志默认启用安全脱敏（可通过 `--no-redact` 关闭）。
- 危险组合（如 `--dangerously-bypass-approvals-and-sandbox`）增加醒目日志与 JSON 元数据标记，便于审计。

5) 编排器接入（最小闭环）
- `orchestrate` 接 `auto`：允许在 `auto` 命令内将任务拆分为“分析→补丁→验证”三步的最小串联，并输出 stream-json 事件到会话 JSONL。

6) 可靠性与提示
- 可选依赖统一：如本机缺少 Node/jq，提供明确的功能降级与安装指引。
- Token 估算阈值可配置，并在超过软阈值时提供切分建议与自动降采样策略。

## 验收标准（Success Criteria）
- 一条命令（`codex-father auto ...` 或 `npm run auto ...`）可以在一个终端窗口中完成：启动→日志跟随→完成摘要，且在 `--ask-for-approval never` + `workspace-write` 下全程无人工确认。
- `--patch-mode` 可选自动应用与验证开关可用，失败能回滚并写明原因。
- 日志与元数据默认启用脱敏；危险姿势在元数据中可观察。
- 误用 `--` 分隔的错误提示明确，发生率显著下降。

## 交互与命令示例（草案）

```bash
# 单窗自动化（人类可读）
core/cli/start.ts auto \
  --task "修复 X 并补充测试" \
  --ask-for-approval never \
  --sandbox workspace-write \
  --max-runs 3

# 机器可读（JSON 输出）
core/cli/start.ts auto --json --task "生成 patch 并验证"

# 补丁全链路验证
./start.sh --patch-mode --patch-apply --verify "npm test" --task "修复 lint 与单测"
```

## 任务=会话（TODO 分解为多 run）

目标：把一个 TODO 列表拆成多个“独立 Codex 会话（run）”，每个 run 单独的 `CODEX_SESSION_DIR`，自然规避上下文膨胀，同时保留每次执行的日志、最后消息与元数据，形成可追溯审计资产。

两条路径：
- 用 `job.sh`（推荐，立即可用）：每个 TODO 项触发一次 `job.sh start`，生成独立会话目录，按状态流转（completed/failed/stopped）与分类（done/approval_required…）驱动下一步。
- 用 `orchestrate`（MVP/可演进）：把 TODO 作为任务列表输入编排器，让编排器在每个任务处启动一个独立 run，并将事件写入 JSONL。

### 用 job.sh 的实现（立即可用）

- TODO 文件格式（示例 `TODO.md`）：
  - `- [ ] 修复 README 错别字`
  - `- [ ] 为 start.sh 增加 --verify 选项`
  - `- [ ] 新增 e2e 冒烟测试`

- 启动单个 run（独立会话）：

```bash
./job.sh start \
  --tag t1 \
  --json \
  --task "<你的 TODO 文本>" \
  --ask-for-approval never \
  --sandbox workspace-write \
  --codex-config sandbox_workspace_write.network_access=true \
  --repeat-until "CONTROL: DONE" \
  --max-runs 3
```

- 跟随日志（单窗观测）：`./job.sh logs <job-id> --follow`
- 轮询状态：`./job.sh status <job-id> --json`

- 顺序执行脚本要点：
  - 读取 `TODO.md` 的未完成项目（`- [ ] `），逐条开 run，等待完成后把对应行改为 `- [x] `。
  - `job.sh start` 会在 `.codex-father/sessions/<job-id>/` 生成独立会话目录，并自动设置 `CODEX_SESSION_DIR` 与 `job.log`。
  - 轮询 `status` 直到 `state` 变为 `completed/failed/stopped`；从 `classification` 或 `last_message_glob` 判断是否捕捉到了 `CONTROL: DONE`。
  - 可选启用完成度约束：`--require-change-in 'src/**' --require-git-commit --auto-commit-on-done`，确保“做到位且写回仓库”。

- 会话资产（每个 run 自动生成）：
  - `job.log`、`*.instructions.md`、`*.last.txt`、`*.meta.json`、`state.json`、`aggregate.jsonl`。

- 单窗体验：
  - 一个终端运行“分发脚本”；另一个终端 `job.sh logs <job-id> --follow` 观察当前任务。
  - 或在脚本里内联 `./job.sh logs "$jobId" --tail 50` 的尾部输出作为进度提示。

- 可靠性与安全建议：
  - `--ask-for-approval never --sandbox workspace-write`（免确认），必要时 `--codex-config sandbox_workspace_write.network_access=true` 开网络。
  - 兜底：`--max-runs 3`；如模型未输出 `CONTROL: DONE` 也能收敛。
  - 严控上下文：默认不携带上一轮对话；如需摘要辅助可用 `--context-head/--context-grep`。
  - 脱敏：必要时加 `--redact`。

### 行为与事件（编排侧）

- SWW 工作区异常（prepareWorkspace 失败）不再中断队列：
  - 当前版本将该类错误映射为 `task_failed(reason=patch_failed)` 与 `patch_failed`（仅 JSONL 审计额外记录细节），继续处理后续补丁，保证长队列的顺序与一致性。
  - 成功补丁仍发 `tool_use`（工具=patch_applier）与 `patch_applied`。
- JSONL 审计事件 vs stdout 契约：
  - stdout 仅两行：`start` 与 `orchestration_completed/failed`。
  - 详细过程事件（如 `understanding_*`、`decomposition_*`、`task_retry_scheduled`）仅写入 JSONL；对外必要提示请通过 `tool_use/task_*` 的 `data` 字段摘要表达。

### 用 orchestrate 的实现（MVP/可演进）

- 目标形态：输入 `tasks.json`（或从 `TODO.md` 解析），每个 task = 一次独立 run。
- 实施建议：先用 Node/TS 薄封装循环 `job.sh start → status 轮询 → logs 摘要 → 事件写入 JSONL`；随后把该逻辑内嵌到 `ProcessOrchestrator`（`spawnAgent` 或 `StateManager` 事件）以实现“任务=会话”。
- 好处：原生并发、重试、失败分类与成功率阈值控制；为“分析→补丁→验证”多阶段编排打底。

### 为什么不会爆上下文

- 每个 TODO 项作为一次“全新 run”，各自的 `CODEX_SESSION_DIR` 独立；Codex 历史对话不跨任务累积，自然不会因“长对话”爆上下文。
- 如需把上一 run 的信息喂给下一 run，不要携带整段对话，只传必要的工件/摘要（补丁路径、提交哈希、概要等），通过 `--content`/`--file` 注入。

### 落地清单（速用）

1) 准备 `TODO.md`；设置：

```bash
export CODEX_VERSION_OVERRIDE=0.44.0
export ALLOW_NEVER_WITH_WRITABLE_SANDBOX=1
```

2) 启动一个 run 并获取 jobId：

```bash
jid=$(./job.sh start --tag t1 --json --task "<TODO 文本>" \
  --ask-for-approval never --sandbox workspace-write \
  --repeat-until "CONTROL: DONE" --max-runs 3 \
  | sed -n 's/.*"jobId"[[:space:]]*:[[:space:]]*"\([^" ]*\)".*/\1/p')
```

3) 观察与收尾：

```bash
./job.sh logs "$jid" --follow
./job.sh status "$jid" --json
```

## TODO 拆解与执行模式（推荐默认：分析拆解→人验收→执行）

两种来源，统一执行：

1) 用 Codex 先做“分析拆解”，人验收后执行（高效+可控，推荐）

- 目标：快速生成可执行的 TODO 草案（每条 1–2 小时内可完成，含完成判据与影响文件 glob），经人工审阅/编辑后落盘为本地 `TODO.md`。
- 生成草案（不直接执行，产出 patch）：

```bash
./start.sh --preset analysis \
  --task "基于当前需求生成可执行的 TODO 列表（checkbox + 完成标准 + 影响文件 glob），优先级从高到低，控制在 12 条内；输出为对 TODO.md 的补丁" \
  -f docs/需求说明.md \
  --patch-mode
```

- 人审阅 patch，确认/编辑后保存 `TODO.md`。
- 执行阶段：按上一节“任务=会话”的 `job.sh start` 流程逐条执行（或用脚本批量调度）。

2) 用户按规范自拆 TODO 文件后，codex-father 自动执行

- 文件格式（最小规范）：Markdown checkbox 列表，每条一行；可选内联元数据，格式示例：

```md
- [ ] 修复 README 错别字 (tag:docs, require:docs/**)
- [ ] 为 start.sh 增加 --verify 选项 (tag:cli, require:start.d/**)
- [ ] 新增 e2e 冒烟测试 (tag:test, require:tests/e2e/**)
```

- 字段约定（可选）：
  - `tag:<name>` → 传给 `job.sh start --tag <name>`
  - `require:<glob>` → 多个以逗号分隔，映射到 `--require-change-in <glob>`（可多次）
  - 如需自定义校验，可在外层脚本里在 run 完成后执行 `verify` 命令（MVP10-B 计划提供 `--verify` 一体化开关）。

- 示例脚本：自动读取 `TODO.md` 并顺序执行（简化版）

```bash
#!/usr/bin/env bash
set -euo pipefail

todo_file="TODO.md"
while IFS= read -r line; do
  [[ "$line" =~ ^-\ \[\ \]\  ]] || continue
  # 提取正文与元数据
  text=$(sed -E 's/^- \[ \] (.*?)(\s*\(.*\))?$/\1/' <<<"$line")
  meta=$(sed -nE 's/.*\((.*)\).*/\1/p' <<<"$line" | tr 'A-Z' 'a-z')
  tag=$(grep -oE 'tag:[^, ]+' <<<"${meta:-}" | cut -d: -f2- || true)
  IFS=',' read -r -a requires <<<"$(grep -oE 'require:[^)]+' <<<"${meta:-}" | cut -d: -f2- | tr -d ' ' | tr ',' '\n' | tr '\n' ',' | sed 's/,$//')"

  args=(--task "$text" --ask-for-approval never --sandbox workspace-write --repeat-until "CONTROL: DONE" --max-runs 3)
  [[ -n "${tag:-}" ]] && args+=(--tag "$tag")
  for g in "${requires[@]:-}"; do [[ -n "$g" ]] && args+=(--require-change-in "$g"); done

  jid=$(./job.sh start --json "${args[@]}" | sed -n 's/.*"jobId"[[:space:]]*:[[:space:]]*"\([^" ]*\)".*/\1/p')
  echo "started: $jid — $text"
  # 简易等待：直到 completed/failed/stopped
  while true; do
    state=$(./job.sh status "$jid" --json | sed -n 's/.*"state"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
    [[ "$state" =~ ^(completed|failed|stopped)$ ]] && break
    sleep 2
  done
  echo "finished: $jid ($state)"
done < "$todo_file"
```

> 说明：此脚本仅示例“如何把每条 TODO 变成独立 run”；可按需扩展并发、失败重试、完成后自动 `git commit` 或外部 `verify` 等逻辑。

## 技术实现要点

- `core/cli`：新增 `auto` 子命令（Ink/非交互两版择一：先实现非交互，跟随 `job.sh logs --follow` 并汇总）。
- `start.sh`：
  - 在 `--patch-mode` 增加 `--patch-apply` 与 `--verify`（可选）；
  - 改进误用 `--` 的检测与报错提示（指向正确用法示例）。
- `job.sh`：
  - `start` 返回中明确提示如何 `logs --follow`；
  - `status/metrics` 保持向后兼容。
- 默认脱敏：在日志回显与聚合前应用；配置项可在 `config/` 下提供模板。
- 编排接入：`auto` 内部调用 `orchestrate` 输出 stream-json 事件，与会话 JSONL 汇总打通。

## 里程碑与排期（建议）

Milestone A（1–2 天）：
- `auto` 子命令（非交互跟随 + 摘要）。
- 文档更新：参数避坑、免确认安全姿势、示例命令。

Milestone B（2–3 天）：
- `--patch-apply` + `--verify` 最小实现，失败回滚与元数据标注。
- 默认脱敏开关与模式集合落地；危险姿势审计标识。

Milestone C（2–4 天）：
- `orchestrate` 与 `auto` 的最小联动（分析→补丁→验证流，事件 JSONL）。
- 可靠性改进（Token 阈值可配置；缺依赖提示与降级）。

## 风险与应对
- 旧版 Codex CLI：保持 0.44 检测与降级路径，必要时回退到“单轮+无 last-message”。
- 自动应用补丁的回滚复杂度：默认关闭，仅在显式传 `--patch-apply` 时启用，且限制在临时工作区。
- 日志脱敏误替换风险：提供默认模式 + 白名单开关；敏感场景鼓励 `secure` 预设。

## 文档与传播
- docs/user 与 README 增补“免确认/单窗自动化最佳实践”。
- 在 `docs/mvp/README.md` 链入本页并附命令速查。

---

附：当前不足清单来自近期使用与实测总结，见上文“现状不足清单”。
