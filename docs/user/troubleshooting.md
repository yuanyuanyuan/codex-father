# 🆘 故障排除指南

> **常见问题和解决方案**，帮您快速解决使用中遇到的问题。

> 环境变量键的完整清单与默认值请参考：
>
> - 人类可读版: ../environment-variables-reference.md
> - 机器可读版: ../environment-variables.json, ../environment-variables.csv

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
codex-mcp-server --version
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

### 工具名称对不上（Unknown tool）

**症状**：

- 工具调用报错：`Unknown tool: codex.exec` 或 `codex_exec`
- 客户端工具列表显示的名称与文档不一致

**原因**：

- 不同客户端对工具命名风格有差异（点号 vs 下划线）
- 前缀 `mcp__<server-id>__` 使用的是你的 MCP 配置键名

**解决**：

- 若使用 Codex 0.44（responses）导致 400：设置
  `CODEX_MCP_NAME_STYLE=underscore-only`，只导出下划线名。
- 为避免混淆：
  - 设置 `CODEX_MCP_TOOL_PREFIX=cf`，并配合 `CODEX_MCP_HIDE_ORIGINAL=1` 仅保留
    `cf_*` 工具。
  - 这样工具列表更清晰：`cf_exec/cf_start/cf_status/cf_logs/cf_stop/cf_list/cf_help`。
- 等价别名总览：
  - 点号：`codex.exec`, `codex.start`, `codex.status`, `codex.logs`,
    `codex.stop`, `codex.list`, `codex.help`
  - 下划线：`codex_exec`, `codex_start`, `codex_status`, `codex_logs`,
    `codex_stop`, `codex_list`, `codex_help`
- 不确定时调用 `codex.help`：
  - 全部概览：`{ "name": "codex.help", "arguments": {"format": "markdown"} }`
  - 单个详情：`{ "name": "codex.help", "arguments": {"tool": "codex.exec", "format": "json"} }`
- 确认前缀 `mcp__<server-id>__` 中的 `<server-id>` 与配置一致（如 `codex-father`
  或 `codex-father-prod`）。

### 报错：-p / --instruction-override 参数已移除

**症状**：CLI 直接退出并打印 `错误: -p 参数已移除` 或
`错误: --instruction-override 参数已移除`。

**原因**：自 v1.0 起，预设和任务描述仅接受长参数；旧版缩写 `-p` 与
`--instruction-override` 已被彻底删除。

**解决**：

- 使用 `--preset <name>` 指定预设（如 `codex-father-preview`、`sprint`）。
- 使用 `--task <text>` 传递任务说明；`--tag <name>`
  可选但强烈推荐，方便按标签检索日志。
- 对于 MCP 客户端，请更新工具调用参数为
  `{"args":["--preset","codex-father-preview","--task","……","--tag","your-tag"]}`。
- Codex CLI 会在启动前估算上下文体积：若任务输入超过默认
  `INPUT_TOKEN_LIMIT=32000`（以 tokens 粗略估算），会即时拒绝并提示拆分；可根据需要在调用环境中调整
  `INPUT_TOKEN_LIMIT`/`INPUT_TOKEN_SOFT_LIMIT`。

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

#### 3. 检查模型配置

```bash
# 仅模型
./start.sh --task "check" --model gpt-5-codex --patch-mode

# 模型 + 推理力度
./start.sh --task "check" --model "gpt-5-codex high" --patch-mode
```

如果返回 `400 Unsupported model`：

- 会话 `job.meta.json`/`aggregate.jsonl` 中会显示 `classification: config_error`
  和 `reason: Unsupported or invalid model`；
- 说明后端不支持该模型名，请改用受支持的模型或检查 provider 映射；
- 若需要推理力度，请只使用 `minimal|low|medium|high` 四个枚举值。

#### 3. 查看日志

```bash
# 查看 Codex 日志
cat .codex-father/logs/latest.log
```

### 看到 `<instructions-section type="policy-note">` / `Patch Mode: on`

**说明**：已启用补丁模式（`--patch-mode`），系统会追加 policy-note，要求仅输出可应用的补丁。

**如何关闭**：移除 `--patch-mode`，即可恢复为正常执行（允许写盘等）。

### `effective_network_access` 显示为 `restricted`

**说明**：默认网络为受限模式；如果需要联网，请显式开启。

**开启方式**：

```bash
# CLI 直接使用
./start.sh --task "need network" \
  --codex-config sandbox_workspace_write.network_access=true

# MCP 工具参数
{ "name": "codex.exec", "arguments": { "network": true } }
```

运行后，`<session>/job.meta.json` 中的 `effective_network_access` 将显示为
`enabled`。

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
