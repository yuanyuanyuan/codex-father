# Codex Father MCP Server

> 🚀 开箱即用的 MCP 服务器，将 Codex CLI 暴露为标准 MCP 工具

通过 MCP (Model Context Protocol) 协议，让 Claude
Desktop 或任何 MCP 客户端都能直接调用 Codex CLI，实现智能代码生成、分析和修复。

## ✨ 核心特性

- **零配置启动** - 5 分钟内完成从安装到运行
- **异步任务管理** - 支持长时间运行的任务，可随时查询状态和日志
- **灵活的安全策略** - 从只读到完全访问，可自由配置
- **多客户端支持**（Ubuntu） - 支持 Codex CLI (rMCP)、Claude Code CLI（Claude
  Desktop 配置留作参考，暂不保证本版本兼容性）
- **标准 MCP 协议** - 完全兼容 Model Context Protocol 规范

---

## 🚀 5 分钟快速上手

### 前置要求

- **Node.js** >= 18
- **Codex CLI** 已安装 ([获取 Codex](https://github.com/anthropics/codex))

> 命名策略与环境变量：不同客户端对工具名格式（点号 vs 下划线）要求不同。如使用 Codex
> 0.44（responses），建议仅导出下划线或带前缀的 `cf_*`。变量与默认值参见：
>
> - 人类可读版:
>   ../../docs/environment-variables-reference.md#mcp-服务器typescript
> - 机器可读版: ../../docs/environment-variables.json

### 方式一：本地开发模式（推荐用于测试）

```bash
# 1. 克隆仓库
git clone https://github.com/yuanyuanyuan/codex-father.git
cd codex-father/mcp/codex-mcp-server

# 2. 安装依赖
npm install

# 3. 启动服务器
npm run dev
```

### 方式二：使用 npx（一键启动）

包已发布到 npmjs，可以直接运行：

```bash
# 直接运行，无需额外配置
npx @starkdev020/codex-father-mcp-server
```

> 💡 **提示**：首次运行会自动下载，后续启动会更快

### 方式三：集成到 MCP 客户端

支持以下 MCP 客户端（Ubuntu）：

#### 3.1 （参考）Claude Desktop（本版本暂不保证兼容性）

**macOS/Linux** 配置文件位置：

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows** 配置文件位置：

```
%APPDATA%\Claude\claude_desktop_config.json
```

**配置内容**：

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server"],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**保存后重启 Claude Desktop**，你将在工具列表中看到 `codex.*` 系列工具！

#### 3.2 Codex CLI（使用 rMCP）

Codex CLI 支持 MCP 服务器配置，在 `~/.codex/config.toml` 中添加：

```toml
[mcp_servers.codex-father]
command = "npx"
args = ["-y", "@starkdev020/codex-father-mcp-server"]
env = { NODE_ENV = "production" }
```

然后运行 Codex：

```bash
codex
# 在 Codex 中，工具将自动可用
```

#### 3.3 Claude Code CLI

在项目根目录创建 `.claude/mcp_settings.json`：

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

启动 Claude Code：

```bash
claude-code
# 工具将自动加载
```

---

## 📖 实战示例

### 示例 1：（参考）在 Claude Desktop 中分析代码（本版本暂不保证兼容性）

配置完成后，在 Claude Desktop 中直接对话：

**你**："帮我分析一下这个项目的代码质量"

**Claude** 会自动调用 `codex.exec` 工具：

```json
{
  "name": "codex.exec",
  "arguments": {
    "args": ["--task", "分析项目代码质量，给出改进建议"],
    "approvalPolicy": "on-request",
    "sandbox": "read-only"
  }
}
```

### 示例 2：修复 Bug（需要写入权限）

**你**："修复这个空指针异常问题"

**Claude** 会使用：

```json
{
  "name": "codex.exec",
  "arguments": {
    "args": ["--task", "修复空指针异常"],
    "sandbox": "workspace-write",
    "approvalPolicy": "on-request"
  }
}
```

### 示例 3：长时间任务（异步执行）

对于耗时的任务，使用异步模式：

```json
{
  "name": "codex.start",
  "arguments": {
    "args": ["--task", "重构整个认证模块"],
    "tag": "refactor-auth",
    "sandbox": "workspace-write"
  }
}
```

返回 `jobId` 后，可以随时查询状态：

```json
{
  "name": "codex.status",
  "arguments": {
    "jobId": "返回的jobId"
  }
}
```

查看实时日志：

```json
{
  "name": "codex.logs",
  "arguments": {
    "jobId": "返回的jobId",
    "mode": "lines",
    "tailLines": 50
  }
}
```

### 示例 4：在 Codex CLI 中使用

配置好 `~/.codex/config.toml` 后，在 Codex CLI 中：

**你**："使用 codex-father 工具分析这个项目的代码质量"

**Codex** 会自动调用配置的 MCP 工具，相当于：

```bash
# Codex 内部执行
codex.exec --task "分析项目代码质量" --sandbox read-only
```

**优势**：

- 在 Codex 的对话流程中无缝集成
- 可以利用 Codex 的上下文管理
- 支持 rMCP 协议的双向通信

---

## 🛠️ MCP 工具详解

> 命名与别名：所有工具提供“点号”和“下划线”两种命名，功能等价。
>
> - 点号：`codex.exec`, `codex.start`, `codex.status`, `codex.logs`,
>   `codex.stop`, `codex.list`, `codex.help`
> - 下划线：`codex_exec`, `codex_start`, `codex_status`, `codex_logs`,
>   `codex_stop`, `codex_list`, `codex_help`
>
> 在多数客户端中，完整调用名为 `mcp__<server-id>__<tool>`，其中 `<server-id>`
> 来自你的 MCP 配置键（如 `codex-father` 或 `codex-father-prod`）。

#### 命名定制（可选）

- `CODEX_MCP_NAME_STYLE`：控制导出名称风格
  - `underscore-only`（推荐，兼容 Codex 0.44 responses）
  - `dot-only`（仅在允许 `.` 的客户端使用）
  - 省略则两者都导出
- `CODEX_MCP_TOOL_PREFIX`：为所有工具增加自定义前缀别名（同时提供 `prefix.*` 与
  `prefix_*` 两种形式，受 `NAME_STYLE` 过滤）
  - 示例：`CODEX_MCP_TOOL_PREFIX=cf` → 导出 `cf_exec`, `cf_start`, ...（如设置
    `underscore-only` 则只留下划线版本）
- `CODEX_MCP_HIDE_ORIGINAL`：隐藏默认的 `codex.*`/`codex_*`
  名称，仅保留前缀别名（`1`/`true` 生效）

示例（Codex 0.44 responses 下的推荐组合）：

```toml
[mcp_servers.codex-father-prod]
command = "npx"
args = ["-y", "@starkdev020/codex-father-mcp-server"]
env.NODE_ENV = "production"
env.CODEX_MCP_NAME_STYLE = "underscore-only"
env.CODEX_MCP_TOOL_PREFIX = "cf"
env.CODEX_MCP_HIDE_ORIGINAL = "1"
```

上述配置下，tools/list 仅会出现 `cf_exec`, `cf_start`, `cf_status`, `cf_logs`,
`cf_stop`, `cf_list`, `cf_help`。

### `codex.help` - 工具自发现

快速查看可用的 `codex.*` 方法、参数 Schema 与示例调用。无需安装 Codex
CLI 也可运行。

示例（显示所有工具与示例）：

```json
{
  "name": "codex.help",
  "arguments": { "format": "markdown" }
}
```

查看单个工具详情（JSON 格式，便于程序消费）：

```json
{
  "name": "codex.help",
  "arguments": { "tool": "codex.exec", "format": "json" }
}
```

> 提示：在多数客户端中，完整调用名为 `mcp__<server-id>__<tool>`；`<server-id>`
> 为你的 MCP 配置键名（如 `codex-father` 或 `codex-father-prod`）。

同名下划线别名：`codex_help`

### `codex.exec` - 同步执行

阻塞执行直到任务完成，适合快速任务。

**参数**：

- `args` (string[]) - 传递给 Codex 的参数
- `tag` (string, 可选) - 任务标签
- `cwd` (string, 可选) - 工作目录
- **便捷字段**：
  - `approvalPolicy`: `untrusted` | `on-failure` | `on-request` | `never`
  - `sandbox`: `read-only` | `workspace-write` | `danger-full-access`
  - `network` (boolean) - 是否允许网络访问（为真时自动追加
    `--codex-config sandbox_workspace_write.network_access=true`）
  - `fullAuto` (boolean) - 开启 Codex 全自动模式（若启用 `dangerouslyBypass`
    将被忽略）
  - `profile` (string) - 指定 Codex 配置文件
  - `codexConfig` (object) - 逐项转换为 `--codex-config key=value`
  - `preset` (string) - 使用仓库内的预设
  - `carryContext` (boolean) - `false` 时追加 `--no-carry-context`
  - `compressContext` (boolean) - `false` 时追加 `--no-compress-context`
  - `contextHead` (number) - 控制上下文保留长度（追加 `--context-head`）
  - `patchMode` (boolean) - 开启补丁模式
  - `requireChangeIn` (string[]) - 重复追加 `--require-change-in`
  - `requireGitCommit` (boolean) - 强制生成 Git 提交
  - `autoCommitOnDone` (boolean) - 成功后自动提交
  - `autoCommitMessage` (string) - 自动提交信息模板
  - `dangerouslyBypass` (boolean) - 注入
    `--dangerously-bypass-approvals-and-sandbox`（详见下文安全说明）

**返回**：

```json
{
  "runId": "...",
  "exitCode": 0,
  "logFile": "/path/to/log",
  "instructionsFile": "/path/to/instructions.md"
}
```

同名下划线别名：`codex_exec`

### `codex.start` - 异步启动

立即返回 `jobId`，任务在后台运行。

**参数**：同 `codex.exec`

**返回**：

```json
{
  "jobId": "job-abc-123",
  "message": "Task started successfully"
}
```

同名下划线别名：`codex_start`

### `codex.status` - 查询状态

**参数**：

- `jobId` (string) - 任务 ID

**返回**：

```json
{
  "status": "running" | "completed" | "failed",
  "exitCode": 0,
  "startTime": "2025-10-03T10:00:00Z"
}
```

同名下划线别名：`codex_status`

> ℹ️ **提示**：工单 schema 禁止额外字段，如果你需要切换 `job.sh`
> 工作目录，请结合下方“高级配置”中的环境变量或在目标目录内启动 MCP 服务器。

### `codex.logs` - 读取日志

**参数**：

- `jobId` (string) - 任务 ID
- `mode` (string, 可选) - `"bytes"` 或 `"lines"` (默认 bytes)
- `offset` / `limit` (number, 可选) - 字节模式分页
- `offsetLines` / `limitLines` (number, 可选) - 行模式分页
- `tailLines` (number, 可选) - 读取最后 N 行
- `grep` (string, 可选) - 过滤关键词

**返回**：

- `mode = "bytes"`：
  ```json
  {
    "chunk": "...",
    "nextOffset": 4096,
    "eof": false,
    "size": 16384
  }
  ```

同名下划线别名：`codex_logs`

- `mode = "lines"`：
  ```json
  {
    "lines": ["..."],
    "totalLines": 1200
  }
  ```

### `codex.stop` - 停止任务

**参数**：

- `jobId` (string) - 任务 ID
- `force` (boolean, 可选) - 强制停止

同名下划线别名：`codex_stop`

### `codex.list` - 列出所有任务

**参数**：无（不接受额外字段）

**返回**：

```json
{
  "jobs": [{ "jobId": "job-1", "status": "running", "tag": "refactor-auth" }]
}
```

同名下划线别名：`codex_list`

> ℹ️ **提示**：同
> `codex.status`，此工具不接受额外参数，请通过环境变量或工作目录切换控制作用范围。

---

## ⚙️ 高级配置

### 环境变量

可以通过环境变量自定义脚本路径：

```bash
# 自定义 job.sh 路径
export CODEX_JOB_SH="/custom/path/to/job.sh"

# 自定义 start.sh 路径
export CODEX_START_SH="/custom/path/to/start.sh"

# 启动服务器
npm run dev
```

> ℹ️ **技巧**：`codex.status` 与 `codex.list` 不接受 `cwd`
> 参数，若要查询其他工作区，请把 `CODEX_JOB_SH` 指向目标目录下的
> `job.sh`，或直接在该目录中启动 MCP 服务器。

### 会话存储位置

所有任务会话存储在：

```
<项目根>/.codex-father/sessions/<job-id>/
├── job.log                # 任务日志
├── *.instructions.md      # 指令文件
├── *.meta.json           # 元数据
├── state.json            # 异步任务状态
└── *.last.txt           # 最后消息
```

### 安全策略说明

| 策略                 | 说明                   | 适用场景           |
| -------------------- | ---------------------- | ------------------ |
| `read-only`          | 只读模式，无法修改文件 | 代码分析、审查     |
| `workspace-write`    | 可修改工作区文件       | Bug 修复、重构     |
| `danger-full-access` | 完全访问（危险）       | 仅在容器或测试环境 |

| 审批策略     | 说明               | 适用场景     |
| ------------ | ------------------ | ------------ |
| `never`      | 从不审批，自动执行 | 全自动化任务 |
| `on-request` | Codex 请求时审批   | 推荐日常使用 |
| `on-failure` | 失败后审批重试     | 调试场景     |
| `untrusted`  | 所有操作需审批     | 高安全环境   |

### `dangerouslyBypass` 行为说明

- 置为 `true` 时会注入
  `--dangerously-bypass-approvals-and-sandbox`，并自动将沙箱切换为
  `danger-full-access`。
- 启用后 Codex 不会追加 `--ask-for-approval`，同时会忽略 `fullAuto=true`
  以避免重复放权。
- 如果 `args` 中已经手动加入
  `--dangerously-bypass-approvals-and-sandbox`，服务器会识别并应用同样的放权逻辑。
- 建议在隔离环境或一次性实验里使用，生产仓库请保持
  `on-request + read-only/workspace-write` 组合。

### 完全自动化示例

如果你信任任务，可以使用完全自动化模式：

```json
{
  "name": "codex.exec",
  "arguments": {
    "cwd": "/path/to/project",
    "tag": "auto-task",
    "approvalPolicy": "never",
    "sandbox": "workspace-write",
    "network": true,
    "fullAuto": true,
    "args": ["--task", "自动完成需求文档中的所有功能"]
  }
}
```

⚠️ **警告**：仅在受信任的环境中使用 `dangerouslyBypass` 选项！

---

## 🆘 故障排除

### 问题 1：Claude Desktop 看不到工具

**症状**：重启 Claude Desktop 后，工具列表中没有 `codex.*` 系列工具

**解决方案**：

```bash
# 1. 检查配置文件路径是否正确
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json

# 2. 确认 dist/index.js 已构建
ls -la /your/path/codex-father/mcp/codex-mcp-server/dist/index.js

# 3. 如果不存在，需要先构建
cd /your/path/codex-father/mcp/codex-mcp-server
npm run build

# 4. 重启 Claude Desktop（完全退出后重新打开）
```

### 问题 2：Codex CLI 中工具未加载

**症状**：在 Codex CLI 中看不到 `codex.*` 工具

**解决方案**：

```bash
# 1. 确认 config.toml 配置正确
cat ~/.codex/config.toml | grep -A 3 "codex-father"

# 应该看到类似输出：
# [mcp_servers.codex-father]
# command = "npx"
# args = ["-y", "@starkdev020/codex-father-mcp-server"]

# 2. 测试 MCP 服务器是否可启动
npx -y @starkdev020/codex-father-mcp-server

# 3. 重启 Codex
codex
```

### 问题 3：任务卡住不动

**症状**：`codex.start` 返回了 `jobId`，但 `codex.status` 一直显示 `running`

**解决方案**：

```bash
# 1. 查看日志
{
  "name": "codex.logs",
  "arguments": {
    "jobId": "your-job-id",
    "mode": "lines",
    "tailLines": 100
  }
}

# 2. 如果日志中有错误，强制停止任务
{
  "name": "codex.stop",
  "arguments": {
    "jobId": "your-job-id",
    "force": true
  }
}

# 3. 检查 Codex CLI 是否正常
codex --version
```

### 问题 4：权限被拒绝

**症状**：

```
Error: EACCES: permission denied
```

**解决方案**：

```bash
# 1. 检查文件权限
ls -la /path/to/codex-father

# 2. 如果是 Node.js 模块权限问题
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /path/to/codex-father

# 3. 重新安装依赖
cd /path/to/codex-father/mcp/codex-mcp-server
rm -rf node_modules package-lock.json
npm install
```

### 问题 5：日志输出乱码

**症状**：`codex.logs` 返回的日志中有乱码或格式错误

**解决方案**：

```jsonc
// 使用行模式 + grep 过滤
{
  "name": "codex.logs",
  "arguments": {
    "jobId": "your-job-id",
    "mode": "lines",
    "grep": "Error|Warning",
    "tailLines": 50,
  },
}
```

---

## 📚 更多资源

- 环境变量参考（源码驱动）
  - 人类可读版: ../../docs/environment-variables-reference.md
  - 机器可读版: ../../docs/environment-variables.json,
    ../../docs/environment-variables.csv

### 项目相关

- **项目主仓库**: [codex-father](https://github.com/yuanyuanyuan/codex-father)
- **npm 包**:
  [@starkdev020/codex-father-mcp-server](https://www.npmjs.com/package/@starkdev020/codex-father-mcp-server)
- **问题反馈**:
  [GitHub Issues](https://github.com/yuanyuanyuan/codex-father/issues)

### 协议与工具

- **MCP 协议规范**: [Model Context Protocol](https://modelcontextprotocol.io/)
- **Codex CLI**: [OpenAI Codex](https://github.com/openai/codex)
- **Codex rMCP 文档**:
  [Advanced Features](https://github.com/openai/codex/blob/main/docs/advanced.md#model-context-protocol-mcp)
- **Codex MCP 接口**:
  [Codex MCP Interface](https://github.com/openai/codex/blob/main/codex-rs/docs/codex_mcp_interface.md)

### 相关工具

- **MCP Inspector**:
  [@modelcontextprotocol/inspector](https://www.npmjs.com/package/@modelcontextprotocol/inspector)
- **Claude Desktop**: [下载 Claude](https://claude.ai/download)

---

## 📝 开发者备注

### 其他 MCP 服务器集成

你可以在配置中同时使用多个 MCP 服务器：

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "node",
      "args": ["/path/to/codex-father/mcp/codex-mcp-server/dist/index.js"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/workspace"
      ]
    }
  }
}
```

### JSON-RPC 调试

使用 MCP Inspector 进行调试：

```bash
# 启动 Inspector（自动在浏览器打开）
npx @modelcontextprotocol/inspector npm run dev

# 在浏览器中测试各种工具调用
```

---

## 🔗 关于 Codex rMCP 支持

### 什么是 rMCP？

rMCP (Remote Model Context Protocol) 是 Codex
CLI 对 MCP 协议的实现，允许 Codex 作为 MCP 客户端调用外部 MCP 服务器。

### Codex Father MCP Server 与 Codex rMCP 的关系

- **Codex rMCP**: Codex CLI 内置的 MCP 客户端功能
  - 配置在 `~/.codex/config.toml` 的 `[mcp_servers]` 部分
  - 让 Codex 能调用外部 MCP 工具

- **Codex Father MCP Server**: 本项目，一个标准 MCP 服务器
  - 暴露 `codex.*` 系列工具（exec、start、status、logs 等）
  - 可被任何 MCP 客户端调用（包括 Codex、Claude Desktop、Claude Code）

### 使用场景对比

| 使用方式                          | 适用场景                            | 配置位置                     |
| --------------------------------- | ----------------------------------- | ---------------------------- |
| **Claude Desktop + Codex Father** | 在 Claude Desktop 中使用 Codex 能力 | `claude_desktop_config.json` |
| **Codex CLI + Codex Father**      | 在 Codex 中调用另一个 Codex 实例    | `~/.codex/config.toml`       |
| **Claude Code + Codex Father**    | 在 Claude Code 中使用 Codex 能力    | `.claude/mcp_settings.json`  |

### Codex 原生 MCP 服务器

Codex 本身也可以作为 MCP 服务器运行（`codex mcp`），提供不同的工具：

- `codex` - 启动 Codex 会话
- `codex-reply` - 继续 Codex 会话

**区别**：

- `codex mcp` 提供的是 Codex 的原生会话管理能力
- `codex-father-mcp-server` 提供的是任务调度和异步管理能力

两者可以配合使用，构建更强大的工作流！

---

**Built with ❤️ by Codex Father Team**
