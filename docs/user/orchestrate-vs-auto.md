# Orchestrate vs Auto：何时用谁？

本文对比 `orchestrate` 与 `auto` 两种路径，帮助你在不同场景下选择合适方式。两者共用事件/文件契约，均支持严格的两行 Stream‑JSON（当指定 `--output-format stream-json`）。

## 快速结论（TL;DR）

- 选择 `auto` 当：
  - 单一目标、可在一个会话内完成（≤3 步、低副作用）。
  - 需要“自动模型路由 + 高质量模板（PLAN→EXECUTE）”。
  - 期望默认 JSON 摘要输出；CI 时可切到 `stream-json`。
- 选择 `orchestrate` 当：
  - 多任务/多角色/并行编排，需成功率阈值/重试统计/报告指标。
  - 需要强审计、失败分类与跨任务会话目录。
  - 必须严格两行事件（CI 标准输出超干净）。

## 能力对比

- 输出契约
  - auto：默认 `--output-format json`；可选 `stream-json` 两行事件；支持 `--save-stream <file>`。
  - orchestrate：`--output-format stream-json` 下仅两行事件：`start` 与 `orchestration_completed/failed`。报告/事件写入会话目录。
- 任务模型
  - auto：单会话直驱 `codex exec --experimental-json`，内置路由与模板，补丁经 SWW 串行。
  - orchestrate：任务图（waves），并发/重试/阈值，SWW 与取消/恢复、指标写入 `report.json`。
- 报告与指标
  - auto：可选写报告（按实现）；默认以 JSON 摘要与 JSONL 事件为主。
  - orchestrate：标准 `report.json`（含 metrics 与 references），`orchestrate:report` 友好化摘要。
- 路由与回退
  - auto：自动路由（`gpt-5` vs `gpt-5-codex`，High），`--model` 覆盖；provider 缺失/不匹配时写 `routeFallback` 并回退到 `gpt-5-codex`。
  - orchestrate：由任务/角色定义决定，无自动路由。

## 推荐用法

- 日常改动/小修小补（Patch、Refactor、小型特性）→ `auto`
- 复杂需求/多步骤流水（分析→修改→验证→回滚策略）→ `orchestrate`
- CI 严格输出控制 → 两者均使用 `--output-format stream-json`；若需保留两行事件同时得到 JSON 摘要，使用 `--save-stream <file>`。

> 注意：`orchestrate` 是独立子命令（`codex-father orchestrate ...` 或 `node dist/core/cli/start.ts orchestrate ...`）。

## 示例

- auto（默认 JSON 摘要）：
  ```bash
  codex-father auto "重构登录模块 FR-210 NFR-7"
  ```
- auto（两行事件）：
  ```bash
  codex-father auto "重构登录模块 FR-210 NFR-7" --output-format stream-json
  ```
- orchestrate（两行事件 + 报告/事件落盘）：
  ```bash
  codex-father orchestrate "演练主路径 FR-123" \
    --mode manual \
    --tasks-file core/cli/tests/fixtures/manual.tasks.json \
    --output-format stream-json
  ```

更多细节：
- auto：docs/user/auto.md、docs/mvp/mvp12/README.md
- orchestrate：docs/user/orchestrate-report.md、docs/mvp/MVP11/PRD.md
