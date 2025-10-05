#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../../.. && pwd)"
TS_SRV_DIR="${ROOT_DIR}/mcp/codex-mcp-server"
ENTRY_JS="${TS_SRV_DIR}/dist/index.js"
NODE_TEST="${TS_SRV_DIR}/tests/mcp_fallback_e2e.js"

fatal() { echo "[mcp-fallback] ERROR: $*" >&2; exit 1; }
info()  { echo "[mcp-fallback] $*"; }

build_server() {
  ( cd "$TS_SRV_DIR" && npm install --silent && npm run build --silent );
}

[[ -f "$NODE_TEST" ]] || fatal "missing node test script"

build_server
[[ -f "$ENTRY_JS" ]] || fatal "missing build artifact $ENTRY_JS"

workspace="$(mktemp -d)"; trap 'rm -rf "$workspace"' EXIT

# 运行 Node E2E 脚本验证 fallback 模式
node "$NODE_TEST" "$ENTRY_JS" "$workspace" || fatal "fallback e2e 失败"

info "PASS"
