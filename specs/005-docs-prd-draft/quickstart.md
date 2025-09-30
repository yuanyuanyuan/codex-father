# Quickstart: 架构调整 - MCP 模式优先实现

**Feature**: 005-docs-prd-draft
**Date**: 2025-09-30
**Purpose**: 快速验证 MCP 协议优先架构的核心功能

---

## 概述

本快速开始指南演示如何验证 MCP 协议优先架构的关键场景。每个场景包含：
1. **前置条件**：需要完成的实现和配置
2. **执行步骤**：具体操作命令
3. **预期结果**：验证成功的标准
4. **验证脚本**：自动化测试（如适用）

---

## 前置条件（所有场景）

### 环境准备

```bash
# 1. 确保 Node.js 18+ 已安装
node --version  # 应输出 v18.x.x 或更高

# 2. 确保 Codex CLI 已安装
codex --version  # 应输出版本号

# 3. 确保 Codex 已登录
codex login --api-key YOUR_API_KEY

# 4. 安装项目依赖
cd /data/codex-father
npm install

# 5. 构建项目
npm run build
```

### 配置文件准备

创建测试配置：`.codex-father/config/approval-whitelist.yaml`

```yaml
whitelist:
  - pattern: "^git status"
    reason: "Read-only git command"
    enabled: true
  - pattern: "^git diff"
    reason: "Read-only git command"
    enabled: true
  - pattern: "^git log"
    reason: "Read-only git command"
    enabled: true
  - pattern: "^ls "
    reason: "Read-only file listing"
    enabled: true
  - pattern: "^cat "
    reason: "Read-only file viewing"
    enabled: true
  # 注意：npm install 可执行任意 postinstall 脚本，默认不自动批准
```

---

## 场景 1: MVP1 单进程基本流程

### 目标

验证 MCP 协议桥接层和单进程管理的核心功能：
- MCP 客户端可以连接 codex-father
- `tools/call` 快速返回（< 500ms）
- 事件通知正确推送（`codex-father/progress`）
- 日志正确记录

### 前置条件

- Phase 1 实现完成：`core/mcp/`, `core/process/manager.ts`, `core/session/`
- 契约测试通过：`tests/contract/mcp-*.test.ts`

### 执行步骤

#### 1. 使用 MCP Inspector 启动和连接

```bash
# Terminal 1: 启动 MCP Inspector（它会自动启动服务器）
cd /data/codex-father
npx @modelcontextprotocol/inspector npm run mcp:start

# 输出示例：
# MCP Inspector starting...
# Launching MCP server: npm run mcp:start
# [INFO] codex-father MCP server starting...
# [INFO] Starting codex mcp process (PID: 12345)
# [INFO] MCP server ready on stdio
# 浏览器自动打开 http://localhost:5173
```

**注意**：Inspector 会自动启动并连接服务器，无需手动在单独终端运行 `npm run mcp:start`。如果需要手动测试服务器，可以：

```bash
# 手动启动服务器（用于调试）
npm run mcp:start

# 然后在另一个终端通过 stdio 手动发送 JSON-RPC 请求
```

#### 2. 在 Inspector 中执行操作

```json
// 步骤 A: 初始化连接
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "clientInfo": {
      "name": "test-client",
      "version": "1.0.0"
    }
  }
}

// 预期响应（< 100ms）：
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": { "listChanged": false },
      "notifications": {}
    },
    "serverInfo": {
      "name": "codex-father",
      "version": "1.0.0"
    }
  }
}

// 步骤 B: 列出工具
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}

// 预期响应：包含 'start-codex-task', 'interrupt-task' 等工具

// 步骤 C: 调用工具（记录开始时间）
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "start-codex-task",
    "arguments": {
      "prompt": "List files in current directory",
      "model": "gpt-5",
      "approvalPolicy": "on-request"
    }
  }
}

// 预期响应（< 500ms）：
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "status": "accepted",
    "jobId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "conversationId": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
    "message": "Task queued, progress will be sent via notifications"
  }
}

// 步骤 D: 观察通知（应自动接收）
// 通知 1: task-started
{
  "jsonrpc": "2.0",
  "method": "codex-father/progress",
  "params": {
    "jobId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "eventType": "task-started",
    "eventData": {
      "taskId": "t123",
      "startTime": "2025-09-30T10:00:00Z"
    },
    "timestamp": "2025-09-30T10:00:00Z"
  }
}

// 通知 2: agent-message (可能多次)
{
  "jsonrpc": "2.0",
  "method": "codex-father/progress",
  "params": {
    "jobId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "eventType": "agent-message",
    "eventData": {
      "message": "Listing files...",
      "role": "assistant"
    },
    "timestamp": "2025-09-30T10:00:01Z"
  }
}

// 通知 3: task-complete
{
  "jsonrpc": "2.0",
  "method": "codex-father/progress",
  "params": {
    "jobId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "eventType": "task-complete",
    "eventData": {
      "result": "Files: package.json, src/, tests/, ...",
      "duration": 5000
    },
    "timestamp": "2025-09-30T10:00:05Z"
  }
}
```

