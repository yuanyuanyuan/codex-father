# Claude Code 配置指南

本指南将详细说明如何配置 Claude Code 与 Codex Father 2.0 的 MCP 集成，让你在对话环境中无缝使用任务管理功能。

## 🎯 配置目标

完成配置后，你将能够：
- ✅ 在 Claude Code 中直接执行开发任务
- ✅ 实时监控任务状态和进度
- ✅ 基于执行结果继续对话
- ✅ 管理多个并发任务
- ✅ 享受流畅的开发体验

## 📋 系统要求

### 必需条件
- **Claude Code**: 已安装并配置
- **Codex Father 2.0**: 已完成 [安装](../installation.md)
- **Node.js**: 18.0.0 或更高版本
- **操作系统**: Linux, macOS, Windows

### 验证环境

```bash
# 1. 验证 Claude Code 安装
claude-code --version

# 2. 验证 Codex Father 安装
codex-father --version

# 3. 检查 Node.js 版本
node --version
```

## 🚀 快速配置（5分钟完成）

### 步骤 1: 检查 Claude Code MCP 配置

首先找到 Claude Code 的配置文件位置：

```bash
# macOS
~/Library/Application Support/Claude/claude_desktop_config.json

# Linux
~/.config/claude/claude_desktop_config.json

# Windows
%APPDATA%\Claude\claude_desktop_config.json
```

### 步骤 2: 添加 Codex Father MCP 服务器

在配置文件中添加以下内容：

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": ["mcp", "--max-concurrency", "10"],
      "env": {
        "CODEX_FATHER_LOG_LEVEL": "info"
      }
    }
  }
}
```

### 步骤 3: 重启 Claude Code

```bash
# 完全退出 Claude Code
# 然后重新启动应用
```

### 步骤 4: 验证配置

在 Claude Code 中输入：

```
用户: 检查 MCP 工具是否可用

Claude: [应显示可用的 codex_* 工具]
✅ MCP 工具已加载:
- codex_exec
- codex_status  
- codex_logs
- codex_reply
- codex_list
- codex_cancel
```

## ⚙️ 详细配置选项

### 基础配置

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": ["mcp"],
      "description": "Codex Father 2.0 - 多任务并发管理工具"
    }
  }
}
```

### 性能优化配置

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": [
        "mcp",
        "--max-concurrency", "20",
        "--timeout", "600000",
        "--working-directory", "/Users/username/projects",
        "--log-level", "info"
      ],
      "env": {
        "CODEX_FATHER_MAX_MEMORY": "1GB",
        "CODEX_FATHER_CACHE_SIZE": "100MB"
      }
    }
  }
}
```

### 开发环境配置

```json
{
  "mcpServers": {
    "codex-father-dev": {
      "command": "node",
      "args": ["/path/to/codex-father/dist/index.js", "mcp", "--verbose"],
      "cwd": "/path/to/codex-father",
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "codex-father:*"
      }
    }
  }
}
```

### 多实例配置

```json
{
  "mcpServers": {
    "codex-father-main": {
      "command": "codex-father",
      "args": ["mcp", "--max-concurrency", "10"],
      "description": "主项目任务管理"
    },
    "codex-father-experimental": {
      "command": "codex-father", 
      "args": ["mcp", "--max-concurrency", "5", "--working-directory", "./experimental"],
      "description": "实验性项目任务管理"
    }
  }
}
```

## 🔧 高级配置

### 1. 自定义工作目录

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": [
        "mcp",
        "--working-directory", "/Users/username/workspace"
      ],
      "env": {
        "CODEX_FATHER_WORKSPACE": "/Users/username/workspace"
      }
    }
  }
}
```

