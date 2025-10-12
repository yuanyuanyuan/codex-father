# Codex Father - TypeScript MCP Server (MVP1)

语言: 中文 | [English](README.en.md)

> MCP (Model Context Protocol) 服务器，用于将 Codex
> CLI 暴露为标准 MCP 工具，支持单进程异步执行和审批机制。

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-2024--11--05-purple)](https://modelcontextprotocol.io/)

> ⚡
> 5 分钟上手：查看“[快速开始](docs/user/quick-start.md)”并一键试跑主路径示例。

> 📘 强烈推荐：面向零基础用户的《[用户使用手册](docs/user/manual.md)》手把手讲解安装、配置、使用与排错，含操作示例与流程图。

## 📋 目录

- [特性](#特性)
- [架构](#架构)
- [快速开始](#快速开始)
- [使用指南](#使用指南)
- [开发](#开发)
- [测试](#测试)
- [文档](#文档)
- [贡献](#贡献)

## ✨ 特性

### 核心功能（MVP1 已实现）

- MCP 协议实现：initialize、tools/list、tools/call
- 单进程管理：Codex CLI 生命周期与健康监控
- 异步执行：非阻塞执行，返回 `jobId`，配套状态/日志查询
- 审批机制：`untrusted`、`on-request`、`on-failure`、`never`（白名单支持）
- 事件通知：进度与消息推送（JSON 通知）
- 会话管理：事件 JSONL 与元数据持久化
- 类型安全：完整 TypeScript + Zod 校验

### Codex 版本兼容（0.44）

- 版本检测与缓存：自动解析 `codex --version`，异常时快速失败并提示修复
- 参数-版本映射：在 0.42 ↔ 0.44 之间做参数兼容与降级（保持调用一致性）
- Profile 自动修复：按模型与能力修正关键项（如 `wire_api`, `model`, 超时等）
- 校验与错误码：不满足 `minVersion` 或参数非法时返回 `-32602`；HTTP 类错误对齐
  `405/401/429/500`
- MCP 方法门禁：在 tools/call 前做版本/参数校验，确保上游可预期

参考：`docs/releases/VERSION_MCP_1.2.0.md`、`docs/architecture/mcp-integration.md`

### MCP 工具（当前实现）

1. `codex.exec` — 同步执行（前台阻塞直到完成）
2. `codex.start` — 启动异步任务（立即返回 `jobId`）
3. `codex.status` — 查询任务状态
4. `codex.logs` — 读取任务日志（字节/行两种模式）
5. `codex.stop` — 停止任务（可 `--force`）
6. `codex.list` — 枚举已知任务
7. `codex.help` — 工具自发现与示例输出

> 命名与别名：同时提供下划线等价别名 `codex_exec`, `codex_start`,
> `codex_status`, `codex_logs`, `codex_stop`, `codex_list`, `codex_help`。

### 命名策略（0.44 responses 推荐）

- Codex 0.44（responses wire
  API）不接受带点号的工具名。建议仅导出下划线形式，并使用自定义前缀避免歧义。
- 环境变量（配置在 MCP 服务器条目的 `env` 下）：
  - `CODEX_MCP_NAME_STYLE=underscore-only`（只导出下划线工具名）
  - `CODEX_MCP_TOOL_PREFIX=cf`（为所有工具增加 `cf_` 别名）
  - `CODEX_MCP_HIDE_ORIGINAL=1`（隐藏默认的 `codex_*` 名称，仅保留 `cf_*`）
- 生效后 tools/list 仅出现：`cf_exec`, `cf_start`, `cf_status`, `cf_logs`,
  `cf_stop`, `cf_list`, `cf_help`。

> 注：早期文档中出现的
> `codex-chat`/`codex-execute`/`codex-read-file`/`codex-apply-patch`
> 为构想接口，当前版本未提供这些工具的独立封装（请使用 `codex.exec/start`
> 统一入口）。

### 功能状态

- [x] MCP 服务器（initialize/tools.list/tools.call）
- [x] 异步任务队列（start/status/logs/stop/list）
- [x] 审批策略 + 终端交互 UI（白名单/策略注入）
- [x] 事件记录与会话持久化（JSONL/metadata）
- [x] 合同/契约测试（tools/call 形态与时延）
- [x] Orchestrate 多代理编排 CLI（`orchestrate` 命令，基础可用，持续演进）
- [x] SWW 单写者窗口 + 两阶段写入（基础实现与测试，持续完善）
- [ ] 资源监控与并发调度（≤10 并发，TaskScheduler）
- [ ] 事件模式与审计日志完善（统一 schema 导出）

## 🏗️ 架构

### 系统架构（当前聚焦 Ubuntu + Claude Code CLI / Codex CLI）

```
┌─────────────────┐
│  MCP Client     │  (Claude Desktop, MCP Inspector)
│  (stdio/SSE)    │
└────────┬────────┘
         │ JSON-RPC 2.0
         │
┌────────▼────────────────────────────────────────┐
│  MCP Server (core/mcp/server.ts)                │
│  - Protocol handling                            │
│  - Tool registration                            │
│  - Event forwarding                             │
└────────┬────────────────────────────────────────┘
         │
         │ Bridge Layer
         │
┌────────▼────────────────────────────────────────┐
│  Process Manager (core/process/manager.ts)      │
│  - Codex CLI lifecycle                          │
│  - JSON-RPC communication                       │
│  - Health monitoring                            │
└────────┬────────────────────────────────────────┘
         │
         │
┌────────▼────────────────────────────────────────┐
│  Session Manager (core/session/)                │
│  - Session lifecycle                            │
│  - Event logging (.jsonl)                       │
│  - Config persistence (.json)                   │
└────────┬────────────────────────────────────────┘
         │
         │
┌────────▼────────────────────────────────────────┐
│  Approval System (core/approval/)               │
│  - Policy engine                                │
│  - Terminal UI (inquirer)                       │
│  - Whitelist management                         │
└─────────────────────────────────────────────────┘
```

### 核心模块

- **MCP Server** (`core/mcp/`): MCP 协议实现和桥接层
- **Process Manager** (`core/process/`): Codex CLI 进程管理
- **Session Manager** (`core/session/`): 会话和日志管理
- **Approval System** (`core/approval/`): 审批策略和终端 UI
- **CLI** (`core/cli/`): 命令行接口

## 🚀 快速开始

### 开箱即用的 MCP 服务器

本项目提供了一个完整的 MCP 服务器实现，推荐将运行时与日志放在用户级目录中，避免污染业务仓库：

```bash
# 1) 安装一次（建议全局安装）
npm install -g @starkdev020/codex-father-mcp-server

# 2) 准备独立目录
export CODEX_RUNTIME_HOME="$HOME/.codex-father-runtime"
export CODEX_SESSIONS_HOME="$HOME/.codex-father-sessions"
mkdir -p "$CODEX_RUNTIME_HOME" "$CODEX_SESSIONS_HOME"

# 3) 启动服务器（默认 NDJSON 传输）
CODEX_MCP_PROJECT_ROOT="$CODEX_RUNTIME_HOME" \
CODEX_SESSIONS_ROOT="$CODEX_SESSIONS_HOME" \
codex-mcp-server --transport=ndjson

# 4) 克隆仓库本地开发（可选）
git clone https://github.com/yuanyuanyuan/codex-father.git
cd codex-father && npm install
```

### 集成到 MCP 客户端

支持多种 MCP 客户端：

**Claude Desktop** - 添加到配置文件：

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-mcp-server",
      "args": ["--transport=ndjson"],
      "env": {
        "NODE_ENV": "production",
        "CODEX_MCP_PROJECT_ROOT": "/ABS/PATH/TO/.codex-father-runtime",
        "CODEX_SESSIONS_ROOT": "/ABS/PATH/TO/.codex-father-sessions"
      }
    }
  }
}
```

**Codex CLI (rMCP)** - 添加到 `~/.codex/config.toml`（prod 使用 npx）：

```toml
[mcp_servers.codex-father]
command = "npx"
args = ["-y", "@starkdev020/codex-father-mcp-server", "--transport=ndjson"]
env.NODE_ENV = "production"
env.CODEX_MCP_PROJECT_ROOT = "/ABS/PATH/TO/.codex-father-runtime"
env.CODEX_SESSIONS_ROOT = "/ABS/PATH/TO/.codex-father-sessions"
startup_timeout_sec = 60
tool_timeout_sec = 180
```

**Claude Code CLI** - 在项目根目录创建 `.claude/mcp_settings.json`

📖 **完整使用文档**: [MCP 服务器使用指南](mcp/codex-mcp-server/README.md)

### 新手传参速览（start.sh/job.sh）

- 标准传参：使用 `--task "<文本>"` 指定任务说明；常用组合：
  - `--sandbox workspace-write`、`--ask-for-approval on-failure|on-request`
  - `--model "gpt-5-codex high"` 或 `--model gpt-5-codex high`
  - `--codex-config <key=value>` 追加细粒度开关（如联网）
- 位置参数容错：如果直接把一段话当成“位置参数”（没有任何
  `--flag`）传给脚本，CLI 会自动把它当作 `--task`
  内容处理，并在日志/标准错误输出提示；推荐长期改为显式 `--task`
  写法以避免歧义。
- 异步执行：优先通过 `job.sh start ... --json` 启动，拿到 `jobId` 后用
  `job.sh status/logs` 跟踪；日志与元数据写入
  `.codex-father/sessions/<job-id>/`。注意：会话目录名中的时间戳使用系统本地时区（如
  `exec-YYYYMMDDHHmmss-<tag>`），便于人工检索；不再使用 UTC。
- 快速示例：

  ```bash
  ./job.sh start --task "检查 README，输出改进建议" \
    --sandbox workspace-write --ask-for-approval on-failure --json

  # 若不小心写成（位置参数）：
  ./job.sh start "检查 README，输出改进建议" --sandbox workspace-write --ask-for-approval on-failure --json
  # CLI 也会将其视为 --task，但会给出 [hint] 提示，建议改回显式 --task
  ```

> 包含详细的配置说明、实战示例、故障排除和 rMCP 集成说明 Codex
> CLI 的更多配置细节请参考
> [`refer-research/openai-codex/docs/config.md#mcp_servers`](refer-research/openai-codex/docs/config.md)
> （收录于本仓库的 `refer-research/index.md`）。

### 本地 rMCP CLI 快速体验

若已克隆本仓库，可直接使用内置脚本快速体验 rMCP 流程：

```bash
# 启动 MCP 服务器（终端 1）
npm run mcp:start

# 在新终端（终端 2）列出可用工具
npm run rmcp:client -- list-tools

# 查看命令帮助或更多选项
npm run rmcp:client -- --help
```

> 示例客户端基于 `@modelcontextprotocol/sdk` 实现，无需额外安装 Rust 工具链。

## 📖 使用指南

### MCP 工具列表

当前版本提供以下 MCP 工具：

1. **`codex.exec`** - 同步执行 Codex 任务（= `codex_exec`）
2. **`codex.start`** - 异步启动任务（返回 jobId）（= `codex_start`）
3. **`codex.status`** - 查询任务状态（= `codex_status`）
4. **`codex.logs`** - 读取任务日志（= `codex_logs`）
5. **`codex.stop`** - 停止运行中的任务（= `codex_stop`）
6. **`codex.list`** - 列出所有任务（= `codex_list`）
7. **`codex.help`** - 工具自发现（= `codex_help`）

### 使用示例

在 Claude Desktop 中直接对话：

**你**: "帮我分析一下这个项目的代码质量"

**Claude** 会自动调用 `codex.exec` 工具执行分析任务。

### 首次使用快速提示（避免常见坑）

- 模型与推理力度（兼容 0.42/0.44 与 0.46）：
  - 仅模型：`--model gpt-5-codex`
  - 0.46 推荐：`--model "gpt-5-codex high"` 或 `--model gpt-5-codex high`
  - 旧写法自动兼容：`--model gpt-5-codex-minimal|low|medium|high`
    - 运行时将被拆分为 `model=gpt-5-codex` 与 `model_reasoning_effort=<effort>`
  - 旧写法同样适用于 `--codex-config` 注入：
    - `--codex-config model=gpt-5-codex-medium` → `model=gpt-5-codex` +
      `model_reasoning_effort=medium`
  - 仅对 `gpt-5-codex-<effort>` 进行安全拆分（不会影响其它包含 `-medium`
    的模型名）；若已显式提供 `model_reasoning_effort`，以显式值为准。
  - 若后端报 400 Unsupported model，请改用后端支持的模型或调整 provider 映射。
- 联网开关：
  - 默认网络为
    `restricted`；需要联网时添加：`--codex-config sandbox_workspace_write.network_access=true`
  - 运行后在 `<session>/job.meta.json` 的 `effective_network_access` 应显示
    `enabled`。
- 审批与沙箱：
  - 可写沙箱 + `never` 会被规范化为 `on-request`，日志中含 `[arg-normalize]`
    提示。
  - 如需无人值守，建议使用 `on-failure`，或显式开启 bypass（危险）。
- 补丁模式：
  - 仅在需要“只输出补丁”时添加 `--patch-mode`；看到日志 `Patch Mode: on`
    即表示已注入 `policy-note`。
  - 默认会将补丁写入 `<session>/patches/patch.diff`（或 `--patch-output`
    指定的路径），日志仅保留预览，可用 `--patch-preview-lines`
    调整、`--no-patch-preview` 关闭回显。
  - 如需恢复旧行为（将完整补丁写进日志），传入 `--no-patch-artifact`。
  - 状态归一化：在 `--patch-mode`
    下，若最后消息包含可应用补丁（`*** Begin Patch`/`*** End Patch`）且带有
    `CONTROL: DONE`， `job.sh status`
    会将该任务视为完成（`state=completed, exit_code=0, classification=patch_only`），方便直接消费
    `job.r*.last.txt` 的补丁产物。
- 结构化 instructions：
  - 准备 JSON/YAML/XML 描述的任务文件后，可执行
    `./start.sh --instructions path/to/task.json --task T032`；CLI 会先校验 schema 再写入
    `.codex-father/instructions/` 并通过 `CODEX_STRUCTURED_*`
    环境变量注入给 Shell。
  - 若传入 `--task`，会校验是否存在同名任务 ID；缺少 `--instructions`
    时 CLI 会直接报错。
  - 详细数据模型、执行语义与示例见
    [`specs/structured-instructions/`](specs/structured-instructions/README.md)。
- 快速自检：
  - 联网+补丁模式示例：
    ```bash
    ./start.sh --task "init" \
      --model "gpt-5-codex high" \
      --sandbox workspace-write \
      --ask-for-approval on-request \
      --codex-config sandbox_workspace_write.network_access=true \
      --patch-mode
    ```

- 输入体积预检（超限立刻拒绝）
  - CLI 会在执行前估算上下文体积；默认
    `INPUT_TOKEN_LIMIT=32000`（粗略：字节/4≈tokens）。
  - 超过硬上限会直接报错并退出码 2，状态落为
    `failed`、`classification=context_overflow`，日志包含
    `[input-check] Estimated tokens ... exceed hard limit ...`。
  - 解决：拆分任务或仅传入摘要。可配合 `--docs` +
    `--context-head/--context-grep` 策略压缩，或临时提高
    `INPUT_TOKEN_LIMIT`（不推荐长期依赖）。

- 预设严格校验（未知值直接失败）
  - `--preset`
    仅接受：`sprint|analysis|secure|fast`；未知预设将直接报错并退出码 2。
  - 日志/状态：`failed`，`classification=input_error`；`bootstrap.err` 与
    `job.log` 都会给出明确提示。

- 状态与分类语义（便于被动通知）
  - 正常完成：`state=completed, exit_code=0, classification=normal`（日志包含
    `Exit Code: 0`）。
  - 用户中断：`state=stopped, exit_code=null, classification=user_cancelled`（强制覆盖，不受日志其他关键词影响）。
  - 参数错误：`state=failed, exit_code=2, classification=input_error`（例如未知预设/未知参数/用法错误）。
  - 上下文超限：`state=failed, exit_code=2, classification=context_overflow`（参见“输入体积预检”）。

### 详细文档

- **完整工具参数说明**:
  [MCP 工具详解](mcp/codex-mcp-server/README.md#🛠️-mcp-工具详解)
- **实战示例**: [实战示例](mcp/codex-mcp-server/README.md#📖-实战示例)
- **安全策略配置**: [安全策略说明](mcp/codex-mcp-server/README.md#⚙️-高级配置)
- **故障排除**: [故障排除指南](mcp/codex-mcp-server/README.md#🆘-故障排除)
- **Codex rMCP 集成**:
  [关于 Codex rMCP](mcp/codex-mcp-server/README.md#🔗-关于-codex-rmcp-支持)
- **[Codex 0.44 兼容指南](docs/architecture/mcp-integration.md)**

> 说明：`auto` 子命令目前处于规划阶段，示例与 PRD 请见
> `docs/mvp/mvp10`、`docs/user/auto.md`；稳定可用的方案请优先使用 `orchestrate`
> 与 MCP 工具集。

## 🛠️ 开发

### 项目结构

```
codex-father/
├── core/
│   ├── approval/          # 审批系统
│   │   ├── policy-engine.ts
│   │   ├── terminal-ui.ts
│   │   └── tests/
│   ├── cli/              # CLI 命令
│   │   ├── commands/
│   │   │   └── mcp-command.ts
│   │   └── tests/
│   ├── mcp/              # MCP 协议实现
│   │   ├── server.ts
│   │   ├── bridge-layer.ts
│   │   ├── event-mapper.ts
│   │   └── tests/
│   ├── process/          # 进程管理
│   │   ├── manager.ts
│   │   └── tests/
│   ├── session/          # 会话管理
│   │   ├── session-manager.ts
│   │   ├── event-logger.ts
│   │   └── tests/
│   └── lib/              # 共享类型和工具
│       └── types.ts
├── tests/
│   ├── contract/         # MCP 契约测试
│   ├── integration/      # 集成测试
│   └── benchmark/        # 性能测试
├── docs/                 # 文档
│   └── mcp-integration.md
└── specs/                # 设计规范
    └── 005-docs-prd-draft/
```

### 开发工具

```bash
# 类型检查
npm run typecheck

# 代码检查
npm run lint
npm run lint:check

# 格式化
npm run format
npm run format:check

# 完整检查
npm run check:all

# 分模块检查
npm run check:core              # 仅 core/src 代码 + 单元测试
npm run check:mcp               # 仅 MCP 子包 lint + mcp-* 集成测试
npm run test:unit:core          # 只跑 tests/unit 下用例
npm run test:integration:mcp    # 只跑 mcp 相关集成测试
```

### 快速校验与缓存策略（推荐工作流）

为加速本地开发，提供“快路径”与自动缓存守卫：

- 快速全套检查（自动守卫 + 并行 + 智能测试）
  - `npm run check:all:fast`
  - 适用：日常开发提交前；自动检测配置/依赖变化并清理缓存；并行执行 typecheck/lint/format；测试仅跑与改动相关用例（自动回退全量）。

- 并行的全量检查（自动守卫 + 并行 + 全量测试）
  - `npm run check:all:parallel`
  - 适用：需要全量测试但希望缩短墙钟时间的场景。

- CI/发版路径（稳健、顺序执行）
  - `npm run check:all`
  - 现在也已内置“自动缓存守卫”，在执行前检测关键配置与依赖指纹变化并清理缓存，确保结果可靠。

- 手动触发缓存清理（通常无需使用）
  - `npm run clean:caches`
  - 强制清理 ESLint/TS/Vitest 相关缓存；遇到跨大分支切换、工具链升级或异常时可使用。

说明与原理：

- 自动缓存守卫 `scripts/cache-guard.mjs`
  会读取以下文件并计算指纹：`package.json`、`package-lock.json`、`eslint.config.js`、`tsconfig*.json`、`vitest.config.ts`、`.prettierignore`、`.prettierrc`，以及关键工具版本（eslint/@typescript-eslint/tsc/vitest/prettier）。
- 指纹变化时会自动清理：`.cache/eslint/`、`.tsbuildinfo*`、`node_modules/.vite/`、`coverage/`、`.nyc_output/`、`vitest-temp/`。
- 智能测试 `scripts/test-smart.sh` 会检测 `git diff HEAD` 的改动文件，优先执行
  `vitest related <files...>`，无法判定时回退全量 `vitest run`。

### Git Hook（提交前自动校验）

项目已配置 Husky 的 `pre-commit` 钩子，在每次提交前自动执行：

- `lint-staged`：仅对暂存区文件执行 ESLint/Prettier 修复与校验；
- `npm run check:all:fast`：自动缓存守卫 + 并行检查 + 智能测试；不通过将阻止提交。
  - 若变更不涉及 `core/`、`src/`、`tests/`，智能测试将跳过执行以提升提交速度。

使用说明：

- 安装 Husky：执行一次 `npm install` 会触发 `npm run prepare` 自动安装 Git
  hooks；如无效运行 `npx husky install`。
- 跳过钩子（不推荐）：`git commit -m "msg" --no-verify`
- 本地复现钩子逻辑：`npm run check:all:fast`

### 调试

#### 使用 MCP Inspector

```bash
# 启动 Inspector (自动打开浏览器)
npx @modelcontextprotocol/inspector npm run mcp:start
```

#### 使用 VS Code

`.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug MCP Server",
  "program": "${workspaceFolder}/core/cli/start.ts",
  "args": ["mcp", "--debug"],
  "env": {
    "NODE_ENV": "development"
  }
}
```

## 🧪 测试

### 运行测试

```bash
# 所有测试
npm test

# 单元测试
npm run test:run

# 集成测试
npm test -- tests/integration/

# 契约测试
npm test -- tests/contract/

# 覆盖率报告
npm run test:coverage

# 监听模式
npm run test:watch
```

### 测试覆盖

- **单元测试**: 147 个测试用例
  - PolicyEngine: 68 tests ✅
  - TerminalUI: 46 tests ✅
  - EventLogger: 16 tests ✅
  - ConfigPersister: 17 tests ✅

- **集成测试**: 30 个测试用例
  - MVP1 基本流程: 12 tests ✅
  - 审批机制: 18 tests ✅

- **总覆盖率**: > 90%

### 性能基准

```bash
# 运行基准测试
npm run benchmark

# 预期指标:
# - MCP 响应时间: < 500ms
# - 事件通知延迟: < 100ms
# - 内存使用: < 100MB
```

## 📚 文档

### 🚀 新手必读（开箱即用）

1. **[⚡ 5分钟快速开始](docs/user/quick-start.md)** - 最快的上手方式 ⭐
   **强烈推荐**
2. **[📦 安装指南](docs/user/installation.md)** - 详细安装步骤和系统要求
3. **[⚙️ 配置指南](docs/user/configuration.md)** - 配置 Claude
   Desktop/Code/Codex CLI
4. **[🚀 首次运行测试](docs/user/first-run.md)** - 10 个测试验证所有功能

### 📖 完整文档导航

- **[📚 文档总入口](docs/README.md)** - 所有文档的导航中心

- 环境变量参考与清单：
  - 人类可读版: [环境变量参考](docs/environment-variables-reference.md)
  - 机器可读版: [JSON](docs/environment-variables.json),
    [CSV](docs/environment-variables.csv)

**按类别浏览**：

- [👤 用户文档](docs/user/README.md) - 使用指南、场景化应用、故障排除
- [🔧 开发文档](docs/developer/README.md) - 开发环境、技术栈、贡献指南
- [🏗️ 架构文档](docs/architecture/README.md) - 系统架构、MCP 集成、API 参考
- [🚀 运维文档](docs/operations/README.md) - 部署指南、运维手册
- [📋 版本发布](docs/releases/README.md) - 发布说明、变更日志

**按角色导航**：

- **第一次使用**：[快速开始](docs/user/quick-start.md) →
  [首次测试](docs/user/first-run.md) → [使用场景](docs/user/use-cases/README.md)
- **开发者**：[开发指南](docs/developer/DEVELOPMENT.md) →
  [架构概览](docs/architecture/overview.md) →
  [贡献指南](docs/developer/contributing.md)
- **运维人员**：[部署指南](docs/operations/DEPLOY.md) →
  [配置指南](docs/user/configuration.md) →
  [故障排除](docs/user/troubleshooting.md)

## 🤝 贡献

欢迎贡献！请遵循以下原则:

1. **SOLID 原则**: 保持代码模块化和可测试
2. **类型安全**: 使用完整的 TypeScript 类型
3. **测试覆盖**: 新功能必须包含测试
4. **文档完整**: 更新相关文档

### 提交 Pull Request

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 开发规范

- 使用 [Conventional Commits](https://www.conventionalcommits.org/)
- 遵循 ESLint 和 Prettier 配置
- 所有测试必须通过 (`npm run check:all`)

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP 协议规范
- [Codex CLI](https://github.com/anthropics/codex) - Anthropic Codex 命令行工具
- [TypeScript](https://www.typescriptlang.org/) - 类型安全的 JavaScript 超集
- [@modelcontextprotocol/sdk](https://www.npmjs.com/package/@modelcontextprotocol/sdk) -
  MCP TypeScript SDK

## 📮 联系

- Issues: [GitHub Issues](https://github.com/yourusername/codex-father/issues)
- 文档: [GitHub Wiki](https://github.com/yourusername/codex-father/wiki)

---

**Built with ❤️ by the Codex Father Team**

## 🗺️ Roadmap

- 006 — Multi‑Agent Orchestration（多代理编排，进行中）
  - CLI：`orchestrate` 命令（`core/cli/commands/orchestrate-command.ts`）
  - 最大并发 ≤ 10，任务超时与成功阈值
  - SWW 两阶段写入：补丁生成 → 串行应用 → 快速校验
  - 事件流遵循
    `docs/schemas/stream-json-event.schema.json`（若缺工具则标记失败）
  - 依赖 `uuid`，命令退出条件：成功率 ≥ 阈值且无 `patch_failed`

如需完整规范与进度，请参见：`specs/006-docs-capability-assessment/*`。

## 💡 使用场景

Codex Father 可以帮您：

- **代码审查** - 自动识别代码质量问题、类型安全、错误处理
- **重构优化** - 发现重复代码，提供重构建议
- **文档生成** - 自动生成 API 文档、使用说明
- **测试生成** - 自动生成单元测试、集成测试
- **Bug 修复** - 快速定位并修复问题
- **性能优化** - 识别性能瓶颈，提供优化方案

查看 **[15+ 场景化使用示例](docs/user/use-cases/examples.md)** 了解更多。

## 📦 发布

- 完整流程：`docs/releases/RELEASE_FLOW_MCP.md`
- 本次版本说明：`docs/releases/VERSION_MCP_1.2.0.md`
- 一键脚本：`scripts/release-mcp.sh`（支持 `--preflight` / `--dry-run` /
  `--local` / `--ci` / `--ci-commit-docs`）
- npm/npx 验证流程：
  1. `npm pack`，确认生成的 `codex-father-*.tgz` 内包含 `start.sh`、`job.sh` 与
     `lib/`（可 `tar -tf` 检查）
  2. 在空目录执行 `npm init -y && npm install /path/to/codex-father-*.tgz`
  3. 运行
     `npx codex-father start --help`，若可正常输出帮助信息即表示包内脚本可被分发与调用
  4. 可选：设置 `CODEX_START_SH`/`CODEX_JOB_SH`
     指向自定义路径再次运行，验证环境变量覆盖是否生效

### 📊 日志摘要（v1.7 新增）

- 基于 events.jsonl 生成会话摘要：

```bash
# 适用于 start/job 会话
node dist/core/cli/start.js logs:summary <sessionId> --text
# 或写入 <session>/report.summary.json
node dist/core/cli/start.js logs:summary <sessionId>
```

- 就地多会话统计：

```bash
# 单会话
node dist/core/cli/start.js logs <sessionId> --summary
# 多会话（逗号分隔）
node dist/core/cli/start.js logs id1,id2,id3 --summary
# 全部会话（在当前会话根下）
node dist/core/cli/start.js logs all --summary
```

会话根目录可通过环境变量配置：`CODEX_SESSIONS_ROOT`（或
`CODEX_SESSIONS_HOME`）。默认为 `.codex-father/sessions`；如需兼容历史数据，可将
`.codex-father-sessions/` 建立为指向新根的软链。

### 🧪 快速健康检查（validate-session）

当你需要确认某个会话是否“首尾闭合、结构完整”，可运行：

```bash
scripts/validate-session.sh /abs/path/to/.codex-father/sessions/<sessionId>
```

它会检查：

- `events.jsonl` 是否包含成对的 `start` 与 `orchestration_completed` 事件；
- `state.json` 是否处于最终状态（completed/failed/cancelled）。
