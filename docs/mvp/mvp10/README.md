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