#### 3. 验证日志文件

```bash
# 检查会话目录是否创建
ls -la .codex-father/sessions/

# 输出示例：
# drwxr-xr-x  2 user user 4096 Sep 30 10:00 task-2025-09-30/

# 检查日志文件
ls -la .codex-father/sessions/task-2025-09-30/

# 预期文件：
# - events.jsonl
# - config.json
# - rollout-ref.txt
# - stdout.log
# - stderr.log

# 验证 events.jsonl 格式
head -n 5 .codex-father/sessions/task-2025-09-30/events.jsonl

# 输出示例（每行一个 JSON 对象）：
# {"eventId":"e1","timestamp":"2025-09-30T10:00:00Z","jobId":"xxx","type":"job-created","data":{...}}
# {"eventId":"e2","timestamp":"2025-09-30T10:00:01Z","jobId":"xxx","type":"session-created","data":{...}}
# ...

# 验证 rollout-ref.txt
cat .codex-father/sessions/task-2025-09-30/rollout-ref.txt

# 输出示例：
# /home/user/.codex/sessions/yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy.jsonl
```

### 验证标准

- ✅ `tools/call` 响应时间 < 500ms
- ✅ 收到至少 3 个通知（task-started, agent-message, task-complete）
- ✅ 所有通知包含正确的 `jobId`（与 tools/call 响应一致）
- ✅ 会话目录创建，包含 5 个文件
- ✅ `events.jsonl` 格式正确（每行一个 JSON）
- ✅ `rollout-ref.txt` 指向存在的 Codex rollout 文件

### 自动化测试

```bash
# 运行集成测试
npm run test -- tests/integration/mvp1-single-process.test.ts

# 测试覆盖：
# - MCP 连接和初始化
# - tools/list 响应验证
# - tools/call 快速返回（< 500ms）
# - 通知接收和 jobId 关联
# - 日志文件创建和格式验证
```

---

## 场景 2: 审批机制验证

### 目标

验证审批策略引擎和终端 UI：
- 策略引擎正确匹配白名单
- 非白名单命令触发人工审批
- 终端 UI 显示审批详情
- 审批决策正确传递给 Codex

### 前置条件

- 场景 1 完成
- Phase 1 实现完成：`core/approval/`

### 执行步骤

#### 1. 启动 codex-father（带终端 UI）

```bash
# Terminal 1: 启动 MCP 服务器
npm run mcp:start
```

#### 2. 发起需要审批的任务

```bash
# Terminal 2: 使用 MCP Inspector
# 发送 tools/call 请求，prompt 包含危险命令
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "start-codex-task",
    "arguments": {
      "prompt": "Remove all build artifacts (hint: rm -rf build)",
      "approvalPolicy": "on-request"
    }
  }
}

# 预期响应（快速返回）：
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "status": "accepted",
    "jobId": "...",
    "conversationId": "...",
    "message": "Task queued, progress will be sent via notifications"
  }
}
```

#### 3. 在 Terminal 1 观察审批提示

