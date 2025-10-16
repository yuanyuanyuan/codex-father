# 🚀 MCP 连接快速开始指南

## 📋 概述

本指南帮助您快速设置和使用 Codex Father 2.0 的 MCP (Model Context Protocol) 功能，让 Claude Code 能够直接执行开发任务。

## 🎯 您将获得

修复后，您将拥有：
- ✅ **参数预检查机制** - 自动修复常见参数问题
- ✅ **MCP连接助手** - 一键配置MCP集成
- ✅ **智能参数生成** - 自动添加缺失的--tag等参数
- ✅ **环境检查工具** - 验证系统兼容性
- ✅ **详细指引文档** - 完整的配置说明

## 🛠️ 快速开始 (5分钟)

### 步骤 1: 环境检查

**方法 1: 使用 npx（推荐）**
```bash
# 使用 npx 检查环境（无需安装）
npx codex-father status

# 或者使用完整功能脚本
npx codex-father-start --help
```

**方法 2: 本地安装**
```bash
# 如果已全局安装
codex-father status

# 使用内置的环境检查工具
./mcp_init_helper.sh --check
```

**预期输出:**
```
🔍 检查系统环境...
🖥️  操作系统: Linux/Darwin/Windows
📦 Node.js: v18.0.0+ ✅
📦 npm: 9.0.0+ ✅
🚀 codex-father: 5.0.0+ ✅
📁 Claude配置目录: ~/.config/claude ✅
```

### 步骤 2: 生成MCP配置

**方法 1: 使用 npx 自动配置（推荐）**
```bash
# 使用 npx 生成配置（自动使用 npx 命令）
npx codex-father mcp --init

# 或者使用内置助手
./mcp_init_helper.sh --generate
```

**生成的配置文件位置:**
- Linux: `~/.config/claude/claude_desktop_config.json`
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

**配置内容示例:**
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

> **💡 使用 npx 的优势**: 无需全局安装 codex-father，自动使用最新版本

### 步骤 3: 重启Claude Code

1. 完全退出 Claude Code 应用
2. 重新启动 Claude Code

### 步骤 4: 验证MCP连接

在 Claude Code 中输入：
```
用户: 检查MCP工具是否可用
```

**预期响应:**
```
Claude: ✅ MCP 工具已加载:
- codex_exec (执行开发任务)
- codex_status (查询任务状态)
- codex_logs (获取执行日志)
- codex_reply (继续任务对话)
- codex_list (列出所有任务)
- codex_cancel (取消运行任务)
```

## 🔧 新功能说明

### 1. 参数预检查机制

**问题修复:**
- ❌ Exit Code 2 (参数错误)
- ❌ Exit Code 141 (SIGPIPE中断)
- ❌ Git仓库检查失败
- ❌ 缺少--tag参数

**自动修复:**
- ✅ 自动添加缺失的 `--tag` 参数
- ✅ 自动添加 `--skip-git-repo-check` (如需要)
- ✅ 智能参数验证和建议

**使用示例:**
```bash
# 方法 1: 使用 npx（推荐）
npx codex-father-start --task "创建用户登录功能" --tag feature

# 方法 2: 本地脚本
./start.sh --task "创建用户登录功能"  # 自动添加 --tag
./start.sh --task "测试任务" --skip-git-repo-check  # 自动验证
```

### 2. 参数验证器工具

```bash
# 检查参数有效性
./lib/param_validator.sh validate --tag test --task "hello world"

# 自动修复参数
./lib/param_validator.sh auto-fix --task "修复bug"

# 检查环境
./lib/param_validator.sh check-env
```

**输出示例:**
```
[INFO] 验证codex-father启动参数...
[SUCCESS] 参数验证通过
```

### 3. 智能日志记录

修复后的启动脚本会自动记录参数检查过程：

```
[param-check] 执行参数预检查...
[param-check] 参数验证通过
```

## 🎯 基础使用示例

### 示例 1: 创建项目

```
用户: 帮我创建一个React TypeScript项目

Claude: [调用 codex_exec]
✅ 任务已提交: task-1704067200000-react-ts
🎯 创建React TypeScript项目
📋 包含: 项目初始化、TypeScript配置、基础组件

# 也可以直接使用 npx
npx codex-father-start --task "创建一个React TypeScript项目，包含Tailwind CSS" --tag react-init
```

### 示例 2: 查看进度

```
用户: 项目创建得怎么样了？

Claude: [调用 codex_status]
📊 React TypeScript项目进度 (80%)
✅ 项目初始化 (100%)
✅ TypeScript配置 (100%)
✅ 基础组件 (70%)
🔄 样式设置 (正在进行)
```

### 示例 3: 继续开发

```
用户: 现在添加用户登录功能

Claude: [调用 codex_reply]
💬 继续任务: task-1704067200000-react-ts
📝 附加需求: 添加用户登录功能
✅ 登录组件已创建
✅ 表单验证已添加
✅ 状态管理已集成
```

## 🔍 故障排除

### 问题 1: MCP工具未显示

**解决方案:**
```bash
# 检查配置文件
./mcp_init_helper.sh --verbose

# 重新生成配置
./mcp_init_helper.sh --generate

# 测试连接
./mcp_init_helper.sh --test
```

### 问题 2: 参数验证失败

**解决方案:**
```bash
# 使用参数验证器检查
./lib/param_validator.sh validate --your-params

# 自动修复参数
./lib/param_validator.sh auto-fix --your-params
```

### 问题 3: 任务执行失败

**解决方案:**
```
用户: 任务失败了，查看详细日志

Claude: [调用 codex_logs]
📝 错误日志分析:
[timestamp] ❌ 错误类型: 参数验证失败
[timestamp] 🔍 原因: 缺少必要参数
[timestamp] 💡 建议: 添加 --tag 和 --task 参数
```

## 📚 高级配置

### 自定义并发数

```json
{
  "mcpServers": {
    "codex-father": {
      "args": ["mcp", "--max-concurrency", "20"]
    }
  }
}
```

### 设置工作目录

```json
{
  "mcpServers": {
    "codex-father": {
      "args": ["mcp", "--working-directory", "/path/to/project"]
    }
  }
}
```

### 调试模式

```json
{
  "mcpServers": {
    "codex-father": {
      "args": ["mcp", "--log-level", "debug"],
      "env": {
        "DEBUG": "codex-father:*"
      }
    }
  }
}
```

## 🎉 成功验证

完成配置后，您应该能够：

1. ✅ 在Claude Code中看到6个codex_*工具
2. ✅ 成功提交开发任务并获得task ID
3. ✅ 查看任务执行状态和进度
4. ✅ 获取详细的执行日志
5. ✅ 基于结果继续对话和开发
6. ✅ 管理多个并发任务

## 📞 获取帮助

**命令行帮助:**
```bash
# 使用 npx（推荐）
npx codex-father --help
npx codex-father mcp --help
npx codex-father-start --help

# 本地命令
./mcp_init_helper.sh --help

# 参数验证器
./lib/param_validator.sh --help

# 启动脚本帮助
./start.sh --help
```

**文档资源:**
- 📖 MCP配置指南: `docs/user/mcp/claude-code-setup.md`
- 📖 MCP工具介绍: `docs/user/mcp/overview.md`
- 📖 故障排除: `docs/user/troubleshooting/common-issues.md`

---

**🎊 恭喜！** 您现在已经成功配置了修复后的 Codex Father 2.0 MCP 功能。享受对话式开发的全新体验吧！🚀