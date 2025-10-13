# 🧭 Codex Father 用户使用手册（零基础友好）

> 面向“非开发者/轻技术”用户：手把手教你安装、配置、使用与排错。
> 你可以把 Codex Father 理解为“一个能帮你在电脑里完成任务的小助手”。
>
> 如果你只想最快开始，用“3 步快走”章节即可；想系统了解，请从流程图开始。

---

## 一图看懂：从安装到得到结果

```mermaid
flowchart TD
  A[准备工具] --> B[安装 MCP 服务器]
  B --> C[配置客户端 (Claude Desktop/Code 或 Codex CLI)]
  C --> D[启动 codex-mcp-server]
  D --> E[在客户端发出请求 (如“列文件”)]
  E --> F[Codex Father 执行任务]
  F --> G[返回结果与日志]
  G --> H{满意吗?}
  H -- 是 --> I[保存设置, 下次直接用]
  H -- 否 --> J[查看日志与提示, 调整配置后重试]
```

小比喻：把 Codex Father 当“万能电工”。你先把电源（安装）和开关（配置）接好，然后说“请开这盏灯”（发出任务），它就去把灯点亮（执行并返回结果）。

---

## 3 步快走（5 分钟）

1) 安装（推荐全局）

```bash
npm install -g @starkdev020/codex-father-mcp-server
```

2) 准备目录并启动服务器（保持窗口不关）

```bash
export CODEX_RUNTIME_HOME="$HOME/.codex-father-runtime"
export CODEX_SESSIONS_HOME="$HOME/.codex-father-sessions"
mkdir -p "$CODEX_RUNTIME_HOME" "$CODEX_SESSIONS_HOME"

CODEX_MCP_PROJECT_ROOT="$CODEX_RUNTIME_HOME" \
CODEX_SESSIONS_ROOT="$CODEX_SESSIONS_HOME" \
codex-mcp-server --transport=ndjson
```

3) 配置并测试客户端（选其一）

- Claude Desktop：在配置里加入名为 `codex-father` 的服务器（见“详细操作”）。
- Codex CLI（rMCP）：在 `~/.codex/config.toml` 添加服务器配置。

打开客户端后发一句：“请列出项目里的 .md 文件” → 能看到列表即成功 ✅

---

## 详细操作（手把手）

### A. 安装

你只需要 Node.js ≥ 18。

- 全局安装（推荐）：`npm install -g @starkdev020/codex-father-mcp-server`
- 升级：`npm update -g @starkdev020/codex-father-mcp-server`
- 卸载：`npm uninstall -g @starkdev020/codex-father-mcp-server`

### B. 启动服务器

创建并使用“用户级”目录（避免污染你的项目）：

```bash
export CODEX_RUNTIME_HOME="$HOME/.codex-father-runtime"
export CODEX_SESSIONS_HOME="$HOME/.codex-father-sessions"
mkdir -p "$CODEX_RUNTIME_HOME" "$CODEX_SESSIONS_HOME"

CODEX_MCP_PROJECT_ROOT="$CODEX_RUNTIME_HOME" \
CODEX_SESSIONS_ROOT="$CODEX_SESSIONS_HOME" \
codex-mcp-server --transport=ndjson
```

看到提示“等待 MCP 客户端请求 …”代表服务器已就绪。

### C. 配置客户端（两种常见）

1) Claude Desktop（图形界面）

