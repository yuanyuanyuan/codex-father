# MVP12：自动模型路由与高质量工作流（不改官方源）

更新时间：2025-10-08

## 背景与目标

- 背景：在不修改 refer-research/openai-codex 官方源码的前提下，为 codex-father 增强“高质量优先、同时高效率”的开发体验，减少返工与手动切换成本。
- 目标：
  - 仅在 `gpt-5 high` 与 `gpt-5-codex high` 间自动切换（路由可解释、可回放）。
  - 以“PLAN→EXECUTE”结构化指令模板（Instruction Composer）提升质量，对齐“理解一致性→任务分解→交付验收”的质量门。
  - 提供统一入口命令（建议：`auto`），串起：路由→指令拼装→codex exec 调用→事件落盘。
  - 保持与既有事件 Schema/“两行 Stream‑JSON 事件”输出契约一致；不新增官方事件类型，仅在 `data` 中扩展。

## 与其他 MVP 的关系

- 强关联
  - MVP10（docs/mvp/mvp10/README.md）：本期的 `auto` 子命令、单窗自动化与补丁全链路落地，直接沿用 MVP10 的 CLI 设计与事件写入约定。
  - MVP11（docs/mvp/MVP11/PRD.md）：两行 stdout 契约与 JSONL 事件模型严格遵循；新增的路由/模板/验收仅放入 `data` 字段。
- 弱关联
  - MVP4（docs/mvp/mvp4/prd.draft.md）：默认模型为 `gpt-5-codex`；本期将其作为“路由默认”，仅在强信号下转向 `gpt-5`，属于“特殊情况覆盖”，不违背默认策略。
- 无冲突说明
  - 不改 refer-research/openai-codex 官方仓；仅在 codex-father 内新增模块/命令与事件扩展，兼容既有文档契约。

## 范围（In/Out）

- In Scope
  - 自动模型路由（仅二选一：`gpt-5` vs `gpt-5-codex`，且始终 High）。
  - 指令模板（PLAN→EXECUTE）+ ROUTING_HINT 首行标签（可读/可解析）。
  - `auto` 命令（或为现有命令的别名）对 codex exec 的零侵入包装。
  - 质量门事件对齐（understanding/decomposition/acceptance），仅扩展 `data`。
- Out of Scope（后续阶段）
  - 在 orchestrator 内部直接流式操控 codex exec stdin/stdout（中期规划，先通过 `auto` 外层循环达成闭环）。
  - 性能/兼容/回滚的专项门（在下一期扩展）。

## 设计概述

### 1) 自动模型路由（Model Router）

- 位置：`src/router/modelRouter.ts`（新）+ `src/router/rules.json`（新，可热更）。
- 输入：用户自然语言/任务描述（以及可选的用户显式模型/指令）。
- 输出：
  ```json
  {
    "decision": "gpt-5-codex" | "gpt-5",
    "effort": "high",
    "score": 0.0-1.0,
    "features": ["code_fence","diff_header","test_terms"],
    "reasons": ["命中代码围栏","出现 diff 头","构建/测试术语"]
  }
  ```
- 规则（首版）：
  - → `gpt-5-codex`：代码围栏/源码路径/常见扩展名；补丁/差异头；构建/测试/CLI 术语；需要读-改-测-并发-打补丁。
  - → `gpt-5`：研究综述/评审/路线图/合规/成本/风险；跨域知识整合与长链路论证。
- 兼容性：不新增事件类型；路由结果写入既有事件 `data.route` 字段。

### 2) 指令模板（Instruction Composer）

- 位置：`src/instructions/composer.ts`（新）。
- 产出结构：
  - 首行：`ROUTING_HINT: CODEX|GPT5`
  - PLAN（≤150词）：需求复述（约束/排除）、风险与未知（≤3）、执行计划（3–6 原子步骤）、验收标准（对齐质量门）。
  - EXECUTE：
    - CODEX：产出“补丁/命令/差异/测试指令”，标注影响面与回滚点（≤2），能并发则并发。
    - GPT5：证据链+取舍，结构化结论与执行清单（谁/何时/验证点），避免散文化。
  - 触发器：
    - 需求含糊/跨域→先提 2–3 澄清问，再执行。
    - 连续 2 回合无可验证物→强制要求补丁/命令/清单。
- High 语义：因 codex exec 无 `--reasoning-effort` 旗标，模板明确“Reasoning Effort: High”，把“高推理”落实到行为（严谨复述、显式验收、证据链）。

### 3) 入口策略与 `auto` 命令

