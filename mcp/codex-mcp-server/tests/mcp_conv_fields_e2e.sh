#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
MCP_SH="${ROOT_DIR}/mcp/server.sh"
TS_SRV_DIR="${ROOT_DIR}/mcp/codex-mcp-server"

fatal() { echo "[mcp-conv-fields] ERROR: $*" >&2; exit 1; }
info()  { echo "[mcp-conv-fields] $*"; }

require_exec() { [[ -x "$1" ]] || fatal "not executable: $1"; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || fatal "missing command: $1"; }

build_server() { ( cd "$TS_SRV_DIR" && npm install --silent && npm run build --silent ); }

tmpdir="$(mktemp -d)"; trap 'rm -rf "$tmpdir"' EXIT

# Start.sh stub captures args to file given as first arg
stub="$tmpdir/start_stub.sh"; cat > "$stub" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
out="$1"; shift || true
printf '%s\n' "$@" >> "$out"
exit 0
SH
chmod +x "$stub"

captured="$tmpdir/captured.txt"; : > "$captured"

build_server
require_exec "$MCP_SH"

payload=$(cat <<JSON
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"conv","version":"0.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"codex.start","arguments":{
  "tag":"conv-fields",
  "cwd":"$ROOT_DIR",
  "approvalPolicy":"never",
  "sandbox":"workspace-write",
  "network":true,
  "fullAuto":true,
  "profile":"dev",
  "codexConfig":{"foo.bar":"baz","a_number":42,"a_bool":true},
  "args":["--log-file","$captured","--task","conv fields test"]
}}}
JSON
)

CODEX_START_SH="$stub" "$MCP_SH" <<< "$payload" >/dev/null 2>&1 || fatal "MCP call failed"

sleep 0.2

[[ -s "$captured" ]] || fatal "no captured args from stub"

grep -F -- "--sandbox" "$captured" >/dev/null || fatal "missing --sandbox in forwarded args"
grep -F -- "workspace-write" "$captured" >/dev/null || fatal "missing sandbox value"
grep -F -- "--ask-for-approval" "$captured" >/dev/null || fatal "missing --ask-for-approval"
grep -F -- "never" "$captured" >/dev/null || fatal "missing approval value"
grep -F -- "--codex-config" "$captured" >/dev/null || fatal "missing --codex-config"
grep -F -- "sandbox_workspace_write.network_access=true" "$captured" >/dev/null || fatal "missing network config kv"
grep -F -- "foo.bar=\"baz\"" "$captured" >/dev/null || fatal "missing string config kv"
grep -F -- "a_number=42" "$captured" >/dev/null || fatal "missing number config kv"
grep -F -- "a_bool=true" "$captured" >/dev/null || fatal "missing bool config kv"
grep -F -- "--full-auto" "$captured" >/dev/null || fatal "missing --full-auto"
grep -F -- "--profile" "$captured" >/dev/null || fatal "missing --profile"
grep -F -- "dev" "$captured" >/dev/null || fatal "missing profile value"

echo "[mcp-conv-fields] PASS"
