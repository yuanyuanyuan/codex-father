# 快速入门指南

欢迎使用 Codex Father 2.0！本指南将帮助你在 5 分钟内上手使用这个强大的任务管理工具。

## 🎯 本指南将学到

- ✅ Codex Father 2.0 的基本概念
- ✅ 三种使用方式的快速体验
- ✅ 第一个任务的创建和执行
- ✅ 基础配置和监控

## 🧠 核心概念（1分钟理解）

### 什么是 Codex Father 2.0？

Codex Father 2.0 是一个**极简的多任务并发管理工具**，可以同时执行多个开发任务：

- **🔄 并发执行**：最多同时运行 50+ 个任务
- **🛡️ 安全沙箱**：每个任务在隔离环境中运行
- **📊 实时监控**：随时查看任务状态和进度
- **🔌 多接口**：支持 MCP、HTTP API、CLI 三种方式

### 支持的任务类型

| 类型 | 描述 | 示例 |
|------|------|------|
| **Shell 命令** | 执行系统命令 | `npm test`, `git status` |
| **Node.js 脚本** | 运行 JavaScript 代码 | 数据处理、API 开发 |
| **Python 脚本** | 运行 Python 代码 | 数据分析、机器学习 |
| **AI 提示** | 自然语言任务 | "创建用户登录组件" |

## 🚀 快速体验（3种方式）

### 方式一：MCP 集成（推荐⭐）

适合开发者，与 Claude Code 深度集成。

```bash
# 1. 启动 MCP 服务器
codex-father mcp

# 2. 在 Claude Code 中直接对话：
# 用户: "帮我创建一个用户登录组件"
# Claude: [自动调用 codex_exec 工具]
# ✅ 任务完成！
```

### 方式二：HTTP API

适合系统集成和自动化。

```bash
# 1. 启动 HTTP 服务器
codex-father server --port 3000

# 2. 提交任务
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "创建一个简单的 Express 服务器",
    "environment": "nodejs"
  }'

# 响应: {"taskId": "task-123", "status": "started"}
```

### 方式三：CLI 命令行

适合传统命令行工作流。

```bash
# 1. 创建任务配置文件
echo '{
  "tasks": [
    {
      "id": "hello-world",
      "command": "echo \"Hello, Codex Father!\"",
      "environment": "shell"
    }
  ]
}' > my-tasks.json

# 2. 执行任务
codex-father run my-tasks.json
```

## 📝 创建你的第一个任务

### 任务 1：简单 Shell 命令

让我们从一个最简单的任务开始：

```bash
# 创建任务配置
cat > first-task.json << 'EOF'
{
  "tasks": [
    {
      "id": "greeting",
      "command": "echo '🎉 Hello from Codex Father 2.0!'",
      "environment": "shell"
    },
    {
      "id": "system-info", 
      "command": "echo 'Node.js version:' && node --version",
      "environment": "shell",
      "dependencies": ["greeting"]
    }
  ]
}
EOF

# 执行任务
codex-father run first-task.json
```

**预期输出：**
```
✅ Task 'greeting' completed: 🎉 Hello from Codex Father 2.0!
✅ Task 'system-info' completed: Node.js version: v20.0.0
🎉 All tasks completed successfully!
```

### 任务 2：Node.js 脚本执行

创建一个简单的 Node.js 任务：

```bash
# 创建 Node.js 脚本
cat > calculator.js << 'EOF'
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const result = fibonacci(10);
console.log(`🧮 Fibonacci(10) = ${result}`);
EOF

# 创建任务配置
cat > node-task.json << 'EOF'
{
  "tasks": [
    {
      "id": "calculate-fibonacci",
      "command": "node calculator.js",
      "environment": "nodejs"
    }
  ]
}
EOF

# 执行任务
codex-father run node-task.json
```

### 任务 3：AI 提示任务（MCP 方式）

如果你配置了 MCP 集成，可以直接在 Claude Code 中：

```
用户: 帮我创建一个计算斐波那契数列的函数

Claude: [调用 codex_exec 工具]
✅ 任务已提交: task-1704067200000-abc123

用户: 查看任务状态

Claude: [调用 codex_status 工具]  
📊 任务已完成：已创建斐波那契计算函数
```

## 📊 监控任务状态

### 查看所有任务