- 入口命令：`core/cli/commands/auto-command.ts`（新，或将现有包装合并为该命令）。
- 行为：
  1. 路由：调用 modelRouter，若用户显式 `--model` 则尊重显式；否则采用决策；若目标 provider 缺失或 wire_api 不匹配，则回退到 `gpt-5-codex high` 并写入解释性事件。
  2. 指令：调用 composer 生成结构化 instruction（PLAN→EXECUTE）。
  3. 执行：调用 `codex exec --experimental-json --model <M> [--sandbox ...]` 并将 instruction 写入 stdin；`wire_api` 使用 `src/lib/modelWireApiMapping.ts` 校验（`gpt-5-codex→responses`）。
  4. 事件：沿用 `start`/`task_started`/`task_execution_summary` 等事件，在 `data` 中加入 `{ route, routingHint, planDigest, artifactsExpectations }`，并遵循“两行 Stream‑JSON 事件”stdout 契约（见下）。
  5. 补丁：`auto` 产生的补丁统一通过 SWWCoordinator（单写窗口）入队与应用，避免与 orchestrate/外部流程产生竞写；取消/恢复时调用 `requestAbort()`/`resetAbort()` 与 orchestrator 语义一致。

- 输出格式（已澄清）：
  - 默认 `--output-format json`（人类可读/结构化 JSON 摘要）。
  - 若需两行事件：使用 `--output-format stream-json`。
  - 如需“同时保留两行事件又获得 JSON 摘要”，可结合 `--save-stream <file>` 将两行事件写入文件，同时 stdout 输出 JSON（与 orchestrate 一致的使用方式）。
- 选项：
  - `--route-dry-run` 仅输出决策，不执行。
  - `--route-explain json` 输出 `{decision,score,features,reasons}`。
  - `--session-dir`/`--output` 与 MVP10 保持一致。

### 4) 与 orchestrate 的关系（中期）

- 近期：推荐先通过 `auto` 外层循环把“任务=会话”闭环打通（符合 MVP10 的建议实现），并复用 `StateManager` 写入 JSONL。
- 中期：在 `core/orchestrator/process-orchestrator.ts` 内引入最小 `exec runner`（参考 `spawn(..., ["exec","--experimental-json"])` 流程），在 `launchCodexAgent()` 之前传入 `{model, instruction}`；补丁仍走 SWWCoordinator，保持单写窗口一致性。

### 5) 事件契约与两行 Stream‑JSON

- 事件类型：严格使用现有枚举（docs/schemas/stream-json-event.schema.json）。
- 数据扩展仅写入 `data` 字段：
  - `task_started.data.route = { decision, score }`
  - `task_execution_summary.data = { routingHint, planDigest, artifactsExpectations }`
- stdout 契约：
  - orchestrate：仅输出两行 Stream‑JSON 事件 `start` 与 `orchestration_completed`；详细过程写入 JSONL（MVP11 契约）。
  - auto：默认 `json`；在 `--output-format stream-json` 下同样仅输出两行事件（`start`/`orchestration_completed`）。

## 实施计划（Phases）

### P0（1–2 天）：最小闭环
- 新增文件：
  - `src/router/modelRouter.ts`、`src/router/rules.json`
  - `src/instructions/composer.ts`
  - `core/cli/commands/auto-command.ts`
- 验收：
  - 同一输入在两类任务上自动分流；打印可解释路由卡；产出结构化指令；事件写入 JSONL 的 `data`。

### P1（2–3 天）：可解释路由 + 冲突合并 + 入口策略
- 内容：
  - `--route-dry-run`/`--route-explain json`；用户显式 `--model` 优先。
  - `src/router/complexityAssessor.ts`（启发式步数/副作用评估）决定 exec vs orchestrate 入口。
- 验收：
  - 20 条样本命中率≥80%（入口选择）；路由卡可回放。

### P2（3–5 天）：orchestrate 深接（不改官方源）
- 内容：
  - 在 auto 外层循环中对“任务=会话”落地（MVP10 推荐路径）。
  - 事件补全 `understanding_* / acceptance_*` 结果，仍在 `data` 承载。
- 验收：
  - task→exec→事件闭环稳定；Gates 结果可查询；返工中位数≤1。

### P3（2–4 天）：指标化与持续提速
- 内容：
  - 统计澄清轮数/返工率/可验证物覆盖率/平均时长/失败分类；导出 `orchestrator.logs --session <id>` 摘要。
- 验收：
  - ≥80% 回合交付可验证物；路由准确率≥90%。

## 兼容性与风控

- 不改 refer-research/openai-codex 官方源；全部改动在 codex-father 内。
- 事件枚举不新增，仅扩展 `data`（与 MVP11/Schema 对齐）。
- `gpt-5-codex`→`responses`、`gpt-5`→`chat` 的 wire_api 映射沿用现有模块（src/lib/modelWireApiMapping.ts）。
- 若路由失败/规则缺失或 provider 不可用：回退到默认 `gpt-5-codex high`；打印说明并写入 JSONL（例如在 `task_execution_summary.data.routeFallback` 标注）。

### 路由优先级与回退（已澄清）

