# CLI 概览

Codex Father 2.0 提供了功能完整的命令行界面（CLI），适合传统开发工作流、自动化脚本和系统管理场景。

## 🎯 CLI 特性

### 🛠️ 多模式支持
- **MCP 模式**: 启动 MCP 服务器（默认模式）
- **HTTP 模式**: 启动 HTTP API 服务器
- **执行模式**: 运行配置文件中的任务
- **管理模式**: 任务管理和监控

### ⚙️ 灵活配置
- **命令行参数**: 实时参数调整
- **配置文件**: 持久化配置管理
- **环境变量**: 环境特定配置
- **配置继承**: 多层级配置覆盖

### 📊 丰富的命令
- **任务管理**: 提交、查看、取消任务
- **状态监控**: 实时系统状态
- **日志查看**: 详细的执行日志
- **系统管理**: 配置和维护操作

## 🚀 快速开始

### 基础命令

```bash
# 查看版本信息
codex-father --version

# 查看帮助信息
codex-father --help

# 查看特定命令帮助
codex-father mcp --help
codex-father server --help
codex-father run --help
```

### 启动不同模式

```bash
# 1. 启动 MCP 服务器（默认）
codex-father mcp

# 2. 启动 HTTP 服务器
codex-father server --port 3000

# 3. 执行任务配置文件
codex-father run tasks.json

# 4. 查看系统状态
codex-father status
```

## 📋 命令结构

### 基本语法

```bash
codex-father [全局选项] <命令> [命令选项] [参数]
```

### 全局选项

```bash
--version, -v          # 显示版本信息
--help, -h            # 显示帮助信息
--config <path>       # 指定配置文件路径
--verbose, -V         # 详细输出模式
--quiet, -q           # 静默模式
--log-level <level>   # 设置日志级别 (error|warn|info|debug)
--working-directory <path>  # 设置工作目录
```

## 🎯 核心命令详解

### 1. mcp - 启动 MCP 服务器

**功能**: 启动 MCP 协议服务器，与 Claude Code 集成

**语法**: `codex-father mcp [选项]`

**常用选项**:
```bash
--max-concurrency <number>     # 最大并发任务数 (默认: 10)
--timeout <milliseconds>       # 默认任务超时时间 (默认: 600000)
--working-directory <path>     # 任务执行工作目录
--log-level <level>            # 日志级别
--test-mode                    # 测试模式，不实际执行任务
--verbose                      # 详细日志输出
--heartbeat-interval <ms>      # 心跳间隔 (默认: 30000)
```

**使用示例**:
```bash
# 基础启动
codex-father mcp

# 高并发配置启动
codex-father mcp --max-concurrency 20 --timeout 300000

# 指定工作目录启动
codex-father mcp --working-directory ./my-project

# 调试模式启动
codex-father mcp --verbose --log-level debug
```

### 2. server - 启动 HTTP 服务器

**功能**: 启动 HTTP API 服务器和 WebSocket 服务

**语法**: `codex-father server [选项]`

**常用选项**:
```bash
--port <number>               # 服务器端口 (默认: 3000)
--host <hostname>             # 服务器主机 (默认: localhost)
--enable-websocket            # 启用 WebSocket 支持
--cors-origin <origin>        # CORS 源配置
--max-connections <number>    # 最大连接数
--rate-limit <requests>       # 速率限制
--ssl                         # 启用 HTTPS
--ssl-cert <path>             # SSL 证书路径
--ssl-key <path>              # SSL 私钥路径
```

**使用示例**:
```bash
# 基础 HTTP 服务器
codex-father server

# 指定端口启动
codex-father server --port 8080

# 启用 WebSocket 和 CORS
codex-father server --enable-websocket --cors-origin "*"

# HTTPS 服务器
codex-father server --ssl --ssl-cert ./cert.pem --ssl-key ./key.pem
```

### 3. run - 执行任务配置

**功能**: 执行配置文件中定义的任务

**语法**: `codex-father run <配置文件> [选项]`

**常用选项**:
```bash
--timeout <milliseconds>       # 任务超时时间
--max-concurrency <number>    # 最大并发数
--working-directory <path>    # 工作目录
--environment <env>           # 执行环境
--priority <priority>         # 任务优先级
--dry-run                     # 试运行，不实际执行
--continue-on-error           # 遇到错误继续执行
--parallel                    # 并行执行所有任务
--sequential                  # 顺序执行任务
```

**使用示例**:
```bash
# 执行基础任务
codex-father run tasks.json

# 试运行配置
codex-father run tasks.json --dry-run

# 高并发执行
codex-father run tasks.json --max-concurrency 20 --parallel

# 错误时继续执行
codex-father run tasks.json --continue-on-error
```

### 4. status - 查看系统状态

**功能**: 显示系统运行状态和统计信息

**语法**: `codex-father status [选项]`

**常用选项**:
```bash
--json                   # JSON 格式输出
--detailed               # 详细信息
--watch                  # 实时监控模式
--tasks                  # 只显示任务信息
--system                 # 只显示系统信息
--performance            # 显示性能指标
--export <format>        # 导出状态信息 (json|yaml|csv)
```