### 2. 安全策略配置

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": [
        "mcp",
        "--security-policy", "strict"
      ],
      "env": {
        "CODEX_FATHER_ALLOWED_PATHS": "/Users/username/projects,/tmp",
        "CODEX_FATHER_NETWORK_DISABLED": "true",
        "CODEX_FATHER_MAX_EXECUTION_TIME": "300000"
      }
    }
  }
}
```

### 3. 日志和调试配置

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": [
        "mcp",
        "--log-level", "debug",
        "--log-file", "/tmp/codex-father-mcp.log"
      ],
      "env": {
        "DEBUG": "codex-father:*",
        "CODEX_FATHER_VERBOSE": "true"
      }
    }
  }
}
```

## 🛠️ 配置文件管理

### 配置文件模板

创建一个可复用的配置模板：

```bash
# 创建配置目录
mkdir -p ~/.claude-configs

# 创建 Codex Father 配置模板
cat > ~/.claude-configs/codex-father.json << 'EOF'
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": [
        "mcp",
        "--max-concurrency", "15",
        "--timeout", "600000",
        "--log-level", "info"
      ],
      "env": {
        "CODEX_FATHER_LOG_LEVEL": "info",
        "CODEX_FATHER_MAX_MEMORY": "1GB"
      }
    }
  }
}
EOF
```

### 环境特定配置

#### 开发环境
```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": ["mcp", "--dev-mode", "--hot-reload"],
      "env": {
        "NODE_ENV": "development",
        "DEBUG": "codex-father:*"
      }
    }
  }
}
```

#### 生产环境
```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": ["mcp", "--production-mode"],
      "env": {
        "NODE_ENV": "production",
        "CODEX_FATHER_LOG_LEVEL": "warn"
      }
    }
  }
}
```

## ✅ 配置验证

### 1. 基础连接测试

在 Claude Code 中测试：

```
用户: 测试 MCP 连接

Claude: [调用 codex_status 无参数]
✅ MCP 连接正常
🔧 服务器版本: 2.0.0
📊 系统状态: 健康
⚡ 就绪任务数: 0
```

### 2. 功能测试

```
用户: 创建一个测试任务

Claude: [调用 codex_exec]
{
  "prompt": "创建一个 Hello World 程序",
  "environment": "nodejs"
}

✅ 测试任务已提交: task-1704067200000-test123

用户: 查看测试任务状态

Claude: [调用 codex_status]
📊 任务状态: 已完成
🎯 结果: Hello World 程序已创建
📁 文件位置: ./hello-world.js
```

### 3. 完整工作流测试

```
用户: 我想开发一个简单的 To-Do 应用

Claude: [调用 codex_exec]
✅ 任务已提交: task-todo-app
🎯 创建 To-Do 应用
📋 技术栈: React + TypeScript + LocalStorage

用户: 查看开发进度

Claude: [调用 codex_status]  
📊 To-Do 应用开发进度 (80%)
✅ 项目初始化 (100%)
✅ 组件结构 (100%)
✅ 状态管理 (100%)
🔄 样式优化 (80%)
⏳ 测试编写 (0%)

用户: 添加任务删除功能

Claude: [调用 codex_reply]
💬 继续开发: 添加删除功能
🔧 实现删除按钮和确认对话框
✅ 功能已完成
```

## 🔧 故障排除

### 常见配置问题

#### 问题 1: MCP 工具未显示

**症状**: Claude Code 中看不到 codex_* 工具

**解决方案**:
```bash
# 1. 检查配置文件语法
cat ~/.config/claude/claude_desktop_config.json | jq .

# 2. 验证 Codex Father 安装
which codex-father
codex-father --version

# 3. 手动测试 MCP 服务器
codex-father mcp --test-mode

# 4. 检查权限
ls -la $(which codex-father)
```

#### 问题 2: 连接超时

**症状**: MCP 工具调用超时或无响应

**解决方案**:
```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": [
        "mcp",
        "--timeout", "30000",
        "--heartbeat-interval", "5000"
      ],
      "env": {
        "CODEX_FATHER_RESPONSE_TIMEOUT": "25000"
      }
    }
  }
}
```

#### 问题 3: 权限错误

**症状**: 任务执行时出现权限被拒绝

