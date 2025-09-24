#!/usr/bin/env bash

set -euo pipefail

# Minimal MCP JSON-RPC (stdio) server for codex-command
# - Lists tools and accepts tool calls mapping to job.sh
# - Non-blocking: codex.start returns immediately with jobId
# - Requires jq for robust JSON parsing; limited fallback handles only tools/list & ping

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"     # codex-command
JOB_SH="${BASE_DIR}/job.sh"

# shellcheck disable=SC1091
if [[ -f "${BASE_DIR}/lib/common.sh" ]]; then . "${BASE_DIR}/lib/common.sh"; fi

have_jq=0
if command -v jq >/dev/null 2>&1; then have_jq=1; fi

json_escape_local() {
  if declare -F json_escape >/dev/null 2>&1; then json_escape "$1"; return; fi
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

reply_ok() {
  local id="$1"; shift
  local result_json="$1"; shift || true
  printf '{"jsonrpc":"2.0","id":%s,"result":%s}\n' "$id" "$result_json"
}

reply_err() {
  local id="$1"; shift
  local code="$1"; shift
  local msg="$1"; shift
  local data_json="${1:-null}"; shift || true
  local esc_msg; esc_msg="\"$(json_escape_local "$msg")\""
  printf '{"jsonrpc":"2.0","id":%s,"error":{"code":%s,"message":%s,"data":%s}}\n' "$id" "$code" "$esc_msg" "$data_json"
}

tools_list_json() {
  # JSON for tools/list result
  cat <<'JSON'
{"tools":[
  {"name":"codex.start","description":"Start a non-blocking codex run; returns jobId immediately.",
   "input_schema":{"type":"object","properties":{
     "args":{"type":"array","items":{"type":"string"}},
     "tag":{"type":"string"},
     "cwd":{"type":"string"}
   },"additionalProperties":false}},
  {"name":"codex.status","description":"Get job status.",
   "input_schema":{"type":"object","properties":{"jobId":{"type":"string"}},"required":["jobId"],"additionalProperties":false}},
  {"name":"codex.logs","description":"Read job log chunk by byte offset.",
   "input_schema":{"type":"object","properties":{
     "jobId":{"type":"string"},
     "offset":{"type":"integer"},
     "limit":{"type":"integer"}
   },"required":["jobId"],"additionalProperties":false}},
  {"name":"codex.stop","description":"Stop a running job.",
   "input_schema":{"type":"object","properties":{
     "jobId":{"type":"string"},
     "force":{"type":"boolean"}
   },"required":["jobId"],"additionalProperties":false}},
  {"name":"codex.list","description":"List known jobs.",
   "input_schema":{"type":"object","properties":{},"additionalProperties":false}}
]}
JSON
}

call_start() {
  # params: { args?: [..], tag?, cwd? }
  local id="$1"; local params_json="$2"
  if (( have_jq == 0 )); then reply_err "$id" -32600 "codex.start requires jq installed"; return; fi
  local tag cwd
  tag=$(printf '%s' "$params_json" | jq -r '.tag // empty')
  cwd=$(printf '%s' "$params_json" | jq -r '.cwd // empty')
  # args array -> bash array (each element as one line)
  mapfile -t args < <(printf '%s' "$params_json" | jq -r '.args // [] | .[]')
  local -a pass
  pass=("${args[@]}")
  if [[ -n "$tag" ]]; then pass=("--tag" "$tag" "${pass[@]}"); fi
  if [[ -n "$cwd" ]]; then pass=("--cwd" "$cwd" "${pass[@]}"); fi
  local out
  if ! out=$("${JOB_SH}" start --json "${pass[@]}" 2>/dev/null); then
    reply_err "$id" 1 "failed to start job"; return
  fi
  # out is already JSON
  reply_ok "$id" "$out"
}

call_status() {
  local id="$1"; local params_json="$2"; local jobId
  if (( have_jq == 0 )); then reply_err "$id" -32600 "codex.status requires jq installed"; return; fi
  jobId=$(printf '%s' "$params_json" | jq -r '.jobId // empty')
  if [[ -z "$jobId" ]]; then reply_err "$id" -32602 "Missing jobId"; return; fi
  local out
  if ! out=$("${JOB_SH}" status "$jobId" --json 2>/dev/null); then
    reply_err "$id" 1 "failed to get status"; return
  fi
  reply_ok "$id" "$out"
}

call_list() {
  local id="$1"; local out
  if ! out=$("${JOB_SH}" list --json 2>/dev/null); then
    reply_err "$id" 1 "failed to list"; return
  fi
  reply_ok "$id" "$out"
}

call_stop() {
  local id="$1"; local params_json="$2"; local jobId force
  if (( have_jq == 0 )); then reply_err "$id" -32600 "codex.stop requires jq installed"; return; fi
  jobId=$(printf '%s' "$params_json" | jq -r '.jobId // empty')
  force=$(printf '%s' "$params_json" | jq -r '.force // false')
  if [[ -z "$jobId" ]]; then reply_err "$id" -32602 "Missing jobId"; return; fi
  if [[ "$force" == "true" ]]; then
    "${JOB_SH}" stop "$jobId" --force >/dev/null 2>&1 || true
  else
    "${JOB_SH}" stop "$jobId" >/dev/null 2>&1 || true
  fi
  reply_ok "$id" '{"ok":true}'
}

call_logs() {
  local id="$1"; local params_json="$2"; local jobId
  if (( have_jq == 0 )); then reply_err "$id" -32600 "codex.logs requires jq installed"; return; fi
  jobId=$(printf '%s' "$params_json" | jq -r '.jobId // empty')
  if [[ -z "$jobId" ]]; then reply_err "$id" -32602 "Missing jobId"; return; fi
  local log_file="${BASE_DIR}/runs/${jobId}/job.log"
  if [[ ! -f "$log_file" ]]; then reply_err "$id" 2 "log not found"; return; fi

  local mode; mode=$(printf '%s' "$params_json" | jq -r '.mode // "bytes"')
  if [[ "$mode" == "lines" ]]; then
    local offsetLines limitLines grep_re tailLines
    offsetLines=$(printf '%s' "$params_json" | jq -r '.offsetLines // 0')
    limitLines=$(printf '%s' "$params_json" | jq -r '.limitLines // 200')
    grep_re=$(printf '%s' "$params_json" | jq -r '.grep // empty')
    tailLines=$(printf '%s' "$params_json" | jq -r '.tailLines // empty')
    [[ "$offsetLines" -lt 0 ]] && offsetLines=0
    [[ "$limitLines" -le 0 ]] && limitLines=200
    local sizeB; sizeB=$(wc -c < "$log_file" 2>/dev/null || echo 0)
    local totalL; totalL=$(wc -l < "$log_file" 2>/dev/null || echo 0)

    local lines out_lines count nextL eof filteredTotal
    if [[ -n "$tailLines" && "$tailLines" != "" && "$tailLines" != "null" ]]; then
      # tail last N lines (optionally grep filter after tail for consistency)
      if [[ -n "$grep_re" ]]; then
        lines=$(tail -n "$tailLines" "$log_file" 2>/dev/null | grep -E "$grep_re" || true)
      else
        lines=$(tail -n "$tailLines" "$log_file" 2>/dev/null || true)
      fi
      offsetLines=0
      # split into array
      IFS=$'\n' read -r -d '' -a arr_lines < <(printf '%s\0' "$lines") || true
      filteredTotal=${#arr_lines[@]}
      count=$(( limitLines < filteredTotal ? limitLines : filteredTotal ))
      out_lines=("${arr_lines[@]:0:count}")
      nextL=$count
      eof=true
    else
      if [[ -n "$grep_re" ]]; then
        # build filtered view with grep; then paginate
        # shellcheck disable=SC2002
        lines=$(cat "$log_file" | grep -n -E "$grep_re" 2>/dev/null | sed -E 's/^[0-9]+://')
        IFS=$'\n' read -r -d '' -a arr_lines < <(printf '%s\0' "$lines") || true
        filteredTotal=${#arr_lines[@]}
        if (( offsetLines >= filteredTotal )); then
          out_lines=()
          nextL=$offsetLines
          eof=true
        else
          count=$(( limitLines < (filteredTotal - offsetLines) ? limitLines : (filteredTotal - offsetLines) ))
          out_lines=("${arr_lines[@]:offsetLines:count}")
          nextL=$(( offsetLines + count ))
          if (( nextL >= filteredTotal )); then eof=true; else eof=false; fi
        fi
      else
        # paginate raw file
        filteredTotal=$totalL
        if (( offsetLines >= filteredTotal )); then
          out_lines=()
          nextL=$offsetLines
          eof=true
        else
          local endL=$(( offsetLines + limitLines ))
          # sed is 1-based lines
          out_lines=()
          while IFS= read -r line; do out_lines+=("$line"); done < <(sed -n "$((offsetLines+1)),${endL}p" "$log_file")
          count=${#out_lines[@]}
          nextL=$(( offsetLines + count ))
          if (( nextL >= filteredTotal )); then eof=true; else eof=false; fi
        fi
      fi
    fi

    # build JSON array
    local arr_json="["; local first=1
    for ln in "${out_lines[@]:-}"; do
      local esc; esc=$(json_escape_local "$ln")
      if (( first == 1 )); then arr_json+="\"${esc}\""; first=0; else arr_json+=",\"${esc}\""; fi
    done
    arr_json+="]"
    printf '{"jsonrpc":"2.0","id":%s,"result":{"lines":%s,"nextOffsetLines":%d,"eof":%s,"totalLines":%d,"filteredTotalLines":%d,"sizeBytes":%d}}\n' \
      "$id" "$arr_json" "$nextL" "$eof" "$totalL" "${filteredTotal:-$totalL}" "$sizeB"
    return
  fi

  # bytes mode (default)
  local offset limit
  offset=$(printf '%s' "$params_json" | jq -r '.offset // 0')
  limit=$(printf '%s' "$params_json" | jq -r '.limit // 4096')
  local size; size=$(wc -c < "$log_file" 2>/dev/null || echo 0)
  [[ "$offset" -lt 0 ]] && offset=0
  [[ "$limit" -le 0 ]] && limit=4096
  if (( offset >= size )); then
    reply_ok "$id" "{\"chunk\":\"\",\"nextOffset\":${offset},\"eof\":true,\"size\":${size}}"
    return
  fi
  local remain=$(( size - offset ))
  local count=$(( limit < remain ? limit : remain ))
  local chunk; chunk=$(dd if="$log_file" bs=1 skip="$offset" count="$count" status=none 2>/dev/null | sed -e 's/\r$//')
  local esc; esc=$(json_escape_local "$chunk")
  local next=$(( offset + count ))
  local eof=false; if (( next >= size )); then eof=true; fi
  printf '{"jsonrpc":"2.0","id":%s,"result":{"chunk":"%s","nextOffset":%d,"eof":%s,"size":%d}}\n' "$id" "$esc" "$next" "$eof" "$size"
}

dispatch_tools_call() {
  local id="$1"; local params_json="$2"
  if (( have_jq == 0 )); then reply_err "$id" -32600 "tools/call requires jq installed"; return; fi
  local name; name=$(printf '%s' "$params_json" | jq -r '.name // empty')
  local args_json; args_json=$(printf '%s' "$params_json" | jq -c '.arguments // {}')
  case "$name" in
    codex.start)  call_start "$id" "$args_json" ;;
    codex.status) call_status "$id" "$args_json" ;;
    codex.logs)   call_logs "$id" "$args_json" ;;
    codex.stop)   call_stop "$id" "$args_json" ;;
    codex.list)   call_list "$id" ;;
    *) reply_err "$id" -32601 "Unknown tool: ${name}" ;;
  esac
}