```
[INFO] Task started: jobId=...
[INFO] Agent is planning...

⚠️  Approval Required
Command: rm -rf build
CWD: /data/codex-father
Reason: Removing files outside sandbox

Waiting: 0s                      # 计时器实时更新

? Your decision: (Use arrow keys)
❯ ✅ Approve
  ❌ Deny
  ⏭️  Skip (add to whitelist)

# 使用箭头键选择 "✅ Approve"，按 Enter
```

#### 4. 验证审批结果

```bash
# Terminal 2: Inspector 应收到通知
{
  "jsonrpc": "2.0",
  "method": "codex-father/progress",
  "params": {
    "jobId": "...",
    "eventType": "approval-required",
    "eventData": {
      "approvalId": "a1",
      "type": "exec-command",
      "details": {
        "command": "rm -rf build",
        "cwd": "/data/codex-father"
      }
    },
    "timestamp": "2025-09-30T10:05:00Z"
  }
}

# 然后收到 approval-approved 通知（用户决策后）
{
  "jsonrpc": "2.0",
  "method": "codex-father/progress",
  "params": {
    "jobId": "...",
    "eventType": "approval-approved",
    "eventData": {
      "approvalId": "a1",
      "decision": "allow",
      "waitingDuration": 15000
    },
    "timestamp": "2025-09-30T10:05:15Z"
  }
}

# 检查 events.jsonl 记录
tail -n 3 .codex-father/sessions/task-2025-09-30/events.jsonl

# 输出示例：
# {"eventId":"e10","timestamp":"2025-09-30T10:05:00Z","jobId":"...","type":"approval-requested","data":{"requestId":"a1","command":"rm -rf build"}}
# {"eventId":"e11","timestamp":"2025-09-30T10:05:15Z","jobId":"...","type":"approval-approved","data":{"requestId":"a1","decision":"allow","waitingDuration":15000}}
```

### 验证标准

- ✅ 白名单命令（如 `git status`）自动批准，无终端提示
- ✅ 非白名单命令触发终端 UI 审批提示
- ✅ 终端 UI 显示命令详情、CWD、原因
- ✅ 计时器实时更新
- ✅ 用户决策正确传递给 Codex
- ✅ 审批事件记录在 `events.jsonl` 中
- ✅ 通知包含 `waitingDuration` 字段

### 自动化测试

```bash
# 运行审批流程集成测试
npm run test -- tests/integration/approval-flow.test.ts

# 测试覆盖：
# - 白名单自动批准
# - 非白名单触发审批（使用 mock 输入）
# - 审批决策传递
# - 事件日志记录
```

---

## 场景 3: MVP2 进程池并行执行（可选，MVP2 阶段）

### 目标

验证进程池管理和真正并行执行：
- 多个任务同时运行
- 进程池正确分配和释放
- 进程崩溃自动恢复

### 前置条件

- 场景 1, 2 完成
- Phase 2 实现完成：`core/process/pool-manager.ts`, `core/process/session-recovery.ts`

### 执行步骤

#### 1. 配置进程池

创建配置文件：`.codex-father/config/process-pool.yaml`

```yaml
maxProcesses: 3  # 限制最大进程数为 3
```

#### 2. 启动 codex-father（MVP2 模式）

```bash
# Terminal 1: 启动 MCP 服务器（MVP2 模式）
npm run mcp:start -- --mode=mvp2

# 输出示例：
# [INFO] codex-father MCP server starting (MVP2 mode)
# [INFO] Process pool initialized (maxProcesses: 3)
# [INFO] MCP server ready on stdio
```

#### 3. 并行发起多个任务

```bash
# Terminal 2: 使用脚本并行发送 3 个 tools/call 请求
node scripts/test-parallel-tasks.js

# 脚本内容（简化版）：
# for (let i = 0; i < 3; i++) {
#   mcpClient.toolsCall({
#     name: 'start-codex-task',
#     arguments: { prompt: `Task ${i + 1}`, model: 'gpt-5' }
#   });
#   await delay(100);  // 间隔 100ms
# }

# 输出示例：
# Task 1 accepted: jobId=j1, conversationId=c1
# Task 2 accepted: jobId=j2, conversationId=c2
# Task 3 accepted: jobId=j3, conversationId=c3
```

