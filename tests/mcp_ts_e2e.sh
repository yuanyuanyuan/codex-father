#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
MCP_SH="${ROOT_DIR}/mcp/server.sh"
TS_SRV_DIR="${ROOT_DIR}/mcp/codex-mcp-server"

fatal() { echo "[mcp-ts-e2e] ERROR: $*" >&2; exit 1; }
info()  { echo "[mcp-ts-e2e] $*"; }

require_exec() { [[ -x "$1" ]] || fatal "not executable: $1"; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || fatal "missing command: $1"; }

json_get() { local path="$1"; jq -r "$path"; }

build_server() {
  require_cmd node; require_cmd npm
  info "Building TS MCP server ..."
  ( cd "$TS_SRV_DIR" && npm install --silent && npm run build --silent )
}

mcp_call() {
  local req="$1"; printf '%s\n' "$req" | "$MCP_SH"
}

test_initialize_and_list() {
  info "Init + tools/list"
  local init='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"e2e","version":"0.0.0"}}}'
  local list='{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
  local out; out=$(printf '%s\n%s\n' "$init" "$list" | "$MCP_SH")
  echo "$out" | jq -e . >/dev/null 2>&1 || fatal "invalid JSON output"
  echo "$out" | grep -q '"tools"' || fatal "tools not present"
  echo "$out" | grep -q 'codex.start' || fatal "codex.start not listed"
}

test_start_status_logs() {
  info "codex.start (dry-run)"
  local start='{"jsonrpc":"2.0","id":10,"method":"tools/call","params":{"name":"codex.start","arguments":{"args":["--task","E2E TS MCP","--dry-run"],"tag":"mcp-ts-e2e","cwd":"'"$ROOT_DIR"'"}}}'
  local res; res=$(mcp_call "$start")
  local text; text=$(echo "$res" | jq -r '.result.content[0].text // empty')
  [[ -n "$text" ]] || fatal "empty start text"
  local jobId; jobId=$(printf '%s' "$text" | jq -r '.jobId // empty')
  [[ -n "$jobId" ]] || fatal "jobId not found in start payload"
  info "jobId=$jobId"

  info "codex.status (wait for completion)"
  local tries=20
  while (( tries-- > 0 )); do
    local st; st=$(printf '{"jsonrpc":"2.0","id":11,"method":"tools/call","params":{"name":"codex.status","arguments":{"jobId":"%s"}}}\n' "$jobId" | "$MCP_SH")
    local st_txt; st_txt=$(echo "$st" | jq -r '.result.content[0].text // empty')
    local state; state=$(printf '%s' "$st_txt" | jq -r '.state // empty')
    if [[ "$state" == "completed" || "$state" == "failed" ]]; then
      echo "$st_txt" | jq . >/dev/null || true
      break
    fi
    sleep 0.3
  done
  [[ "$tries" -gt 0 ]] || fatal "status did not complete"

  info "codex.logs (tail lines)"
  local logs; logs=$(printf '{"jsonrpc":"2.0","id":12,"method":"tools/call","params":{"name":"codex.logs","arguments":{"jobId":"%s","mode":"lines","tailLines":80,"cwd":"'"$ROOT_DIR"'"}}}\n' "$jobId" | "$MCP_SH")
  echo "$logs" | grep -q 'Exit Code' || fatal "logs missing 'Exit Code'"
}

test_exec_sync() {
  info "codex.exec (sync, dry-run)"
  local exec_req='{"jsonrpc":"2.0","id":20,"method":"tools/call","params":{"name":"codex.exec","arguments":{"args":["--task","E2E MCP exec","--dry-run"],"tag":"mcp-ts-e2e"}}}'
  local res; res=$(mcp_call "$exec_req")
  local text; text=$(echo "$res" | jq -r '.result.content[0].text // empty')
  [[ -n "$text" ]] || fatal "empty exec text"
  echo "$text" | jq -e . >/dev/null 2>&1 || fatal "exec result not JSON"
  local exitCode; exitCode=$(printf '%s' "$text" | jq -r '.exitCode // empty')
  [[ "$exitCode" == "0" ]] || fatal "exec exitCode != 0: $exitCode"
  local logFile; logFile=$(printf '%s' "$text" | jq -r '.logFile // empty')
  [[ -f "$logFile" ]] || fatal "exec logFile not found: $logFile"
}

main() {
  require_cmd jq
  build_server
  require_exec "$MCP_SH"
  test_initialize_and_list
  test_exec_sync
  test_start_status_logs
  info "E2E PASSED"
}

main "$@"
