# T037 - 手动验收测试操作指引

> **任务目标**：执行 `quickstart.md` 中的所有场景，验证 MVP1 功能完整性

## 📋 测试前准备

### 1. 环境检查

```bash
# 确认 Node.js 版本
node --version  # 需要 >= 18

# 确认依赖已安装
npm install

# 确认构建成功
npm run build

# 确认测试通过（可选）
npm test
```

### 2. 工具安装

```bash
# 安装 MCP Inspector（用于测试 MCP 服务器）
npm install -g @modelcontextprotocol/inspector

# 或使用 npx（推荐）
npx @modelcontextprotocol/inspector
```

---

## 🧪 场景 1: MVP1 单进程基本流程

### 目标

验证 MCP 服务器的基本功能：初始化、工具列表、工具调用、通知接收

### 步骤 1.1: 启动 MCP 服务器

```bash
# 方式 1: 直接启动（用于 Inspector 连接）
npm run mcp:start

# 方式 2: 使用 Inspector 启动（推荐）
npx @modelcontextprotocol/inspector npm run mcp:start
```

**预期结果**：

- ✅ 服务器成功启动，无错误输出
- ✅ 显示监听状态（stdio 或指定端口）

### 步骤 1.2: 使用 MCP Inspector 连接

1. **打开 Inspector Web UI**
   - 自动打开浏览器（通常是 `http://localhost:5173`）
   - 或手动访问控制台输出的 URL

2. **验证 initialize 响应**
   - 点击 "Initialize" 按钮
   - **预期结果**：
     ```json
     {
       "protocolVersion": "2024-11-05",
       "serverInfo": {
         "name": "codex-father",
         "version": "1.0.0"
       },
       "capabilities": {
         "tools": {},
         "notifications": {}
       }
     }
     ```

### 步骤 1.3: 验证 tools/list

1. **调用 tools/list**
   - 在 Inspector 中点击 "List Tools"

2. **预期结果**：
   - ✅ 返回工具列表包含以下工具：
     - `codex-chat` - 发送消息到 Codex 对话
     - `codex-execute` - 执行 Codex 命令
     - `codex-read-file` - 读取文件内容
     - `codex-apply-patch` - 应用代码补丁

3. **验证工具 Schema**：
   - 每个工具包含 `name`, `description`, `inputSchema`
   - `inputSchema` 包含必需字段定义

### 步骤 1.4: 验证 tools/call 快速返回

1. **调用 codex-chat 工具**

   ```json
   {
     "name": "codex-chat",
     "arguments": {
       "message": "Hello, Codex!",
       "sessionName": "test-session"
     }
   }
   ```

2. **预期结果**：
   - ✅ **响应时间 < 500ms**
   - ✅ 返回 Job 信息：
     ```json
     {
       "status": "started",
       "jobId": "uuid-string",
       "conversationId": "uuid-string",
       "message": "Task started successfully"
     }
     ```

### 步骤 1.5: 验证进度通知

1. **观察通知接收**
   - 在 Inspector 的 "Notifications" 面板中

2. **预期结果**：
   - ✅ 接收到 `codex-father/progress` 通知
   - ✅ 通知包含 `jobId`, `type`, `data` 字段
   - ✅ 通知类型包括：
     - `task-started`
     - `task-progress`
     - `task-completed` 或 `task-error`

### 步骤 1.6: 验证会话日志

1. **检查会话目录**

   ```bash
   ls -la .codex-father/sessions/
   ```

2. **预期结果**：
   - ✅ 创建了会话目录 `.codex-father/sessions/test-session-<timestamp>/`
   - ✅ 包含以下文件：
     - `events.jsonl` - JSONL 格式事件日志
     - `config.json` - 会话配置
     - `rollout-ref.txt` - Rollout 文件引用（如有）

3. **验证日志内容**

   ```bash
   cat .codex-father/sessions/test-session-*/events.jsonl | jq
   ```

   **预期**：每行是有效的 JSON，包含 `timestamp`, `type`, `data` 字段

---

## 🔐 场景 2: 审批机制验证

### 目标

验证命令审批策略的正确性：白名单自动批准、非白名单触发审批

### 步骤 2.1: 配置审批策略

1. **检查审批配置**

   ```bash
   cat .codex-father/approval-policy.yaml
   ```

