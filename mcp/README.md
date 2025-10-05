MCP servers in this repo

- TypeScript server: `mcp/codex-mcp-server` (invoked via `mcp/server.sh`)
  - Built with `@modelcontextprotocol/sdk`
  - Exposes standard MCP Tools endpoints (tools/list, tools/call)
- Tools: `codex.exec`, `codex.start`, `codex.status`, `codex.logs`,
  `codex.stop`, `codex.list`, `codex.help`
- Aliases (underscore): `codex_exec`, `codex_start`, `codex_status`,
  `codex_logs`, `codex_stop`, `codex_list`, `codex_help`
  - Publishable to npm as `codex-father-mcp-server`
  - Requires Node.js >= 18