#### 4. 观察并行执行

```bash
# Terminal 1: 观察日志
[INFO] Task 1 started in process 12345 (codex exec)
[INFO] Task 2 started in process 12346 (codex exec)
[INFO] Task 3 started in process 12347 (codex exec)
[INFO] All tasks running in parallel

# 验证进程存在
ps aux | grep "codex exec"

# 输出示例：
# user  12345  ... codex exec --json --model gpt-5
# user  12346  ... codex exec --json --model gpt-5
# user  12347  ... codex exec --json --model gpt-5
```

#### 5. 验证真正并行

```bash
# 检查任务完成时间（应该接近，而非串行）
grep "task-complete" .codex-father/sessions/*/events.jsonl | grep timestamp

# 输出示例（时间戳接近，证明并行）：
# task-2025-09-30-1/events.jsonl:{"timestamp":"2025-09-30T10:10:05Z","type":"task-complete"}
# task-2025-09-30-2/events.jsonl:{"timestamp":"2025-09-30T10:10:06Z","type":"task-complete"}
# task-2025-09-30-3/events.jsonl:{"timestamp":"2025-09-30T10:10:07Z","type":"task-complete"}
```

### 验证标准

- ✅ 3 个任务同时运行（通过 `ps` 验证）
- ✅ 任务完成时间接近（证明并行，而非串行）
- ✅ 进程池未超过 `maxProcesses` 限制
- ✅ 任务完成后进程被释放（可接受新任务）

### 自动化测试

```bash
# 运行进程池集成测试
npm run test -- tests/integration/mvp2-process-pool.test.ts

# 测试覆盖：
# - 进程池初始化
# - 多任务并行分配
# - 进程释放和复用
# - maxProcesses 限制
```

---

## 场景 4: MVP2 会话恢复（可选，MVP2 阶段）

### 目标

验证基于 Codex 原生 rollout 文件的会话恢复：
- 进程崩溃检测
- rollout 文件引用读取
- `codex exec resume` 恢复执行

### 前置条件

- 场景 3 完成
- Phase 2 实现完成：`core/process/session-recovery.ts`

### 执行步骤

#### 1. 启动任务并模拟崩溃

```bash
# Terminal 1: 启动 MCP 服务器（MVP2 模式）
npm run mcp:start -- --mode=mvp2

# Terminal 2: 启动一个长任务
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "start-codex-task",
    "arguments": {
      "prompt": "Implement a new feature (this will take 10 minutes)"
    }
  }
}

# 记录 jobId 和 conversationId
# jobId: j123
# conversationId: c456

# Terminal 3: 模拟进程崩溃（杀死 codex exec 进程）
ps aux | grep "codex exec" | grep c456
# 找到 PID，例如 12345

kill -9 12345  # 强制杀死进程
```

#### 2. 观察自动恢复

```bash
# Terminal 1: 观察日志
[ERROR] Process 12345 crashed (conversationId: c456)
[INFO] Attempting session recovery...
[INFO] Reading rollout reference: .codex-father/sessions/feature-2025-09-30/rollout-ref.txt
[INFO] Rollout file: /home/user/.codex/sessions/c456.jsonl
[INFO] Executing: codex exec resume c456
[INFO] Process 12348 started (recovery)
[INFO] Session c456 recovered successfully
```

#### 3. 验证恢复成功

```bash
# Terminal 2: 应继续收到通知（jobId 不变）
{
  "jsonrpc": "2.0",
  "method": "codex-father/progress",
  "params": {
    "jobId": "j123",
    "eventType": "session-recovering",
    "eventData": {
      "conversationId": "c456",
      "reason": "Process crashed"
    },
    "timestamp": "2025-09-30T10:15:00Z"
  }
}

{
  "jsonrpc": "2.0",
  "method": "codex-father/progress",
  "params": {
    "jobId": "j123",
    "eventType": "agent-message",
    "eventData": {
      "message": "Continuing implementation...",
      "role": "assistant"
    },
    "timestamp": "2025-09-30T10:15:02Z"
  }
}

# 任务最终正常完成（无需重新开始）
```

#### 4. 验证日志记录

