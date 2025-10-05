# 📦 安装指南

> **完整的 Codex Father 安装指南**，包括系统要求、多种安装方式和验证步骤。

## 📋 目录

- [系统要求](#系统要求)
- [安装方式](#安装方式)
  - [方式 1：npx（推荐）](#方式-1npx推荐)
  - [方式 2：npm 全局安装](#方式-2npm-全局安装)
  - [方式 3：从源码安装](#方式-3从源码安装)
- [验证安装](#验证安装)
- [卸载](#卸载)
- [常见问题](#常见问题)

---

## 📦 系统要求

### 必需条件

| 项目          | 要求                    | 验证命令          |
| ------------- | ----------------------- | ----------------- |
| **Node.js**   | >= 18.0.0               | `node --version`  |
| **npm**       | >= 9.0.0                | `npm --version`   |
| **Codex CLI** | 最新版本                | `codex --version` |
| **操作系统**  | macOS / Windows / Linux | -                 |

### 推荐配置

- **内存**：至少 2GB 可用内存
- **磁盘空间**：至少 500MB 可用空间
- **网络**：稳定的互联网连接（用于 npm 包下载）

### 检查系统要求

运行以下命令验证系统要求：

```bash
# 检查 Node.js 版本
node --version  # 应该 >= v18.0.0

# 检查 npm 版本
npm --version   # 应该 >= 9.0.0

# 检查 Codex CLI 是否安装
codex --version # 应该显示版本号
```

**如果 Codex CLI 未安装**：

访问 [Codex CLI 官网](https://docs.codex.dev) 按照说明安装。

---

## 🚀 安装方式

### 方式 1：npx（推荐）

**优点**：

- ✅ 无需安装，直接使用
- ✅ 自动使用最新版本
- ✅ 最简单快捷

**命令**：

```bash
npx -y @starkdev020/codex-father-mcp-server
```

**使用场景**：

- 适合快速体验
- 适合临时使用
- 适合自动化脚本

**配置示例**（在 MCP 客户端配置文件中）：

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server"]
    }
  }
}
```

---

### 方式 2：npm 全局安装

**优点**：

- ✅ 安装一次，随处使用
- ✅ 启动速度更快
- ✅ 可以指定版本

**命令**：

```bash
# 安装最新版本
npm install -g @starkdev020/codex-father-mcp-server

# 或安装指定版本
npm install -g @starkdev020/codex-father-mcp-server@1.4.0
```

**验证安装**：

```bash
# 应该显示版本号
codex-mcp-server --version
```

**配置示例**：

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father-mcp-server"
    }
  }
}
```

---

### 方式 3：从源码安装

**优点**：

- ✅ 可以修改源码
- ✅ 可以调试问题
- ✅ 最新的开发版本

**步骤**：

#### 1. 克隆仓库

```bash
git clone https://github.com/yuanyuanyuan/codex-father.git
cd codex-father
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 构建项目

```bash
npm run build
```

#### 4. 验证构建

```bash
# 应该显示构建后的文件
ls -la dist/
```

#### 5. 启动服务器

```bash
npm start
```

**配置示例**：

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "node",
      "args": ["/path/to/codex-father/dist/core/cli/start.js"]
    }
  }
}
```

**注意**：将 `/path/to/codex-father` 替换为实际的项目路径。

---

## ✅ 验证安装

### 1. 验证 MCP 服务器启动

**方式 A：直接运行**（源码安装）

```bash
cd codex-father
npm start
```

**预期输出**：

```
MCP Server started
Listening on stdin/stdout
Server capabilities: tools
Tools registered: codex.exec, codex.start, codex.status, codex.logs, codex.stop, codex.list
```

**方式 B：使用 MCP Inspector**

```bash
npx @modelcontextprotocol/inspector npx -y @starkdev020/codex-father-mcp-server
```

浏览器会自动打开，显示 MCP Inspector 界面。

### 2. 验证工具列表

在 MCP Inspector 或 Claude Desktop 中，应该能看到以下工具：

- `codex.exec` - 同步执行 Codex 任务
- `codex.start` - 异步启动任务
- `codex.status` - 查询任务状态
- `codex.logs` - 读取任务日志
- `codex.stop` - 停止运行中的任务
- `codex.list` - 列出所有任务

### 3. 验证版本信息

**检查包版本**：

```bash
npm list -g @starkdev020/codex-father-mcp-server  # 全局安装
npm list @starkdev020/codex-father-mcp-server     # 本地安装
```

**检查 Codex CLI 版本**：

```bash
codex --version
```

---

## 🗑️ 卸载

### 卸载 npm 全局安装

```bash
npm uninstall -g @starkdev020/codex-father-mcp-server
```

### 删除源码安装

```bash
cd /path/to/codex-father
rm -rf node_modules dist
cd ..
rm -rf codex-father
```

### 清理配置文件

**Claude Desktop 配置**：

编辑 `claude_desktop_config.json`，删除 `codex-father` 配置项。

**Codex CLI 配置**：

编辑 `~/.codex/config.toml`，删除 `[mcp_servers.codex-father]` 配置项。

---

## ❓ 常见问题

### Q1: `npm install` 失败怎么办？

**原因**：网络问题或权限问题

**解决**：

```bash
# 尝试使用国内镜像
npm install --registry=https://registry.npmmirror.com

# 或使用 yarn
yarn install
```

### Q2: 提示 "Node.js 版本过低"

**原因**：系统 Node.js 版本 < 18.0.0

**解决**：

```bash
# 使用 nvm 安装最新 Node.js
nvm install 18
nvm use 18

# 验证版本
node --version
```

### Q3: `npm start` 提示找不到命令

**原因**：未安装依赖或未构建

**解决**：

```bash
npm install
npm run build
npm start
```

### Q4: macOS 提示"无法验证开发者"

**原因**：macOS 安全机制

**解决**：

```bash
# 临时解决
sudo spctl --master-disable

# 或在"系统偏好设置 > 安全性与隐私"中允许
```

### Q5: Windows 提示"无法加载文件"

**原因**：PowerShell 执行策略限制

**解决**：

```powershell
# 以管理员身份运行 PowerShell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned

# 重新尝试安装
```

---

## 🔗 下一步

安装完成后，您可以：

1. **配置客户端**：查看 [配置指南](configuration.md) 配置 Claude
   Desktop/Code/Codex CLI
2. **快速开始**：查看 [5分钟快速开始](quick-start.md) 运行第一个测试
3. **首次运行测试**：查看 [首次运行测试](first-run.md) 验证所有功能

---

## 📞 获取帮助

- **文档**：[完整文档目录](../README.md)
- **故障排除**：[故障排除指南](troubleshooting.md)
- **Issues**：[GitHub Issues](https://github.com/yuanyuanyuan/codex-father/issues)

---

**🎉 安装完成！开始享受 Codex Father 带来的便利吧！**
