#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../../.. && pwd)"
MCP_SH="${ROOT_DIR}/mcp/server.sh"
TS_SRV_DIR="${ROOT_DIR}/mcp/codex-mcp-server"

fatal() { echo "[mcp-prefix] ERROR: $*" >&2; exit 1; }
require_exec() { [[ -x "$1" ]] || fatal "not executable: $1"; }
build_server() { ( cd "$TS_SRV_DIR" && npm install --silent && npm run build --silent ); }

tmpdir="$(mktemp -d)"; trap 'rm -rf "$tmpdir"' EXIT

build_server
require_exec "$MCP_SH"

# With prefix cf, underscore-only, hide originals
payload_list=$(cat <<JSON
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"prefix","version":"0.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
JSON
)

out_list="${tmpdir}/list.out"
CODEX_MCP_TOOL_PREFIX=cf CODEX_MCP_HIDE_ORIGINAL=1 CODEX_MCP_NAME_STYLE=underscore-only "$MCP_SH" <<< "$payload_list" >"$out_list" 2>/dev/null || fatal "tools/list failed"
grep -F '"name":"cf_exec"' "$out_list" >/dev/null || fatal "cf_exec not listed"
grep -F '"name":"codex_exec"' "$out_list" >/dev/null && fatal "codex_exec should be hidden"

# Call normalization works: cf_status should route to codex.status
stub_job="${tmpdir}/job_stub.sh"; cat > "$stub_job" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
cmd="${1:-}"; shift || true
case "$cmd" in
  status)
    id="${1:-}"; shift || true
    echo "{\"jobId\":\"$id\",\"status\":\"running\"}"
    ;;
  *)
    echo "unsupported: $cmd" >&2
    exit 1
    ;;
esac
SH
chmod +x "$stub_job"

payload_status=$(cat <<JSON
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"prefix","version":"0.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"cf_status","arguments":{ "jobId":"job-prefix-1" }}}
JSON
)

out_status="${tmpdir}/status.out"
CODEX_MCP_TOOL_PREFIX=cf CODEX_MCP_HIDE_ORIGINAL=1 CODEX_MCP_NAME_STYLE=underscore-only CODEX_VERSION_OVERRIDE=0.44.0 CODEX_JOB_SH="$stub_job" "$MCP_SH" <<< "$payload_status" >"$out_status" 2>/dev/null || fatal "cf_status call failed"
grep -F 'running' "$out_status" >/dev/null || fatal "status did not return running"

echo "[mcp-prefix] PASS"

