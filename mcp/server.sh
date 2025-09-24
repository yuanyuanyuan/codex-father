#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS_ENTRY="${MCP_TS_SERVER:-${SCRIPT_DIR}/codex-mcp-server/dist/index.js}"

if ! command -v node >/dev/null 2>&1; then
  echo "[mcp/server.sh] Node.js (>=18) is required to run the MCP server (TypeScript implementation)." >&2
  exit 1
fi

if [[ ! -f "$TS_ENTRY" ]]; then
  echo "[mcp/server.sh] Build artifact not found: $TS_ENTRY" >&2
  echo "Hint: cd \"${SCRIPT_DIR}/codex-mcp-server\" && npm install && npm run build" >&2
  exit 1
fi

exec node "$TS_ENTRY"
