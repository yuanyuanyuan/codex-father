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

### Codex 版本兼容（0.44）

- 版本检测与缓存：自动解析 `codex --version`，异常时快速失败并提示修复
- 参数-版本映射：在 0.42 ↔ 0.44 之间做参数兼容与降级（保持调用一致性）
- Profile 自动修复：按模型与能力修正关键项（如 `wire_api`, `model`, 超时等）
- 校验与错误码：不满足 `minVersion` 或参数非法时返回 `-32602`；HTTP 类错误对齐
  `405/401/429/500`
- MCP 方法门禁：在 tools/call 前做版本/参数校验，确保上游可预期

参考：`docs/releases/VERSION_MCP_1.2.0.md`、`docs/architecture/mcp-integration.md`

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

### 开箱即用的 MCP 服务器

本项目提供了一个完整的 MCP 服务器实现，支持通过 npx 一键启动：

```bash
# 直接运行（推荐）
npx @starkdev020/codex-father-mcp-server

# 或者克隆仓库本地开发
git clone https://github.com/yuanyuanyuan/codex-father.git
cd codex-father/mcp/codex-mcp-server
npm install && npm run dev
```

### 集成到 MCP 客户端

支持多种 MCP 客户端：

**Claude Desktop** - 添加到配置文件：

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server"]
    }
  }
}
```

**Codex CLI (rMCP)** - 添加到 `~/.codex/config.toml`：

```toml
[mcp_servers.codex-father]
command = "npx"
args = ["-y", "@starkdev020/codex-father-mcp-server"]
```

**Claude Code CLI** - 在项目根目录创建 `.claude/mcp_settings.json`

📖 **完整使用文档**: [MCP 服务器使用指南](mcp/codex-mcp-server/README.md)

> 包含详细的配置说明、实战示例、故障排除和 rMCP 集成说明

## 📖 使用指南

### MCP 工具列表

当前版本提供以下 MCP 工具：

1. **`codex.exec`** - 同步执行 Codex 任务
2. **`codex.start`** - 异步启动任务（返回 jobId）
3. **`codex.status`** - 查询任务状态
4. **`codex.logs`** - 读取任务日志
5. **`codex.stop`** - 停止运行中的任务
6. **`codex.list`** - 列出所有任务

### 使用示例

在 Claude Desktop 中直接对话：

**你**: "帮我分析一下这个项目的代码质量"

**Claude** 会自动调用 `codex.exec` 工具执行分析任务。

### 详细文档

- **完整工具参数说明**:
  [MCP 工具详解](mcp/codex-mcp-server/README.md#🛠️-mcp-工具详解)
- **实战示例**: [实战示例](mcp/codex-mcp-server/README.md#📖-实战示例)
- **安全策略配置**: [安全策略说明](mcp/codex-mcp-server/README.md#⚙️-高级配置)
- **故障排除**: [故障排除指南](mcp/codex-mcp-server/README.md#🆘-故障排除)
- **Codex rMCP 集成**:
  [关于 Codex rMCP](mcp/codex-mcp-server/README.md#🔗-关于-codex-rmcp-支持)
- **[Codex 0.44 兼容指南](docs/architecture/mcp-integration.md)**

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

### 🚀 新手必读（开箱即用）

1. **[⚡ 5分钟快速开始](docs/user/quick-start.md)** - 最快的上手方式 ⭐
   **强烈推荐**
2. **[📦 安装指南](docs/user/installation.md)** - 详细安装步骤和系统要求
3. **[⚙️ 配置指南](docs/user/configuration.md)** - 配置 Claude
   Desktop/Code/Codex CLI
4. **[🚀 首次运行测试](docs/user/first-run.md)** - 10 个测试验证所有功能

### 📖 完整文档导航

- **[📚 文档总入口](docs/README.md)** - 所有文档的导航中心

**按类别浏览**：

- [👤 用户文档](docs/user/README.md) - 使用指南、场景化应用、故障排除
- [🔧 开发文档](docs/developer/README.md) - 开发环境、技术栈、贡献指南
- [🏗️ 架构文档](docs/architecture/README.md) - 系统架构、MCP 集成、API 参考
- [🚀 运维文档](docs/operations/README.md) - 部署指南、运维手册
- [📋 版本发布](docs/releases/README.md) - 发布说明、变更日志

**按角色导航**：

- **第一次使用**：[快速开始](docs/user/quick-start.md) →
  [首次测试](docs/user/first-run.md) → [使用场景](docs/user/use-cases/README.md)
- **开发者**：[开发指南](docs/developer/DEVELOPMENT.md) →
  [架构概览](docs/architecture/overview.md) →
  [贡献指南](docs/developer/contributing.md)
- **运维人员**：[部署指南](docs/operations/DEPLOY.md) →
  [配置指南](docs/user/configuration.md) →
  [故障排除](docs/user/troubleshooting.md)

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

## 💡 使用场景

Codex Father 可以帮您：

- **代码审查** - 自动识别代码质量问题、类型安全、错误处理
- **重构优化** - 发现重复代码，提供重构建议
- **文档生成** - 自动生成 API 文档、使用说明
- **测试生成** - 自动生成单元测试、集成测试
- **Bug 修复** - 快速定位并修复问题
- **性能优化** - 识别性能瓶颈，提供优化方案

查看 **[15+ 场景化使用示例](docs/user/use-cases/examples.md)** 了解更多。

## 📦 发布

- 完整流程：`docs/releases/RELEASE_FLOW_MCP.md`
- 本次版本说明：`docs/releases/VERSION_MCP_1.2.0.md`
- 一键脚本：`scripts/release-mcp.sh`（支持 `--preflight` / `--dry-run` /
  `--local` / `--ci` / `--ci-commit-docs`）
- npm/npx 验证流程：
  1. `npm pack`，确认生成的 `codex-father-*.tgz` 内包含 `start.sh`、`job.sh` 与
     `lib/`（可 `tar -tf` 检查）
  2. 在空目录执行 `npm init -y && npm install /path/to/codex-father-*.tgz`
  3. 运行
     `npx codex-father start --help`，若可正常输出帮助信息即表示包内脚本可被分发与调用
  4. 可选：设置 `CODEX_START_SH`/`CODEX_JOB_SH`
     指向自定义路径再次运行，验证环境变量覆盖是否生效
