# Codex 0.44 兼容性与使用指南

本文档面向 codex-father MCP 服务器用户，说明在 Codex
0.42 与 0.44 环境下的使用方法、兼容性与常见问题排查。内容与项目 specs 的 quickstart 与 research 文档保持一致，可直接复制粘贴执行。

## 使用指南（Getting Started）

### 1.1 启动 MCP 服务器

- 安装依赖：
  ```bash
  npm install
  # 如本地首次构建或更新后建议编译
  npm run build
  ```
- 启动命令：
  ```bash
  npm run mcp:start
  # 或
  npm start
  ```
- 调试模式（MCP Inspector）：
  ```bash
  npx @modelcontextprotocol/inspector npm run mcp:start
  ```
- 配置位置：无需额外配置文件；使用项目根目录运行即可。

### 1.2 配置 Claude Desktop / Codex

- 配置文件位置：
  - Claude
    Desktop（macOS）：`~/Library/Application Support/Claude/claude_desktop_config.json`
  - Codex CLI：`~/.codex/config.toml`

- MCP 服务器注册示例（Claude Desktop）：

  ```json
  {
    "mcpServers": {
      "codex-father": {
        "command": "npm",
        "args": ["run", "mcp:start"],
        "cwd": "/path/to/codex-father"
      }
    }
  }
  ```

- Codex CLI rMCP 注册（可选）：

  ```toml
  [mcp_servers.codex-father]
  command = "npm"
  args = ["run", "mcp:start"]
  ```

- Codex Profile 配置（针对 gpt-5-codex，0.44 支持的推理配置）：

  ```toml
  [profiles.codex-father]
  model = "gpt-5-codex"
  # 关键：推理模型必须使用 responses Wire API，避免 405
  [profiles.codex-father.model_providers.openai]
  wire_api = "responses"

  # 可选（Codex 0.44 新特性）：
  # 推荐使用清晰的 0.44 字段名
  model_reasoning_effort = "high"  # 推理力度：minimal/low/medium/high
  ```

### 1.3 验证安装

- 使用 MCP 方法 `start-codex-task` 快速验收：
  - 方式一：Claude Desktop 连接后在对话中触发；
  - 方式二：MCP Inspector 连接后在工具列表调用。
- 版本检测：codex-father 会自动检测 Codex 版本（0.42 或 0.44），启动日志会打印检测结果。
- 查看日志与工件：`.codex-father/sessions/<id>/` 目录下包含 JSONL 事件与元数据。

## 版本兼容性说明（Compatibility Matrix）

### 2.1 0.42 vs 0.44 功能对比

| 功能                             | Codex 0.42 | Codex 0.44 | codex-father 支持 |
| -------------------------------- | ---------- | ---------- | ----------------- |
| 基础会话管理                     | ✓          | ✓          | ✓（向后兼容）     |
| `newConversation`                | ✓          | ✓          | ✓                 |
| `sendUserMessage`                | ✓          | ✓          | ✓                 |
| `sendUserTurn`                   | ✗          | ✓          | ✓（0.44 only）    |
| Profile 参数（`profile`）        | ✗          | ✓          | ✓（自动检测）     |
| Reasoning 配置（effort/summary） | ✗          | ✓          | ✓（自动检测）     |
| HTTP 405 错误格式化              | ✗          | ✓          | ✓（增强诊断）     |
| 版本自动检测                     | N/A        | N/A        | ✓（codex-father） |

说明：推理相关能力在 Codex 0.44 通过 `sendUserTurn` 支持（如 `effort: "high"`,
`summary: "always"`）。

### 2.2 版本自动检测机制

- 自动检测 Codex 版本（0.42 或 0.44），并启用相应兼容模式。
- 检测逻辑：
  1. 调用 `codex --version` 解析语义化版本；
  2. 在需要时探测 `sendUserTurn` 能力（仅 0.44 支持）；
  3. 根据结果自动切换兼容模式与参数过滤。
- 性能与缓存：首次检测 < 1s，进程内缓存后续 < 100ms。
- 降级策略：0.44 特性在 0.42 上自动禁用或在 MCP 层返回标准错误。

### 2.3 功能降级说明

- Codex 0.42 环境：
  - ✗ 不支持 `sendUserTurn`（回退到 `sendUserMessage` 流程）
  - ✗ 不支持 `profile` 参数（MCP 层报 `Invalid params`）
  - ✗ 不支持 Reasoning 配置（忽略 `model_reasoning_effort` 等字段）
  - ✓ 基础会话功能正常（`newConversation`/`sendUserMessage`）