dispatch_direct() {
  # Accept direct method names (non-MCP): codex.*
  local id="$1"; local method="$2"; local params_json="$3"
  case "$method" in
    codex.start)  call_start "$id" "$params_json" ;;
    codex.status) call_status "$id" "$params_json" ;;
    codex.logs)   call_logs "$id" "$params_json" ;;
    codex.stop)   call_stop "$id" "$params_json" ;;
    codex.list)   call_list "$id" ;;
    *) reply_err "$id" -32601 "Unknown method: ${method}" ;;
  esac
}

handle_line_with_jq() {
  local line="$1"
  local id method params
  id=$(printf '%s' "$line" | jq -c '.id // null')
  method=$(printf '%s' "$line" | jq -r '.method // empty')
  params=$(printf '%s' "$line" | jq -c '.params // {}')
  if [[ -z "$method" ]]; then reply_err "$id" -32600 "Missing method"; return; fi
  case "$method" in
    initialize)
      reply_ok "$id" '{"protocolVersion":"jsonrpc-2.0","serverName":"codex-command","serverVersion":"0.1.0","capabilities":{"tools":{}}}'
      ;;
    "tools/list")
      reply_ok "$id" "$(tools_list_json)"
      ;;
    "tools/call")
      dispatch_tools_call "$id" "$params"
      ;;
    ping)
      reply_ok "$id" '{"ok":true}'
      ;;
    shutdown|exit)
      reply_ok "$id" '{"ok":true}'
      exit 0
      ;;
    codex.*)
      dispatch_direct "$id" "$method" "$params"
      ;;
    *)
      reply_err "$id" -32601 "Method not found: ${method}"
      ;;
  esac
}

handle_line_fallback() {
  # Very limited parser: only detects method and id (string or number)
  local line="$1"
  local id method
  id=$(printf '%s' "$line" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/"\1"/p' | head -n1)
  if [[ -z "$id" ]]; then id=$(printf '%s' "$line" | sed -n 's/.*"id"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -n1); fi
  method=$(printf '%s' "$line" | sed -n 's/.*"method"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
  if [[ "$method" == "tools/list" ]]; then
    reply_ok "$id" "$(tools_list_json)"
  elif [[ "$method" == "ping" ]]; then
    reply_ok "$id" '{"ok":true}'
  else
    reply_err "$id" -32600 "jq is required for this method"
  fi
}

# Main loop
while IFS= read -r line; do
  # Ignore empty lines
  [[ -n "${line//[[:space:]]/}" ]] || continue
  if (( have_jq == 1 )); then
    handle_line_with_jq "$line"
  else
    handle_line_fallback "$line"
  fi
done
