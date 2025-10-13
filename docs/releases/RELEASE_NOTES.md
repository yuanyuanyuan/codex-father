# Release Notes - Codex Father

> 最新亮点：MCP 子包 v1.6.0 发布（内置脚本自动同步，缺失即显式报错）

---

## 🎉 重大里程碑（节选）

这是 **Codex Father** 的发布汇总页。MCP 子包已完成以下关键版本：

- v1.6.1：仓库整洁度与编排增强（依赖清理、事件契约与 AGENTS 指南同步、SWW 工作区异常不再中断队列、Orchestrator CI 矩阵 Node 18/20）
- v1.6.0：移除系统 fallback，自动同步 `.codex-father` 内置脚本并提供显式缺失错误
- v1.4.0：可发现性与传输增强（默认 NDJSON；`--transport=content-length`；`codex.clean`/`codex.metrics`；`codex.logs`
  增强）
- v1.3.0：工具别名与命名策略（`CODEX_MCP_NAME_STYLE`/`CODEX_MCP_TOOL_PREFIX`/`CODEX_MCP_HIDE_ORIGINAL`；`codex.help`）
- v1.2.0：版本兼容门禁（Codex 版本检测、参数与配置键校验、明确错误码）

完整详细说明见 docs/releases 目录下对应版本页面。

---

## v1.7.0 — 2025-10-12

本次版本聚焦“可观测性 + 变量化根路径 + 低噪声日志”。

### ✨ 新增

- logs:summary（按会话生成摘要）：从 `events.jsonl` 生成 `report.summary.json`，并支持 `--text` 预览。
- logs --summary（就地多会话预览）：支持 `id1,id2` 或 `all` 汇总多会话关键信息。
- 事件枚举补充：`instructions_updated`（记录指令快照 path/sha256/行数/增删行）。
- 自检脚本：`scripts/validate-session.sh` 检查 `events.jsonl` 起止事件与 `state.json` 闭合。

### ♻️ 改进

- 变量化会话根目录：新增 `core/lib/paths.ts`，统一解析 `CODEX_SESSIONS_ROOT`（或 `CODEX_SESSIONS_HOME`），默认回退 `.codex-father/sessions`。
- CLI 与 MCP 工具接入变量：`orchestrate`、`logs`、`logs:summary`、`read-session-artifacts`、`list-sessions`、`get-latest-session`。
- 异步作业链路写入标准事件：`start` 与 `orchestration_completed`，确保最小可复盘事件闭环。
- 指令降噪：默认不再把“合成指令全文”贴入 `job.log`；改为 `instructions_updated` 事件 + `sha` 摘要；可通过 `CODEX_ECHO_INSTRUCTIONS=1` 或 `--echo-instructions --echo-limit 0` 恢复全文回显。

### 🐛 修复

- `state.json` 可能停留在 `running` 的情况：编排与作业在结束路径统一落盘最终状态（completed/failed/cancelled）。

### 🔧 升级与兼容性

- 历史 `.codex-father-sessions/` 依然可用：建议将其做为软链指向 `.codex-father/sessions/`；或直接通过 `CODEX_SESSIONS_ROOT` 指向历史根。
- 若依赖 `job.log` 中的“合成指令全文”，请显式开启回显或改为消费 `instructions_updated` 事件与快照文件。

### 📚 文档

- README（中英）补充 `logs:summary` 与 `logs --summary` 用法、变量根路径说明。
- `docs/user/manual*.md`、`docs/user/configuration*.md` 均已注明 `CODEX_SESSIONS_ROOT` 为推荐入口，历史变量 `CODEX_SESSIONS_HOME` 仍兼容。

---

## [Unreleased]

本节总结自上次发布以来的新增与改进，重点聚焦“更强可观测、更稳诊断、可读摘要”的交付。

### ✨ 新增