```bash
# 检查 events.jsonl
grep "session-recovering\|process-crashed" .codex-father/sessions/feature-2025-09-30/events.jsonl

# 输出示例：
# {"eventId":"e20","timestamp":"2025-09-30T10:15:00Z","jobId":"j123","type":"process-crashed","data":{"pid":12345,"conversationId":"c456"}}
# {"eventId":"e21","timestamp":"2025-09-30T10:15:01Z","jobId":"j123","type":"session-recovering","data":{"conversationId":"c456"}}
# {"eventId":"e22","timestamp":"2025-09-30T10:15:02Z","jobId":"j123","type":"session-active","data":{"newPid":12348}}
```

### 验证标准

- ✅ 进程崩溃被检测到（< 5s）
- ✅ rollout 文件路径正确读取
- ✅ `codex exec resume` 成功执行
- ✅ 会话继续（无需重新开始）
- ✅ 客户端收到 `session-recovering` 通知
- ✅ 崩溃和恢复事件记录在 `events.jsonl`

### 自动化测试

```bash
# 运行会话恢复集成测试
npm run test -- tests/integration/session-recovery.test.ts

# 测试覆盖：
# - 进程崩溃检测
# - rollout 文件读取
# - 恢复命令执行
# - 会话继续验证
# - 事件日志记录
```

---

## 性能验证

### 目标

验证系统满足 constitution 的性能要求。

### 执行步骤

```bash
# 运行性能基准测试
npm run benchmark

# 测试覆盖：
# - MCP tools/call 响应时间（< 500ms）
# - 事件通知延迟（< 100ms）
# - 内存占用（< 200MB）
# - 并发会话数（MVP2: 至少 4 个）
```

### 验证标准

- ✅ MCP tools/call 响应时间 p95 < 500ms
- ✅ 事件通知延迟 p95 < 100ms
- ✅ MCP 服务器空闲内存占用 < 200MB
- ✅ MVP2 支持至少 4 个并发任务（取决于 CPU 核数）

---

## 故障排查

### 问题 1: `tools/call` 响应超过 500ms

**可能原因**：
- Codex `newConversation` 调用阻塞
- 日志写入阻塞

**解决方案**：
1. 检查 Codex 启动时间：`time codex exec --version`
2. 使用异步日志写入（`winston` 异步传输）
3. 优化数据验证（Zod parse 缓存）

### 问题 2: 通知丢失或延迟

**可能原因**：
- Codex 事件流解析错误
- EventEmitter 监听器未注册

**解决方案**：
1. 检查 Codex 进程 stdout：`cat .codex-father/sessions/*/stdout.log`
2. 验证 line-delimited JSON 解析逻辑
3. 增加日志：`DEBUG=codex-father:events npm run mcp:start`

### 问题 3: 审批提示未显示

**可能原因**：
- 终端 UI 库（inquirer）未正确初始化
- Approval 请求未被捕获

**解决方案**：
1. 检查 Codex 是否发送了 `applyPatchApproval` 或 `execCommandApproval`
2. 验证 JSON-RPC 请求处理逻辑
3. 测试 inquirer 独立工作：`node -e "require('inquirer').prompt([{type:'list',name:'test',choices:['A','B']}])"`

### 问题 4: 会话恢复失败

**可能原因**：
- rollout 文件不存在或路径错误
- Codex 版本不兼容

**解决方案**：
1. 验证 `rollout-ref.txt` 内容：`cat .codex-father/sessions/*/rollout-ref.txt`
2. 检查 rollout 文件存在：`ls -l $(cat rollout-ref.txt)`
3. 验证 Codex 版本：`codex --version`（确保兼容 rollout 格式）
4. 手动测试恢复：`codex exec resume <conversation-id>`

---

## 总结

所有快速开始场景已定义，涵盖：
- ✅ MVP1 核心流程（场景 1, 2）
- ✅ MVP2 进程池并行（场景 3）
- ✅ MVP2 会话恢复（场景 4）
- ✅ 性能验证
- ✅ 故障排查指南

**准备就绪，可以用于 Phase 2 任务规划和 Phase 3 实现验证** ✓