**使用示例**:
```bash
# 基础状态信息
codex-father status

# JSON 格式输出
codex-father status --json

# 实时监控
codex-father status --watch

# 详细性能信息
codex-father status --detailed --performance
```

### 5. logs - 查看任务日志

**功能**: 查看任务的执行日志和输出

**语法**: `codex-father logs [任务ID] [选项]`

**常用选项**:
```bash
--follow, -f               # 实时跟踪日志
--lines <number>           # 显示行数
--since <time>             # 显示指定时间后的日志
--level <level>            # 日志级别过滤
--format <format>          # 输出格式 (text|json)
--output <file>            # 输出到文件
--grep <pattern>           # 过滤日志内容
--recent                   # 显示最近的日志
--all                      # 显示所有日志
```

**使用示例**:
```bash
# 查看特定任务日志
codex-father logs task-123

# 实时跟踪日志
codex-father logs task-123 --follow

# 显示最近 50 行
codex-father logs task-123 --lines 50

# 过滤错误日志
codex-father logs task-123 --level error

# 搜索特定内容
codex-father logs task-123 --grep "error"
```

### 6. cancel - 取消任务

**功能**: 取消正在运行或排队中的任务

**语法**: `codex-father cancel <任务ID> [选项]`

**常用选项**:
```bash
--force                   # 强制取消
--all                     # 取消所有运行中的任务
--reason <reason>         # 取消原因
--timeout <seconds>       # 取消超时时间
--dry-run                 # 试运行，不实际取消
```

**使用示例**:
```bash
# 取消特定任务
codex-father cancel task-123

# 取消所有任务
codex-father cancel --all

# 强制取消并指定原因
codex-father cancel task-123 --force --reason "no longer needed"

# 试运行取消操作
codex-father cancel task-123 --dry-run
```

### 7. config - 配置管理

**功能**: 管理配置文件和设置

**语法**: `codex-father config <子命令> [选项]`

**子命令**:
```bash
show                      # 显示当前配置
set <key> <value>         # 设置配置项
get <key>                 # 获取配置项
reset                     # 重置配置为默认值
validate                  # 验证配置文件
init                      # 初始化配置文件
```

**使用示例**:
```bash
# 显示当前配置
codex-father config show

# 设置配置项
codex-father config set runner.maxConcurrency 15

# 获取配置项
codex-father config get runner.maxConcurrency

# 验证配置文件
codex-father config validate

# 初始化配置文件
codex-father config init
```

## 🔧 配置文件管理

### 配置文件位置

Codex Father 2.0 按优先级查找配置文件：

1. `./codex-father.json`（当前目录）
2. `./.codex-father.json`（当前目录隐藏文件）
3. `~/.codex-father/config.json`（用户配置目录）
4. `/etc/codex-father/config.json`（系统配置）

### 配置文件示例

```json
{
  "runner": {
    "maxConcurrency": 10,
    "defaultTimeout": 600000,
    "workingDirectory": "./workspace",
    "environment": "nodejs"
  },
  "server": {
    "port": 3000,
    "host": "localhost",
    "enableWebSocket": true,
    "cors": {
      "origin": "*",
      "credentials": true
    }
  },
  "mcp": {
    "heartbeatInterval": 30000,
    "maxConnections": 100
  },
  "logging": {
    "level": "info",
    "file": "./logs/codex-father.log",
    "maxSize": "10MB",
    "maxFiles": 5
  },
  "security": {
    "networkDisabled": true,
    "allowedPaths": ["./workspace", "/tmp"],
    "maxExecutionTime": 600000
  }
}
```

### 动态配置

```bash
# 临时覆盖配置
codex-father mcp --max-concurrency 20 --timeout 300000

# 使用环境变量
export CODEX_FATHER_MAX_CONCURRENCY=20
export CODEX_FATHER_LOG_LEVEL=debug
codex-father mcp

# 指定配置文件
codex-father --config ./custom-config.json mcp
```

## 📊 实用命令组合

### 开发工作流

```bash
# 1. 初始化项目配置
codex-father config init

# 2. 启动 MCP 服务器
codex-father mcp --max-concurrency 5

# 3. 在另一个终端监控状态
codex-father status --watch

# 4. 查看任务执行日志
codex-father logs --follow --level info
```

### 系统监控

```bash
# 实时状态监控
watch -n 2 'codex-father status --detailed'

# 日志监控
codex-father logs --follow --grep "error\|warning"

# 性能监控
codex-father status --performance --export json > metrics.json
```

### 批量操作

```bash
# 批量执行测试
codex-father run test-tasks.json --parallel --continue-on-error

# 批量取消任务
codex-father cancel --all --force

# 批量查看日志
for task in $(codex-father status --json | jq -r '.data.runningTasks[]'); do
  echo "=== $task ==="
  codex-father logs "$task" --lines 10
done
```

## 🎯 实际使用场景

### 场景 1: 项目初始化

