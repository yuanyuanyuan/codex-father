# ⚡ 5分钟快速开始

> **目标**：让您在 5 分钟内完成 Codex Father 的安装、配置和第一次使用测试。

> 一键试跑（最短路径）：
>
> - 复制配置模板：`cp config/templates/codex-father.config.example.yaml ./codex-father.config.yaml`
> - 执行主路径演练：`codex-father orchestrate "演练主路径 FR-123" --mode manual --tasks-file core/cli/tests/fixtures/manual.tasks.json --output-format stream-json`
> - 查看报告摘要：`codex-father orchestrate:report --path .codex-father/sessions/<id>/report.json`

## 📋 您将学到

- [x] 安装 Codex Father
- [x] 配置你的第一个客户端（推荐 Claude Desktop）
- [x] 运行第一个测试
- [x] 验证配置成功

---

## 🚀 步骤 1：安装（2分钟）

### 方式 A：用户级部署（推荐，最稳妥）

```bash
# 1. 安装一次（建议全局安装）
npm install -g @starkdev020/codex-father-mcp-server

# 2. 准备独立目录（也可按项目自定义）
export CODEX_RUNTIME_HOME="$HOME/.codex-father-runtime"
export CODEX_SESSIONS_HOME="$HOME/.codex-father-sessions"
mkdir -p "$CODEX_RUNTIME_HOME" "$CODEX_SESSIONS_HOME"

# 若希望在项目内维护独立副本，可跳过上述 export，直接在配置里写入项目路径，例如：
# env.CODEX_MCP_PROJECT_ROOT = "/path/to/project/.codex-father"
# env.CODEX_SESSIONS_ROOT = "/path/to/project/.codex-father/sessions"
# 并提前在该项目目录执行：
#   mkdir -p .codex-father/sessions

# 3. 启动服务器（默认 NDJSON 传输）
CODEX_MCP_PROJECT_ROOT="$CODEX_RUNTIME_HOME" \
CODEX_SESSIONS_ROOT="$CODEX_SESSIONS_HOME" \
codex-mcp-server --transport=ndjson
```

**验证**：若看到服务器横幅并提示“等待 MCP 客户端发送 initialize 请求…”，即表示安装成功。

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
      "args": ["-y", "@starkdev020/codex-father-mcp-server", "--transport=ndjson"],
      "env": {
        "CODEX_MCP_PROJECT_ROOT": "/ABS/PATH/TO/.codex-father-runtime",
        "CODEX_SESSIONS_ROOT": "/ABS/PATH/TO/.codex-father-sessions"
      }
    }
  }
}
```

> 将 `/ABS/PATH/TO/...` 替换为你的绝对路径，例如 `~/.codex-father-runtime` 与
> `~/.codex-father-sessions`（需要展开为完整路径）。

> 命名策略与环境变量：
>
> - 不同客户端对工具名（点号 vs 下划线）支持不同；Codex
>   0.44（responses）推荐仅下划线或带前缀 `cf_*`。
> - 需要自定义导出名称或前缀时，请参考：
>   - 人类可读版: ../environment-variables-reference.md#mcp-服务器typescript
>   - 机器可读版: ../environment-variables.json

**重启 Claude Desktop**：完全退出 Claude Desktop 并重新打开。

**验证配置**：

- 在 Claude Desktop 中，点击右下角的 "🔧" 图标
- 查看是否出现 "codex-father" 服务器
- 状态应该显示为 "已连接" ✅

### Codex CLI (rMCP)

> 参考 `refer-research/openai-codex/docs/config.md#mcp_servers`

1. 编辑 `~/.codex/config.toml`：

   ```toml
   # prod：使用 npx 直接运行 npm 包
   [mcp_servers.codex-father]
   command = "npx"
   args = ["-y", "@starkdev020/codex-father-mcp-server", "--transport=ndjson"]
   env.NODE_ENV = "production"
   env.CODEX_MCP_PROJECT_ROOT = "/ABS/PATH/TO/.codex-father-runtime"
   env.CODEX_SESSIONS_ROOT = "/ABS/PATH/TO/.codex-father-sessions"
   startup_timeout_sec = 60
   tool_timeout_sec = 180
   ```

2. 执行 `codex`，在会话中运行「请列出当前项目的文件」验证连通性。
3. 如需命令行管理，可使用 `codex config mcp add/list/remove`（详见官方文档）。

---

## 🧪 步骤 3：运行第一个测试（1分钟）

在 Claude Code CLI 中输入以下测试指令：

### 测试 1：连接测试

**Claude Code 中输入**：

```
请帮我列出当前项目的所有 .md 文件
```

**预期结果**：

- Claude 会调用 `codex.exec`（或等价的 `codex_exec`）工具
- 返回项目中的 Markdown 文件列表
- 如果看到文件列表，说明连接成功！✅