- 细粒度进度：`status --json` 增加 `progress{current,total,percentage,currentTask,eta*}` 与 `checkpoints[]`；ETA 采用指数滑动均值估算（EWM）。
- 事件扩展：新增 `plan_updated`、`progress_updated`、`checkpoint_saved`（SSE/文件队列均输出，见 `docs/schemas/stream-json-event.schema.json`）。
- 只读 HTTP/SSE：`http:serve` 提供 `/api/v1/jobs/:id/status|checkpoints|events`；SSE 支持 `fromSeq` 断点续订与心跳；错误体统一 `{ code, message, hint }`。
- 批量 CLI：`bulk:status` 一次查询多个作业状态（只读，便于脚本化）。
- CLI 报告摘要：`orchestrate:report` 新增 `--duration-precision <0|1|2>`，与 `--duration-format` 搭配控制人类可读摘要的时长精度（不影响 JSON）。
- 诊断工具增强：`grep-events` 支持 `ignoreCase`（大小写不敏感）与 `regex`（正则匹配）。
- rMCP 示例：新增 `diagnose-report` 命令，一步拿到降级 `reason` 并按 Playbook 行动。

### 🔒 行为强化（补丁模式 DRY RUN 强制确认）

- CLI 与 rMCP 运行时新增补丁模式强制确认与冲突校验：
  - `--patch-mode` 必须显式确认，否则直接失败（退出码 2）。确认方式：`--ack-patch-mode` 或 `--tag DRYRUN` 或环境变量 `CODEX_ACK_PATCH_MODE=1`。
  - 与落盘/提交相关的开关将报错退出：`--require-change-in`、`--require-git-commit`、`--auto-commit-on-done`、`--repeat-until`。
  - 日志顶部打印 `[dry-run] Patch Mode: on` 横幅；产生有效补丁时统一标记 `classification=patch_only`（仅产出补丁，仓库未修改）。

### ♻️ 改进（入参与错误码映射更严格）

- `read-report-file` / `read-events-preview` / `read-report-metrics`：
  - 仅接受绝对路径；相对路径/缺参 → `invalid_arguments`
  - ENOENT → `not_found`；EACCES/EPERM → `permission_denied`
- `grep-events`：
  - 新增参数校验：`q` 必须非空、`limit` 为正整数
  - 支持 `ignoreCase`/`regex`；非法正则 → `invalid_arguments`
- SWW：补“多轮交错重放×顺序扰动”用例，验证重放在复杂场景仍遵循全局入队顺序（FIFO）。

### ⏱️ 行为变更：会话目录时间戳改为本地时区

- MCP `codex.exec`（含 fallback runtime）生成的 `runId`/会话目录名现使用“系统本地时区”的 14 位时间戳，格式保持 `exec-YYYYMMDDHHmmss-<tag>`，便于人工检索与对照系统时钟。
- CLI 在基于 run-id 反推出“显示时间”（日志头中的括号部分）时，现附带本地时区偏移（例如 `+08:00`），不再使用固定 `Z`（UTC）。

兼容性影响（如你做了自动化解析）：
- 若你的脚本依赖目录名的“UTC 语义”，请改为不假设时区或显式读取偏移；目录名的结构未变，仅时间语义从 UTC → 本地时区。
- 若你的工具解析日志头中的时间并假定 `Z` 结尾，请改为解析 `±HH:MM` 偏移或忽略偏移字段。

快速验证建议：
- 生成一个新会话后，检查 `.codex-father/sessions/` 下是否存在以本地时间生成的 `exec-YYYYMMDDHHmmss-<tag>` 目录；对比 `date +%Y%m%d%H%M%S`（秒级）以确认一致。
- 查看该会话的 `job.log` 头部，`Codex Run Start: <TS> (<TS_DISPLAY>)` 中 `<TS_DISPLAY>` 应带本地时区偏移（如 `+08:00`）。

### 🧪 测试

- 诊断工具契约新增 6 条断言：涵盖 metrics/grep 的绝对路径/缺参/非法正则/大小写不敏感/正则分支。
- Orchestrator/SWW 新增“多轮交错重放×顺序扰动”用例，断言最后两条重放严格等于入队顺序。

### 📚 文档

- 新增 `docs/operations/sse-endpoints.md`（中）与 `docs/operations/sse-endpoints.en.md`（英）。
- 新增 `docs/operations/bulk-cli.md`（中）与 `docs/operations/bulk-cli.en.md`（英）。
- README（中/英）同步补充 HTTP/SSE 与 Bulk CLI 用法示例。
- 新增/更新 Schema：`docs/schemas/codex-status-response.schema.json`、`docs/schemas/checkpoint.schema.json`，并附示例与单测。
- 更新 `docs/user/mcp-diagnostic-tools.md`：补 `not_found`/`permission_denied` 枚举与 `grep-events` 新参数说明。
- `docs/user/orchestrate-report.md`：补 `--duration-precision` 说明；README 顶部加入“快速开始”直达提醒。

