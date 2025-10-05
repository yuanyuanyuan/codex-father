# Codex Father MCP v1.4.0 — 发布摘要（可发现性与传输增强）

> 发布对象：`@starkdev020/codex-father-mcp-server` 标签：`mcp-v1.4.0`

---

## 一句话总结

增强可发现性与互操作性：新增 `--help`/`--version`
与启动横幅，默认 NDJSON（与官方 SDK 对齐），同时提供
`--transport=content-length`
兼容旧式分帧客户端；新增清理与指标工具，日志查看更灵活。

---

## 新增

- CLI 可用性：
  - `--help|-h` 输出用法与环境变量说明
  - `--version|-V` 输出版本号
  - 启动横幅（记录传输模式、日志级别、路径与关键环境变量）
- 传输模式：
  - 默认 `NDJSON`（与 `@modelcontextprotocol/sdk` stdio 实现一致）
  - 兼容 `Content-Length` 分帧：`--transport=content-length`
- 新工具：
  - `codex.clean` 清理历史会话（支持 `dryRun`、按状态/时间过滤）
  - `codex.metrics` 汇总任务指标（状态分布、时长、令牌等）
- `codex.logs` 增强：新增 `view` 参数（`default`/`result-only`/`debug`）

## 变更

- 默认使用 NDJSON 作为 stdio 传输；`--transport=stdio` 等价于 `ndjson`
- 启动与错误信息统一输出到 stderr（不污染 stdio 渠道）
- 初始化握手后输出“等待 initialize”与入门指引（stderr）

## 修复

- `content-length` 传输解析错误时的容错与明确错误日志

---

## 兼容性与用户影响评估

- 默认 NDJSON 与官方 SDK 行为一致；若你的客户端强依赖 Content-Length 分帧：
  - 解决：在命令行添加 `--transport=content-length`，或在 MCP 客户端 args 中配置
- `codex.logs` 新增的 `view` 为可选参数，不影响旧调用
- 命名策略与别名行为沿用 1.3.0 的默认值（同时导出原始名与下划线别名）
- 协议版本由 SDK 报告（例如 `2025-06-18`）；若你的客户端强制要求旧版常量（如
  `0.1`），需升级客户端或 SDK

若以上任一项在你环境中造成兼容问题，请先不要升级生产环境，或联系维护者获取兼容补丁。

---

## 升级建议

1. 直接升级（默认无破坏）：
   ```bash
   npm i -g @starkdev020/codex-father-mcp-server@1.4.0
   ```
2. 对 Content-Length 客户端：
   - 在配置中追加 `--transport=content-length`
3. 检查脚本与文档中是否误用二进制名（应为 `codex-mcp-server`）

---

_本页为 MCP 子包 v1.4.0 版本说明，项目级总览请参考根 `CHANGELOG.md` 与
`RELEASE_NOTES.md`。_
