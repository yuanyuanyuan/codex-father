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

### 核心功能

- **MCP 协议支持**: 完整实现 MCP 2024-11-05 协议规范
- **单进程管理**: 高效的 Codex CLI 进程管理和生命周期控制
- **异步执行**: 非阻塞的命令执行，立即返回 Job ID
- **审批机制**: 灵活的命令审批策略 (UNTRUSTED/ON_REQUEST/ON_FAILURE/NEVER)
- **事件通知**: 实时进度通知和状态更新
- **会话管理**: 自动化的会话创建和日志持久化
- **类型安全**: 完整的 TypeScript 类型定义和 Zod 验证

### MCP 工具

1. **codex-chat** - 发送消息到 Codex 对话
   - 支持用户消息和系统提示
   - 自动会话管理
   - 实时进度通知

2. **codex-execute** - 执行 Codex 命令
   - 支持任意 Codex CLI 参数
   - 异步执行模式
   - 命令审批控制

3. **codex-read-file** - 读取文件内容
   - 支持相对/绝对路径
   - 二进制文件检测
   - 大文件处理

4. **codex-apply-patch** - 应用代码补丁
   - Unified diff 格式
   - 自动审批流程
   - 文件变更追踪

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

- [MCP 集成指南](docs/mcp-integration.md) - 详细的 MCP 协议集成说明
- [Quickstart](specs/005-docs-prd-draft/quickstart.md) - 快速验证指南
- [数据模型](specs/005-docs-prd-draft/data-model.md) - 类型定义和 Schema
- [技术设计](specs/005-docs-prd-draft/technical-design.md) - 架构和设计决策

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
