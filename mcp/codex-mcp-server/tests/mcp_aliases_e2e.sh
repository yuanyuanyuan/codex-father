#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../../.. && pwd)"
MCP_SH="${ROOT_DIR}/mcp/server.sh"
TS_SRV_DIR="${ROOT_DIR}/mcp/codex-mcp-server"

fatal() { echo "[mcp-aliases] ERROR: $*" >&2; exit 1; }
info()  { echo "[mcp-aliases] $*"; }

require_exec() { [[ -x "$1" ]] || fatal "not executable: $1"; }

build_server() { ( cd "$TS_SRV_DIR" && npm install --silent && npm run build --silent ); }

tmpdir="$(mktemp -d)"; trap 'rm -rf "$tmpdir"' EXIT

# job.sh stub: minimal handlers for start/status
stub_job="${tmpdir}/job_stub.sh"
cat > "$stub_job" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
cmd="${1:-}"; shift || true
case "$cmd" in
  start)
    # Ignore args; just emit a fake job JSON
    echo '{"jobId":"job-alias-start","message":"Task started successfully"}'
    ;;
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

build_server
require_exec "$MCP_SH"

# 1) tools/list contains codex_start alias
payload_list=$(cat <<JSON
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"alias","version":"0.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
JSON
)
out_list="${tmpdir}/list.out"
"$MCP_SH" <<< "$payload_list" >"$out_list" 2>/dev/null || fatal "tools/list failed"
grep -F '"name":"codex_start"' "$out_list" >/dev/null || fatal "codex_start not listed in tools"

# 2) codex_status alias hits job stub and returns running
payload_status=$(cat <<JSON
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"alias","version":"0.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"codex_status","arguments":{ "jobId":"job-alias-1" }}}
JSON
)

out_status="${tmpdir}/status.out"
CODEX_VERSION_OVERRIDE="0.44.0" CODEX_JOB_SH="$stub_job" "$MCP_SH" <<< "$payload_status" >"$out_status" 2>/dev/null || fatal "codex_status alias call failed"
sleep 0.1
grep -F 'running' "$out_status" >/dev/null || fatal "status did not return running"
grep -F 'job-alias-1' "$out_status" >/dev/null || fatal "status did not echo job id"

# 3) codex_logs alias reads from workspace sessions dir
wsdir="${tmpdir}/ws"; mkdir -p "$wsdir/.codex-father/sessions/job-alias-1"
printf '%s\n' "hello" "world" > "$wsdir/.codex-father/sessions/job-alias-1/job.log"

payload_logs=$(cat <<JSON
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"alias","version":"0.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"codex_logs","arguments":{ "jobId":"job-alias-1", "mode":"lines", "offsetLines":1, "limitLines":1, "cwd":"$wsdir" }}}
JSON
)

out_logs="${tmpdir}/logs.out"
CODEX_VERSION_OVERRIDE="0.44.0" "$MCP_SH" <<< "$payload_logs" >"$out_logs" 2>/dev/null || fatal "codex_logs alias call failed"
sleep 0.1
grep -F 'lines' "$out_logs" >/dev/null || fatal "logs response missing lines field"
grep -F 'world' "$out_logs" >/dev/null || fatal "logs response missing expected line"

echo "[mcp-aliases] PASS"
