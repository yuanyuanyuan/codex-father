# Changelog

本文档记录 Codex Father 项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，本项目遵循
[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### ✨ 新增 / 兼容性

- CLI 兼容旧模型写法 `gpt-5-codex-<effort>`（0.42/0.44 风格）：
  - `--model gpt-5-codex-minimal|low|medium|high` 将归一化为
    `model=gpt-5-codex` + `model_reasoning_effort=<effort>`；
  - 同样适用于 `--codex-config model=gpt-5-codex-<effort>` 注入。

### 📚 文档

- README（中/英）补充“模型与推理力度（兼容 0.42/0.44 与 0.46）”示例与注意事项。

### mcp/codex-mcp-server 3.0.2

- fix(common): 忽略“未使用的 MCP 客户端启动超时”，避免将整次运行误判为
  `network_error`；可通过环境变量 `CODEX_IGNORE_MCP_START_FAILURES=0`
  恢复旧行为。
- fix(common): 规范输出 last.txt 的换行（末尾自动补齐），减少 “with no line
  terminators” 的解析噪音。
- fix(common): `CONTROL: DONE/CONTINUE`
  仅在“整行匹配”时生效，避免句中提及触发误判。
- chore(runtime): 同步更新 MCP runtime 的
  `assets/runtime/lib/common.sh`，与主库行为保持一致。

## 1.8.0 - 2025-10-13

### ✨ 新增

- CLI: 新增 `version` 子命令，支持 `--json` 输出（便于自动化采集环境信息）。
- HTTP: 新增 `GET /api/v1/version` 返回
  `{ name, version, node, platform, env }`；`GET /healthz` 同步返回
  `{ name, version }`。
- MCP: 新增工具
  `codex.version`，返回文本与结构化字段（`mcpName/mcpVersion/coreName/coreVersion/node/platform/pid`）。

### 🧪 测试

- 覆盖 `/api/v1/version` 端点的单测（确保与根包版本一致）。
- 覆盖 MCP tools spec 含 `codex.version` 的单测。
- 覆盖 CLI 版本命令在 `--json` 模式下的单测。

### 📚 文档

- README（中/英）与用户手册：新增“版本查询（CLI/MCP/HTTP）”章节与示例；HTTP 章节补充
  `/api/v1/version` 与 `/healthz` 示例。

### 说明

- 本次为向后兼容的功能新增（minor）。MCP 子包版本将由语义化发布自动提升。

## 1.6.2 - 2025-10-12

### ♻️ 改进 / 文档

- 统一“prod（生产）”示例为 npx 启动：在 Codex CLI (rMCP) 的
  `~/.codex/config.toml` 中使用 `command = "npx"` 与
  `args = ["-y", "@starkdev020/codex-father-mcp-server", "--transport=ndjson"]`。
- 保持 “preview（预览/本地调试）” 使用本地源码构建产物：`command = "node"` + 本地
  `dist/index.js` 并显式 `--transport=ndjson`。
- 同步更新中英文文档示例：README、User
  Configuration、Installation、Manual、Quick Start。

### 说明

- 本次为文档与示例更新，不涉及运行时代码逻辑变更。

### mcp/codex-mcp-server 3.0.1

- 文档示例与说明同步“prod 用 npx”的口径。

### ✨ 新增

- CLI: `orchestrate:report` 新增 `--duration-precision <0|1|2>`（与
  `--duration-format` 协同控制人类摘要时长精度，不影响 JSON）。
- MCP 诊断：`grep-events` 支持 `ignoreCase`（大小写不敏感）与
  `regex`（正则匹配）。
- rMCP 脚本：新增 `diagnose-report` 命令，一步拿到 `reason` 并按 Playbook 行动。

### ♻️ 改进

- 诊断工具严格化（入参与错误码映射）：
  - `read-report-file`/`read-events-preview`/`read-report-metrics`
    要求绝对路径；
    - 不存在→`not_found`（ENOENT）；权限不足→`permission_denied`（EACCES/EPERM）；相对路径/缺参→`invalid_arguments`。
  - `grep-events` 新增参数校验：`q` 必须非空、`limit` 为正整数；并支持
    `ignoreCase`/`regex`。
- SWW：补充“多轮交错重放×顺序扰动”用例，验证重放在复杂场景仍遵循全局入队顺序（FIFO）。

### 🧪 测试

- `core/mcp/tests/diagnostic-tools.test.ts` 增加 6 条断言：
  - `read-report-metrics` 相对路径→`invalid_arguments`，缺文件→`not_found`；
  - `grep-events` 空 `q` / 相对路径 / 缺文件→对应
    `invalid_arguments`/`not_found`；
  - `grep-events` 在 `ignoreCase`/`regex` 模式下匹配计数正确；非法正则经
    `call-with-downgrade` 映射为 `invalid_arguments`。
- `core/orchestrator/tests/sww-multi-round-interleaved.perturbed-order.test.ts`：多轮交错重放×顺序扰动。

### 📚 文档

- 新增
  `docs/user/mcp-diagnostic-playbook.md`：提供 ASCII 决策树（reason→行动）与命令演示。
- 更新 `docs/user/mcp-diagnostic-tools.md`：补充 `not_found`/`permission_denied`
  枚举与 `grep-events` 新参数示例。
- `docs/user/orchestrate-report.md` 补充 `--duration-precision`
  说明；README 顶部增加“快速开始”直达提醒。

### 🔎 示例输出（rMCP 降级诊断片段）

```
$ node scripts/rmcp-client.mjs diagnose-report --path /abs/path/to/missing-report.json
诊断结果：degraded=true, reason=not_found
{
  "status": "ok",
  "degraded": true,
  "reason": "not_found",
  "result": null
}
```

- T030 仓库整洁度（依赖/文档）
  - 移除未使用依赖：chokidar/mermaid/fs-extra/@types-fs-extra/supertest/@types-supertest/jscpd
  - 保留：tslib/rimraf/vite/@vitest/coverage-v8；新增可选依赖 winston-syslog（用于 Syslog 输出）
  - 同步契约与指引：events.md 增补 JSONL 审计事件；AGENTS.md 增补 Gates/Events；开发文档移除 fs-extra 主依赖描述
- 测试增强（不改运行时逻辑）
  - Gate 顺序与阻断：manualIntervention → understanding →
    decomposition 的多路径断言
  - 资源联动：concurrency_reduced /
    concurrency_increased 的降级/恢复联动与 from/to 字段
- SWW 映射与顺序：长队列部分失败保持事件配对与顺序一致性（tool_use+patch_applied
  / task_failed+patch_failed）
- SWW 工作区异常：prepareWorkspace 失败映射为 patch_failed，不再中断队列
- CI 改进：新增 orchestrator 专用工作流（.github/workflows/test-orchestrator.yml），Node 版本矩阵（18/20），仅在 orchestrator/schema/contracts/AGENTS 等路径变化时触发
- 补丁模式默认将 diff 落盘并仅在日志中输出预览，新增
  `--patch-output`、`--patch-preview-lines`、`--no-patch-preview`、
  `--no-patch-artifact` 等 CLI 开关，配合元数据记录哈希与行数。
- 更新 `codex.help`/README/故障排除文档，强调缩减日志噪声的推荐参数（如
  `--no-echo-instructions`、`--no-carry-context`、`view=result-only`）。
- CLI: `start` 命令支持 `--instructions`（JSON/YAML/XML）+ `--task`
  结构化指令文件，执行前会校验 schema、输出归一化副本，并通过
  `CODEX_STRUCTURED_*` 环境变量传递给 Shell。
- 新增 `job.sh resume` 子命令与 `codex.resume` MCP 工具，可复用 `state.json`
  中记录的参数重启任务，并在会话状态写入 `resumed_from` 与 `args`
  字段，便于断线续跑与审计。
- Job 状态归一化（补丁模式）：当启用 `--patch-mode` 且最后消息包含可应用补丁以及
  `CONTROL: DONE` 时，即使底层退出码非 0，也将规范化为
  `state=completed`、`exit_code=0`、`classification=patch_only`，便于无人值守场景直接消费产物（不再被审批拦截的“失败表象”干扰）。

### 🛠️ 修复

- MCP: 修正 `codex.logs` 在 `.codex-father`
  目录下重复拼接路径的问题，并在报错时附带 `details.searched`
  帮助排查路径探测历史。
- CLI: 可写沙箱在未显式允许时将 `never` 自动归一为
  `on-failure`，避免健康检查类任务在无人值守环境下直接触发 `approval_required`。
- docs/help: 补充未受支持参数 (`--notes`/`--files`/裸文本) 的错误案例与修复指南，避免再次触发退出码 2。
- CLI/job: 消除 `state.json`
  写入竞态（启动前先写入初始 running，trap 兜底缺失时自建骨架），失败/停止均能稳定落盘并被动通知可用。
- CLI: trap 统一追加 `Exit Code: <N>`
  独立行，状态归纳器可稳定解析退出码；停止场景强制归类为 `user_cancelled`。
- CLI: `--preset` 严格校验（仅 `sprint|analysis|secure|fast`），未知预设直接作为
  `input_error` 失败并提示修正。
- 分类精度：`input_error` 优先于网络/工具错误匹配；超限预检统一
  `context_overflow` 并在日志中写出 `[input-check]` 提示。
- MCP/CLI: 会话目录名时间戳改为“系统本地时区”（`exec-YYYYMMDDHHmmss-<tag>`），并在 CLI 由 run-id 反推的显示时间附带本地偏移（不再使用 UTC
  `Z`）。

---

## [1.0.0] - 2025-10-01

### 🎉 首次正式发布 (MVP1)

这是 Codex Father 的首个正式版本，实现了完整的 MCP 服务器功能。

### ✨ 新增功能

#### MCP 协议支持

- 实现 MCP 2024-11-05 协议规范
- 支持 stdio 传输方式
- 提供标准化的工具定义和调用接口
- 实时事件通知机制

#### MCP 工具

- `codex-chat` - 发送消息到 Codex 对话
- `codex-execute` - 执行 Codex 任务
- `codex-read-file` - 读取工作区文件
- `codex-apply-patch` - 应用文件补丁

#### 进程管理

- 单进程 Codex CLI 管理 (`SingleProcessManager`)
- 自动健康检查和进程重启
- 进程生命周期完整管理
- 异步非阻塞执行模式

#### 审批机制

- 4 种审批策略：UNTRUSTED / ON_REQUEST / ON_FAILURE / NEVER
- 终端交互式审批 UI (`TerminalUI`)
- 白名单正则表达式匹配 (`PolicyEngine`)
- 审批超时控制
- 批量审批支持

#### 会话管理

- 自动会话创建和目录管理 (`SessionManager`)
- JSONL 格式事件日志流式写入 (`EventLogger`)
- JSON 格式配置持久化 (`ConfigPersister`)
- Rollout 引用文件管理
- 会话状态追踪 (INITIALIZING → ACTIVE → IDLE → TERMINATED)

#### 事件系统

- Codex 事件到 MCP 通知的实时映射 (`EventMapper`)
- 支持 Job / Session / Process / Approval 事件
- 进度通知推送
- 错误和完成状态通知

#### CLI 命令

- `codex-father mcp` - 启动 MCP 服务器
- 支持 `--debug`, `--server-name`, `--timeout` 等选项
- 优雅关闭处理 (SIGINT, SIGTERM)
- 用户友好的输出界面

### 🚀 性能优化

- tools/call 响应时间 ~60ms (目标 < 500ms，超出 8.3x)
- 事件映射延迟 ~0.008ms (目标 < 100ms，超出 12,500x)
- 内存使用 ~100MB (目标 < 200MB，低于 50%)
- 并发请求处理 ~65ms

### ✅ 测试覆盖

- 51 个测试文件
- 506 个测试用例通过 (98.8% 通过率)
- 契约测试 (MCP 和 Codex JSON-RPC)
- 单元测试 (覆盖所有核心模块)
- 集成测试 (端到端场景)
- 性能基准测试

### 📚 文档

- README.md - 项目概述和使用指南
- docs/developer/DEVELOPMENT.md - 开发指南
- docs/architecture/mcp-integration.md - MCP 集成详细文档
- docs/\_\_archive/old-docs/mvp1-manual-test-plan.md - 完整测试计划
- docs/\_\_archive/old-docs/mvp1-quick-test-guide.md - 快速测试指南
- docs/releases/RELEASE_NOTES.md - 发布说明
- CHANGELOG.md - 变更日志

### 🏗️ 技术栈

#### 核心依赖

- TypeScript 5.3+ - 类型安全
- Node.js 18+ - 运行时
- @modelcontextprotocol/sdk ^1.0.4 - MCP 官方 SDK
- inquirer ^9.3.7 - 终端交互 UI
- zod ^3.24.1 - 运行时类型验证
- uuid ^11.0.3 - 唯一 ID 生成

#### 开发工具

- vitest ^1.6.1 - 测试框架
- ESLint - 代码质量检查
- Prettier - 代码格式化

### 🎯 代码质量

- ✅ TypeScript strict mode
- ✅ 0 个 Lint 错误
- ✅ 代码重复率 0.67% (目标 < 5%)
- ✅ SOLID 原则遵循
- ✅ 模块化设计

### 🔧 项目结构

```
codex-father/
├── core/                 # MVP1 核心实现
│   ├── approval/        # 审批系统
│   ├── cli/             # CLI 命令
│   ├── mcp/             # MCP 协议实现
│   ├── process/         # 进程管理
│   ├── session/         # 会话管理
│   └── lib/             # 共享库
├── tests/               # 测试
│   ├── contract/        # 契约测试
│   ├── integration/     # 集成测试
│   └── benchmark/       # 性能测试
├── docs/                # 文档
└── specs/               # 设计规范
```

### ⚠️ 已知限制

#### MVP1 范围限制

- 单进程管理（串行执行任务）
- 终端交互式审批 UI
- 基础的 JSONL 日志格式

#### 非阻塞问题

- 237 个 Lint 警告（仅代码风格，不影响功能）

### 🔗 相关链接

- [完整发布说明](./docs/releases/RELEASE_NOTES.md)
- [项目文档](./README.md)
- [开发指南](./docs/developer/DEVELOPMENT.md)
- [MCP 集成文档](./docs/architecture/mcp-integration.md)

---

## [Unreleased]

### 计划功能 (MVP2)

#### 性能增强

- 多进程池管理
- 智能任务调度
- 并发控制优化

#### 功能扩展

- Web UI 审批界面
- 日志查询和分析工具
- 更多 MCP 工具

#### 监控和运维

- 性能监控面板
- 健康检查 API
- 日志聚合和分析

---

## 版本说明

### 语义化版本格式

- **主版本号 (MAJOR)**: 不兼容的 API 变更
- **次版本号 (MINOR)**: 向下兼容的功能性新增
- **修订号 (PATCH)**: 向下兼容的问题修正

### 变更类型

- **Added** (新增): 新功能
- **Changed** (变更): 现有功能的变更
- **Deprecated** (废弃): 即将移除的功能
- **Removed** (移除): 已移除的功能
- **Fixed** (修复): 任何 bug 修复
- **Security** (安全): 修复安全问题

---

**注意**: 本项目目前处于 MVP1 阶段，API 可能会有变动。我们会在 v2.0.0 之前保持 API 稳定。

[1.0.0]: https://github.com/your-org/codex-father/releases/tag/v1.0.0
[Unreleased]: https://github.com/your-org/codex-father/compare/v1.0.0...HEAD

### Added

- MCP: 新增 `codex.help`
  自发现工具（列出所有方法与示例，支持 markdown/json 输出）。
- MCP: 为所有 `codex.*` 工具提供下划线等价别名：`codex_exec`, `codex_start`,
  `codex_status`, `codex_logs`, `codex_stop`, `codex_list`, `codex_help`。
- Docs: 更新使用文档与快速开始、故障排除、监督模式说明以覆盖别名与自发现。
- Tests: 新增别名轻量 E2E（`mcp/codex-mcp-server/tests/mcp_aliases_e2e.sh`），覆盖
  `tools/list`、`codex_status`、`codex_logs`。

### 已发布（子包）

- MCP 子包 `@starkdev020/codex-father-mcp-server`：
  - v1.4.0 可发现性与传输增强（NDJSON 默认，支持
    `--transport=content-length`，新增
    `codex.clean`/`codex.metrics`，`codex.logs` 增强）
  - v1.3.0 工具别名与命名策略（`CODEX_MCP_NAME_STYLE`、`CODEX_MCP_TOOL_PREFIX`、`CODEX_MCP_HIDE_ORIGINAL`、`codex.help`）
  - v1.2.0 版本兼容门禁（Codex 版本检测、参数与配置键校验、明确错误码）
