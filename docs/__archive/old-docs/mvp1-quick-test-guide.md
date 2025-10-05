# MVP1 快速测试指南

**快速入门** - 5 分钟内完成核心功能测试

---

## 🚀 快速开始

### 第 1 步：自动化测试（3 分钟）

```bash
# 1. 进入项目目录
cd /data/codex-father

# 2. 运行完整自动化测试套件
./scripts/manual-test.sh all

# 这会自动执行:
# ✓ 环境检查
# ✓ 冒烟测试（类型检查、Lint、单元测试）
# ✓ 服务器启动/关闭测试
# ✓ 会话目录和日志测试
# ✓ 配置文件加载测试
# ✓ 性能基准测试
# ✓ 生成测试报告
```

**期望结果**：所有测试通过 ✅

---

### 第 2 步：MCP Inspector 测试（2 分钟）⭐

**这是最重要的交互式测试！**

#### 2.1 启动 MCP Inspector

```bash
# 使用 MCP Inspector 启动服务器
npx @modelcontextprotocol/inspector npm start

# 期望:
# - 自动打开浏览器（http://localhost:6274）
# - 显示 MCP Inspector UI
```

#### 2.2 测试 Initialize

```
在 Inspector UI 中:
1. 点击 "Connect" 按钮
2. 观察响应 JSON

期望响应:
{
  "protocolVersion": "2024-11-05",
  "capabilities": {
    "tools": {},
    "notifications": {}
  },
  "serverInfo": {
    "name": "codex-father",
    "version": "1.0.0"
  }
}
```

#### 2.3 测试 Tools/List

```
在 Inspector UI 中:
1. 点击 "List Tools" 按钮
2. 观察工具列表

期望看到 4 个工具:
✓ chat
✓ execute
✓ read-file
✓ apply-patch
```

#### 2.4 测试 Tools/Call - Chat

```
在 Inspector UI 中:
1. 点击 "Call Tool"
2. 选择 "chat" 工具
3. 输入参数:
   {
     "message": "Hello, what is 2+2?",
     "sessionName": "quick-test",
     "model": "claude-3-5-sonnet-20241022"
   }
4. 点击 "Call"

期望:
✓ 快速返回（< 500ms）
✓ 返回 jobId 和 conversationId
✓ 在 "Notifications" 面板看到进度通知
```

**验证点**:

- [ ] 服务器启动成功
- [ ] 协议版本正确
- [ ] 工具列表正确
- [ ] Chat 工具正常工作
- [ ] 收到进度通知

---

### 第 3 步：验证会话数据（30 秒）

```bash
# 查看创建的会话目录
ls -la .codex-father/sessions/

# 期望输出:
# quick-test-2025-10-01/

# 查看会话内容
ls -la .codex-father/sessions/quick-test-*/

# 期望文件:
# events.jsonl      (事件日志)
# config.json       (会话配置)
# rollout-ref.txt   (可选)

# 查看事件日志
cat .codex-father/sessions/quick-test-*/events.jsonl | jq

# 期望: 每行一个 JSON 事件
```

**验证点**:

- [ ] 会话目录已创建
- [ ] events.jsonl 存在且格式正确
- [ ] config.json 存在且内容正确

---

## ✅ 快速测试完成

如果以上 3 个步骤都通过，说明 **MVP1 核心功能正常**！🎉

---

## 📋 可选：深度测试场景

### 测试审批机制（需要 Codex CLI）⚠️

**前置条件**: 需要安装并配置 Codex CLI

#### 启动服务器（前台模式）

```bash
# 终端 1: 启动服务器
npm start

# 保持这个终端可见，能看到审批 UI
```

#### 发送需要审批的命令

```bash
# 终端 2: 启动 Inspector
npx @modelcontextprotocol/inspector npm start

# 在 Inspector 中调用 execute 工具:
{
  "tool": "execute",
  "arguments": {
    "command": "npm install lodash",
    "cwd": "/data/codex-father",
    "sessionName": "test-approval"
  }
}
```

#### 观察审批 UI（终端 1）

```
期望看到:
┌─────────────────────────────────────────┐
│ 审批请求                                 │
├─────────────────────────────────────────┤
│ 会话: test-approval                     │
│ 命令: npm install lodash                │
│ 工作目录: /data/codex-father            │
│ 等待时间: 0:00:05                       │
├─────────────────────────────────────────┤
│ [A] 批准  [D] 拒绝  [W] 加入白名单     │
└─────────────────────────────────────────┘

操作:
- 按 A 批准
- 按 D 拒绝
```

**验证点**:

