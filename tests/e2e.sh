#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/../.. && pwd)"
CMD_DIR="${ROOT_DIR}/codex-command"
JOB_SH="${CMD_DIR}/job.sh"
MCP_SH="${CMD_DIR}/mcp/server.sh"

fatal() { echo "[e2e] ERROR: $*" >&2; exit 1; }
info() { echo "[e2e] $*"; }

require_file() { [[ -f "$1" ]] || fatal "missing file: $1"; }
require_exec() { [[ -x "$1" ]] || fatal "not executable: $1"; }

json_get_str() {
  # naive top-level string extractor
  local key="$1"; local json="$2"
  printf '%s' "$json" | grep -o '"'"${key}"'"[[:space:]]*:[[:space:]]*"[^"]*"' | sed -E 's/.*:[[:space:]]*"([^"]*)".*/\1/' | head -n1
}

json_get_num() {
  local key="$1"; local json="$2"
  printf '%s' "$json" | grep -o '"'"${key}"'"[[:space:]]*:[[:space:]]*-?[0-9]+' | sed -E 's/.*:[[:space:]]*(-?[0-9]+).*/\1/' | head -n1
}

assert_contains() { local hay="$1"; local needle="$2"; grep -q -- "$needle" <<<"$hay" || fatal "assert_contains failed: expected to find: $needle"; }
assert_file() { [[ -f "$1" ]] || fatal "file not found: $1"; }

run_job_e2e() {
  info "Job E2E: start --dry-run"
  local out; out=$("${JOB_SH}" start --task "E2E dry-run" --dry-run --tag e2e --json)
  local jobId; jobId=$(json_get_str jobId "$out")
  [[ -n "$jobId" ]] || fatal "jobId not found in start output"
  info "jobId=$jobId"

  # wait for start.sh to finish writing
  sleep 1

  info "Job E2E: status"
  local st; st=$("${JOB_SH}" status "$jobId" --json)
  local state; state=$(json_get_str state "$st")
  [[ "$state" == "completed" || "$state" == "failed" ]] || fatal "unexpected state: $state"

  info "Job E2E: logs"
  local lg; lg=$("${JOB_SH}" logs "$jobId" --tail 50)
  assert_contains "$lg" "Exit Code:"

  # artifacts
  local run_dir="${CMD_DIR}/runs/${jobId}"
  assert_file "${run_dir}/job.log"
  assert_file "${run_dir}/state.json"
}

mcp_call() {
  local req="$1"
  printf '%s\n' "$req" | "${MCP_SH}"
}

run_mcp_e2e() {
  info "MCP E2E: tools/list"
  local list; list=$(mcp_call '{"jsonrpc":"2.0","id":1,"method":"tools/list"}')
  assert_contains "$list" 'codex.start'

  info "MCP E2E: codex.start (dry-run)"
  local start_req='{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"codex.start","arguments":{"args":["--task","E2E via MCP","--dry-run"],"tag":"mcp-e2e"}}}'
  local start_res; start_res=$(mcp_call "$start_req")
  local jobId; jobId=$(json_get_str jobId "$start_res")
  [[ -n "$jobId" ]] || fatal "MCP start returned no jobId"
  info "mcp jobId=$jobId"

  sleep 1

  info "MCP E2E: codex.status"
  local status_req; status_req=$(printf '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"codex.status","arguments":{"jobId":"%s"}}}' "$jobId")
  local status_res; status_res=$(mcp_call "$status_req")
  echo "$status_res" | grep -Eq '"state"[[:space:]]*:[[:space:]]*"completed"' || fatal "state not completed in MCP status"

  info "MCP E2E: codex.logs (lines)"
  local logs_req; logs_req=$(printf '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"codex.logs","arguments":{"jobId":"%s","mode":"lines","offsetLines":0,"limitLines":50}}}' "$jobId")
  local logs_res; logs_res=$(mcp_call "$logs_req")
  assert_contains "$logs_res" 'Exit Code'
}