### ⛳ 影响与兼容性

- 诊断工具对路径与参数更严格：相对路径/空查询/非法 limit/非法正则现在会得到 `invalid_arguments`，请按文档示例改为绝对路径并修正参数。
- 仅影响诊断工具（只读行为），不改变运行时代码路径与 JSON 契约。

### 🔧 升级与验证

1) 升级依赖与构建
```
npm ci
npm run build
```
2) 运行定向测试
```
npm run -s test:orchestrator:file -- core/mcp/tests/diagnostic-tools.test.ts
```
3) 快速体验（rMCP）
```
node scripts/rmcp-client.mjs diagnose-report --path /abs/path/to/report.json
```
若路径不存在：输出 `reason=not_found`；若为相对路径：`reason=invalid_arguments`。

---

## v1.8.0 — 2025-10-13

Phase 1 收尾：SSE / ETA / plan_updated / Bulk 全面可用。

### ✨ 新增

- 细粒度进度：`status --json` 增加 `progress{current,total,percentage,currentTask,eta*}` 与 `checkpoints[]`（详见 schema）。
- ETA 估算：在未提供 `etaSeconds` 时基于 EWM 输出 `etaHuman`（如 `4m 20s`）。
- 事件扩展：`plan_updated`、`progress_updated`、`checkpoint_saved`（SSE 与文件队列）。
- 只读 HTTP/SSE：`http:serve` 暴露 `/api/v1/jobs/:id/status|checkpoints|events`，SSE 支持 `fromSeq` 断点续订与心跳。
- 批量 CLI：`bulk:status|stop|resume`（默认 dry‑run；`--execute` 执行；`--force` 强制停止）。
 - 程序化 Bulk API（Node SDK）：`codex_bulk_status|codex_bulk_stop|codex_bulk_resume`，与 CLI 返回结构对齐，便于外部系统集成。

### ♻️ 改进

- Bulk 返回结构补充 `summary` 与 `advice.retry/rollback`（仅文案与结构，无行为改变）。

### 📚 文档

- 新增：
  - `docs/operations/sse-endpoints.(md|en.md)`
  - `docs/operations/bulk-cli.(md|en.md)`（含 stop/resume 预演/执行示例）
  - `docs/schemas/bulk-stop-response.schema.json`、`docs/schemas/bulk-resume-response.schema.json` 与示例
- 新增：`docs/operations/bulk-sdk.(md|en.md)`（程序化 Bulk API 用法与返回结构）。
- 更新：README（中/英）与用户手册同步加入 HTTP/SSE、Bulk CLI 与 Programmatic Bulk API 用法。

### ⛳ 契约与兼容

- 严格保持 stdout 两行；多信息通过 HTTP/SSE。
- 所有新增字段为可选，默认不影响既有集成。

## ✨ 核心特性

### 1. MCP 协议支持

- ✅ 完整实现 MCP 2024-11-05 协议规范
- ✅ 支持 stdio 传输方式
- ✅ 标准化的工具定义和调用
- ✅ 实时事件通知机制

### 2. Codex CLI 集成

- ✅ 单进程高效管理
- ✅ 异步非阻塞执行
- ✅ 自动进程健康检查和重启
- ✅ 进程生命周期完整管理

### 3. 审批机制

支持 4 种灵活的审批策略：

- **UNTRUSTED**: 仅白名单命令自动批准
- **ON_REQUEST**: Codex 请求时需审批
- **ON_FAILURE**: 命令失败时需审批
- **NEVER**: 所有命令自动批准

特性：

- ✅ 终端交互式 UI
- ✅ 白名单正则表达式匹配
- ✅ 审批超时控制
- ✅ 批量审批支持

### 4. 会话管理

- ✅ 自动会话创建和目录管理
- ✅ JSONL 格式事件日志 (流式写入)
- ✅ JSON 格式配置持久化
- ✅ Rollout 引用文件管理
- ✅ 会话状态追踪 (INITIALIZING → ACTIVE → IDLE → TERMINATED)