2. **预期内容**：
   ```yaml
   approval:
     mode: UNTRUSTED
     whitelist:
       - pattern: '^(git status|git diff|git log|ls|cat).*'
         auto_approve: true
   ```

### 步骤 2.2: 测试白名单自动批准

1. **调用只读命令**

   ```json
   {
     "name": "codex-execute",
     "arguments": {
       "command": "git status"
     }
   }
   ```

2. **预期结果**：
   - ✅ **无需审批，自动执行**
   - ✅ 快速返回 Job 信息（< 500ms）
   - ✅ 在日志中看到 `approval-granted` 事件（auto_approve: true）

### 步骤 2.3: 测试非白名单触发审批

1. **调用非白名单命令**

   ```json
   {
     "name": "codex-execute",
     "arguments": {
       "command": "rm -rf /tmp/test"
     }
   }
   ```

2. **预期结果**：
   - ✅ 终端显示审批提示：

     ```
     ⚠️  Approval Required
     Command: rm -rf /tmp/test
     CWD: /data/codex-father
     Reason: Command not in whitelist

     ✅ Approve  ❌ Deny  ⏭️ Whitelist
     ```

3. **选择 "Deny"**

4. **预期结果**：
   - ✅ MCP 返回拒绝消息
   - ✅ 日志中记录 `approval-denied` 事件

### 步骤 2.4: 验证审批事件日志

1. **检查日志**

   ```bash
   cat .codex-father/sessions/*/events.jsonl | grep approval
   ```

2. **预期结果**：
   - ✅ 包含 `approval-required` 事件
   - ✅ 包含 `approval-granted` 或 `approval-denied` 事件
   - ✅ 事件包含审批详情（command, decision, timestamp）

---

## ✅ 验收标准

### 场景 1 验收清单

- [ ] MCP 服务器成功启动
- [ ] initialize 响应正确
- [ ] tools/list 返回 4 个工具
- [ ] tools/call 响应时间 < 500ms
- [ ] 接收到进度通知
- [ ] 会话日志文件正确创建

### 场景 2 验收清单

- [ ] 白名单命令自动批准
- [ ] 非白名单命令触发审批提示
- [ ] 审批拒绝正确处理
- [ ] 审批事件正确记录到日志

---

## 🐛 常见问题排查

### 问题 1: MCP 服务器启动失败

**症状**：

```
Error: Cannot find module '@modelcontextprotocol/sdk'
```

**解决方案**：

```bash
npm install
npm run build
```

### 问题 2: Inspector 无法连接

**症状**：

```
Connection refused or timeout
```

**解决方案**：

1. 确认服务器已启动
2. 检查端口是否被占用
3. 尝试重启服务器

### 问题 3: 工具调用超时

**症状**：

```
tools/call response time > 500ms
```

**可能原因**：

- Codex CLI 进程启动慢
- 系统资源不足

**解决方案**：

```bash
# 检查 Codex CLI
codex --version

# 重启 MCP 服务器
npm run mcp:start
```

### 问题 4: 审批提示未显示

**症状**：非白名单命令未触发审批

**解决方案**：

1. 检查审批配置文件
2. 确认命令不在白名单中
3. 查看服务器日志

---

## 📝 测试报告模板

完成测试后，请填写以下报告：

```markdown
## T037 验收测试报告

**测试日期**: YYYY-MM-DD **测试人员**: [姓名] **环境**: Node.js [版本], OS
[系统]

### 场景 1: MVP1 单进程基本流程

- [ ] 通过 / [ ] 失败
- 问题记录: [描述任何问题]

### 场景 2: 审批机制验证

- [ ] 通过 / [ ] 失败
- 问题记录: [描述任何问题]

### 总体评价

- [ ] 所有场景通过，可以发布
- [ ] 部分场景失败，需要修复：[列出问题]

### 附加说明

[任何额外的观察或建议]
```

---

## 🎯 下一步

完成验收测试后：

1. ✅ 填写测试报告
2. ✅ 如有问题，创建 Issue 或修复
3. ✅ 通过后，进入 **T038 代码审查**
4. ✅ 准备发布 v1.0.0

---

**祝测试顺利！** ヽ(✿ﾟ▽ﾟ)ノ
