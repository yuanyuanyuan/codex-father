# 第一个任务

本教程将手把手教你创建和执行第一个 Codex Father 2.0 任务，帮助你理解核心概念和工作流程。

## 🎯 学习目标

完成本教程后，你将能够：
- ✅ 理解任务的基本结构和配置
- ✅ 创建不同类型的任务（Shell、Node.js、AI提示）
- ✅ 使用三种不同的执行方式
- ✅ 监控任务状态和查看结果
- ✅ 处理任务错误和异常

## 📋 准备工作

确保你已经完成了 [安装指南](./installation.md) 并且：

```bash
# 验证安装
codex-father --version

# 创建工作目录
mkdir my-first-codex-project
cd my-first-codex-project

# 创建基础配置
echo '{"runner": {"maxConcurrency": 3, "defaultTimeout": 60000}}' > codex-father.json
```

## 🚀 任务 1：Hello World Shell 任务

### 步骤 1：创建任务配置文件

```bash
# 创建第一个任务配置
cat > hello-world.json << 'EOF'
{
  "tasks": [
    {
      "id": "greeting",
      "command": "echo '🎉 Hello, Codex Father 2.0!'",
      "environment": "shell",
      "timeout": 10000
    }
  ]
}
EOF
```

### 步骤 2：执行任务

```bash
# 使用 CLI 执行
codex-father run hello-world.json

# 预期输出：
# 🚀 Starting task execution...
# ✅ Task 'greeting' completed successfully
# 🎉 Hello, Codex Father 2.0!
# 📊 Execution summary: 1 tasks completed in 0.5s
```

### 步骤 3：查看任务详情

```bash
# 查看系统状态
codex-father status

# 查看任务日志
codex-father logs greeting
```

## 🔧 任务 2：文件操作任务

### 步骤 1：准备文件

```bash
# 创建一个示例文件
echo "Codex Father 2.0 is awesome!" > sample.txt

# 创建文件操作任务
cat > file-tasks.json << 'EOF'
{
  "tasks": [
    {
      "id": "read-file",
      "command": "cat sample.txt",
      "environment": "shell"
    },
    {
      "id": "copy-file",
      "command": "cp sample.txt backup.txt",
      "environment": "shell",
      "dependencies": ["read-file"]
    },
    {
      "id": "list-files",
      "command": "ls -la *.txt",
      "environment": "shell", 
      "dependencies": ["copy-file"]
    }
  ]
}
EOF
```

### 步骤 2：执行文件操作任务

```bash
# 执行任务链
codex-father run file-tasks.json

# 预期输出：
# 🚀 Starting task execution...
# ✅ Task 'read-file' completed
# Codex Father 2.0 is awesome!
# ✅ Task 'copy-file' completed  
# ✅ Task 'list-files' completed
# -rw-r--r-- 1 user user 32 Jan 1 12:00 backup.txt
# -rw-r--r-- 1 user user 32 Jan 1 12:00 sample.txt
# 📊 Execution summary: 3 tasks completed in 1.2s
```

## 💻 任务 3：Node.js 编程任务

### 步骤 1：创建 Node.js 脚本

```bash
# 创建数据处理脚本
cat > data-processor.js << 'EOF'
// 简单的数据处理示例
const data = [
  { name: 'Alice', age: 30, city: 'Beijing' },
  { name: 'Bob', age: 25, city: 'Shanghai' },
  { name: 'Charlie', age: 35, city: 'Guangzhou' }
];

console.log('📊 Processing user data...');

// 数据过滤：年龄大于25的用户
const filteredUsers = data.filter(user => user.age > 25);
console.log(`👥 Users over 25: ${filteredUsers.length}`);

// 数据转换：添加年龄分组
const processedUsers = data.map(user => ({
  ...user,
  ageGroup: user.age < 30 ? 'Young' : 'Senior'
}));

// 统计各城市用户数量
const cityStats = data.reduce((acc, user) => {
  acc[user.city] = (acc[user.city] || 0) + 1;
  return acc;
}, {});

console.log('🏙️ Users by city:', cityStats);
console.log('✅ Data processing completed!');
EOF

# 创建 Node.js 任务配置
cat > nodejs-tasks.json << 'EOF'
{
  "tasks": [
    {
      "id": "process-data",
      "command": "node data-processor.js",
      "environment": "nodejs",
      "timeout": 30000
    }
  ]
}
EOF
```

### 步骤 2：执行 Node.js 任务

```bash
# 执行 Node.js 任务
codex-father run nodejs-tasks.json

# 预期输出：
# 🚀 Starting task execution...
# 📊 Processing user data...
# 👥 Users over 25: 2
# 🏙️ Users by city: { Beijing: 1, Shanghai: 1, Guangzhou: 1 }
# ✅ Data processing completed!
# ✅ Task 'process-data' completed successfully
```

## 🤖 任务 4：AI 提示任务（MCP 方式）

如果你配置了 Claude Code MCP 集成，可以这样使用：

### 方式 A：通过 Claude Code

```
用户: 我需要创建一个简单的 Web 服务器，能够：
1. 提供 GET /api/users 返回用户列表
2. 提供 GET /api/users/:id 返回特定用户
3. 使用 Express 框架
4. 包含错误处理

Claude: [调用 codex_exec 工具]
✅ 任务已接受: task-1704067200000-abc123
正在创建 Express 服务器...

[等待几秒后]

✅ 服务器创建完成！已生成 server.js 文件
- 支持 GET /api/users 端点
- 支持 GET /api/users/:id 端点  
- 包含完整的错误处理
- 代码已保存到 ./server.js
```

