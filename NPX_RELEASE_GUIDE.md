# 📦 npx 发布使用指南

## 🎯 概述

Codex Father 现已支持通过 `npx` 直接使用，无需本地安装！本指南详细说明了各种使用方式和配置。

## 🚀 快速开始

### 基本使用

```bash
# 1. 使用主 CLI（推荐）
npx codex-father --help

# 2. 使用启动脚本（完整功能）
npx codex-father-start --task "创建一个新功能"

# 3. 使用任务脚本
npx codex-father-job --help
```

### MCP 服务器启动

```bash
# 启动 MCP 服务器（用于 Claude Code 集成）
npx codex-father mcp

# 带参数启动
npx codex-father mcp --max-concurrency 10 --timeout 600000
```

## 📋 可用命令

### 主命令 (codex-father)

```bash
# 显示版本信息
npx codex-father version
npx codex-father version --json

# 检查系统状态
npx codex-father status
npx codex-father status --detailed

# 配置管理
npx codex-father config show
npx codex-father config set key=value

# 队列管理
npx codex-father queue list
npx codex-father queue clear

# 日志管理
npx codex-father logs list
npx codex-father logs follow <session-id>

# 任务管理
npx codex-father task list
npx codex-father task create --task "任务描述"

# 编排命令
npx codex-father orchestrate --help
npx codex-father orchestrate report

# HTTP 服务
npx codex-father http --port 3000

# 批量操作
npx codex-father bulk --help
```

### 启动脚本 (codex-father-start)

```bash
# 基本使用
npx codex-father-start --task "创建用户登录功能"

# 指定文件
npx codex-father-start -f README.md -c "请解释这个项目"

# 使用标签
npx codex-father-start --task "修复 Bug" --tag bugfix

# 干运行模式
npx codex-father-start --task "测试" --dry-run

# 完整帮助
npx codex-father-start --help
```

### 任务脚本 (codex-father-job)

```bash
# 基本使用
npx codex-father-job --help

# 具体任务执行
npx codex-father-job [参数...]
```

## 🔧 配置说明

### 1. Claude Code MCP 集成

在 `~/.config/claude/claude_desktop_config.json` 中添加：

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "npx",
      "args": [
        "codex-father",
        "mcp",
        "--max-concurrency", "10",
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
```

### 2. 环境变量配置

```bash
# 临时设置
export CODEX_LOG_LEVEL=debug
npx codex-father-start --task "测试"

# 永久设置（添加到 ~/.bashrc 或 ~/.zshrc）
export CODEX_FATHER_CONFIG_DIR="$HOME/.codex-father"
export CODEX_LOG_DIR="$HOME/.codex-father/logs"
```

### 3. 项目级配置

在项目根目录创建 `codex-father.config.json`：

```json
{
  "logging": {
    "level": "info",
    "dir": "./logs",
    "retention": "7d"
  },
  "mcp": {
    "maxConcurrency": 5,
    "timeout": 300000
  },
  "tasks": {
    "defaultTimeout": 600000,
    "maxRetries": 3
  }
}
```

## 🎯 使用场景示例

### 场景 1：快速创建项目

```bash
# 在任何目录快速创建项目
npx codex-father-start --task "创建一个 React TypeScript 项目，包含 Tailwind CSS 和测试配置" --tag react-init
```

### 场景 2：代码审查

```bash
# 审查当前目录代码
npx codex-father-start -f . --task "请审查这个项目的代码质量，并提出改进建议" --tag code-review
```

### 场景 3：生成文档

```bash
# 自动生成项目文档
npx codex-father-start --docs src/ --task "基于代码生成 API 文档" --tag docs
```

### 场景 4：调试问题

```bash
# 快速调试
npx codex-father status --detailed
npx codex-father logs list
```

### 场景 5：批量处理

```bash
# 批量修改文件
npx codex-father bulk rename --pattern "*.js" --to "*.ts"
```

## 🔍 故障排除

### 问题 1：命令不存在

```bash
# 检查 npx 是否可用
which npx

# 清除 npx 缓存
npx clear-cache

# 尝试完整命令
npx --yes codex-father --version
```

### 问题 2：脚本执行失败

```bash
# 检查脚本权限
npx codex-father-start --help 2>&1 | head -20

# 使用调试模式
DEBUG=codex-father:* npx codex-father-start --task "测试"
```

### 问题 3：模块找不到

```bash
# 检查文件结构
npx codex-father status | grep -E "(valid|missing|issues)"

# 重新安装最新版本
npx codex-father@latest --version
```

### 问题 4：权限问题

```bash
# Linux/macOS - 确保脚本可执行
npx --yes sh -c "ls -la \$(npx which codex-father-start)"

# Windows - 使用 Git Bash 或 WSL
npx codex-father --help
```

## 📚 最佳实践

### 1. 项目初始化

```bash
# 创建新项目时使用特定标签
npx codex-father-start --task "初始化项目" --tag project-init

# 保存配置到项目
npx codex-father config set default.profile=development
```

### 2. 团队协作

```bash
# 使用统一的配置文件
echo '{"tasks": {"defaultTimeout": 300000}}' > codex-father.config.json

# 确保所有成员使用相同版本
npx codex-father@5.0.0 --task "团队任务"
```

### 3. CI/CD 集成

```yaml
# .github/workflows/codex-father.yml
- name: Run Codex Father
  run: |
    npx codex-father mcp --max-concurrency 5
```

### 4. 性能优化

```bash
# 使用本地缓存
export CODEX_FATHER_CACHE_DIR="$HOME/.codex-father/cache"

# 并发控制
npx codex-father mcp --max-concurrency 20
```

## 🎉 高级功能

### 1. 自定义脚本集成

```bash
# 结合其他 npx 工具
npx create-react-app my-app && cd my-app
npx codex-father-start --task "配置开发环境" --tag setup
```

### 2. 多项目协调

```bash
# 使用工作目录参数
npx codex-father --working-dir /path/to/project status

# 批量处理多个项目
for dir in projects/*; do
    npx codex-father --working-dir "$dir" status
done
```

### 3. 扩展开发

```bash
# 开发自定义插件
npx codex-father orchestrate --template plugin
```

## 📞 获取帮助

```bash
# 获取详细帮助
npx codex-father --help
npx codex-father-start --help
npx codex-father-job --help

# 查看版本
npx codex-father version --json

# 检查系统状态
npx codex-father status --detailed

# 查看日志
npx codex-father logs --help
```

## 🔗 相关链接

- 📖 [完整文档](./docs/README.md)
- 🚀 [MCP 配置指南](./MCP_QUICKSTART.md)
- 🐛 [故障排除](./docs/user/troubleshooting/)
- 💬 [反馈问题](https://github.com/codex-father/codex-father/issues)

---

**🎊 享受无需安装的便捷体验吧！** 使用 `npx codex-father` 开始您的开发之旅。