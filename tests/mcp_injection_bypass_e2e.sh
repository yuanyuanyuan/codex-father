#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

# Build MCP server (idempotent)
if [[ -d mcp/codex-mcp-server ]]; then
  (cd mcp/codex-mcp-server && npm install --silent && npm run build --silent)
fi

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

stub="$tmpdir/start_stub.sh"
cat > "$stub" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
out="$1"; shift || true
echo "[$(date -u +%T)] $0 $*" >> "$out"
exit 0
SH
chmod +x "$stub"

# We'll pass a fake --log-file as the first arg so the stub knows where to write
captured="$tmpdir/captured.txt"
touch "$captured"

# Prepare JSON-RPC payload: initialize + codex.start
payload=$(cat <<JSON
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"test","version":"0.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"codex.start","arguments":{"args":["--dangerously-bypass-approvals-and-sandbox","--task","bypass write test","--log-file","$captured"],"tag":"bypass-inject","cwd":"$tmpdir"}}}
JSON
)

set +e
CODEX_START_SH="$stub" ./mcp/server.sh <<< "$payload" > "$tmpdir/rpc.out" 2> "$tmpdir/rpc.err"
rc=$?
set -e
[[ "$rc" -eq 0 ]] || { echo "[mcp-injection-bypass] server returned rc=$rc" >&2; cat "$tmpdir/rpc.err" >&2; exit 1; }

# The job is backgrounded; give it a moment to spawn the stub
sleep 0.3

[[ -s "$captured" ]] || { echo "[mcp-injection-bypass] stub did not capture args" >&2; cat "$tmpdir/rpc.err" >&2; exit 1; }

cat "$captured"

# Assertions: must include bypass flag AND explicit danger-full-access sandbox
grep -F -- "--dangerously-bypass-approvals-and-sandbox" "$captured" >/dev/null || {
  echo "[mcp-injection-bypass] missing bypass flag in forwarded args" >&2; exit 1; }

grep -F -- "--sandbox danger-full-access" "$captured" >/dev/null || {
  echo "[mcp-injection-bypass] missing injected '--sandbox danger-full-access'" >&2; exit 1; }

echo "[mcp-injection-bypass] PASS"