```bash
# 1. 创建项目配置
cat > codex-father.json << 'EOF'
{
  "runner": {
    "maxConcurrency": 5,
    "workingDirectory": "./src"
  }
}
EOF

# 2. 创建初始化任务
cat > init-tasks.json << 'EOF'
{
  "tasks": [
    {
      "id": "setup-project",
      "command": "npm init -y",
      "environment": "shell"
    },
    {
      "id": "install-deps",
      "command": "npm install express lodash",
      "environment": "shell",
      "dependencies": ["setup-project"]
    },
    {
      "id": "create-structure",
      "command": "mkdir -p src/routes src/models src/utils",
      "environment": "shell",
      "dependencies": ["install-deps"]
    }
  ]
}
EOF

# 3. 执行初始化
codex-father run init-tasks.json
```

### 场景 2: CI/CD 集成

```bash
#!/bin/bash
# ci-build.sh - CI/CD 构建脚本

set -e

echo "🚀 开始 CI/CD 构建..."

# 1. 环境检查
codex-father status --detailed

# 2. 运行测试
codex-father run ci-tests.json --parallel

# 3. 代码质量检查
codex-father run quality-check.json

# 4. 构建项目
codex-father run build.json

# 5. 生成报告
codex-father status --export json > build-report.json

echo "✅ CI/CD 构建完成!"
```

### 场景 3: 开发服务器管理

```bash
#!/bin/bash
# dev-server.sh - 开发环境管理脚本

case "$1" in
  start)
    echo "🚀 启动开发服务器..."
    codex-father server --port 3000 --enable-websocket &
    codex-father mcp --max-concurrency 10 &
    echo "✅ 服务器已启动"
    ;;
  stop)
    echo "🛑 停止开发服务器..."
    pkill -f "codex-father server"
    pkill -f "codex-father mcp"
    echo "✅ 服务器已停止"
    ;;
  status)
    codex-father status --detailed
    ;;
  logs)
    codex-father logs --follow
    ;;
  *)
    echo "用法: $0 {start|stop|status|logs}"
    exit 1
    ;;
esac
```

## 🔧 高级用法

### 管道和重定向

```bash
# 将状态信息导出
codex-father status --json > status.json

# 过滤任务列表
codex-father status --json | jq '.data.runningTasks[]'

# 日志分析
codex-father logs --all | grep "ERROR" | wc -l

# 配置备份
codex-father config show > config-backup.json
```

### 条件执行

```bash
# 检查系统状态后再执行
if codex-father status --json | jq -e '.data.runningTasks | length == 0' > /dev/null; then
  echo "系统空闲，开始执行任务..."
  codex-father run batch-tasks.json
else
  echo "系统繁忙，稍后重试"
fi
```

### 并行启动

```bash
# 并行启动多个服务
codex-father server --port 3000 &
SERVER_PID=$!

codex-father mcp --max-concurrency 5 &
MCP_PID=$!

# 等待服务启动
sleep 2

# 检查服务状态
if kill -0 $SERVER_PID && kill -0 $MCP_PID; then
  echo "✅ 所有服务已启动"
else
  echo "❌ 服务启动失败"
  exit 1
fi
```

## 🛡️ 故障排除

### 常见问题

#### 命令找不到
```bash
# 检查安装
which codex-father

# 重新安装
npm install -g codex-father

# 检查 PATH
echo $PATH | grep -o '[^:]*npm[^:]*'
```

#### 配置文件错误
```bash
# 验证配置文件
codex-father config validate

# 查看配置
codex-father config show

# 重置配置
codex-father config reset
```

#### 权限问题
```bash
# 检查文件权限
ls -la codex-father.json

# 修复权限
chmod 644 codex-father.json

# 检查执行权限
ls -la $(which codex-father)
```

#### 端口占用
```bash
# 检查端口使用
lsof -i :3000

# 使用不同端口
codex-father server --port 3001

# 杀死占用进程
kill -9 $(lsof -t -i:3000)
```

## ✅ 最佳实践

### 1. 配置管理
- 使用版本控制管理配置文件
- 环境特定配置使用环境变量
- 定期备份重要配置

### 2. 日志管理
- 设置合适的日志级别
- 定期清理日志文件
- 使用日志轮转策略

### 3. 性能优化
- 根据系统资源调整并发数
- 设置合理的超时时间
- 监控系统资源使用

### 4. 安全考虑
- 限制文件访问权限
- 使用安全的配置选项
- 定期更新系统

## 🎉 下一步

现在你已经掌握了 CLI 的基本使用：

1. **深入学习** → [CLI 命令详解](./commands.md)
2. **配置管理** → [配置文件详解](./configuration.md)
3. **高级用法** → [CLI 高级技巧](./advanced.md)
4. **实际示例** → [CLI 使用示例](../examples/cli-workflows.md)

---

**💡 提示**: CLI 是 Codex Father 2.0 最灵活的接口方式，适合自动化脚本、CI/CD 集成和系统管理场景。善用命令行参数和配置文件，可以发挥出强大的功能！