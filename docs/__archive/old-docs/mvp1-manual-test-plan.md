# MVP1 手动测试计划

**测试日期**: 2025-10-01 **测试人员**: 待执行 **测试环境**:

- Node.js: 18+
- TypeScript: 5.3+
- Codex CLI: 已安装并配置

---

## 🎯 测试目标

验证 MVP1 TypeScript MCP Server 的以下核心功能：

1. ✅ MCP 服务器启动和关闭
2. ✅ MCP 协议通信（使用 MCP Inspector）
3. ✅ 单进程会话管理
4. ✅ 事件日志记录
5. ✅ 审批机制（策略引擎 + 终端 UI）
6. ✅ 配置持久化
7. ✅ 进程健康检查和重启
8. ✅ 错误处理和边界情况

---

## 📋 测试前准备

### 1. 环境检查

```bash
# 检查 Node.js 版本
node --version
# 期望: v18.x 或更高

# 检查 npm 版本
npm --version
# 期望: 9.x 或更高

# 检查 Codex CLI 是否安装
codex --version
# 期望: 显示版本号

# 检查 Codex 登录状态
codex auth status
# 期望: 显示已登录
```

### 2. 项目构建

```bash
# 进入项目目录
cd /data/codex-father

# 安装依赖
npm install

# 构建项目
npm run build

# 运行类型检查
npm run typecheck

# 运行 lint 检查
npm run lint:check

# 期望: 所有检查通过 ✅
```

### 3. 清理旧数据（可选）

```bash
# 备份旧会话数据
mv .codex-father .codex-father.backup.$(date +%Y%m%d_%H%M%S)

# 或者直接删除
rm -rf .codex-father

# 重新创建目录
mkdir -p .codex-father/sessions
```

---

## 🧪 测试场景

### 场景 1: MCP 服务器基本启动和关闭 ⭐

**目标**: 验证 MCP 服务器能够正常启动和优雅关闭

**步骤**:

```bash
# 1. 启动 MCP 服务器（前台模式，便于观察日志）
npm start

# 期望输出:
# ✓ MCP Server initialized
# ✓ Process manager started
# ✓ Listening on stdio...
# → codex-father MCP server is ready
```

**验证点**:

- [ ] 服务器成功启动，无错误日志
- [ ] 显示 "MCP server is ready" 消息
- [ ] 进程管理器已启动

**停止服务器**:

```bash
# 按 Ctrl+C 发送 SIGINT
# 或在另一个终端
kill -SIGINT <pid>

# 期望输出:
# → Received SIGINT, shutting down gracefully...
# ✓ MCP Server stopped
# ✓ Process manager stopped
# → Shutdown complete
```

**验证点**:

- [ ] 优雅关闭，无错误
- [ ] 所有子进程被清理
- [ ] 会话数据已保存

---

### 场景 2: MCP Inspector 连接测试 ⭐

**目标**: 使用 MCP Inspector 连接并测试协议通信

**步骤**:

```bash
# 1. 使用 MCP Inspector 启动服务器
npx @modelcontextprotocol/inspector npm start

# 期望:
# - 自动打开浏览器
# - 显示 MCP Inspector UI
# - 左侧显示 "Connected" 状态
```

**在 Inspector 中测试**:

#### 测试 2.1: Initialize

```json
// 点击 "Connect" 按钮
// 期望响应:
{
  "protocolVersion": "2024-11-05",
  "capabilities": {
    "tools": {},
    "notifications": {}
  },
  "serverInfo": {
    "name": "codex-father",
    "version": "1.0.0"
  }
}
```

**验证点**:

- [ ] 协议版本正确
- [ ] capabilities 包含 tools 和 notifications
- [ ] serverInfo.name 为 "codex-father"

#### 测试 2.2: Tools/List