### 5. 事件系统

- ✅ 实时事件映射 (Codex → MCP)
- ✅ Job/Session/Process/Approval 事件支持
- ✅ 进度通知推送
- ✅ 错误和完成状态通知

---

## 🚀 MCP 工具

本版本提供以下 MCP 工具：

### 1. `codex-chat`

发送消息到 Codex 对话

- 支持自定义 session name 和 model
- 自动会话管理
- 实时进度通知

### 2. `codex-execute`

执行 Codex 任务

- 支持任意 Codex CLI 参数
- 异步执行，快速返回 (< 500ms)
- 命令审批控制

### 3. `codex-read-file`

读取工作区文件

- 支持相对/绝对路径
- 二进制文件检测
- 大文件安全处理

### 4. `codex-apply-patch`

应用文件补丁

- 文件创建/修改/删除
- 审批机制保护
- 原子操作支持

---

## 📊 性能指标

### 响应速度

```
✅ tools/call 响应时间: ~60ms (目标: < 500ms) - 超出预期 8.3x
✅ 事件映射延迟: ~0.008ms (目标: < 100ms) - 超出预期 12,500x
✅ 并发请求处理: ~65ms
```

### 资源占用

```
✅ 内存使用: ~100MB (目标: < 200MB) - 低于目标 50%
✅ 大量事件处理: ~125MB (仍低于目标)
```

### 端到端性能

```
✅ 完整请求-响应周期: ~49-60ms
✅ 高负载下性能: ~49ms (更优)
```

---

## ✅ 测试覆盖

### 测试统计

```
Test Files:  51 passed (51)
Tests:       506 passed | 6 skipped (512)
Duration:    91.19s
Pass Rate:   98.8%
```

### 测试类型

- ✅ **契约测试** (4个): 验证 MCP 和 Codex JSON-RPC 协议
- ✅ **单元测试** (400+): 覆盖所有核心模块
- ✅ **集成测试** (30+): 端到端场景验证
- ✅ **性能基准测试** (8个): 性能指标验证

### 测试覆盖模块

- ✅ 审批系统 (PolicyEngine, TerminalUI) - 62 tests
- ✅ MCP 协议层 (Server, BridgeLayer, EventMapper) - 105 tests
- ✅ 会话管理 (SessionManager, EventLogger, ConfigPersister) - 64 tests
- ✅ 进程管理 (SingleProcessManager) - 28 tests
- ✅ Codex 客户端 (CodexClient) - 13 tests
- ✅ CLI 命令 (mcp-command) - 13 tests

---

## 🏗️ 技术栈

### 核心依赖

- **TypeScript** 5.3+ - 类型安全
- **Node.js** 18+ - 运行时
- **@modelcontextprotocol/sdk** ^1.0.4 - MCP 官方 SDK
- **inquirer** ^9.3.7 - 终端交互 UI
- **zod** ^3.24.1 - 运行时类型验证
- **uuid** ^11.0.3 - 唯一 ID 生成

### 开发工具

- **vitest** ^1.6.1 - 测试框架
- **ESLint** - 代码质量检查
- **Prettier** - 代码格式化
- **TypeScript Compiler** - 类型检查

---

## 📁 项目结构

```
codex-father/
├── core/                 # MVP1 核心实现
│   ├── approval/        # 审批系统
│   │   ├── policy-engine.ts      # 策略引擎
│   │   └── terminal-ui.ts        # 终端 UI
│   ├── cli/             # CLI 命令
│   │   └── commands/
│   │       └── mcp-command.ts    # MCP 服务器命令
│   ├── mcp/             # MCP 协议实现
│   │   ├── server.ts             # MCP 服务器
│   │   ├── bridge-layer.ts       # 桥接层
│   │   ├── event-mapper.ts       # 事件映射器
│   │   ├── codex-client.ts       # Codex 客户端
│   │   └── protocol/types.ts     # 协议类型
│   ├── process/         # 进程管理
│   │   └── manager.ts            # 单进程管理器
│   ├── session/         # 会话管理
│   │   ├── session-manager.ts    # 会话管理器
│   │   ├── event-logger.ts       # 事件日志
│   │   └── config-persister.ts   # 配置持久化
│   └── lib/             # 共享库
│       └── types.ts              # 类型定义
├── tests/               # 测试
│   ├── contract/        # 契约测试
│   ├── integration/     # 集成测试
│   └── benchmark/       # 性能测试
├── docs/                # 文档
│   ├── mcp-integration.md       # MCP 集成指南
│   ├── mvp1-manual-test-plan.md # 手动测试计划
│   └── mvp1-quick-test-guide.md # 快速测试指南
├── README.md            # 项目说明
└── CLAUDE.md            # 开发指南
```