- Codex 0.44 环境：
  - ✓ 全功能支持
  - ✓ 增强错误诊断（尤其 405 错误的上下文与修复建议）

## 故障排除（Troubleshooting）

### 3.1 HTTP 405：Method Not Allowed

问题示例：

```
POST /v1/... returned 405: Method Not Allowed
```

常见原因：

1. 模型与 Wire API 组合不兼容
   - 例如：`model = "gpt-5-codex"` + `wire_api = "chat"`（错误）
   - 正确：`model = "gpt-5-codex"` + `wire_api = "responses"`（✓）
2. Profile 配置缺失或不正确（遗漏 `wire_api` 或模型名拼写错误）

解决方案：

- 自动修复（推荐）：
  ```bash
  # codex-father 会检测到不安全组合并引导创建修复用 Profile
  # 按提示选择 "创建 codex-father-auto-fix profile"
  ```
  生成的 Profile 示例：
  ```toml
  [profiles.codex-father-auto-fix]
  # Auto-fixed by codex-father: gpt-5-codex requires wire_api = "responses"
  model = "gpt-5-codex"
  [profiles.codex-father-auto-fix.model_providers.openai]
  wire_api = "responses"
  # 可选（0.44）：
  model_reasoning_effort = "high"
  ```
- 手动修复：编辑 `~/.codex/config.toml`：
  ```toml
  [profiles.default]
  model = "gpt-5-codex"          # 确保模型名称正确
  [profiles.default.model_providers.openai]
  wire_api = "responses"         # 推理模型必须使用 responses
  # 可选（0.44）：
  model_reasoning_effort = "high"
  ```

### 3.2 版本检测失败

问题示例：

```
Failed to detect Codex version: Command not found
```

原因排查：

- Codex CLI 未安装或不在 PATH 中
- Codex CLI 执行权限问题

解决步骤：

1. 验证安装
   ```bash
   which codex
   codex --version
   ```
2. 检查 PATH 环境变量
   ```bash
   echo $PATH | grep codex || true
   ```
3. 重新安装 Codex CLI（参考官方说明）
4. 临时措施：codex-father 在 MCP 方法调用时会自动降级并给出兼容模式提示

### 3.3 配置验证错误

问题示例：

```
Config validation failed: Invalid model/wire_api combination
```

常见原因：

- TOML 语法错误或缺少必需字段
- 模型与 `wire_api` 不匹配（如 `gpt-5-codex` 未设置 `responses`）

解决方案：

- 使用交互式修复（推荐）：codex-father 提供 3 个选项
  1. 创建新 Profile（推荐）
  2. 修改现有 Profile
  3. 临时覆盖（单次运行）
- 验证配置语法：
  ```bash
  # 如有 TOML 校验工具，可用于检查
  cat ~/.codex/config.toml | toml-verify
  ```
- 参考示例：见项目根目录 `README.md` 与本页配置示例

### 3.4 MCP 方法不可用

问题示例：

```
Method 'start-codex-task' not found
```

原因排查：

- MCP 服务器未正确启动
- 客户端配置错误或未连接当前工作目录
- MCP 协议/SDK 版本不匹配

解决步骤：

1. 检查 MCP 服务器状态：
   ```bash
   npm run mcp:start
   ```
2. 验证 MCP SDK 版本：
   - codex-father 使用 `@modelcontextprotocol/sdk` ^1.18.x
   - 确保 Claude Desktop 或 Inspector 版本兼容
3. 使用 MCP Inspector 调试：
   ```bash
   npx @modelcontextprotocol/inspector npm run mcp:start
   # 在浏览器中查看可用方法与工具列表（应包含 start-codex-task）
   ```
4. 重启客户端：修改配置后需重启 Claude Desktop 以加载新配置

---

附注与一致性说明：

- 所有命令与配置样例均参考并对齐 `specs/008-ultrathink-codex-0/quickstart.md` 与
  `specs/008-ultrathink-codex-0/research.md`。
- 推理相关配置在 Codex 0.44 环境下生效：配置层使用
  `model_reasoning_effort`，调用层通过 `sendUserTurn` 的 `effort/summary` 控制。
- 日志与会话工件位于 `.codex-father/sessions/<id>/`，便于回溯与诊断。
