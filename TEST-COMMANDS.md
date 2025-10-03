# 测试命令速查表

**快速参考** - 复制粘贴即可使用的测试命令

---

## 🎯 推荐测试流程

### 步骤 1: 快速自动化测试（3 分钟）⭐

```bash
# 运行完整自动化测试套件
./scripts/manual-test.sh all
```

### 步骤 2: MCP Inspector 交互测试（2 分钟）⭐

```bash
# 启动 MCP Inspector
npx @modelcontextprotocol/inspector npm start
```

**在浏览器中测试**:

1. 点击 "Connect"
2. 点击 "List Tools"
3. 调用 "chat" 工具，参数：
   ```json
   {
     "message": "Hello, what is 2+2?",
     "sessionName": "quick-test",
     "model": "claude-3-5-sonnet-20241022"
   }
   ```

### 步骤 3: 验证会话数据（30 秒）

```bash
# 查看会话目录
ls -la .codex-father/sessions/

# 查看事件日志
cat .codex-father/sessions/quick-test-*/events.jsonl | jq

# 查看配置文件
cat .codex-father/sessions/quick-test-*/config.json | jq
```

---

## 📦 单独测试场景

### 环境检查

```bash
# 检查 Node.js 版本
node --version

# 检查 npm 版本
npm --version

# 检查 Codex CLI
codex --version

# 检查 Codex 登录状态
codex auth status
```

---

### 构建和代码质量检查

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 类型检查
npm run typecheck

# Lint 检查
npm run lint:check

# 格式检查
npm run format

# 运行所有单元测试
npm test

# 运行单元测试（无监听）
npm run test:run

# 生成测试覆盖率报告
npm run test:coverage

# 运行完整检查（类型 + lint + 格式 + 测试）
npm run check:all
```

---

### 启动服务器

```bash
# 方式 1: 普通启动（前台）
npm start

# 方式 2: 使用 MCP Inspector（推荐）
npx @modelcontextprotocol/inspector npm start

# 方式 3: 开发模式（自动重载）
npm run dev

# 方式 4: 直接启动（构建后）
npm run mcp:start
```

---

### 自动化测试脚本

```bash
# 冒烟测试（最快，~30 秒）
./scripts/manual-test.sh smoke

# 服务器启动测试
./scripts/manual-test.sh server-start

# 会话目录测试
./scripts/manual-test.sh session-dir

# 配置文件测试
./scripts/manual-test.sh config

# 性能基准测试
./scripts/manual-test.sh performance

# 完整测试套件
./scripts/manual-test.sh all

# 生成测试报告
./scripts/manual-test.sh report

# 清理测试数据
./scripts/manual-test.sh cleanup
```

---

## 🧪 MCP Inspector 测试参数

### Chat 工具（最常用）

```json
{
  "message": "Hello, what is 2+2?",
  "sessionName": "test-chat",
  "model": "claude-3-5-sonnet-20241022"
}
```

### Execute 工具（需要审批）

```json
{
  "command": "npm install lodash",
  "cwd": "/data/codex-father",
  "sessionName": "test-execute"
}
```

### Execute 工具（白名单命令，自动批准）

```json
{
  "command": "git status",
  "cwd": "/data/codex-father",
  "sessionName": "test-whitelist"
}
```

### Read-File 工具

```json
{
  "path": "/data/codex-father/README.md"
}
```

### Apply-Patch 工具

```json
{
  "filePath": "/data/codex-father/test-file.txt",
  "patch": "--- a/test-file.txt\n+++ b/test-file.txt\n@@ -1 +1 @@\n-old content\n+new content"
}
```

---

## 📊 查看测试数据

### 会话目录

```bash
# 列出所有会话
ls -la .codex-father/sessions/

# 查看最新会话
ls -la .codex-father/sessions/ | tail -n 1

# 查看特定会话内容
ls -la .codex-father/sessions/test-chat-*/
```

### 事件日志

```bash
# 查看事件日志（原始格式）
cat .codex-father/sessions/*/events.jsonl

# 查看事件日志（格式化 JSON）
cat .codex-father/sessions/*/events.jsonl | jq

# 查看事件日志（紧凑格式）
cat .codex-father/sessions/*/events.jsonl | jq -c

# 过滤特定类型事件
cat .codex-father/sessions/*/events.jsonl | jq 'select(.type == "task-started")'

# 统计事件数量
cat .codex-father/sessions/*/events.jsonl | wc -l
```

### 配置文件

```bash
# 查看配置文件
cat .codex-father/sessions/*/config.json | jq

# 查看所有会话的配置
for dir in .codex-father/sessions/*/; do
  echo "=== $(basename $dir) ==="
  cat "$dir/config.json" | jq -c
done
```

---

## 🧹 清理命令

```bash
# 备份现有会话数据
cp -r .codex-father .codex-father.backup.$(date +%Y%m%d_%H%M%S)

# 清理测试会话
rm -rf .codex-father/sessions/test-*

# 清理所有会话（危险！）
rm -rf .codex-father/sessions/*

# 重新创建目录
mkdir -p .codex-father/sessions
```

---

## 🐛 调试命令

### 查看进程

```bash
# 查看 Node.js 进程
ps aux | grep node

# 查看 Codex 进程
ps aux | grep codex

# 查看端口占用
lsof -i :6274

# 杀死所有 Node.js 进程（危险！）
killall node
```

### 查看日志

```bash
# 实时查看服务器日志
npm start 2>&1 | tee server.log

# 实时跟踪日志
tail -f server.log

# 查看错误日志
npm start 2>&1 | grep -i error

# 查看警告日志
npm start 2>&1 | grep -i warning
```

### 性能监控

```bash
# 查看内存使用
node --max-old-space-size=4096 dist/cli/commands/mcp-command.js

# 使用 Node.js 性能分析
node --prof dist/cli/commands/mcp-command.js

# 查看堆快照
node --inspect dist/cli/commands/mcp-command.js
```

---

## 🔧 故障排查

### 服务器无法启动

```bash
# 检查依赖
npm install

# 重新构建
rm -rf dist && npm run build

# 检查 TypeScript 错误
npm run typecheck

# 查看详细错误
npm start 2>&1 | tee error.log
```

### MCP Inspector 无法连接

```bash
# 检查端口占用
lsof -i :6274

# 使用其他端口
PORT=6275 npm start

# 使用本地 Inspector
npx @modelcontextprotocol/inspector npm start
```

### Codex CLI 问题

```bash
# 检查 Codex 安装
which codex

# 检查 Codex 版本
codex --version

# 检查登录状态
codex auth status

# 重新登录
codex auth login --api-key YOUR_API_KEY

# 查看 Codex 配置
cat ~/.codex/config.toml
```

---

## 📄 文档链接

- **快速测试指南**: `docs/mvp1-quick-test-guide.md`
- **完整测试计划**: `docs/mvp1-manual-test-plan.md`
- **MCP 集成指南**: `docs/mcp-integration.md`
- **README**: `README.md`

---

## 💡 提示

### 最快测试方法

```bash
# 一键运行所有自动化测试
./scripts/manual-test.sh all

# 然后手动测试 MCP Inspector
npx @modelcontextprotocol/inspector npm start
```

### 持续开发模式

```bash
# 终端 1: 自动重载开发模式
npm run dev

# 终端 2: 自动运行测试
npm run test:watch

# 终端 3: 自动运行 Lint
npm run lint:check -- --watch
```

### 快速验证

```bash
# 快速检查一切是否正常
npm run check:all && ./scripts/manual-test.sh smoke
```

---

**祝测试顺利！** 🎉

如有问题，请参考完整测试计划或提交 Issue。