---

## 🎯 代码质量

### Lint 检查

```
✅ Errors: 0
⚠️  Warnings: 237 (仅代码风格，不影响功能)
```

### 类型安全

```
✅ TypeScript strict mode
✅ 完整类型注解
✅ Zod 运行时验证
```

### 代码重复率

```
✅ 0.67% (目标: < 5%) - 远低于目标
```

### 架构评分

```
⭐⭐⭐⭐⭐ SOLID 原则遵循
⭐⭐⭐⭐⭐ 模块化设计
⭐⭐⭐⭐⭐ 职责分离
⭐⭐⭐⭐⭐ 可维护性
⭐⭐⭐⭐⭐ 可测试性
```

---

## 🚀 快速开始

### 安装

```bash
# 克隆仓库
git clone <repository-url>
cd codex-father

# 安装依赖
npm install

# 构建项目
npm run build
```

### 启动 MCP 服务器

```bash
# 直接启动
npm start

# 或使用 MCP Inspector 调试
npx @modelcontextprotocol/inspector npm start
```

### 配置为 Claude Desktop MCP 服务器

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "node",
      "args": ["/path/to/codex-father/dist/core/cli/start.js"],
      "env": {
        "CODEX_FATHER_APPROVAL_POLICY": "untrusted"
      }
    }
  }
}
```

---

## 📚 文档

- **README.md** - 项目概述和使用指南
- **CLAUDE.md** - 开发指南和技术栈说明
- **docs/mcp-integration.md** - MCP 集成详细文档
- **docs/mvp1-manual-test-plan.md** - 完整测试计划
- **specs/005-docs-prd-draft/** - 设计规范和任务清单

---

## 🔄 升级指南

这是首个正式版本，无需升级步骤。

---

## ⚠️ 已知限制

### MVP1 范围限制

1. **单进程管理**: 当前仅支持单个 Codex 进程（串行执行任务）
   - 多任务会排队执行
   - 未来 MVP2 将支持多进程池

2. **审批 UI**: 终端交互式 UI
   - 需要终端访问
   - 未来计划支持 Web UI

3. **日志查询**: 基础的 JSONL 格式
   - 需要手动解析
   - 未来计划提供查询工具

### 非阻塞问题

- **Lint 警告**: 237 个代码风格警告（不影响功能）
  - 主要是 `any` 类型和缺少返回类型注解
  - 已列入后续改进计划

---

## 🗺️ 未来计划 (MVP2)

### 性能增强

- [ ] 多进程池管理
- [ ] 智能任务调度
- [ ] 并发控制优化

### 功能扩展

- [ ] Web UI 审批界面
- [ ] 日志查询和分析工具
- [ ] 更多 MCP 工具

### 监控和运维

- [ ] 性能监控面板
- [ ] 健康检查 API
- [ ] 日志聚合和分析

---

## 🤝 贡献

我们欢迎社区贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

### 报告问题

- GitHub Issues:
  [github.com/your-org/codex-father/issues](https://github.com/your-org/codex-father/issues)

### 代码规范

- TypeScript strict mode
- ESLint + Prettier
- 完整单元测试覆盖

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

感谢所有为本项目做出贡献的开发者和测试人员！

特别感谢：

- **Model Context Protocol** 团队提供的优秀协议和 SDK
- **Codex CLI** 团队提供的强大工具
- 所有社区反馈和建议

---

## 📞 联系方式

- **项目主页**: [GitHub Repository](https://github.com/your-org/codex-father)
- **文档**: [Documentation](https://docs.example.com/codex-father)
- **问题反馈**: [GitHub Issues](https://github.com/your-org/codex-father/issues)

---

**🎉 Codex Father v1.0.0 - 让 Codex 更强大！**
