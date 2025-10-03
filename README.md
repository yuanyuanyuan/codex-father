# Codex Father - TypeScript MCP Server (MVP1)

> MCP (Model Context Protocol) 服务器，用于将 Codex
> CLI 暴露为标准 MCP 工具，支持单进程异步执行和审批机制。

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-2024--11--05-purple)](https://modelcontextprotocol.io/)

## 📋 目录

- [特性](#特性)
- [架构](#架构)
- [快速开始](#快速开始)
- [使用指南](#使用指南)
- [开发](#开发)
- [测试](#测试)
- [文档](#文档)
- [贡献](#贡献)

## ✨ 特性

### 核心功能（MVP1 已实现）

- MCP 协议实现：initialize、tools/list、tools/call
- 单进程管理：Codex CLI 生命周期与健康监控
- 异步执行：非阻塞执行，返回 `jobId`，配套状态/日志查询
- 审批机制：`untrusted`、`on-request`、`on-failure`、`never`（白名单支持）
- 事件通知：进度与消息推送（JSON 通知）
- 会话管理：事件 JSONL 与元数据持久化
- 类型安全：完整 TypeScript + Zod 校验

### MCP 工具（当前实现）

1. `codex.exec` — 同步执行（前台阻塞直到完成）
2. `codex.start` — 启动异步任务（立即返回 `jobId`）
3. `codex.status` — 查询任务状态
4. `codex.logs` — 读取任务日志（字节/行两种模式）
5. `codex.stop` — 停止任务（可 `--force`）
6. `codex.list` — 枚举已知任务

> 注：早期文档中出现的
> `codex-chat`/`codex-execute`/`codex-read-file`/`codex-apply-patch`
> 为构想接口，当前版本未提供这些工具的独立封装（请使用 `codex.exec/start`
> 统一入口）。

### 功能状态

- [x] MCP 服务器（initialize/tools.list/tools.call）
- [x] 异步任务队列（start/status/logs/stop/list）
- [x] 审批策略 + 终端交互 UI（白名单/策略注入）
- [x] 事件记录与会话持久化（JSONL/metadata）
- [x] 合同/契约测试（tools/call 形态与时延）
- [ ] Orchestrate 多代理编排 CLI（`orchestrate` 命令）
- [ ] SWW 单写者窗口 + 两阶段写入（补丁生成→串行应用→快速校验）
- [ ] 资源监控与并发调度（≤10 并发，TaskScheduler）
- [ ] 事件模式与审计日志完善（统一 schema 导出）

## 🏗️ 架构

### 系统架构

```
┌─────────────────┐
│  MCP Client     │  (Claude Desktop, MCP Inspector)
│  (stdio/SSE)    │
└────────┬────────┘
         │ JSON-RPC 2.0
         │
┌────────▼────────────────────────────────────────┐
│  MCP Server (core/mcp/server.ts)                │
│  - Protocol handling                            │
│  - Tool registration                            │
│  - Event forwarding                             │
└────────┬────────────────────────────────────────┘
         │
         │ Bridge Layer
         │
┌────────▼────────────────────────────────────────┐
│  Process Manager (core/process/manager.ts)      │
│  - Codex CLI lifecycle                          │
│  - JSON-RPC communication                       │
│  - Health monitoring                            │
└────────┬────────────────────────────────────────┘
         │
         │
┌────────▼────────────────────────────────────────┐
│  Session Manager (core/session/)                │
│  - Session lifecycle                            │
│  - Event logging (.jsonl)                       │
│  - Config persistence (.json)                   │
└────────┬────────────────────────────────────────┘
         │
         │
┌────────▼────────────────────────────────────────┐
│  Approval System (core/approval/)               │
│  - Policy engine                                │
│  - Terminal UI (inquirer)                       │
│  - Whitelist management                         │
└─────────────────────────────────────────────────┘
```

### 核心模块

- **MCP Server** (`core/mcp/`): MCP 协议实现和桥接层
- **Process Manager** (`core/process/`): Codex CLI 进程管理
- **Session Manager** (`core/session/`): 会话和日志管理
- **Approval System** (`core/approval/`): 审批策略和终端 UI
- **CLI** (`core/cli/`): 命令行接口

## 🚀 快速开始

### 前置要求

- **Node.js** >= 18.0.0
- **TypeScript** >= 5.3.0
- **Codex CLI** 已安装并配置

### 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/codex-father.git
cd codex-father

# 安装依赖
npm install

# 构建项目
npm run build
```

### 启动服务器

```bash
# 开发模式（自动重载）
npm run dev

# 生产模式
npm start

# 使用 MCP Inspector 调试
npx @modelcontextprotocol/inspector npm run mcp:start
```

### 配置 Claude Desktop

添加到 `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "node",
      "args": ["/path/to/codex-father/dist/core/cli/start.ts", "mcp"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## 📖 使用指南

### 基本使用

#### 1. 发送消息到 Codex

```typescript
// 通过 MCP 工具调用
{
  "name": "codex-chat",
  "arguments": {
    "message": "帮我分析这段代码的性能问题",
    "systemPrompt": "你是一位资深的性能优化专家"
  }
}
```

#### 2. 执行 Codex 命令

```typescript
{
  "name": "codex-execute",
  "arguments": {
    "args": ["--task", "运行测试", "--cwd", "/workspace"]
  }
}
```

#### 3. 读取文件

```typescript
{
  "name": "codex-read-file",
  "arguments": {
    "path": "src/index.ts"
  }
}
```

#### 4. 应用补丁

```typescript
{
  "name": "codex-apply-patch",
  "arguments": {
    "patch": "--- a/file.ts\n+++ b/file.ts\n@@ ...",
    "fileChanges": [
      { "type": "modify", "path": "file.ts" }
    ]
  }
}
```

### 审批机制

配置审批策略 `.codex-father/config/approval-policy.json`:

```json
{
  "mode": "untrusted",
  "whitelist": [
    {
      "pattern": "^git status",
      "reason": "Read-only git command",
      "enabled": true
    }
  ],
  "timeout": 60000
}
```

**审批模式:**

- `never`: 从不审批 (危险，仅用于测试)
- `on-request`: Codex 请求时审批
- `on-failure`: 失败后审批重试
- `untrusted`: 所有操作需审批 (除非在白名单)

### 事件通知

服务器会发送以下 MCP 通知:

```typescript
// 进度通知
{
  "method": "notifications/progress",
  "params": {
    "progressToken": "job-123",
    "progress": 50,
    "total": 100
  }
}

// 日志通知
{
  "method": "notifications/message",
  "params": {
    "level": "info",
    "logger": "codex-father",
    "data": "Command completed successfully"
  }
}
```

## 🛠️ 开发

### 项目结构

```
codex-father/
├── core/
│   ├── approval/          # 审批系统
│   │   ├── policy-engine.ts
│   │   ├── terminal-ui.ts
│   │   └── tests/
│   ├── cli/              # CLI 命令
│   │   ├── commands/
│   │   │   └── mcp-command.ts
│   │   └── tests/
│   ├── mcp/              # MCP 协议实现
│   │   ├── server.ts
│   │   ├── bridge-layer.ts
│   │   ├── event-mapper.ts
│   │   └── tests/
│   ├── process/          # 进程管理
│   │   ├── manager.ts
│   │   └── tests/
│   ├── session/          # 会话管理
│   │   ├── session-manager.ts
│   │   ├── event-logger.ts
│   │   └── tests/
│   └── lib/              # 共享类型和工具
│       └── types.ts
├── tests/
│   ├── contract/         # MCP 契约测试
│   ├── integration/      # 集成测试
│   └── benchmark/        # 性能测试
├── docs/                 # 文档
│   └── mcp-integration.md
└── specs/                # 设计规范
    └── 005-docs-prd-draft/
```

### 开发工具

```bash
# 类型检查
npm run typecheck

# 代码检查
npm run lint
npm run lint:check

# 格式化
npm run format
npm run format:check

# 完整检查
npm run check:all
```

### 调试

#### 使用 MCP Inspector

```bash
# 启动 Inspector (自动打开浏览器)
npx @modelcontextprotocol/inspector npm run mcp:start
```

#### 使用 VS Code

`.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug MCP Server",
  "program": "${workspaceFolder}/core/cli/start.ts",
  "args": ["mcp", "--debug"],
  "env": {
    "NODE_ENV": "development"
  }
}
```

## 🧪 测试

### 运行测试

```bash
# 所有测试
npm test

# 单元测试
npm run test:run

# 集成测试
npm test -- tests/integration/

# 契约测试
npm test -- tests/contract/

# 覆盖率报告
npm run test:coverage

# 监听模式
npm run test:watch
```

### 测试覆盖

- **单元测试**: 147 个测试用例
  - PolicyEngine: 68 tests ✅
  - TerminalUI: 46 tests ✅
  - EventLogger: 16 tests ✅
  - ConfigPersister: 17 tests ✅

- **集成测试**: 30 个测试用例
  - MVP1 基本流程: 12 tests ✅
  - 审批机制: 18 tests ✅

- **总覆盖率**: > 90%

### 性能基准

```bash
# 运行基准测试
npm run benchmark

# 预期指标:
# - MCP 响应时间: < 500ms
# - 事件通知延迟: < 100ms
# - 内存使用: < 100MB
```

## 📚 文档

- [MCP 使用指南](README.md#mcp-使用指南) — 工具、参数映射、JSON-RPC 示例
- [Quickstart（已归档）](specs/_archived/005-docs-prd-draft/quickstart.md)
- [数据模型（已归档）](specs/_archived/005-docs-prd-draft/data-model.md)
- [非交互模式说明](docs/codex-non-interactive.md)

## 🤝 贡献

欢迎贡献！请遵循以下原则:

1. **SOLID 原则**: 保持代码模块化和可测试
2. **类型安全**: 使用完整的 TypeScript 类型
3. **测试覆盖**: 新功能必须包含测试
4. **文档完整**: 更新相关文档

### 提交 Pull Request

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发规范

- 使用 [Conventional Commits](https://www.conventionalcommits.org/)
- 遵循 ESLint 和 Prettier 配置
- 所有测试必须通过 (`npm run check:all`)

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP 协议规范
- [Codex CLI](https://github.com/anthropics/codex) - Anthropic Codex 命令行工具
- [TypeScript](https://www.typescriptlang.org/) - 类型安全的 JavaScript 超集
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -
  MCP TypeScript SDK

## 📮 联系

- Issues: [GitHub Issues](https://github.com/yourusername/codex-father/issues)
- 文档: [GitHub Wiki](https://github.com/yourusername/codex-father/wiki)

---

**Built with ❤️ by the Codex Father Team**

## 🗺️ Roadmap

- 006 — Multi‑Agent Orchestration（多代理编排，进行中）
  - CLI：`orchestrate` 命令（`core/cli/commands/orchestrate-command.ts`）
  - 最大并发 ≤ 10，任务超时与成功阈值
  - SWW 两阶段写入：补丁生成 → 串行应用 → 快速校验
  - 事件流遵循
    `docs/schemas/stream-json-event.schema.json`（若缺工具则标记失败）
  - 依赖 `uuid`，命令退出条件：成功率 ≥ 阈值且无 `patch_failed`

如需完整规范与进度，请参见：`specs/006-docs-capability-assessment/*`。

## MCP 使用指南

本节整合了原先的 `readme.mcp.md` 内容，作为 MCP 使用的唯一权威文档。

### 工具与参数

- 同步：`codex.exec` — `{ args?: string[], tag?: string, cwd?: string }`
- 异步：
  - `codex.start` — `{ args?: string[], tag?: string, cwd?: string }`
  - `codex.status` — `{ jobId: string, cwd?: string }`
  - `codex.logs` —
    `{ jobId: string, mode?: 'bytes'|'lines', offset?: number, limit?: number, offsetLines?: number, limitLines?: number, tailLines?: number, grep?: string, cwd?: string }`
  - `codex.stop` — `{ jobId: string, force?: boolean, cwd?: string }`
  - `codex.list` — `{ cwd?: string }`

常用参数映射（传给 `arguments.args`）

- 指令组合：`-F/--file-override`、`-f/--file`（通配）`--docs`、`-c/--content`
- 模板：`--prepend*`、`--append*`
- 预设：`--preset sprint|analysis|secure|fast`
- 上下文：`--no-carry-context`、`--no-compress-context`、`--context-head N`、`--context-grep REGEX`
- 直通 Codex：`--sandbox`、`--codex-config approval_policy=<policy>`、`--profile`、`--full-auto`、`--codex-arg "--flag value"`

建议：MCP 场景避免使用 STDIN（`-f -`/`-F -`），改用 `-c` 或将内容落盘后以
`-f/--docs` 传入。

### stdio/JSON-RPC 示例

```bash
# 初始化 + 列出工具
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"demo","version":"0.0.1"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | ./mcp/server.sh

# 同步执行（exec）
printf '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"codex.exec","arguments":{"args":["--task","Sync via MCP","--dry-run"],"tag":"mcp-sync"}}}\n' | ./mcp/server.sh

# 异步执行（start）
printf '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"codex.start","arguments":{"args":["--task","Async via MCP","--dry-run"],"tag":"mcp-async"}}}\n' | ./mcp/server.sh
```

### 产物与路径

- 会话目录：`<项目根>/.codex-father/sessions/<job-id>/`
- 同步（exec）：`job.log | job.instructions.md | job.meta.json | aggregate.*`
- 异步（start）：`job.log | *.instructions.md | *.meta.json | state.json | pid | aggregate.*`

### 默认安全与补丁模式

- 默认：若未显式提供，MCP 会为 `codex.exec/start` 注入
  `--sandbox workspace-write`；不再默认注入 `--approvals`（兼容更多 CLI 版本）。
- 补丁模式：`--patch-mode`（提示仅输出补丁而不改盘），建议与只读策略搭配：`--sandbox read-only --codex-config approval_policy=never`。

## 🧩 使用示例

### 1) 直接使用 CLI（同步）

```bash
# 汇总多个文档要点（同步执行）
./start.sh --docs 'docs/**/*.md' -c "仅输出中文要点" --dry-run

# 只输出补丁（不改盘）+ 安全只读
./start.sh --task "修复 README 锚点" \
  --patch-mode --sandbox read-only --codex-config approval_policy=never
```

### 2) 异步任务（job.sh）

```bash
# 启动后台任务
./job.sh start --task "验证 MCP 工具" --dry-run --tag demo --json

# 查询状态
./job.sh status <job-id> --json

# 查看日志（跟随）
./job.sh logs <job-id> --follow

# 停止任务
./job.sh stop <job-id> --force
```

### 3) MCP（stdio/JSON-RPC）

```bash
# 初始化 + 列出工具
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"demo","version":"0.0.1"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n' | ./mcp/server.sh

# 同步执行：codex.exec
printf '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"codex.exec","arguments":{"args":["--task","Sync via MCP","--dry-run"],"tag":"mcp-sync"}}}\n' | ./mcp/server.sh

# 异步执行：codex.start
printf '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"codex.start","arguments":{"args":["--task","Async via MCP","--dry-run"],"tag":"mcp-async"}}}\n' | ./mcp/server.sh
```

提示：MCP 场景中避免使用 STDIN（`-f -`/`-F -`），优先 `-c` 或落盘后用
`-f/--docs` 传入。

## 🆘 快速排障

- 无法启动 MCP 服务器
  - 确认 Node ≥ 18：`node -v`
  - 构建 MCP：`(cd mcp/codex-mcp-server && npm install && npm run build)`
  - 直接运行：`./mcp/server.sh`

- tools/list 为空或 tools/call 报错
  - 检查运行目录是否是项目根（影响相对路径）
  - 明确传入 `cwd` 字段到 MCP 调用中
  - 查看 `.codex-father/sessions/<id>/job.log` 末尾错误

- exec/start 行为与审批不符
  - 未显式传入时会注入 `--sandbox workspace-write`
  - 指定审批：`--codex-config approval_policy=on-request`（或
    `never`/`on-failure`/`untrusted`）
  - 需要只读+补丁：`--patch-mode --sandbox read-only --codex-config approval_policy=never`

- 本地提交被 lint-staged 阻塞
  - 先执行：`npm run lint:check` 查看报错
  - 若钩子中断：按提示使用 `git stash list` 恢复 `stash@{0}`（如有）

- 测试失败或类型报错
  - 执行：`npm run check:all`（typecheck + lint + format:check + test）
  - 逐项排查：`npm run typecheck`、`npm run test:run`
