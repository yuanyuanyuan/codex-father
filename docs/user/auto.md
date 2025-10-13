# Auto 命令使用指南（MVP12）

本文档介绍 `codex-father auto` 命令：自动模型路由（gpt‑5 vs gpt‑5‑codex, High）、结构化指令模板（PLAN→EXECUTE）、两行 Stream‑JSON 事件契约与补丁写入的 SWW 协调。

## 为什么使用 auto

- 一条命令完成“路由 → 高质量模板 → 执行”。
- 与 orchestrate 的事件/文件契约一致：`--output-format stream-json` 下 stdout 仅两行事件，详细事件写入 `.codex-father/sessions/<id>/events.jsonl`。
- 生成的补丁通过 SWWCoordinator 串行应用，避免竞写；取消/恢复与 orchestrate 语义一致。

## 快速开始

```bash
codex-father auto "重构登录模块 FR-210 NFR-7"
# 默认 stdout: JSON 摘要（--output-format json）
```

两行事件（适用于自动化/CI）：

```bash
codex-father auto "重构登录模块 FR-210 NFR-7" --output-format stream-json
# stdout: 两行事件（start / orchestration_completed）
```

仅查看路由（不执行）：

```bash
codex-father auto "该任务更偏研究还是改代码？" --route-dry-run --route-explain json
```

## 关键选项

- `--route-dry-run`：只输出路由决策，不执行。
- `--route-explain json`：输出 `{ decision, score, features, reasons }`。
- `--model <name>`：显式指定模型，覆盖自动路由。
- `--output-format <json|stream-json>`：默认 `json`；在自动化与 CI 中建议使用 `stream-json`（两行事件）。
- `--save-stream <file>`：当 `--output-format json` 时，将两行事件同时写入文件（便于“同时拿到两行事件 + JSON 摘要”）。

## 路由与回退

- 仅二选一：`gpt-5` 与 `gpt-5-codex`，且均为 High。
- 优先级：显式 `--model` 覆盖自动路由。
- 当目标 provider 不可用或 wire_api 不匹配时，回退到 `gpt-5-codex high`；在 JSONL 中以 `task_execution_summary.data.routeFallback` 标注（简版字段：`{ from, to, reason }`）。

## 事件与产物

- stdout：默认 `json`；在 `--output-format stream-json` 下输出两行事件（`start`，`orchestration_completed`）。
- JSONL：写入 `task_started`、`task_execution_summary` 等事件；路由/模板摘要进入 `data` 字段。
- 报告：如启用报告写入，路径位于 `.codex-father/sessions/<id>/report.json`，可用 `orchestrate:report` 查看。

## 与 orchestrate 的关系（避免混淆）

- 短期：auto 独立封装 `codex exec --experimental-json` 路径，复用 StateManager 写 JSONL。
- 中期：在 orchestrator 内注入最小 exec runner，提前计算 `{model, instruction}`，补丁仍经 SWW 协调。
- 注意：`orchestrate` 是独立子命令（`codex-father orchestrate ...` 或
  `node dist/core/cli/start.ts orchestrate ...`）。

更多设计细节与路线图见：`docs/mvp/mvp12/README.md`。
