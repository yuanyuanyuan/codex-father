# Changelog

本文档记录 Codex Father 项目的所有重要变更。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，本项目遵循
[语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### ♻️ 改进

- 补丁模式默认将 diff 落盘并仅在日志中输出预览，新增
  `--patch-output`、`--patch-preview-lines`、`--no-patch-preview`、
  `--no-patch-artifact` 等 CLI 开关，配合元数据记录哈希与行数。
- 更新 `codex.help`/README/故障排除文档，强调缩减日志噪声的推荐参数（如
  `--no-echo-instructions`、`--no-carry-context`、`view=result-only`）。

### 🛠️ 修复

- MCP: 修正 `codex.logs` 在 `.codex-father`
  目录下重复拼接路径的问题，并在报错时附带 `details.searched` 帮助排查。
- docs/help: 补充未受支持参数 (`--notes`/`--files`/裸文本) 的错误案例与修复指南，避免再次触发退出码 2。

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
