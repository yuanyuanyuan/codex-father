# ⚙️ 配置指南

> **完整的 Codex Father 配置指南**，覆盖 Claude Desktop、Claude Code、Codex
> CLI 三种客户端的详细配置步骤。

## 📋 目录

- [配置 Claude Desktop](#配置-claude-desktop)
- [配置 Claude Code](#配置-claude-code)
- [配置 Codex CLI (rMCP)](#配置-codex-cli-rmcp)
- [高级配置](#高级配置)
- [配置文件示例](#配置文件示例)
- [常见配置错误](#常见配置错误)

---

## 🖥️ 配置 Claude Desktop

### 步骤 1：找到配置文件

配置文件位置：

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

**快速打开配置文件**：

```bash
# macOS
open ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Windows (PowerShell)
notepad $env:APPDATA\Claude\claude_desktop_config.json

# Linux
gedit ~/.config/Claude/claude_desktop_config.json
```

### 步骤 2：添加 Codex Father 配置

#### 方式 A：使用 npx（推荐）

```json
{
  "mcpServers": {
    "codex-father-prod": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**优点**：

- 无需安装，自动使用最新版本
- 配置简单

#### 方式 B：使用全局安装

**前提**：已运行 `npm install -g @starkdev020/codex-father-mcp-server`

```json
{
  "mcpServers": {
    "codex-father-prod": {
      "command": "codex-father-mcp-server",
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**优点**：

- 启动速度更快
- 可以锁定版本

#### 方式 C：使用源码路径

**前提**：已克隆仓库并构建

```json
{
  "mcpServers": {
    "codex-father-preview": {
      "command": "node",
      "args": ["/path/to/codex-father/dist/core/cli/start.js"]
    }
  }
}
```

**注意**：将 `/path/to/codex-father` 替换为实际路径。

### 步骤 3：重启 Claude Desktop

**重要**：必须完全退出 Claude Desktop（不是最小化）

1. 完全退出 Claude Desktop
2. 等待 5 秒
3. 重新打开 Claude Desktop

### 步骤 4：验证配置

1. 打开 Claude Desktop
2. 点击右下角的 **🔧 图标**
3. 查看 MCP 服务器列表
4. 确认 `codex-father-prod`（以及可选的 `codex-father-preview`）显示为
   **"已连接"** ✅

> 你可以在 Desktop 配置中同时保留 `codex-father-preview` 与
> `codex-father-prod`，与 Claude Code CLI 和 Codex CLI 的推荐配置保持一致。

---

## 💻 配置 Claude Code

### 步骤 1：找到配置文件

在项目根目录创建或编辑配置文件：

```bash
# 项目根目录
.claude/mcp_settings.json
```

### 步骤 2：添加配置

**推荐做法**：同时配置预览与生产两个 MCP 服务器，按需切换。

```json
{
  "mcpServers": {
    "codex-father-preview": {
      "command": "node",
      "args": ["./mcp/codex-mcp-server/dist/index.js"]
    },
    "codex-father-prod": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

- `codex-father-preview`：直接引用仓库内 `dist/index.js`，适合本地调试最新代码。
- `codex-father-prod`：通过 `npx` 拉取发布版本，并设置 `NODE_ENV=production`。

> 如果生产环境使用 npm 全局安装，将 `codex-father-prod` 的 `command` 改成
> `"codex-father-mcp-server"` 即可；若需要自定义 dist 路径，调整
> `codex-father-preview` 的 `args` 为你的构建产物路径。

### 步骤 3：重启 Claude Code CLI

```bash
# 退出当前会话
exit

# 重新启动 Claude Code
claude-code
```

### 步骤 4：验证配置

在 Claude Code 中运行：

```
请列出当前可用的 MCP 工具
```

应该看到可用工具（如未配置命名策略，可能同时出现 `codex.exec`/`codex_exec`
两组；在 Codex 0.44 responses 下建议只保留下划线或带前缀的 `cf_*`）。

> 使用 `claude-code status mcp`（或等效命令）时，应该能看到
> `codex-father-preview` 与 `codex-father-prod` 均为已连接状态。

---

## 🚀 配置 Codex CLI (rMCP)

> Codex CLI 从 0.44 版本开始支持 rMCP（反向 MCP），可以直接集成 Codex Father。

### 步骤 1：检查 Codex CLI 版本

```bash
codex --version
```

**要求**：>= 0.44.0

**如果版本过低**，升级 Codex CLI：

```bash
npm install -g @anthropic/codex-cli@latest
```

### 步骤 2：编辑配置文件

配置文件位置：`~/.codex/config.toml`

```bash
# 编辑配置文件
vim ~/.codex/config.toml
```

### 步骤 3：添加 MCP 服务器配置

#### 推荐：同时配置预览与生产服务器

```toml
[mcp_servers.codex-father-preview]
command = "node"
args = ["/abs/path/to/repo/mcp/codex-mcp-server/dist/index.js"]

[mcp_servers.codex-father-prod]
command = "npx"
args = ["-y", "@starkdev020/codex-father-mcp-server"]
env.NODE_ENV = "production"
```

> 如果生产环境使用全局安装，将 `codex-father-prod` 的 `command` 改成
> `"codex-father-mcp-server"`。

### 步骤 4：验证配置

```bash
# 启动 Codex 会话
codex

# 在会话中测试
请列出当前项目的文件
```

---

## 🔧 高级配置

### 审批策略配置

控制 Codex Father 何时需要审批：

```json
{
  "mcpServers": {
    "codex-father-prod": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server"],
      "env": {
        "APPROVAL_POLICY": "on-failure"
      }
    }
  }
}
```

**审批策略选项**：

| 策略         | 说明               | 使用场景           |
| ------------ | ------------------ | ------------------ |
| `untrusted`  | 每个命令都需要审批 | 首次使用、测试环境 |
| `on-request` | AI 请求时审批      | 平衡安全和效率     |
| `on-failure` | 仅失败时审批       | 生产环境（推荐）   |
| `never`      | 从不审批           | 完全信任的环境     |

### 环境变量配置

```json
{
  "mcpServers": {
    "codex-father-prod": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server"],
      "env": {
        "APPROVAL_POLICY": "on-failure",
        "LOG_LEVEL": "info",
        "CODEX_CONFIG_PATH": "~/.codex/config.toml",
        "MAX_CONCURRENT_JOBS": "10"
      }
    }
  }
}
```

**可用环境变量**：

- `APPROVAL_POLICY` - 审批策略（默认：`on-failure`）
- `LOG_LEVEL` - 日志级别（`debug`, `info`, `warn`, `error`）
- `CODEX_CONFIG_PATH` - Codex 配置文件路径
- `MAX_CONCURRENT_JOBS` - 最大并发任务数（默认：10）
- `TIMEOUT_MS` - 任务超时时间（毫秒，默认：300000）
- `CODEX_MCP_NAME_STYLE` - 工具命名风格：`underscore-only`（推荐，0.44 兼容）/
  `dot-only` / 省略（两者都导出）
- `CODEX_MCP_TOOL_PREFIX` - 自定义前缀：例如 `cf` → 导出 `cf_exec/cf_start/...`
- `CODEX_MCP_HIDE_ORIGINAL` - 隐藏默认名，仅保留前缀别名（`1`/`true` 生效）

### 日志配置

指定日志输出路径：

```json
{
  "mcpServers": {
    "codex-father-prod": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server"],
      "env": {
        "LOG_FILE": "/path/to/codex-father.log",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

### 白名单配置

配置自动批准的命令白名单：

```json
{
  "mcpServers": {
    "codex-father-prod": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server"],
      "env": {
        "WHITELIST_COMMANDS": "ls,pwd,git status,npm test"
      }
    }
  }
}
```

---

## 📄 配置文件示例

### 完整的 Claude Desktop 配置

```json
{
  "mcpServers": {
    "codex-father-preview": {
      "command": "node",
      "args": ["/path/to/codex-father/dist/core/cli/start.js"],
      "env": {
        "LOG_LEVEL": "debug"
      }
    },
    "codex-father-prod": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server"],
      "env": {
        "APPROVAL_POLICY": "on-failure",
        "LOG_LEVEL": "info",
        "MAX_CONCURRENT_JOBS": "5",
        "TIMEOUT_MS": "300000",
        "WHITELIST_COMMANDS": "ls,pwd,git status"
      }
    },
    "other-mcp-server": {
      "command": "npx",
      "args": ["-y", "other-mcp-server"]
    }
  }
}
```

> 如需在 Desktop 端使用仓库内构建产物，记得将
> `/path/to/codex-father/dist/core/cli/start.js` 替换为本地绝对路径。

### 完整的 Codex CLI 配置

```toml
# ~/.codex/config.toml

[mcp_servers.codex-father-preview]
command = "node"
args = ["/abs/path/to/repo/mcp/codex-mcp-server/dist/index.js"]

[mcp_servers.codex-father-prod]
command = "npx"
args = ["-y", "@starkdev020/codex-father-mcp-server"]

[mcp_servers.codex-father-prod.env]
APPROVAL_POLICY = "on-failure"
LOG_LEVEL = "info"
MAX_CONCURRENT_JOBS = "5"
NODE_ENV = "production"
CODEX_MCP_NAME_STYLE = "underscore-only"
CODEX_MCP_TOOL_PREFIX = "cf"
CODEX_MCP_HIDE_ORIGINAL = "1"
```

> 如果已全局安装 codex-father MCP，可将 `codex-father-prod` 的 `command` 改成
> `"codex-father-mcp-server"`。

---

## ❌ 常见配置错误

### 错误 1：JSON 格式错误

**症状**：Claude Desktop 无法启动

**原因**：JSON 格式不正确（缺少逗号、引号不匹配等）

**解决**：使用 JSON 验证工具检查格式

```bash
# 验证 JSON 格式
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq .
```

### 错误 2：路径包含空格未转义

**症状**：服务器无法启动

**原因**：路径中的空格未正确处理

**解决**：使用完整路径或转义空格

```json
{
  "command": "/Users/username/My Documents/codex-father/start.js" // ❌ 错误
}
```

```json
{
  "command": "/Users/username/My\\ Documents/codex-father/start.js" // ✅ 正确
}
```

### 错误 3：Node.js 版本过低

**症状**：服务器启动失败，提示语法错误

**原因**：Node.js < 18.0.0

**解决**：升级 Node.js

```bash
nvm install 18
nvm use 18
```

### 错误 4：权限不足

**症状**：提示"Permission denied"

**原因**：配置文件或命令没有执行权限

**解决**：

```bash
# 给予配置文件正确权限
chmod 644 ~/.codex/config.toml

# 或使用 sudo 安装（不推荐）
sudo npm install -g @starkdev020/codex-father-mcp-server
```

---

## 🔗 下一步

配置完成后，您可以：

1. **运行测试**：查看 [首次运行测试](first-run.md) 验证配置
2. **场景化使用**：查看 [使用场景](use-cases/README.md) 了解实际应用
3. **故障排除**：如有问题，查看 [故障排除指南](troubleshooting.md)

---

## 📞 获取帮助

- **快速开始**：[5分钟快速开始](quick-start.md)
- **安装指南**：[安装指南](installation.md)
- **故障排除**：[故障排除指南](troubleshooting.md)
- **Issues**：[GitHub Issues](https://github.com/yuanyuanyuan/codex-father/issues)

---

**🎉 配置完成！开始使用 Codex Father 吧！**
