# ⚡ 5分钟快速开始

> **目标**：让您在 5 分钟内完成 Codex Father 的安装、配置和第一次使用测试。

## 📋 您将学到

- [x] 安装 Codex Father
- [x] 配置你的第一个客户端（推荐 Claude Desktop）
- [x] 运行第一个测试
- [x] 验证配置成功

---

## 🚀 步骤 1：安装（2分钟）

### 方式 A：使用 npx（推荐，最简单）

```bash
# 无需安装，直接使用
npx -y @starkdev020/codex-father-mcp-server
```

**验证**：如果看到 MCP 服务器启动信息，说明安装成功！

### 方式 B：从源码安装

```bash
# 克隆仓库
git clone https://github.com/yuanyuanyuan/codex-father.git
cd codex-father

# 安装依赖
npm install

# 构建项目
npm run build

# 验证安装
npm start
```

**验证**：如果看到 "MCP Server started" 信息，说明安装成功！

---

## ⚙️ 步骤 2：配置客户端（2分钟）

### 推荐：Claude Desktop

**找到配置文件**：

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

**添加配置**：

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

**重启 Claude Desktop**：完全退出 Claude Desktop 并重新打开。

**验证配置**：

- 在 Claude Desktop 中，点击右下角的 "🔧" 图标
- 查看是否出现 "codex-father" 服务器
- 状态应该显示为 "已连接" ✅

---

## 🧪 步骤 3：运行第一个测试（1分钟）

在 Claude Desktop 对话框中输入以下测试指令：

### 测试 1：连接测试

**您输入**：

```
请帮我列出当前项目的所有 .md 文件
```

**预期结果**：

- Claude 会调用 `codex.exec`（或等价的 `codex_exec`）工具
- 返回项目中的 Markdown 文件列表
- 如果看到文件列表，说明连接成功！✅

### 测试 2：简单任务测试

**您输入**：

```
帮我创建一个 hello.txt 文件，内容是 "Hello, Codex Father!"
```

**预期结果**：

- Claude 会执行文件创建任务
- 返回成功信息
- 检查项目目录，应该能看到 `hello.txt` 文件

---

### 工具命名小贴士

- 同一工具有两种等价命名：点号（如 `codex.exec`）和下划线（如 `codex_exec`）。
- Codex 0.44（responses）不接受点号名；推荐只导出下划线，或配置前缀别名如
  `cf_exec`。
- 在多数客户端中，完整调用名为 `mcp__<server-id>__<tool>`，其中 `<server-id>`
  是你的 MCP 配置键名（如 `codex-father`）。
- 不确定时，先调用 `codex.help` 获取全部方法与示例；或直接看带前缀的
  `cf_help`（若已配置前缀）。

## ✅ 验证成功标志

如果以下三个条件都满足，恭喜您配置成功！🎉

1. **服务器状态**：Claude Desktop 右下角显示 "codex-father 已连接"
2. **测试通过**：测试 1 和测试 2 都返回了预期结果
3. **无错误**：没有出现连接错误或权限错误

---

## ❌ 如果遇到问题

### 问题 1：找不到配置文件

**解决**：手动创建配置文件

```bash
# macOS
mkdir -p ~/Library/Application\ Support/Claude
touch ~/Library/Application\ Support/Claude/claude_desktop_config.json

# Windows (PowerShell)
New-Item -Path "$env:APPDATA\Claude" -ItemType Directory -Force
New-Item -Path "$env:APPDATA\Claude\claude_desktop_config.json" -ItemType File
```

### 问题 2：服务器显示"未连接"

**解决步骤**：

1. 完全退出 Claude Desktop（不是最小化）
2. 等待 5 秒
3. 重新打开 Claude Desktop
4. 如果仍然失败，检查配置文件格式是否正确（JSON 格式）

### 问题 3：测试指令无响应

**解决步骤**：

1. 检查是否有 Codex CLI 安装在系统中
2. 运行 `codex --version` 验证
3. 如果没有，访问 [Codex CLI 官网](https://docs.codex.dev) 安装

---

## 🔗 下一步

恭喜完成快速开始！现在您可以：

1. **深入配置**：查看 [完整配置指南](configuration.md) 了解更多配置选项
2. **运行测试**：查看 [首次运行测试](first-run.md) 运行 10 个渐进式测试
3. **场景化使用**：查看 [使用场景](use-cases/README.md) 了解 15+ 实际使用场景
4. **故障排除**：如有问题，查看 [故障排除指南](troubleshooting.md)

---

## 💡 提示

- **审批策略**：首次使用时，Codex
  Father 会询问您是否批准执行命令，这是正常的安全机制
- **性能优化**：可以在配置中添加 `"approval-policy": "on-failure"` 减少审批次数
- **日志查看**：遇到问题时，可以查看 `.codex-father/logs/` 目录下的日志文件

---

**🎉 享受使用 Codex Father！如有问题，请查看 [完整文档](../README.md)
或提交 Issue。**
