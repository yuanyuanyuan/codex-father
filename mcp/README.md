MCP servers in this repo

- Bash server: `mcp/server.sh`
  - Minimal JSON-RPC stdio bridge to `job.sh`
  - Good for zero-deps environments

- TypeScript server: `mcp/codex-mcp-server` (recommended)
  - Built with `@modelcontextprotocol/sdk`
  - Richer typing and easier extension
  - Publishable to npm (`codex-father-mcp-server`)

Deepwiki integration
- Add the `deepwiki` SSE server to your MCP client config to query `https://github.com/modelcontextprotocol/typescript-sdk` contents at any time.
- Example config: see `mcp/example.mcp.json`.

