# Codex Father MCP v1.3.0 — 发布摘要（工具别名与命名策略）

> 发布对象：`@starkdev020/codex-father-mcp-server` 标签：`mcp-v1.3.0`

---

## 一句话总结

新增工具别名与命名策略，提供更友好的 `codex_*`
下划线风格名称，同时支持按需过滤与前缀扩展，便于在不同客户端与生态中对齐命名规范。

---

## 新增

- 工具别名：为所有 `codex.*` 工具自动生成 `codex_*` 别名（如 `codex.exec` ↔
  `codex_exec`）
- 命名风格过滤：通过 `CODEX_MCP_NAME_STYLE=underscore-only | dot-only`
  控制工具导出集合
- 前缀别名：`CODEX_MCP_TOOL_PREFIX` 自动生成 `<prefix>.<name>` 与
  `<prefix>_<name>` 两种前缀别名
- 隐藏原始名称：`CODEX_MCP_HIDE_ORIGINAL=1|true` 仅导出别名，隐藏 `codex.*`
  原始名称
- 新增 `codex.help`
  工具（别名：`codex_help`），集中展示工具用法、参数示例与返回示例

## 变更

- `tools/list` 结果现在可能包含更多别名（默认保留原始名称 + 下划线别名）
- 文档补充命名策略说明与示例

## 修复

- 无（MINOR）

---

## 兼容性

- 默认行为保持兼容：不设置任何环境变量时，原始名称与下划线别名同时存在
- 若设置 `CODEX_MCP_HIDE_ORIGINAL`，将影响依赖 `codex.*`
  名称的客户端（请谨慎启用）

---

## 升级建议

1. 无需改动即可升级（默认兼容）
2. 如需统一风格，在部署环境设置：
   - 仅下划线：`CODEX_MCP_NAME_STYLE=underscore-only`
   - 仅点号：`CODEX_MCP_NAME_STYLE=dot-only`
   - 统一前缀：`CODEX_MCP_TOOL_PREFIX=myapp`

---

_本页为 MCP 子包 v1.3.0 版本说明，项目级总览请参考根 `CHANGELOG.md` 与
`RELEASE_NOTES.md`。_
