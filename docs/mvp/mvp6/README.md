# MVP6：帮助（help）与环境体检（doctor）— 自发现与自检

更新时间：2025-10-08

## 目标
- 为 CLI/MCP 提供“自发现与自检”能力：用户无需翻文档即可获知可用命令/工具、环境/配置是否健康。
- 与 MVP12/auto、MVP11/四模式 契约一致，不引入新事件类型；必要信息写入 JSONL 的 `data` 字段。

## 范围（In Scope）
- CLI：
  - `codex-father help [--json]`：输出命令树、关键选项与简述；`--json` 给结构化描述。
  - `codex-father doctor [--fix] [--json]`：体检环境与配置，给出建议或一键修复（仅安全项）。
- MCP：
  - 在 `tools/list` 中补充分组与描述；
  - 只读诊断工具保留（`read-report-file`、`read-events-preview`、`read-session-artifacts`）。

不在范围（Out of Scope）
- 跨项目批修；
- UI/TUI；
- 云端遥测（仅本地体检）。

## 体检项（初版）
- CLI/环境：Node 版本（>=18）、git、可写目录权限（`.codex-father/` 0700）、`codex` 可用性与版本。
- 模型/Provider：是否配置了 `gpt-5-codex`，`wire_api` 是否为 `responses`；推荐项告警（非阻断）。
- 网络与代理：`workspace-write` 下联网标志，必要时提示开启；
- 安全：脱敏策略是否开启；MCP 诊断工具是否限制基目录（生产建议）。

## CLI 输出与退出码
- `help`：
  - 默认人类可读；`--json` 输出 `{ commands: [...], options: [...] }`。
- `doctor`：
  - 默认人类可读摘要；`--json` 输出：
  ```json
  {
    "status": "ok|warn|error",
    "checks": [
      { "id": "node_version", "ok": true, "actual": "v18.19.0", "hint": "" },
      { "id": "wire_api", "ok": false, "actual": "chat", "expected": "responses", "hint": "change wire_api" }
    ]
  }
  ```
  - 退出码：`0=ok|warn`、`1=error`；`--fix` 执行成功仍返回 0。

## 实施建议（简单实现）
- `help`：遍历现有 parser 的注册命令（含别名），打印树；`--json` 直出结构。
- `doctor`：
  - 读取用户配置，复用 `src/lib/modelWireApiMapping.ts` 与 `src/lib/configValidator.ts`；
  - 逐项检测 → 累计状态（ok/warn/error）→ 输出；
  - `--fix`：仅对“安全且可逆”的项进行更改（如本地配置模板写入/补全），其余给出 next step。

## 测试建议（CI gating：简版）
- 样本 20 条、命中率≥90%（路由/入口解释适配 G1）；
- `doctor` 在最常见场景返回 ok/warn，wire_api 错配返回 warn；
- `help --json` 的 schema 稳定并在文档中示例。

## 路线与依赖
- 依赖：MVP12（需覆盖 `auto`）、MVP11（需覆盖 MCP/四模式）；
- 可与 MVP5/7 并行实施；完成后作为“第一次使用”的推荐入口之一。

---

> 该文档为 MVP6 的雏形，聚焦“简单可用”。后续可按需要扩展修复项与规则。