- [ ] 审批 UI 正确显示
- [ ] 快捷键正常工作
- [ ] 批准后命令执行
- [ ] 拒绝后命令不执行

---

### 测试白名单自动批准

```bash
# 在 Inspector 中调用 execute 工具:
{
  "tool": "execute",
  "arguments": {
    "command": "git status",
    "cwd": "/data/codex-father",
    "sessionName": "test-whitelist"
  }
}

# 期望:
# - 无需人工审批，自动批准
# - 快速返回
```

**验证点**:

- [ ] 白名单命令自动批准
- [ ] 无需人工干预

---

## 🛠️ 单独测试场景命令

### 冒烟测试（最快）

```bash
# 只运行基本检查
./scripts/manual-test.sh smoke

# 耗时: ~30 秒
```

### 服务器启动测试

```bash
# 测试服务器启动和关闭
./scripts/manual-test.sh server-start

# 耗时: ~10 秒
```

### 会话目录测试

```bash
# 测试会话目录结构
./scripts/manual-test.sh session-dir

# 耗时: ~5 秒
```

### 配置文件测试

```bash
# 测试配置加载
./scripts/manual-test.sh config

# 耗时: ~5 秒
```

### 性能测试

```bash
# 运行性能基准测试
./scripts/manual-test.sh performance

# 耗时: ~1 分钟
```

### 清理测试数据

```bash
# 清理所有测试会话数据
./scripts/manual-test.sh cleanup

# 注意: 会备份现有数据
```

---

## 🐛 常见问题

### Q1: 服务器启动失败

**症状**: `npm start` 报错或无法连接

**排查步骤**:

```bash
# 1. 检查端口占用
lsof -i :6274

# 2. 检查构建产物
ls -la dist/

# 3. 重新构建
npm run build

# 4. 查看详细日志
npm start 2>&1 | tee server.log
```

### Q2: MCP Inspector 无法连接

**症状**: 浏览器显示 "Connection refused"

**排查步骤**:

```bash
# 1. 检查服务器是否启动
ps aux | grep "node.*mcp"

# 2. 检查防火墙
# (如果使用远程服务器)

# 3. 使用本地模式
npm start
# 然后在另一个终端
npx @modelcontextprotocol/inspector npm start
```

### Q3: 事件日志文件不存在

**症状**: 会话目录中没有 events.jsonl

**原因**: 可能是 Codex CLI 未正确配置或沙箱权限不足

**解决**:

```bash
# 检查 Codex 配置
codex auth status

# 检查沙箱模式（应该是 workspace-write）
# 查看日志中的 sandbox 配置
```

### Q4: 审批 UI 不显示

**症状**: 发送需要审批的命令后，终端没有显示审批提示

**原因**:

1. 命令在白名单中（自动批准）
2. 审批策略配置为 NEVER
3. Codex CLI 未启动

**解决**:

```bash
# 检查审批策略配置
cat core/approval/policy-engine.ts | grep -A 5 "DEFAULT_POLICY"

# 确保使用前台模式启动
npm start
# (不要使用后台模式)
```

---

## 📊 测试清单

### 快速测试（5 分钟）

- [ ] 自动化测试全部通过
- [ ] MCP Inspector 连接成功
- [ ] Tools/List 显示 4 个工具
- [ ] Chat 工具正常工作
- [ ] 会话目录已创建
- [ ] 事件日志格式正确

### 深度测试（15 分钟）

- [ ] 审批 UI 正常显示
- [ ] 批准操作正常工作
- [ ] 拒绝操作正常工作
- [ ] 白名单自动批准
- [ ] 多会话管理
- [ ] 进程健康检查

### 完整测试（30 分钟）

- [ ] 所有快速测试 + 深度测试
- [ ] 性能基准测试通过
- [ ] 错误处理测试
- [ ] 进程崩溃和重启测试
- [ ] 配置文件热重载测试

---

## 📄 相关文档

- **完整测试计划**: `docs/mvp1-manual-test-plan.md`
- **MCP 集成指南**: `docs/mcp-integration.md`
- **主文档**: `README.md`

---

## ✨ 快速命令速查表

```bash
# 完整自动化测试
./scripts/manual-test.sh all

# 快速冒烟测试
./scripts/manual-test.sh smoke

# MCP Inspector 测试
npx @modelcontextprotocol/inspector npm start

# 查看会话数据
ls -la .codex-father/sessions/

# 清理测试数据
./scripts/manual-test.sh cleanup

# 生成测试报告
./scripts/manual-test.sh report
```

---

**祝测试顺利！** 🚀

有问题请查看完整测试计划或提交 Issue。
