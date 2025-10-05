# MCP Integration Guide - MCP 集成指南

> 详细的 Model Context Protocol (MCP) 集成文档，说明 Codex Father
> MCP 服务器的架构、协议实现和使用方法

**版本**: MVP1 **日期**: 2025-09-30 **MCP 协议版本**: 2024-11-05

---

## 目录

1. [概述](#概述)
2. [架构设计](#架构设计)
3. [协议实现](#协议实现)
4. [工具定义](#工具定义)
5. [事件通知](#事件通知)
6. [错误处理](#错误处理)
7. [配置管理](#配置管理)
8. [集成示例](#集成示例)
9. [故障排查](#故障排查)

---

## 概述

### 什么是 MCP?

Model Context Protocol
(MCP) 是一个开放协议，用于 AI 模型和外部工具之间的标准化通信。通过 MCP，AI 模型可以调用工具、读取资源和接收实时通知。

### Codex Father MCP Server

Codex Father MCP Server 是一个 TypeScript 实现的 MCP 服务器，它将 Codex
CLI 的能力暴露为标准 MCP 工具。主要特性：

- **完整的 MCP 2024-11-05 协议支持**
- **4 个核心工具**: chat, execute, read-file, apply-patch
- **实时事件通知**: 进度、日志、状态更新
- **审批机制**: 灵活的命令审批策略
- **会话管理**: 自动化的会话创建和持久化

### 使用场景

- **AI 辅助开发**: 通过 Claude Desktop 使用 Codex 能力
- **自动化工作流**: 在 CI/CD 中集成 Codex 命令
- **交互式调试**: 使用 MCP Inspector 测试和调试
- **多客户端支持**: 支持任何兼容 MCP 的客户端

---

## 架构设计

### 整体架构

```
┌──────────────────────────────────────────────────────┐
│                  MCP Client                          │
│  (Claude Desktop / MCP Inspector / Custom)           │
└────────────────────┬─────────────────────────────────┘
                     │
                     │ stdio / SSE
                     │ JSON-RPC 2.0
                     ▼
┌──────────────────────────────────────────────────────┐
│              MCP Server (server.ts)                  │
│  ┌────────────────────────────────────────────────┐  │
│  │  Protocol Layer                                │  │
│  │  - initialize                                  │  │
│  │  - tools/list                                  │  │
│  │  - tools/call                                  │  │
│  │  - notifications/* (outgoing)                  │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │  Bridge Layer (bridge-layer.ts)               │  │
│  │  - Tool definitions                            │  │
│  │  - Argument validation                         │  │
│  │  - Response formatting                         │  │
│  └────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │  Event Mapper (event-mapper.ts)               │  │
│  │  - Codex events → MCP notifications           │  │
│  │  - Progress tracking                           │  │
│  │  - Log formatting                              │  │
│  └────────────────────────────────────────────────┘  │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│        Process Manager (manager.ts)                  │
│  - Codex CLI spawn & lifecycle                       │
│  - JSON-RPC communication (stdin/stdout)             │
│  - Health monitoring & auto-restart                  │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│        Session Manager (session-manager.ts)          │
│  - Session creation & cleanup                        │
│  - Event logging (.jsonl)                            │
│  - Config persistence (.json)                        │
└────────────────────┬─────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────┐
│        Approval System (approval/)                   │
│  - Policy engine (whitelist, modes)                  │
│  - Terminal UI (inquirer)                            │
│  - Decision logging                                  │
└──────────────────────────────────────────────────────┘
```

### 核心组件

#### 1. MCP Server (`core/mcp/server.ts`)

- **职责**: MCP 协议的主要入口点
- **功能**:
  - 处理 MCP 客户端连接 (stdio transport)
  - 注册工具和处理 `tools/call` 请求
  - 转发 Codex 事件为 MCP 通知
  - 管理服务器生命周期

#### 2. Bridge Layer (`core/mcp/bridge-layer.ts`)

- **职责**: MCP 协议和 Codex CLI 之间的适配层
- **功能**:
  - 定义 MCP 工具 Schema (JSON Schema)
  - 验证工具参数 (Zod)
  - 格式化 MCP 响应
  - 映射错误码

#### 3. Event Mapper (`core/mcp/event-mapper.ts`)

- **职责**: 将 Codex 事件转换为 MCP 通知
- **支持的事件**:
  - `codex/progress` → `notifications/progress`
  - `codex/log` → `notifications/message`
  - `codex/status` → `notifications/message`
  - `codex/error` → `notifications/message`

#### 4. Process Manager (`core/process/manager.ts`)

- **职责**: 管理 Codex CLI 进程
- **功能**:
  - 进程启动和健康检查
  - JSON-RPC 通信 (stdin/stdout)
  - 自动重启 (最多 3 次)
  - 优雅关闭

#### 5. Session Manager (`core/session/session-manager.ts`)

- **职责**: 会话生命周期管理
- **功能**:
  - 创建会话目录和 rollout 文件
  - 事件日志记录 (JSONL 格式)
  - 配置持久化 (JSON 格式)
  - 会话清理

#### 6. Approval System (`core/approval/`)

- **职责**: 命令审批策略控制
- **组件**:
  - `policy-engine.ts`: 策略评估引擎
  - `terminal-ui.ts`: 交互式审批 UI

---

## 协议实现

### 初始化流程

```typescript
// 1. 客户端发送 initialize 请求
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "claude-desktop",
      "version": "1.0.0"
    }
  }
}

// 2. 服务器响应
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": {}
    },
    "serverInfo": {
      "name": "codex-father",
      "version": "1.0.0-mvp1"
    }
  }
}
```

### 工具列表

```typescript
// 客户端请求
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}

// 服务器响应
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "codex-chat",
        "description": "Send a message to Codex",
        "inputSchema": {
          "type": "object",
          "properties": {
            "message": { "type": "string" },
            "systemPrompt": { "type": "string" }
          },
          "required": ["message"]
        }
      },
      // ... 其他工具
    ]
  }
}
```

### 工具调用

```typescript
// 客户端请求
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "codex-chat",
    "arguments": {
      "message": "分析这段代码",
      "systemPrompt": "你是一位资深工程师"
    }
  }
}

// 服务器响应 (立即返回)
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\n  \"jobId\": \"job-abc123\",\n  \"conversationId\": \"conv-xyz789\",\n  \"status\": \"running\"\n}"
      }
    ]
  }
}

// 服务器发送进度通知 (异步)
{
  "jsonrpc": "2.0",
  "method": "notifications/progress",
  "params": {
    "progressToken": "job-abc123",
    "progress": 50,
    "total": 100
  }
}
```

---

## 工具定义

### 1. codex-chat

**描述**: 发送消息到 Codex 对话

**参数**:

```typescript
interface CodexChatArgs {
  message: string; // 用户消息 (必需)
  systemPrompt?: string; // 系统提示 (可选)
}
```

**返回**:

```typescript
{
  jobId: string; // 任务 ID
  conversationId: string; // 会话 ID
  status: 'running'; // 状态
}
```

**示例**:

```typescript
{
  "name": "codex-chat",
  "arguments": {
    "message": "帮我优化这段代码的性能",
    "systemPrompt": "你是一位性能优化专家"
  }
}
```

---

### 2. codex-execute

**描述**: 执行 Codex 命令

**参数**:

```typescript
interface CodexExecuteArgs {
  args: string[]; // Codex CLI 参数数组 (必需)
}
```

**返回**:

```typescript
{
  jobId: string; // 任务 ID
  command: string; // 执行的命令
  cwd: string; // 工作目录
}
```

**示例**:

```typescript
{
  "name": "codex-execute",
  "arguments": {
    "args": [
      "--task", "运行测试",
      "--cwd", "/workspace",
      "--sandbox", "read-only"
    ]
  }
}
```

---

### 3. codex-read-file

**描述**: 读取文件内容

**参数**:

```typescript
interface CodexReadFileArgs {
  path: string; // 文件路径 (必需)
}
```

**返回**:

```typescript
{
  path: string; // 文件路径
  content: string; // 文件内容
  size: number; // 文件大小 (bytes)
}
```

**示例**:

```typescript
{
  "name": "codex-read-file",
  "arguments": {
    "path": "src/index.ts"
  }
}
```

---

### 4. codex-apply-patch

**描述**: 应用代码补丁

**参数**:

```typescript
interface CodexApplyPatchArgs {
  patch: string; // Unified diff 格式补丁 (必需)
  fileChanges: FileChange[]; // 文件变更列表 (必需)
}

interface FileChange {
  type: 'create' | 'modify' | 'delete';
  path: string;
}
```

**返回**:

```typescript
{
  approvalId: string;        // 审批 ID
  status: 'pending';         // 状态
  fileChanges: FileChange[]; // 文件变更
}
```

**示例**:

```typescript
{
  "name": "codex-apply-patch",
  "arguments": {
    "patch": "--- a/file.ts\n+++ b/file.ts\n@@ -10,7 +10,7 @@\n-old line\n+new line",
    "fileChanges": [
      { "type": "modify", "path": "file.ts" }
    ]
  }
}
```

---

## 事件通知

### 进度通知

```typescript
{
  "method": "notifications/progress",
  "params": {
    "progressToken": "job-123",
    "progress": 75,
    "total": 100
  }
}
```

### 日志通知

```typescript
{
  "method": "notifications/message",
  "params": {
    "level": "info",          // info | warning | error
    "logger": "codex-father",
    "data": "Command completed successfully"
  }
}
```

### 资源更新通知

```typescript
{
  "method": "notifications/resources/updated",
  "params": {
    "uri": "file:///workspace/file.ts"
  }
}
```

---

## 错误处理

### 错误码

| 错误码 | 含义                 | 示例           |
| ------ | -------------------- | -------------- |
| -32700 | Parse error          | 无效的 JSON    |
| -32600 | Invalid Request      | 缺少必需字段   |
| -32601 | Method not found     | 工具不存在     |
| -32602 | Invalid params       | 参数类型错误   |
| -32603 | Internal error       | 服务器内部错误 |
| -32000 | Tool execution error | Codex 执行失败 |
| -32001 | Approval denied      | 用户拒绝审批   |

### 错误响应格式

```typescript
{
  "jsonrpc": "2.0",
  "id": 3,
  "error": {
    "code": -32602,
    "message": "Invalid params: message is required",
    "data": {
      "field": "message",
      "expected": "string",
      "received": "undefined"
    }
  }
}
```

### 错误处理最佳实践

1. **参数验证**: 使用 Zod 在工具调用前验证
2. **优雅降级**: 捕获异常并返回有意义的错误信息
3. **日志记录**: 记录所有错误到 events.jsonl
4. **用户友好**: 错误消息清晰且可操作

---

## 配置管理

### 审批策略配置

`.codex-father/config/approval-policy.json`:

```json
{
  "mode": "untrusted",
  "whitelist": [
    {
      "pattern": "^git status",
      "reason": "Read-only git command",
      "enabled": true
    },
    {
      "pattern": "^git diff",
      "reason": "Read-only git diff",
      "enabled": true
    },
    {
      "pattern": "^ls ",
      "reason": "Read-only list",
      "enabled": true
    }
  ],
  "timeout": 60000
}
```

### 会话配置

`.codex-father/sessions/<session-id>/config.json`:

```json
{
  "sessionId": "session-abc123",
  "conversationId": "conv-xyz789",
  "createdAt": "2025-09-30T10:00:00.000Z",
  "rolloutPath": "/path/to/rollout",
  "approval": {
    "mode": "untrusted",
    "timeout": 60000
  }
}
```

### 事件日志

`.codex-father/sessions/<session-id>/events.jsonl`:

```jsonl
{"type":"session-start","sessionId":"session-abc123","timestamp":"2025-09-30T10:00:00.000Z"}
{"type":"tool-call","toolName":"codex-chat","args":{"message":"Hello"},"timestamp":"2025-09-30T10:00:01.000Z"}
{"type":"codex-event","event":{"type":"progress","progress":50},"timestamp":"2025-09-30T10:00:05.000Z"}
{"type":"tool-result","result":{"jobId":"job-123"},"timestamp":"2025-09-30T10:00:10.000Z"}
```

---

## 集成示例

### Claude Desktop 配置

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "node",
      "args": [
        "/path/to/codex-father/dist/core/cli/start.ts",
        "mcp",
        "--debug"
      ],
      "env": {
        "NODE_ENV": "production",
        "CODEX_API_KEY": "your-api-key"
      }
    }
  }
}
```

### MCP Inspector 调试

```bash
# 启动 Inspector (自动打开浏览器)
npx @modelcontextprotocol/inspector npm run mcp:start

# 或者使用 node 命令
npx @modelcontextprotocol/inspector node dist/core/cli/start.ts mcp
```

### 自定义客户端示例

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// 创建客户端
const transport = new StdioClientTransport({
  command: 'node',
  args: ['dist/core/cli/start.ts', 'mcp'],
});

const client = new Client(
  {
    name: 'my-custom-client',
    version: '1.0.0',
  },
  {
    capabilities: {},
  }
);

// 连接
await client.connect(transport);

// 列出工具
const tools = await client.listTools();
console.log(tools);

// 调用工具
const result = await client.callTool({
  name: 'codex-chat',
  arguments: {
    message: 'Hello, Codex!',
  },
});
console.log(result);

// 监听通知
client.setNotificationHandler((notification) => {
  console.log('Notification:', notification);
});
```

---

## 故障排查

### 常见问题

#### 1. 服务器无法启动

**症状**: `npm run mcp:start` 报错

**检查**:

```bash
# 1. 检查 Node.js 版本
node --version  # 应该 >= 18.0.0

# 2. 检查 TypeScript 构建
npm run build

# 3. 检查 Codex CLI
codex --version

# 4. 查看详细日志
DEBUG=* npm run mcp:start
```

#### 2. 工具调用失败

**症状**: `tools/call` 返回错误

**检查**:

```bash
# 1. 验证参数格式
# 使用 MCP Inspector 测试

# 2. 查看会话日志
cat .codex-father/sessions/latest/events.jsonl

# 3. 检查审批策略
cat .codex-father/config/approval-policy.json
```

#### 3. 事件通知未收到

**症状**: 客户端没有收到 progress 通知

**检查**:

```typescript
// 1. 确保客户端注册了通知处理器
client.setNotificationHandler((notification) => {
  console.log(notification);
});

// 2. 检查 Event Mapper 日志
// 在 server.ts 中启用 debug 模式
```

#### 4. 审批超时

**症状**: 命令卡在等待审批

**解决方案**:

```json
// 增加超时时间
{
  "mode": "untrusted",
  "timeout": 120000  // 2 分钟
}

// 或者使用白名单
{
  "mode": "untrusted",
  "whitelist": [
    {
      "pattern": "^your-command-pattern",
      "reason": "Safe command",
      "enabled": true
    }
  ]
}
```

### 调试工具

#### 1. MCP Inspector

最推荐的调试工具，提供 UI 界面测试所有 MCP 功能。

```bash
npx @modelcontextprotocol/inspector npm run mcp:start
```

#### 2. 日志查看

```bash
# 服务器日志
tail -f .codex-father/sessions/latest/server.log

# 事件日志
tail -f .codex-father/sessions/latest/events.jsonl | jq .

# Codex 进程日志
tail -f .codex-father/sessions/latest/codex.log
```

#### 3. 性能分析

```bash
# 运行基准测试
npm run benchmark

# 查看测试报告
open test-results/index.html
```

---

## 参考资料

- [MCP 官方文档](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Codex CLI 文档](https://docs.anthropic.com/codex)
- [项目 README](../README.md)
- [Quickstart 指南](../specs/005-docs-prd-draft/quickstart.md)

---

**最后更新**: 2025-09-30 **维护者**: Codex Father Team
