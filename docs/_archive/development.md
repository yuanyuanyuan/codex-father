### 开发指南（MCP/脚本）

- 代码结构
  - `start.sh` / `job.sh`：Bash 脚本，尽量保持“薄封装、默认安全”
  - `lib/`：通用函数；新增功能优先复用/扩展
  - `mcp/codex-mcp-server`：TypeScript MCP 服务器（基于 @modelcontextprotocol/sdk）

- 开发环境
  - Node.js >= 18、TypeScript 5、npm
  - 推荐：`nvm` 管理 Node 版本

- MCP（TS）开发
  - 进入目录：`cd mcp/codex-mcp-server`
  - 安装依赖：`npm install`
  - 开发运行：`npm run dev`（基于 tsx）
  - 构建产物：`npm run build`（输出到 `dist/`）
  - 入口文件：`src/index.ts`（使用 SDK 的 Server + StdioServerTransport）
  - 工具扩展：
    - 在 `tools/list` 中声明工具及 `inputSchema`
    - 在 `CallToolRequest` 分支中实现具体逻辑（与 `job.sh` 对接）

- CLI 命令（TypeScript 实现）
  - `codex-father task <action>`：创建/列出/查询/取消/重试任务，自动管理 `.codex-father/queue/` 目录结构，支持 `--json` 输出。
  - `codex-father config <action>`：初始化与维护配置数据，支持点号键访问、环境隔离、`--secure` 加密写入（依赖 `CODEX_CONFIG_SECRET`）与 `--reveal` 解密查看，默认 JSON/文本输出。
  - `codex-father status`：查看 CLI 与任务队列健康度、性能基线及 legacy 脚本检测结果。

- Bash 脚本规范
  - 开头必须：`#!/usr/bin/env bash` + `set -euo pipefail`
  - 错误输出统一到 stderr
  - 兼容 Linux/macOS 常见工具（`grep -E`、`sed -E`、`awk` 等）
  - 遵循 `AGENTS.md` 中的约束（STDIN 仅出现一次等）