```bash
# 查看系统状态
codex-father status

# 输出示例：
# 📊 Codex Father Status
# 🔧 Version: 2.0.0
# ⚡ Running: 0 tasks
# ⏳ Pending: 0 tasks  
# ✅ Completed: 5 tasks
# 💾 Memory: 45MB
# 🕒 Uptime: 2m 30s
```

### 查看任务日志

```bash
# 查看特定任务日志
codex-father logs greeting

# 实时跟踪日志
codex-father logs calculate-fibonacci --follow

# 查看最近的日志
codex-father logs --recent 5
```

### 取消运行中的任务

```bash
# 取消特定任务
codex-father cancel task-id

# 取消所有运行中的任务
codex-father cancel --all
```

## ⚙️ 基础配置

### 创建配置文件

```bash
# 创建默认配置
cat > codex-father.json << 'EOF'
{
  "runner": {
    "maxConcurrency": 5,
    "defaultTimeout": 300000,
    "workingDirectory": "./workspace"
  },
  "logging": {
    "level": "info"
  }
}
EOF

# 创建工作目录
mkdir -p workspace
```

### 配置说明

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `maxConcurrency` | 最大并发任务数 | 10 |
| `defaultTimeout` | 默认超时时间（毫秒） | 600000 (10分钟) |
| `workingDirectory` | 任务执行目录 | ./workspace |
| `logLevel` | 日志级别 | info |

## 🎯 进阶体验

### 并发任务示例

```bash
# 创建并发任务配置
cat > concurrent-tasks.json << 'EOF'
{
  "tasks": [
    {
      "id": "task-1",
      "command": "echo 'Task 1 started' && sleep 2 && echo 'Task 1 done'",
      "environment": "shell",
      "priority": "high"
    },
    {
      "id": "task-2", 
      "command": "echo 'Task 2 started' && sleep 1 && echo 'Task 2 done'",
      "environment": "shell",
      "priority": "normal"
    },
    {
      "id": "task-3",
      "command": "echo 'Task 3 started' && sleep 3 && echo 'Task 3 done'", 
      "environment": "shell",
      "priority": "low"
    }
  ]
}
EOF

# 执行并发任务
codex-father run concurrent-tasks.json
```

### 任务依赖示例

```bash
# 创建有依赖关系的任务
cat > dependent-tasks.json << 'EOF'
{
  "tasks": [
    {
      "id": "install-deps",
      "command": "npm init -y && npm install lodash",
      "environment": "shell"
    },
    {
      "id": "build-code",
      "command": "echo 'Building with dependencies...'",
      "environment": "shell", 
      "dependencies": ["install-deps"]
    },
    {
      "id": "run-tests",
      "command": "echo 'Running tests...'",
      "environment": "shell",
      "dependencies": ["build-code"]
    }
  ]
}
EOF

# 执行有依赖的任务
codex-father run dependent-tasks.json
```

## 🔍 常用命令速查

```bash
# 基础命令
codex-father --version          # 查看版本
codex-father --help             # 查看帮助
codex-father status             # 查看状态

# 任务管理
codex-father run config.json    # 执行配置文件
codex-father logs task-id       # 查看日志
codex-father cancel task-id     # 取消任务

# 服务启动
codex-father mcp                # 启动 MCP 服务
codex-father server --port 3000 # 启动 HTTP 服务

# 配置选项
codex-father mcp --max-concurrency 20  # 设置最大并发
codex-father server --port 8080       # 设置端口
codex-father run --timeout 600000     # 设置超时
```

## ✅ 成功检查清单

完成以下步骤说明你已经成功上手：

- [ ] ✅ 成功安装 Codex Father 2.0
- [ ] ✅ 运行了第一个 Shell 任务
- [ ] ✅ 尝试了 Node.js 任务执行
- [ ] ✅ 查看了任务状态和日志
- [ ] ✅ 创建了基础配置文件
- [ ] ✅ 体验了并发任务执行

## 🎉 下一步

恭喜！你已经掌握了 Codex Father 2.0 的基础使用。接下来可以：

1. **深入学习 MCP 集成** → [MCP 工具集介绍](./mcp/overview.md)
2. **探索 HTTP API** → [API 概览](./http/overview.md)
3. **掌握 CLI 高级用法** → [CLI 命令详解](./cli/commands.md)
4. **查看实际项目示例** → [实用示例](./examples/workflows.md)

---

**💡 小贴士**: 遇到问题时，使用 `codex-father --help` 查看命令帮助，或查看 [故障排除指南](./troubleshooting/common-issues.md)。