**解决方案**:
```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": [
        "mcp",
        "--working-directory", "/Users/username/safe-workspace"
      ],
      "env": {
        "CODEX_FATHER_ALLOWED_PATHS": "/Users/username/safe-workspace,/tmp"
      }
    }
  }
}
```

### 调试技巧

#### 启用详细日志

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": ["mcp", "--verbose", "--log-level", "debug"],
      "env": {
        "DEBUG": "codex-father:*",
        "CODEX_FATHER_LOG_TO_FILE": "/tmp/codex-debug.log"
      }
    }
  }
}
```

#### 手动测试 MCP 服务器

```bash
# 启动独立的 MCP 服务器进行测试
codex-father mcp --standalone --port 3010

# 在另一个终端测试
curl http://localhost:3010/healthz
```

#### 检查进程状态

```bash
# 查看 Codex Father 进程
ps aux | grep codex-father

# 查看网络连接
netstat -an | grep 3010

# 查看系统资源
top | grep codex-father
```

## 🎯 最佳实践

### 1. 合理设置并发数

```json
{
  "args": ["mcp", "--max-concurrency", "10"]
}
```

**建议**:
- 开发环境: 5-10 个并发
- 生产环境: 10-20 个并发
- 根据 CPU 核心数调整

### 2. 配置工作目录

```json
{
  "args": ["mcp", "--working-directory", "/Users/username/active-project"]
}
```

**好处**:
- 任务执行路径统一
- 文件访问权限明确
- 便于项目管理

### 3. 设置合理的超时

```json
{
  "args": ["mcp", "--timeout", "600000"]
}
```

**建议**:
- 简单任务: 30-60 秒
- 复杂开发: 5-10 分钟
- 大型重构: 15-30 分钟

### 4. 环境变量管理

```bash
# 创建环境配置文件
cat > ~/.codex-father-env << 'EOF'
export CODEX_FATHER_LOG_LEVEL=info
export CODEX_FATHER_MAX_MEMORY=1GB
export CODEX_FATHER_WORKSPACE=$HOME/projects
EOF

# 在 shell 配置中加载
echo 'source ~/.codex-father-env' >> ~/.zshrc
```

## 🔄 配置更新和维护

### 定期更新

```bash
# 更新 Codex Father
npm update -g codex-father

# 检查配置兼容性
codex-father mcp --check-config

# 备份配置
cp ~/.config/claude/claude_desktop_config.json ~/.config/claude/claude_desktop_config.json.backup
```

### 配置版本管理

```bash
# 创建配置版本目录
mkdir -p ~/.claude-configs/versions

# 保存当前配置
cp ~/.config/claude/claude_desktop_config.json ~/.claude-configs/versions/v2.0.0.json

# 创建配置切换脚本
cat > ~/.claude-configs/switch-config.sh << 'EOF'
#!/bin/bash
VERSION=$1
cp ~/.claude-configs/versions/$VERSION.json ~/.config/claude/claude_desktop_config.json
echo "配置已切换到版本: $VERSION"
EOF
```

## ✅ 配置检查清单

完成配置后，确认以下项目：

- [ ] ✅ Claude Code 能正常启动
- [ ] ✅ MCP 服务器连接正常
- [ ] ✅ 六件套工具全部可用
- [ ] ✅ 测试任务能正常执行
- [ ] ✅ 日志输出正常
- [ ] ✅ 工作目录权限正确
- [ ] ✅ 网络策略配置生效
- [ ] ✅ 性能参数合理

## 🎉 下一步

配置完成后，你可以：

1. **学习工具使用** → [MCP 工具详解](./tools.md)
2. **探索实际示例** → [MCP 使用示例](../examples/mcp-workflows.md)
3. **了解会话管理** → [会话上下文](./sessions.md)
4. **查看高级用法** → [高级 MCP 技巧](./advanced.md)

---

**💡 恭喜！** 你已经成功配置了 Claude Code 与 Codex Father 2.0 的集成。现在可以享受前所未有的对话式开发体验了！🚀