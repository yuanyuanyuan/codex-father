# MCP 服务器 (`mcp`)

该目录包含了 `codex-father` 的 MCP (Model Context
Protocol) 服务器的实现。它负责处理来自 MCP 客户端的请求，并将其转换为对 Codex
CLI 的调用。

## 目录结构

- `protocol/`: 定义了 MCP 协议中使用的数据结构和类型。
- `tests/`: 包含了 MCP 模块的单元测试。
- `bridge-layer.ts`: 实现了一个桥接层，用于在 MCP 协议和底层的 Codex
  CLI 工具之间进行转换。
- `codex-client.ts`: 实现了一个与 Codex CLI 交互的客户端。
- `event-mapper.ts`: 负责将 Codex CLI 的事件映射到 MCP 事件。
- `server.ts`: 实现了 MCP 服务器，负责监听和处理来自客户端的请求。