run_job_stop_e2e() {
  info "Job STOP E2E: start --dry-run"
  local out; out=$("${JOB_SH}" start --task "E2E stop" --dry-run --tag e2e-stop --json)
  local jobId; jobId=$(json_get_str jobId "$out")
  [[ -n "$jobId" ]] || fatal "jobId not found"
  sleep 1
  info "Job STOP E2E: stop (should be non-running)"
  set +e
  local stop_out; stop_out=$("${JOB_SH}" stop "$jobId" 2>&1)
  local rc=$?
  set -e
  [[ $rc -eq 0 ]] || fatal "stop returned non-zero rc=$rc"
  if ! echo "$stop_out" | grep -Eq '进程已不在运行|已发送停止信号'; then
    fatal "unexpected stop output: $stop_out"
  fi
}

run_mcp_logs_filters_e2e() {
  info "MCP Logs Filters E2E: start --dry-run"
  local start_req='{"jsonrpc":"2.0","id":20,"method":"tools/call","params":{"name":"codex.start","arguments":{"args":["--task","E2E logs filters","--dry-run"],"tag":"mcp-e2e-logs"}}}'
  local start_res; start_res=$(mcp_call "$start_req")
  local jobId; jobId=$(json_get_str jobId "$start_res")
  [[ -n "$jobId" ]] || fatal "no jobId for logs filters"
  sleep 1
  info "MCP Logs Filters E2E: grep filter"
  local logs_req; logs_req=$(printf '{"jsonrpc":"2.0","id":21,"method":"tools/call","params":{"name":"codex.logs","arguments":{"jobId":"%s","mode":"lines","grep":"^Exit|^----- End","offsetLines":0,"limitLines":200}}}' "$jobId")
  local logs_res; logs_res=$(mcp_call "$logs_req")
  assert_contains "$logs_res" 'Exit Code'
  info "MCP Logs Filters E2E: tail last lines"
  local tail_req; tail_req=$(printf '{"jsonrpc":"2.0","id":22,"method":"tools/call","params":{"name":"codex.logs","arguments":{"jobId":"%s","mode":"lines","tailLines":100,"limitLines":100}}}' "$jobId")
  local tail_res; tail_res=$(mcp_call "$tail_req")
  assert_contains "$tail_res" 'Exit Code'
}

run_concurrency_e2e() {
  info "Concurrency E2E: start two jobs"
  local out1; out1=$("${JOB_SH}" start --task "E2E c1" --dry-run --tag e2e-c1 --json)
  local id1; id1=$(json_get_str jobId "$out1")
  [[ -n "$id1" ]] || fatal "id1 empty"
  local start_req='{"jsonrpc":"2.0","id":30,"method":"tools/call","params":{"name":"codex.start","arguments":{"args":["--task","E2E c2","--dry-run"],"tag":"e2e-c2"}}}'
  local out2; out2=$(mcp_call "$start_req")
  local id2; id2=$(json_get_str jobId "$out2")
  [[ -n "$id2" ]] || fatal "id2 empty"
  [[ "$id1" != "$id2" ]] || fatal "duplicate ids"
  sleep 1
  local lst; lst=$("${JOB_SH}" list --json)
  local c1; c1=$(grep -c -- "$id1" <<<"$lst" || true)
  local c2; c2=$(grep -c -- "$id2" <<<"$lst" || true)
  (( c1 >= 1 )) || fatal "id1 not found in list"
  (( c2 >= 1 )) || fatal "id2 not found in list"
}

main() {
  require_file "$JOB_SH"; require_exec "$JOB_SH"
  require_file "$MCP_SH"; require_exec "$MCP_SH"
  run_job_e2e
  run_mcp_e2e
  run_job_stop_e2e
  run_mcp_logs_filters_e2e
  run_concurrency_e2e
  info "E2E OK"
}

main "$@"
