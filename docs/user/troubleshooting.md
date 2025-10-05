# 🆘 故障排除指南

> **常见问题和解决方案**，帮您快速解决使用中遇到的问题。

## 📋 快速诊断

### 症状索引

- [服务器无法连接](#服务器无法连接)
- [命令执行失败](#命令执行失败)
- [权限错误](#权限错误)
- [性能问题](#性能问题)
- [审批机制问题](#审批机制问题)

---

## 🔌 服务器无法连接

### 症状

- Claude Desktop 显示"未连接"
- 测试指令无响应
- 右下角无 codex-father 图标

### 诊断步骤

#### 1. 检查配置文件格式

```bash
# macOS
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq .

# 如果有错误，会显示语法错误位置
```

#### 2. 检查命令是否可用

```bash
# 如果使用 npx
npx -y @starkdev020/codex-father-mcp-server

# 如果使用全局安装
codex-father-mcp-server --version
```

#### 3. 检查 Node.js 版本

```bash
node --version  # 应该 >= v18.0.0
```

### 解决方案

#### 方案 A：重新配置

1. 备份配置文件
2. 使用推荐的 npx 方式重新配置
3. 完全退出并重启 Claude Desktop

#### 方案 B：使用 MCP Inspector 调试

```bash
npx @modelcontextprotocol/inspector npx -y @starkdev020/codex-father-mcp-server
```

浏览器会打开 Inspector 界面，可以看到详细的错误信息。

---

## ❌ 命令执行失败

### 症状

- 返回"Command not found"
- 执行超时
- 返回空结果

### 诊断步骤

#### 1. 检查 Codex CLI 是否安装

```bash
codex --version
```

#### 2. 检查命令语法

```bash
# 在终端直接测试命令
codex exec "ls -la"
```

#### 3. 查看日志

```bash
# 查看 Codex 日志
cat .codex-father/logs/latest.log
```

### 解决方案

#### 方案 A：安装/更新 Codex CLI

```bash
npm install -g @anthropic/codex-cli@latest
```

#### 方案 B：调整超时时间

在配置中增加超时：

```json
{
  "mcpServers": {
    "codex-father": {
      "env": {
        "TIMEOUT_MS": "600000"
      }
    }
  }
}
```

---

## 🔒 权限错误

### 症状

- "Permission denied"
- "Access is denied"
- 无法创建文件

### 诊断步骤

#### 1. 检查文件权限

```bash
ls -la ~/.codex/
```

#### 2. 检查当前用户权限

```bash
whoami
pwd
```

### 解决方案

#### 方案 A：修复权限

```bash
# macOS/Linux
chmod 755 ~/.codex
chmod 644 ~/.codex/config.toml

# Windows (PowerShell 管理员)
icacls ~/.codex /grant:r $env:USERNAME:F
```

#### 方案 B：使用用户目录

确保操作的文件都在用户目录下，避免操作系统目录。

---

## ⚡ 性能问题

### 症状

- 响应速度慢
- 内存占用高
- CPU 使用率高

### 诊断步骤

#### 1. 检查并发任务数

```bash
# 查看当前运行的任务
ps aux | grep codex
```

#### 2. 检查日志大小

```bash
du -sh .codex-father/logs/
```

### 解决方案

#### 方案 A：限制并发数

```json
{
  "mcpServers": {
    "codex-father": {
      "env": {
        "MAX_CONCURRENT_JOBS": "3"
      }
    }
  }
}
```

#### 方案 B：清理日志

```bash
# 清理旧日志
rm .codex-father/logs/*.log.old
```

---

## 🤔 审批机制问题

### 症状

- 频繁弹出审批请求
- 审批后仍然失败
- 无法通过审批

### 解决方案

#### 方案 A：调整审批策略

```json
{
  "mcpServers": {
    "codex-father": {
      "env": {
        "APPROVAL_POLICY": "on-failure"
      }
    }
  }
}
```

#### 方案 B：配置白名单

```json
{
  "mcpServers": {
    "codex-father": {
      "env": {
        "WHITELIST_COMMANDS": "ls,pwd,git status,npm test"
      }
    }
  }
}
```

---

## 🔍 高级诊断

### 启用调试日志

```json
{
  "mcpServers": {
    "codex-father": {
      "env": {
        "LOG_LEVEL": "debug",
        "LOG_FILE": "/tmp/codex-father-debug.log"
      }
    }
  }
}
```

### 使用 MCP Inspector

```bash
npx @modelcontextprotocol/inspector npx -y @starkdev020/codex-father-mcp-server
```

Inspector 提供：

- 实时工具调用监控
- 详细错误堆栈
- 请求/响应日志

---

## 📞 获取更多帮助

如果以上方法无法解决问题：

1. **收集信息**：
   - 错误信息截图
   - 配置文件内容
   - 系统信息（OS、Node.js 版本）
   - 日志文件

2. **提交 Issue**：
   - [GitHub Issues](https://github.com/yuanyuanyuan/codex-father/issues)
   - 标题简洁描述问题
   - 提供完整的诊断信息

3. **社区支持**：
   - 查看已有 Issues
   - 搜索相似问题的解决方案

---

**💡 提示**：大部分问题都可以通过重启客户端和检查配置文件解决。
