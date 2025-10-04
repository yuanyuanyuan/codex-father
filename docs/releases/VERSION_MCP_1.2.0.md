# Codex Father MCP v1.2.0 — 发布摘要（008 UltraThink Codex‑0）

> 发布对象：`@starkdev020/codex-father-mcp-server`
> 标签：`mcp-v1.2.0`（语义化发布生成）

---

## 一句话总结

为 Codex
0.44 带来“可检测、可降级、可修复”的全链路兼容能力：版本检测、参数-版本映射、Profile 自动修复、严格错误码与 MCP 方法兼容校验。

---

## 新增

- 版本检测与缓存：解析 `codex --version`，不可用时快速失败并提示
- 参数-版本映射：在 0.42 ↔ 0.44 之间进行参数兼容与降级策略
- Profile 自动修复：按模型/能力修正关键项（如 `wire_api`, `model`, 超时等）
- 验证与错误码：不满足 `minVersion` 或参数不合法时返回 `-32602`；网关错误对齐
  `405/401/429/500`
- MCP 方法兼容校验：在 tools/call 前进行版本与参数门禁

## 变更

- 日志与问题提示更加结构化、可诊断
- 错误信息统一走 JSON-RPC/MCP 语义，便于上层消费

## 修复

- codex 命令不存在/执行失败时的挂起问题 → 统一快速失败并输出修复建议

---

## 兼容性

- 无破坏性变更（MINOR）。旧参数默认兼容，必要时自动降级；当约束无法满足时明确返回
  `-32602`。

---

## 快速开始（升级关注）

1. 安装/升级：`npm i -g @starkdev020/codex-father-mcp-server`
2. 启动：`codex-mcp-server --help`
3. 查看版本检测与修复日志：检查 `.codex-father/sessions/<id>/` 下的 `*.log`
   与事件 JSONL

---

## 关联文档

- 规格与设计：`specs/__archive/008-ultrathink-codex-0/spec.md`
- 数据模型：`specs/__archive/008-ultrathink-codex-0/data-model.md`
- 快速上手：`specs/__archive/008-ultrathink-codex-0/quickstart.md`
- 计划与验收：`specs/__archive/008-ultrathink-codex-0/plan.md`,
  `T058_acceptance_report.md`

### 部署补充

- 环境模板：`config/templates/codex-father.env.example`（配置 `CODEX_START_SH` /
  `CODEX_JOB_SH` / `CODEX_SESSIONS_ROOT`）

---

_本页为 MCP 子包 v1.2.0 版本说明，项目级总览请参考根 `CHANGELOG.md` 与
`RELEASE_NOTES.md`。_