- 打开配置文件：
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- 添加配置（把绝对路径改为你自己的路径）：

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "npx",
      "args": ["-y", "@starkdev020/codex-father-mcp-server", "--transport=ndjson"],
      "env": {
        "CODEX_MCP_PROJECT_ROOT": "/ABS/PATH/TO/.codex-father-runtime",
        "CODEX_SESSIONS_ROOT": "/ABS/PATH/TO/.codex-father-sessions"
      }
    }
  }
}
```

- 完全退出并重启 Claude Desktop
- 验证：右下角“齿轮/工具”里能看到 `codex-father` 且状态“已连接”。

2) Codex CLI（rMCP）

- 编辑 `~/.codex/config.toml`：

```toml
[mcp_servers.codex-father]
command = "npx"
args = ["-y", "@starkdev020/codex-father-mcp-server", "--transport=ndjson"]
env.CODEX_MCP_PROJECT_ROOT = "/ABS/PATH/TO/.codex-father-runtime"
env.CODEX_SESSIONS_ROOT = "/ABS/PATH/TO/.codex-father-sessions"
startup_timeout_sec = 60
tool_timeout_sec = 180
```

- 运行 `codex`，在对话里说“列出 .md 文件”，看到列表即成功。

---

## 第一次使用（2 个简易测试）

- 测试 1：连接
  - 说：“请列出当前目录的 .md 文件”。
  - 预期：返回一个 Markdown 文件清单 ✅

- 测试 2：创建文件
  - 说：“请创建 hello.txt，内容为 Hello, Codex Father!”。
  - 预期：返回“创建成功”，目录里能看到 `hello.txt` ✅

遇到问题？见“排错指南”。

---

## 实时查看与订阅（只读 HTTP/SSE 与批量查询）

- 标准输出（stdout）在 `--output-format stream-json` 下严格两行事件（`start` / `orchestration_completed`）。
- 详细事件落盘：`.codex-father/sessions/<id>/events.jsonl`。
- 若需要“实时进度/剩余时间/当前任务”的订阅视图，不破坏两行契约：

```bash
# 启动只读 HTTP/SSE 服务（默认 0.0.0.0:7070）
node bin/codex-father http:serve --port 7070

# 查询状态
curl http://127.0.0.1:7070/api/v1/jobs/<jobId>/status | jq

# 订阅事件（SSE），支持 fromSeq 断点续订
curl -N http://127.0.0.1:7070/api/v1/jobs/<jobId>/events?fromSeq=0
```

- 新事件类型：`plan_updated`（计划步数变化）、`progress_updated`（进度变化）、`checkpoint_saved`（检查点记录）。
- `status --json` 现包含：
  - `progress{current,total,percentage,currentTask,eta*,estimatedTimeLeft}`
  - `resource_usage{tokens,tokensUsed,apiCalls,filesModified}`（`apiCalls` 来自 `events.jsonl` 中 `tool_use` 计数，`filesModified` 来自 `patches/manifest.jsonl`）
  - `checkpoints[]`（含 `error`、`durationMs`、`context` 字段，详见 Schema）

批量查询（只读）：

```bash
node bin/codex-father bulk:status job-1 job-2 --json
```

更多细节：`docs/operations/sse-endpoints.md` 与 `docs/operations/bulk-cli.md`。

程序化 Bulk API（Node）：

无需逐个调用 `codex_status`，可用 SDK 一次性处理多个 Job：

```ts
import {
  codex_bulk_status,
  codex_bulk_stop,
  codex_bulk_resume,
} from 'codex-father/dist/core/sdk/bulk.js';

// 批量查询（默认直接读取 state.json；传 refresh: true 将先调用 job.sh status）
const status = await codex_bulk_status({ jobIds: ['job-1','job-2'], repoRoot: process.cwd() });

// 批量停止（默认 dry-run；execute: true 才执行）
const stopPreview = await codex_bulk_stop({ jobIds: ['job-1','job-2'], repoRoot: process.cwd() });
const stopExec = await codex_bulk_stop({ jobIds: ['job-1','job-2'], repoRoot: process.cwd(), execute: true });

// 批量恢复（支持 resumeFrom/skipCompleted）
const resumePreview = await codex_bulk_resume({ jobIds: ['job-3'], repoRoot: process.cwd() });
const resumeExec = await codex_bulk_resume({ jobIds: ['job-3'], repoRoot: process.cwd(), execute: true, resumeFrom: 7 });
```

更多示例：`docs/operations/bulk-sdk.md`。

### 恢复策略（codex.resume）

在 MCP/CLI 中使用“按检查点继续”或“从指定步恢复”：

- MCP：`codex.resume` 支持 `strategy`、`resumeFrom`/`resumeFromStep`、`skipCompleted`、`reuseArtifacts`
- CLI：`job.sh resume <jobId> [--strategy full-restart|from-last-checkpoint|from-step] [--resume-from N] [--skip-completed] [--reuse-artifacts|--no-reuse-artifacts]`

Checkpoint 记录扩展：当本轮失败时将写入 `error` 简要原因，并记录 `durationMs`（ms）。

---

## 常见任务示例（直接复制即可）

- 查看某个任务的日志（已知 jobId）
  - 说：“请查看任务 cdx-2025… 的日志，按最新 50 行返回”。

- 停止执行中的任务
  - 说：“请停止任务 cdx-2025…（不要强制）”。如果还在运行，再补一句“强制停止”。

- 启动一个较长命令并后台跟踪
  - 说：“请用 codex.start 执行 ‘npm run lint’，并告诉我 jobId”。
  - 再说：“用 codex.logs 跟随该 jobId 的日志输出（按行模式）”。

- 运行编排示例（适合有样例文件的仓库）
  - 命令行输入：

```bash
node dist/core/cli/start.ts orchestrate "演练主路径 FR-123" \
  --mode manual \
  --tasks-file core/cli/tests/fixtures/manual.tasks.json \
  --output-format stream-json
