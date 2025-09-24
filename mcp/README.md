MCP servers in this repo

- TypeScript server: `mcp/codex-mcp-server` (invoked via `mcp/server.sh`)
  - Built with `@modelcontextprotocol/sdk`
  - Exposes standard MCP Tools endpoints (tools/list, tools/call)
  - Tools: `codex.start`, `codex.status`, `codex.logs`, `codex.stop`, `codex.list`
  - Publishable to npm as `codex-father-mcp-server`
  - Requires Node.js >= 18