```json
// 点击 "List Tools" 按钮
// 期望响应:
{
  "tools": [
    {
      "name": "chat",
      "description": "Send a chat message to Codex",
      "inputSchema": {
        "type": "object",
        "properties": {
          "message": { "type": "string" },
          "sessionName": { "type": "string" },
          "model": { "type": "string" }
        },
        "required": ["message"]
      }
    },
    {
      "name": "execute",
      "description": "Execute a Codex task",
      "inputSchema": {
        /* ... */
      }
    },
    {
      "name": "read-file",
      "description": "Read a file from the workspace",
      "inputSchema": {
        /* ... */
      }
    },
    {
      "name": "apply-patch",
      "description": "Apply a patch to a file",
      "inputSchema": {
        /* ... */
      }
    }
  ]
}
```

**验证点**:

- [ ] 返回 4 个工具定义
- [ ] 每个工具有 name、description、inputSchema
- [ ] inputSchema 格式正确（JSON Schema）

#### 测试 2.3: Tools/Call - Chat

```json
// 点击 "Call Tool" → 选择 "chat"
// 输入参数:
{
  "message": "Hello, what is 2+2?",
  "sessionName": "test-chat",
  "model": "claude-3-5-sonnet-20241022"
}

// 期望响应（快速返回 < 500ms）:
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"status\": \"accepted\",\n  \"jobId\": \"job-abc123\",\n  \"conversationId\": \"conv-xyz789\",\n  \"message\": \"Task started\"\n}"
    }
  ],
  "isError": false
}
```

**验证点**:

- [ ] 快速返回（< 500ms）
- [ ] 返回 jobId 和 conversationId
- [ ] status 为 "accepted"

**观察通知**:

```json
// 在 "Notifications" 面板应该陆续收到:
{
  "method": "notifications/message",
  "params": {
    "level": "info",
    "logger": "codex-father",
    "data": {
      "jobId": "job-abc123",
      "eventType": "task-started",
      "eventData": {
        /* ... */
      },
      "timestamp": "2025-10-01T..."
    }
  }
}

// 后续通知:
// - agent-message (Codex 的回复)
// - task-completed (任务完成)
```

**验证点**:

- [ ] 收到 task-started 通知
- [ ] 收到 agent-message 通知
- [ ] 收到 task-completed 通知
- [ ] jobId 一致

---

### 场景 3: 会话目录和日志验证 ⭐

**目标**: 验证会话目录结构和事件日志记录

**步骤**:

```bash
# 1. 列出会话目录
ls -la .codex-father/sessions/

# 期望输出:
# drwxr-xr-x  test-chat-2025-10-01/

# 2. 查看会话目录内容
ls -la .codex-father/sessions/test-chat-2025-10-01/

# 期望输出:
# -rw-r--r--  events.jsonl
# -rw-r--r--  config.json
# -rw-r--r--  rollout-ref.txt  (如果有)
```

**验证事件日志**:

```bash
# 3. 查看事件日志
cat .codex-father/sessions/test-chat-2025-10-01/events.jsonl

# 期望格式（每行一个 JSON）:
# {"type":"session-created","sessionId":"...","timestamp":"2025-10-01T..."}
# {"type":"task-started","jobId":"job-abc123","timestamp":"2025-10-01T..."}
# {"type":"agent-message","jobId":"job-abc123","content":"2+2 equals 4","timestamp":"..."}
# {"type":"task-completed","jobId":"job-abc123","duration":5000,"timestamp":"..."}
```

**验证配置文件**:

```bash
# 4. 查看配置文件
cat .codex-father/sessions/test-chat-2025-10-01/config.json | jq

# 期望输出:
{
  "sessionId": "...",
  "sessionName": "test-chat",
  "conversationId": "conv-xyz789",
  "model": "claude-3-5-sonnet-20241022",
  "cwd": "/data/codex-father",
  "createdAt": "2025-10-01T...",
  "status": "completed"
}
```

**验证点**:

- [ ] 会话目录已创建，命名格式正确
- [ ] events.jsonl 存在且格式正确（每行一个 JSON）
- [ ] config.json 存在且包含完整配置
- [ ] 所有字段类型正确

---

### 场景 4: 审批机制测试 - 白名单自动批准 ⭐