### 测试 2：简单任务测试

**Claude Code 中输入**：

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

更多命名/前缀相关变量详见：

- 人类可读版: ../environment-variables-reference.md#mcp-服务器typescript
- 机器可读版: ../environment-variables.json

## ✅ 验证成功标志

如果以下三个条件都满足，恭喜您配置成功！🎉

1. **客户端状态**：Claude Code CLI 中能正常调用 MCP 工具（例如
   `cf_help`/`codex_help`）
2. **测试通过**：测试 1 和测试 2 都返回了预期结果
3. **无错误**：没有出现连接错误或权限错误

---

## ❌ 如果遇到问题

### 问题 1：找不到配置文件（Claude Code）

**解决**：在项目根目录手动创建 `.claude/mcp_settings.json`

```bash
mkdir -p .claude
cat > .claude/mcp_settings.json <<'JSON'
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
JSON
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

## 🧭 Orchestrate 主路径快速演练（CLI）

> 目标：用最小手工任务文件走通“提交 → 分解 → 执行 → 写入 → 汇总”的主路径，并生成报告与事件日志。

1) 运行主路径（仅两行 stdout）

```bash
codex-father orchestrate "演练主路径 FR-123 NFR-7" \
  --mode manual \
  --tasks-file core/cli/tests/fixtures/manual.tasks.json \
  --output-format stream-json
```

- stdout 仅两行 Stream-JSON：`start` 与 `orchestration_completed`。
- 第二行中包含 `reportPath` 与 `orchestrationId`。

2) 查看报告摘要或 JSON

```bash
# 人类摘要
codex-father orchestrate:report --path .codex-father/sessions/<id>/report.json

# JSON 输出（含 metrics 与 FR/NFR 引用）
codex-father --json orchestrate:report --session-id <id>
```

3) 失败分支演练（期望 exit code=1）

```bash
codex-father orchestrate "失败分支 FR-9" \
  --mode manual \
  --tasks-file core/cli/tests/fixtures/manual.failure.tasks.json \
  --output-format stream-json \
  --success-threshold 0.95
```

> 样例任务文件：
> - 成功：`core/cli/tests/fixtures/manual.tasks.json`
> - 失败：`core/cli/tests/fixtures/manual.failure.tasks.json`

更多字段与指标说明见：`docs/user/orchestrate-report.md`。

### 复制模板 → 运行（最短路径）

1) 复制示例配置（含人工确认与理解门控映射，均可按需关闭）

```bash
cp config/templates/codex-father.config.example.yaml ./codex-father.config.yaml
```

2) 执行主路径（最小任务文件）

```bash
codex-father orchestrate "演练主路径 FR-123" \
  --mode manual \
  --tasks-file core/cli/tests/fixtures/manual.tasks.json \
  --output-format stream-json
```

3) 查看报告与建议

```bash
codex-father orchestrate:report --path .codex-father/sessions/<id>/report.json
```

若需要失败分支示例以观察“失败分类/建议摘要”，将 `--tasks-file` 替换为 `manual.failure.tasks.json` 并将 `--success-threshold` 调高至 `0.95`。

---

## 🚀 Auto 快速演练（路由 + 高质量模板）

> 目标：一条命令完成“自动模型路由 → 结构化指令（PLAN→EXECUTE）→ 执行”，采用“两行 Stream‑JSON 事件”契约，详细事件写入 JSONL。

1) 路由并执行（默认输出 JSON 摘要）

```bash
codex-father auto "重构登录模块 FR-210 NFR-7"
# stdout：JSON 摘要（默认 --output-format json）
```

2) 两行事件（适用于自动化/CI）

```bash
codex-father auto "重构登录模块 FR-210 NFR-7" --output-format stream-json
# stdout 仅两行：{"event":"start",...}\n{"event":"orchestration_completed",...}
```

3) 只看路由决策（不执行）

```bash
codex-father auto "是代码改动还是研究评审？" --route-dry-run --route-explain json
```

说明：
- auto 的补丁应用通过 SWWCoordinator 串行处理，避免与 orchestrate/外部流程竞写；取消/恢复与 orchestrate 语义一致。
- 当目标 provider 不可用或 wire_api 不匹配时，auto 会回退到 `gpt-5-codex high` 并在 JSONL 中标注 `routeFallback`。

更多示例与原理见：`docs/mvp/mvp12/README.md`。

---

## 💡 提示

- **审批策略**：首次使用时，Codex
  Father 会询问您是否批准执行命令，这是正常的安全机制
- **性能优化**：可以在配置中添加 `"approval-policy": "on-failure"` 减少审批次数
- **日志查看**：遇到问题时，可以查看 `.codex-father/logs/` 目录下的日志文件

---

**🎉 享受使用 Codex Father！如有问题，请查看 [完整文档](../README.md)
或提交 Issue。**
