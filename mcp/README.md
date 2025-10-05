MCP servers in this repo

- TypeScript server: `mcp/codex-mcp-server` (invoked via `mcp/server.sh`)
  - Built with `@modelcontextprotocol/sdk`
  - Exposes standard MCP Tools endpoints (tools/list, tools/call)
- Tools: `codex.exec`, `codex.start`, `codex.status`, `codex.logs`,
  `codex.stop`, `codex.list`, `codex.help`
- Aliases (underscore): `codex_exec`, `codex_start`, `codex_status`,
  `codex_logs`, `codex_stop`, `codex_list`, `codex_help`
  - Naming (env):
    - `CODEX_MCP_NAME_STYLE` → `underscore-only` (recommended for Codex 0.44
      responses) / `dot-only`
    - `CODEX_MCP_TOOL_PREFIX` → add prefixed aliases (e.g., `cf_exec`,
      `cf_start`, ...)
    - `CODEX_MCP_HIDE_ORIGINAL` → hide `codex.*`/`codex_*`, keep only prefixed
      aliases
  - Publishable to npm as `codex-father-mcp-server`
  - Requires Node.js >= 18