- 优先级：显式 `--model` > 自动路由决策。
- 回退标注（简版）：
  ```json
  {
    "event": "task_execution_summary",
    "data": {
      "route": { "decision": "gpt-5", "score": 0.62 },
      "routeFallback": { "from": "gpt-5", "to": "gpt-5-codex", "reason": "provider_missing" }
    }
  }
  ```

### 入口选择（exec vs orchestrate，已澄清）

- 简单规则：`complexityAssessor.score >= 0.5` 且估计步数≤3、写入副作用低 → 走 `exec`；否则走 `orchestrate`。
- 可配置：阈值默认 0.5；提供 `--route-explain json` 输出 `{ decision, score, reasons }`。
- CI 门槛：路由样本≥20 条、命中率目标≥90%；默认仅告警，不阻断（可通过环境变量/flag 提升为阻断门）。

### SWW 边界（已澄清）

- 简单实现：进程内单例 SWWCoordinator；不做跨进程文件锁。
- 建议：在并行运行 auto 与 orchestrate 时，尽量复用同一进程/会话，或错峰执行，以避免跨进程竞写。

### MCP 诊断工具（安全姿势，已澄清）

- 默认：保持启用（只读）。
- 生产建议：通过 CLI/config 关闭或限制 `baseDir`；避免跨项目读取路径。

## stdout 契约与示例（补充）

- orchestrate：
  ```bash
  codex-father orchestrate "演练 FR-123" \
    --mode manual \
    --tasks-file core/cli/tests/fixtures/manual.tasks.json \
    --output-format stream-json
  # stdout 仅两行：{"event":"start",...}\n{"event":"orchestration_completed",...}
  ```

- auto（建议在自动化场景使用 stream-json）：
  ```bash
  codex-father auto "路由与执行 FR-9" --output-format stream-json
  # stdout 仅两行：{"event":"start",...}\n{"event":"orchestration_completed",...}
  ```

## 文件与接口清单（新增/修改）

- 新增
  - `src/router/modelRouter.ts`：纯函数路由器（输入文本→二选一决策+解释）。
  - `src/router/rules.json`：可配置规则与权重。
  - `src/instructions/composer.ts`：模板引擎（PLAN→EXECUTE）。
  - `core/cli/commands/auto-command.ts`：统一入口命令（或 alias）。
- 修改
  - `core/cli/start.ts`：注册 `auto` 子命令。
  - `docs/mvp/README.md`：追加 MVP12 索引。

## 测试策略

- 路由单测：给定 20–50 条样本（输入→期望模型），命中率≥90%。
- 契约测试：
  - 拦截 spawn 断言 `--model <M>` 旗标；
  - 事件 JSONL 结构断言：在 `task_started` 与 `task_execution_summary` 的 `data` 含路由与模板摘要。
- 回归：与 MVP10 的 `auto`/补丁链路用例不冲突；与 MVP11 的两行 stdout 契约一致。

## 指令模板（附）

```
System:
You are my senior engineering partner. Quality first (accurate, aligned, no misunderstanding), then efficiency. Reasoning Effort: High.

Policy:
- First line: ROUTING_HINT: CODEX|GPT5
- Two-phase response:
  PLAN (<=150 words): restate constraints/exclusions; risks<=3; 3-6 atomic steps; acceptance criteria.
  EXECUTE: if CODEX -> patches/commands/diffs/tests with impact & rollback(<=2); if GPT5 -> evidence & decision + execution checklist.
- Triggers: if ambiguous/cross-domain -> ask 2-3 clarifying Qs; if 2 rounds w/o artifacts -> force artifacts.

Assistant output format:
ROUTING_HINT: CODEX|GPT5

PLAN:
- ...

EXECUTE:
- ...
```

## 路由规则示例（附）

- `rules.json` 结构示例：
```json
{
  "version": 1,
  "default": "gpt-5-codex",
  "signals": [
    { "name": "code_fence", "pattern": "```", "weight": 0.25, "to": "gpt-5-codex" },
    { "name": "diff_header", "pattern": "^diff --git|\\n\\*\\*\\* Begin Patch", "flags": "m", "weight": 0.35, "to": "gpt-5-codex" },
    { "name": "build_test_terms", "pattern": "npm|pnpm|cargo|pytest|mvn|make|docker|rg -n|sed -n", "weight": 0.2, "to": "gpt-5-codex" },
    { "name": "research_terms", "pattern": "合规|风控|路线图|评审|综述|trade-off|取舍|回报|成本", "weight": 0.3, "to": "gpt-5" }
  ],
  "threshold": 0.5
}
```

## 风险与缓解

- 路由误判：提供 `--route-dry-run/--route-explain` 与人工 override；保底回退默认模型。
- 冗长输出：由模板约束为结构化与可验证产物；非散文化。
- 事件漂移：仅扩展 `data`，不碰事件名；对齐 Schema（docs/schemas/stream-json-event.schema.json）。

—— End of MVP12 ——