**目标**: 验证白名单命令自动批准

**前置条件**: 确保审批策略配置正确

```bash
# 查看审批策略配置
cat core/approval/policy-engine.ts | grep -A 10 "DEFAULT_WHITELIST"

# 期望包含:
# - ^git status
# - ^git diff
# - ^git log
# - ^ls
# - ^cat
```

**步骤（使用 MCP Inspector）**:

```json
// 1. 调用 execute 工具，执行白名单命令
{
  "tool": "execute",
  "arguments": {
    "command": "git status",
    "cwd": "/data/codex-father",
    "sessionName": "test-approval-whitelist"
  }
}

// 期望响应（快速返回）:
{
  "content": [
    {
      "type": "text",
      "text": "{\n  \"status\": \"accepted\",\n  \"jobId\": \"job-def456\",\n  \"message\": \"Command approved by whitelist\"\n}"
    }
  ]
}
```

**验证点**:

- [ ] 命令自动批准，无需人工干预
- [ ] 快速返回（< 500ms）
- [ ] 日志中记录 "Command approved by whitelist"

**查看事件日志**:

```bash
cat .codex-father/sessions/test-approval-whitelist-*/events.jsonl | grep approval

# 期望输出（包含）:
# {"type":"approval-auto-approved","reason":"whitelist-match",...}
```

---

### 场景 5: 审批机制测试 - 终端 UI 人工审批 ⭐⚠️

**目标**: 验证非白名单命令触发终端 UI 审批

**注意**: 这个测试需要**人工交互**

**步骤 1: 准备终端**

```bash
# 1. 在一个终端启动 MCP 服务器（前台模式，能看到审批 UI）
npm start
```

**步骤 2: 在另一个终端使用 MCP Inspector**

```bash
# 2. 在另一个终端启动 Inspector
npx @modelcontextprotocol/inspector npm start
```

**步骤 3: 发送非白名单命令**

```json
// 在 Inspector 中调用 execute 工具
{
  "tool": "execute",
  "arguments": {
    "command": "npm install lodash",
    "cwd": "/data/codex-father",
    "sessionName": "test-approval-manual"
  }
}
```

**步骤 4: 观察审批 UI（第一个终端）**

期望显示：

```
┌─────────────────────────────────────────────────────────┐
│ 审批请求                                                 │
├─────────────────────────────────────────────────────────┤
│ 会话: test-approval-manual                              │
│ 命令: npm install lodash                                │
│ 工作目录: /data/codex-father                            │
│ 等待时间: 0:00:05                                       │
├─────────────────────────────────────────────────────────┤
│ [A] 批准  [D] 拒绝  [W] 加入白名单  [S] 跳过           │
└─────────────────────────────────────────────────────────┘
```

**步骤 5: 人工操作**

```bash
# 测试批准
按 A 键 → Enter

# 期望:
# ✓ 命令已批准
# → 返回 Inspector，收到成功响应
```

**验证点**:

- [ ] 终端 UI 正确显示审批请求
- [ ] 显示命令、工作目录、等待时间
- [ ] 快捷键 A/D/W/S 正常工作
- [ ] 批准后命令正常执行
- [ ] 事件日志记录审批决策

**测试拒绝**:

```json
// 再次发送命令
{
  "tool": "execute",
  "arguments": {
    "command": "rm -rf /tmp/test",
    "cwd": "/data/codex-father",
    "sessionName": "test-approval-deny"
  }
}

// 在终端按 D 键 → Enter 拒绝

// 期望 Inspector 收到错误响应:
{
  "content": [
    {
      "type": "text",
      "text": "Error: Command denied by user"
    }
  ],
  "isError": true
}
```

**验证点**:

- [ ] 拒绝后命令不执行
- [ ] 返回错误响应
- [ ] 事件日志记录拒绝决策

---

### 场景 6: 多会话管理测试 ⭐

**目标**: 验证单进程管理多个会话（串行执行）

**步骤（使用 MCP Inspector）**:

```json
// 1. 快速连续发送 3 个任务
// 任务 1
{
  "tool": "chat",
  "arguments": {
    "message": "Count from 1 to 5 slowly",
    "sessionName": "session-1"
  }
}

// 任务 2（立即发送，不等待任务 1 完成）
{
  "tool": "chat",
  "arguments": {
    "message": "What is the capital of France?",
    "sessionName": "session-2"
  }
}

// 任务 3（立即发送）
{
  "tool": "chat",
  "arguments": {
    "message": "Calculate 100 * 200",
    "sessionName": "session-3"
  }
}

// 期望:
// - 所有任务都快速返回（< 500ms）
// - 每个任务都有独立的 jobId
// - 但后端是串行执行（任务 2 等待任务 1 完成）
```

**验证点**:

- [ ] 3 个任务都快速返回（前端不阻塞）
- [ ] 3 个任务有不同的 jobId
- [ ] 创建了 3 个会话目录
- [ ] 通知中能看到任务按顺序执行

**查看会话目录**:

```bash
ls -la .codex-father/sessions/

# 期望输出:
# session-1-2025-10-01/
# session-2-2025-10-01/
# session-3-2025-10-01/
```

---

### 场景 7: 进程健康检查和重启 ⚠️

**目标**: 验证进程崩溃后自动重启

**注意**: 这是一个破坏性测试，需要手动干预

**步骤**:

```bash
# 1. 启动 MCP 服务器
npm start

# 2. 在另一个终端查看 Codex 进程
ps aux | grep "codex mcp"

# 期望输出:
# user  12345  ... codex mcp

# 3. 记录进程 PID
CODEX_PID=12345

# 4. 手动杀死 Codex 进程（模拟崩溃）
kill -9 $CODEX_PID

# 5. 观察 MCP 服务器日志
# 期望输出:
# ⚠️  Codex process crashed (PID: 12345)
# → Attempting to restart...
# ✓ Codex process restarted (PID: 12346)
```

**验证点**:

- [ ] 检测到进程崩溃
- [ ] 自动重启进程
- [ ] 新进程有不同的 PID
- [ ] 重启后服务正常可用

**测试重启后功能**:

```json
// 在 Inspector 中再次调用 chat 工具
{
  "tool": "chat",
  "arguments": {
    "message": "Are you still working?",
    "sessionName": "test-restart"
  }
}

// 期望: 正常响应 ✅
```

---

### 场景 8: 配置文件加载测试

**目标**: 验证配置文件正确加载

**步骤**:

```bash
# 1. 检查默认配置
cat package.json | jq '.config'

# 2. 查看审批策略配置
cat core/approval/policy-engine.ts | grep -A 20 "DEFAULT_POLICY"

# 3. 启动服务器，检查日志中的配置信息
npm start 2>&1 | grep -i "config\|policy\|whitelist"

# 期望输出:
# ✓ Loaded approval policy: UNTRUSTED mode
# ✓ Whitelist rules: 5 patterns
# ✓ Default model: claude-3-5-sonnet-20241022
```

**验证点**:

- [ ] 配置文件正确加载
- [ ] 审批策略配置生效
- [ ] 白名单规则加载正确

---

### 场景 9: 错误处理测试

**目标**: 验证各种错误场景的处理

#### 9.1 无效参数

```json
// 在 Inspector 中调用 chat 工具，缺少必需参数
{
  "tool": "chat",
  "arguments": {
    // 缺少 message 参数
    "sessionName": "test-error"
  }
}

// 期望响应:
{
  "content": [
    {
      "type": "text",
      "text": "Error: Missing required parameter: message"
    }
  ],
  "isError": true
}
```

#### 9.2 不存在的工具

```json
// 调用不存在的工具
{
  "tool": "non-existent-tool",
  "arguments": {}
}

// 期望响应:
{
  "error": {
    "code": -32601,
    "message": "Method not found: non-existent-tool"
  }
}
```

#### 9.3 无效的文件路径

