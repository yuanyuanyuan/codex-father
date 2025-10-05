#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../../.. && pwd)"
MCP_SH="${ROOT_DIR}/mcp/server.sh"
TS_SRV_DIR="${ROOT_DIR}/mcp/codex-mcp-server"

fatal() { echo "[mcp-init-guard] ERROR: $*" >&2; exit 1; }
info()  { echo "[mcp-init-guard] $*"; }

require_exec() { [[ -x "$1" ]] || fatal "not executable: $1"; }

build_server() {
  ( cd "$TS_SRV_DIR" && npm install --silent && npm run build --silent );
}

tmpdir="$(mktemp -d)"; trap 'rm -rf "$tmpdir"' EXIT

build_server
require_exec "$MCP_SH"

payload=$(cat <<'JSON'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"capabilities":{},"clientInfo":{"name":"guard","version":"0.0.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
JSON
)

out_json="${tmpdir}/guard.out.json"
err_log="${tmpdir}/guard.err.log"
LOG_LEVEL=error "$MCP_SH" <<< "$payload" >"$out_json" 2>"$err_log" || true

grep -F 'initialize 请求缺少 protocolVersion 字段' "$out_json" >/dev/null || fatal "initialize 错误信息不符合预期"
grep -F '尚未完成 MCP initialize 握手' "$out_json" >/dev/null || fatal "tools/list 未被握手校验阻止"
grep -F '"code":-32602' "$out_json" >/dev/null || fatal "initialize 应返回 InvalidParams (-32602)"
grep -F '"code":-32600' "$out_json" >/dev/null || fatal "tools/list 应返回 InvalidRequest (-32600)"

info "PASS"