### 方式 B：通过 HTTP API

```bash
# 启动 HTTP 服务器
codex-father server --port 3000 &

# 提交 AI 提示任务
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "创建一个 REST API 服务器，包含用户管理的 CRUD 操作",
    "environment": "nodejs",
    "priority": "high"
  }'

# 响应示例：
# {
#   "success": true,
#   "taskId": "task-1704067200000-def456",
#   "status": "started",
#   "message": "Task submitted successfully"
# }

# 查询任务状态
curl http://localhost:3000/tasks/task-1704067200000-def456
```

## ⚡ 任务 5：并发任务示例

### 创建并发任务

```bash
# 创建并发执行的任务
cat > concurrent-tasks.json << 'EOF'
{
  "tasks": [
    {
      "id": "task-quick",
      "command": "echo 'Quick task started' && sleep 1 && echo 'Quick task done'",
      "environment": "shell",
      "priority": "high"
    },
    {
      "id": "task-medium",
      "command": "echo 'Medium task started' && sleep 2 && echo 'Medium task done'",
      "environment": "shell",
      "priority": "normal"
    },
    {
      "id": "task-slow",
      "command": "echo 'Slow task started' && sleep 3 && echo 'Slow task done'",
      "environment": "shell",
      "priority": "low"
    }
  ]
}
EOF
```

### 执行并发任务

```bash
# 执行并发任务（观察执行顺序）
codex-father run concurrent-tasks.json

# 在另一个终端监控状态
codex-father status --watch
```

## 🔍 任务监控和调试

### 实时监控任务

```bash
# 启动一个长时间运行的任务
cat > long-task.json << 'EOF'
{
  "tasks": [
    {
      "id": "long-running",
      "command": "for i in {1..10}; do echo \"Progress: $i/10\"; sleep 1; done",
      "environment": "shell",
      "timeout": 15000
    }
  ]
}
EOF

# 在后台执行
codex-father run long-task.json &

# 实时查看状态
watch -n 1 'codex-father status'

# 查看实时日志
codex-father logs long-running --follow
```

### 错误处理示例

```bash
# 创建一个会失败的任务
cat > error-task.json << 'EOF'
{
  "tasks": [
    {
      "id": "will-fail",
      "command": "exit 1",
      "environment": "shell"
    },
    {
      "id": "will-succeed",
      "command": "echo 'This will still run'",
      "environment": "shell"
    }
  ]
}
EOF

# 执行并观察错误处理
codex-father run error-task.json

# 查看错误日志
codex-father logs will-fail
```

## 🎯 任务配置详解

### 完整的任务配置结构

```json
{
  "tasks": [
    {
      "id": "example-task",
      "command": "echo 'Hello World'",
      "prompt": "Create a simple greeting",
      "environment": "shell",
      "timeout": 60000,
      "priority": "normal",
      "dependencies": ["previous-task"],
      "workingDirectory": "./workspace",
      "environment": {
        "NODE_ENV": "production",
        "API_KEY": "secret-key"
      },
      "metadata": {
        "author": "developer",
        "project": "my-project"
      }
    }
  ]
}
```

### 配置字段说明

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 任务唯一标识符 |
| `command` | string | ❌ | 要执行的命令（与 prompt 二选一） |
| `prompt` | string | ❌ | AI 提示（与 command 二选一） |
| `environment` | string | ❌ | 执行环境：shell/nodejs/python |
| `timeout` | number | ❌ | 超时时间（毫秒） |
| `priority` | string | ❌ | 优先级：low/normal/high |
| `dependencies` | string[] | ❌ | 依赖的任务ID列表 |
| `workingDirectory` | string | ❌ | 工作目录 |
| `metadata` | object | ❌ | 任务元数据 |

## 📊 任务结果分析

### 查看任务结果

```bash
# 查看最近的任务
codex-father logs --recent 5

# 查看特定任务结果
codex-father logs --result task-id

# 导出任务报告
codex-father logs --export report.json
```

### 性能分析

```bash
# 查看系统性能
codex-father status --detailed

# 查看任务执行时间
codex-father logs --timing

# 查看资源使用情况
codex-father status --resources
```

## ✅ 成功检查清单

完成以下任务说明你已经掌握了基础：

- [ ] ✅ 创建并执行了 Shell 命令任务
- [ ] ✅ 创建了有依赖关系的任务链
- [ ] ✅ 执行了 Node.js 编程任务
- [ ] ✅ 体验了并发任务执行
- [ ] ✅ 学会了监控任务状态
- [ ] ✅ 能够查看和分析任务日志
- [ ] ✅ 处理了任务错误和异常

## 🎉 下一步

恭喜你完成了第一个任务的教程！现在可以：

1. **学习 MCP 集成** → [MCP 工具集介绍](./mcp/overview.md)
2. **探索更多任务类型** → [任务类型详解](./tasks/types.md)
3. **掌握高级配置** → [高级配置指南](./configuration/advanced.md)
4. **查看实际项目示例** → [实用示例](./examples/workflows.md)

---

**💡 提示**: 记住，Codex Father 2.0 的核心价值在于**并发执行**和**智能调度**。尝试创建更多复杂的任务组合来发挥其威力！