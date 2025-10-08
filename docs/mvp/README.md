# 🎯 MVP 文档

> **各个 MVP 阶段的规划和实现文档**。

## 📚 MVP 列表

- [MVP3 文档](mvp3/) - 能力评估和非交互模式
- [MVP4 文档](mvp4/) - PRD 草案
- [MVP5 文档](mvp5/) - Worktree 集成计划
- [MVP6 文档](mvp6/README.md) - 帮助（help）与环境体检（doctor）— 自发现与自检（雏形）
- [MVP10 文档](mvp10/README.md) - 免确认/单窗自动化与编排增强
- [MVP11 文档](MVP11/PRD.md) - 四种模式（CLI/作业/MCP/内嵌）整合 PRD
- [MVP12 文档](mvp12/README.md) - 自动模型路由与高质量工作流（不改官方源）

## 🛠️ 实施顺序与依赖

> 目标：在不改官方源的前提下，按最小依赖与可回归路径推进，保证契约稳定（事件枚举、两行 Stream‑JSON）。

1) P0 基线（已完成/在途，依赖最小）
   - 统一 stdout 契约：orchestrate 在 `--output-format stream-json` 下仅输出两行事件（start / orchestration_completed）。
   - 报告指标/引用：`report.json` 增加 `metrics` 与 `references` 字段，`orchestrate:report` 支持友好摘要。
   - SWW 协调器：支持中止/复位与启发式冲突检测；编排取消时触发中止，恢复时复位。
   -（可选）MCP 诊断只读工具：读取报告与事件预览（默认可开）。

2) P1 MVP12‑最小闭环（依赖 P0）
   - 路由器与规则：`src/router/modelRouter.ts` + `rules.json`；显式 `--model` 覆盖路由。
   - 指令模板：`src/instructions/composer.ts`（PLAN→EXECUTE，首行 ROUTING_HINT）。
   - `auto` 命令雏形：`codex exec --experimental-json` 包装；复用 `StateManager` 写 JSONL；stdout 采用“两行 Stream‑JSON 事件”。
   - 补丁路径：`auto` 产出的补丁经 SWW 队列串行应用，避免与 orchestrate 竞写。

3) P2 MVP12‑可解释与入口策略（依赖 P1）
   - `--route-dry-run` / `--route-explain json`；
   - `complexityAssessor`：决定 `auto` 直接 exec 还是交给 orchestrate；产出 explain 事件。

4) P3 orchestrate 深接（依赖 P2）
   - 在 orchestrator 内部注入最小 exec runner（不改官方源）：在 `launchCodexAgent()` 前提供 `{ model, instruction }`。
   - Gates 结果补齐到 `data`；成功率阈值/重试指标纳入报告。

5) P4 指标化与提效（依赖 P3，可并行推进部分）
   - 路由准确率/返工率/时长等指标采集与导出；
   - `logs`/`report` 命令增强与仪表盘草图。

依赖关系概述：P0 → P1（路由/模板/auto）→ P2（解释与入口）→ P3（与 orchestrate 深接）→ P4（指标化）。

## 🧭 全局实施路线图（跨 MVP）

> 目标：给出“不同 MVP 的推进顺序与依赖”，便于排期与并行。

顺序（建议）：
- G1 → MVP12（已对齐本仓实现基础）
  - 内容：自动模型路由、PLAN→EXECUTE 模板、`auto` 命令、两行 Stream‑JSON 契约、补丁统一走 SWW。
  - 依赖：P0 基线（orchestrate 两行事件、报告 metrics/references、SWW 中止/复位）。

- G2 → MVP6（占位：帮助与自发现/配置自检）
  - 说明：当前仓未收录 MVP6 文档；建议定义为“CLI/MCP 自描述能力 + 版本/配置自检与向导”，承接 MVP4 的第 2/6/7/8 点。
  - 产出：
    - CLI：`codex-father help --json` 与 `codex-father doctor`（检查 wire_api/模型/provider/version）。
    - MCP：`tools/list`/`tools/call` 自描述扩展（已具备诊断只读工具，可复用）。
  - 依赖：G1（`auto`/路由落地后，帮助/自检需覆盖新能力）。

- G3 → MVP5（Worktree 集成）
  - 内容：worktree 列表/创建/归档/附着会话，互斥锁、两阶段写入、回滚与快速验证。
  - 依赖：与 G1/G2 低耦合；建议在 G2 之后实施，以便 `auto`/队列在独立工作树中运行、隔离补丁影响。

- G4 → MVP7（流水线加固/预检门）
  - 内容：预构建/依赖门、事件去重/幂等、断点续传；增强 start/job 编排的稳定性。
  - 依赖：基于 G1/G3，覆盖 `auto` 与 worktree 下的执行路径。

- G5 → MVP10（单窗自动化与编排增强）
  - 内容：一条命令跑全流程（近 TUI）、日志跟随/摘要、补丁全链路联动；与 `auto` 汇合成一致体验。
  - 依赖：G1/G3/G4；在有路由、worktree 与加固能力后统一 UX。

- G6 → MVP11（四模式整合校准）
  - 内容：对齐 4 种模式（CLI/作业/MCP/内嵌）的契约与文档，补全示例与回归脚本。
  - 依赖：前述能力落地后统一校准与文档化。

并行建议：
- 文档与测试（契约、端到端）可与 G2–G5 并行推进；
- MCP 诊断工具扩展可与 G2/G4 并行（只读，不影响主链路）。

注：`mvp3/` 当前不存在文档目录，列表项仅作历史占位；后续若补齐内容，可在 G2–G4 之间插队实施。

## 🔗 其他文档

- [📚 文档总入口](../README.md)
- [🏗️ 架构文档](../architecture/README.md)