```json
// 读取不存在的文件
{
  "tool": "read-file",
  "arguments": {
    "path": "/non/existent/file.txt"
  }
}

// 期望响应:
{
  "content": [
    {
      "type": "text",
      "text": "Error: File not found: /non/existent/file.txt"
    }
  ],
  "isError": true
}
```

**验证点**:

- [ ] 错误信息清晰明确
- [ ] 返回正确的错误码
- [ ] 不会导致服务器崩溃

---

### 场景 10: 性能基准测试

**目标**: 验证性能指标符合要求

**步骤**:

```bash
# 运行性能基准测试
npm run benchmark

# 期望输出:
# ✓ tools/call Response Time
#   - should respond to tools/call within 500ms: 60ms (PASS)
# ✓ Event Notification Latency
#   - should map event within 100ms: 1ms (PASS)
# ✓ Memory Usage
#   - should maintain < 200MB: 100MB (PASS)
```

**验证点**:

- [ ] tools/call 响应时间 < 500ms
- [ ] 事件通知延迟 < 100ms
- [ ] 内存占用 < 200MB

---

## 📊 测试结果记录表

### 测试概览

| 场景    | 测试项            | 状态      | 备注         |
| ------- | ----------------- | --------- | ------------ |
| 场景 1  | 服务器启动        | ⬜️ 待测试 |              |
| 场景 1  | 优雅关闭          | ⬜️ 待测试 |              |
| 场景 2  | Initialize        | ⬜️ 待测试 |              |
| 场景 2  | Tools/List        | ⬜️ 待测试 |              |
| 场景 2  | Tools/Call - Chat | ⬜️ 待测试 |              |
| 场景 3  | 会话目录创建      | ⬜️ 待测试 |              |
| 场景 3  | 事件日志记录      | ⬜️ 待测试 |              |
| 场景 3  | 配置文件保存      | ⬜️ 待测试 |              |
| 场景 4  | 白名单自动批准    | ⬜️ 待测试 |              |
| 场景 5  | 终端 UI 显示      | ⬜️ 待测试 | 需要人工交互 |
| 场景 5  | 批准操作          | ⬜️ 待测试 | 需要人工交互 |
| 场景 5  | 拒绝操作          | ⬜️ 待测试 | 需要人工交互 |
| 场景 6  | 多会话管理        | ⬜️ 待测试 |              |
| 场景 7  | 进程崩溃检测      | ⬜️ 待测试 | 破坏性测试   |
| 场景 7  | 自动重启          | ⬜️ 待测试 | 破坏性测试   |
| 场景 8  | 配置加载          | ⬜️ 待测试 |              |
| 场景 9  | 错误处理          | ⬜️ 待测试 |              |
| 场景 10 | 性能基准          | ⬜️ 待测试 |              |

### 详细测试记录

**测试日期**: **\*\***\_\_\_**\*\*** **测试人员**: **\*\***\_\_\_**\*\***

---

#### 场景 1: MCP 服务器基本启动和关闭

- [ ] 测试通过
- [ ] 测试失败

**失败原因** (如果失败):

```
记录详细错误信息...
```

**截图/日志**:

```
粘贴相关日志...
```

---

#### 场景 2: MCP Inspector 连接测试

- [ ] 测试通过
- [ ] 测试失败

**失败原因** (如果失败):

```
记录详细错误信息...
```

**截图/日志**:

```
粘贴相关日志...
```

---

_(为每个场景添加类似的记录模板...)_

---

## 🐛 已知问题记录

| 问题编号 | 场景 | 描述 | 严重程度 | 状态 |
| -------- | ---- | ---- | -------- | ---- |
|          |      |      |          |      |

---

## ✅ 测试总结

**测试完成日期**: **\*\***\_\_\_**\*\***

**通过率**: **_ / 18 (_**%)

## **关键发现**:

## **建议改进**:

**是否可以发布**:

- [ ] 是，所有关键测试通过
- [ ] 否，存在阻塞性问题

---

**文档版本**: 1.0.0 **创建日期**: 2025-10-01 **维护者**: codex-father 团队
