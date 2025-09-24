MCP servers in this repo

- TypeScript server: `mcp/codex-mcp-server` (default via `mcp/server.sh` wrapper)
  - Built with `@modelcontextprotocol/sdk`
  - Exposes standard MCP Tools endpoints (tools/list, tools/call)
  - Tools: `codex.start`, `codex.status`, `codex.logs`, `codex.stop`, `codex.list`
  - Publishable to npm as `codex-father-mcp-server`

- Bash server (fallback): legacy implementation embedded in `mcp/server.sh` and used only if Node/TS build is unavailable.