```

---

## 排错指南（简单有效）

- 看不到服务器？
  - 确认 `codex-mcp-server` 已启动且窗口未关闭。
  - Windows/macOS 上路径要改成绝对路径（不要留 ~）。

- 提示“权限/审批”相关？
  - 这是安全保护。若你只想少打扰，可选择“on-failure”（仅失败时再确认）。

- 无法联网？
  - 默认网络受限。需要联网时，请在任务/会话里按使用指南启用联网（由维护者配置）。

- 日志在哪？
  - 目录：`.codex-father/sessions/<session-id>/`
  - 关键文件：`events.jsonl`（事件流）、`job.log`（执行日志）。

### 日志摘要（v1.7 新增）

> 把厚厚的“流水账”压成一页“体检报告”。适合快速定位状态、耗时与失败计数。

- 生成单会话摘要（并以文本预览关键字段）：

```bash
node dist/core/cli/start.js logs:summary <sessionId> --text
```

- 生成单会话摘要（写入 `<session>/report.summary.json`）：

```bash
node dist/core/cli/start.js logs:summary <sessionId>
```

- 就地预览多会话/全部会话（按 `status/exit/successRate` 汇总）：

```bash
node dist/core/cli/start.js logs id1,id2 --summary
node dist/core/cli/start.js logs all --summary
```

说明：会话根目录可通过 `CODEX_SESSIONS_ROOT`（或兼容的 `CODEX_SESSIONS_HOME`）覆盖；默认为 `.codex-father/sessions`。

### 恢复“合成指令”全文回显（降噪可控）

> 默认仅记录指令的“指纹”（`instructions_updated` 事件含 path/sha256/行数等）；如需在 `job.log` 中看到合成指令全文，可按需开启。

- 运行前导出变量（示例：完全不截断）：

```bash
export CODEX_ECHO_INSTRUCTIONS=1
export CODEX_ECHO_INSTRUCTIONS_LIMIT=0  # 0 表示不截断
```

- 或在 CLI 透传等价选项：`--echo-instructions --echo-limit 0`

注意：自 v1.7 起，默认不再回显全文（更安静、更安全）。当前默认值以源码为准：

- `CODEX_ECHO_INSTRUCTIONS=0`
- `CODEX_ECHO_INSTRUCTIONS_LIMIT=120`

- 彻底重置（遇到异常时使用）
  - 关闭客户端与服务器 → 删除 `~/.codex-father-*` 相关临时目录 → 重新“3 步快走”。

---

## 常见问答（FAQ）

- Q：我不会写命令，能直接说人话吗？
  - A：可以。直接说“请把 A 文件复制为 B”或“请列出 .md 文件”。必要时助手会自动调用工具完成。

- Q：可以只在一个项目里使用吗？
  - A：可以。把 `CODEX_MCP_PROJECT_ROOT` 设为项目内的 `.codex-father-runtime` 目录即可。

- Q：如何更新到新版本？
  - A：执行 `npm update -g @starkdev020/codex-father-mcp-server`。

---

## 附录：命令小抄

- 启动服务器：`codex-mcp-server --transport=ndjson`
- 导出 API 文档（在项目内）：`npm run docs:api`
- 运行测试（在项目内）：`npm test`

---

如果你还有问题，建议先看“排错指南”，仍未解决就到 GitHub 提 Issue。祝使用顺利！
