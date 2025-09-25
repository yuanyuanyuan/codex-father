#!/usr/bin/env bash

set -euo pipefail

# Async job manager for start.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
START_SH="${SCRIPT_DIR}/start.sh"

# shellcheck disable=SC1091
if [[ -f "${SCRIPT_DIR}/lib/common.sh" ]]; then . "${SCRIPT_DIR}/lib/common.sh"; fi

usage() {
  cat <<'EOF'
用法: job.sh <命令> [参数]

命令:
  start [start.sh 同参…] [--tag <t>] [--cwd <dir>] [--json]
        后台启动一次 codex 运行，立刻返回 job-id 与句柄。
  status <job-id> [--json]
        查询任务状态，若已结束则补充分类与摘要。
  logs <job-id> [--tail N] [--follow]
        查看任务日志；--follow 持续跟随。
  stop <job-id> [--force]
        终止任务；默认 SIGTERM，--force 使用 SIGKILL。
  list [--json]
        罗列已知任务（runs/*）。

示例:
  ./codex-command/job.sh start --preset sprint --task "检查 README" --tag demo --json
  ./codex-command/job.sh status cdx-20240924_120001-demo --json
  ./codex-command/job.sh logs cdx-20240924_120001-demo --tail 200
  ./codex-command/job.sh stop cdx-20240924_120001-demo
  ./codex-command/job.sh list --json
EOF
}

err() { echo "$*" >&2; }

now_iso() { date -u "+%Y-%m-%dT%H:%M:%SZ"; }

sessions_dir() {
  # Usage: sessions_dir [base_dir]
  local base="${1:-$PWD}"
  printf '%s/.codex-father/sessions' "$base"
}

safe_tag() {
  local t="$1"
  printf '%s' "${t}" | tr -cs 'A-Za-z0-9_.-' '-' | sed 's/^-\+//; s/-\+$//'
}

gen_job_id() {
  local tag="$1"; local ts; ts=$(date +%Y%m%d_%H%M%S)
  if [[ -n "${tag}" ]]; then
    local st; st=$(safe_tag "${tag}")
    printf 'cdx-%s-%s' "${ts}" "${st}"
  else
    printf 'cdx-%s' "${ts}"
  fi
}

pid_alive() {
  local pid="$1"
  if [[ -z "${pid}" ]]; then return 1; fi
  if kill -0 "${pid}" >/dev/null 2>&1; then return 0; else return 1; fi
}

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

write_state() {
  local state_file="$1"; shift
  local json="$1"; shift || true
  umask 077
  printf '%s\n' "${json}" > "${state_file}.tmp"
  mv -f "${state_file}.tmp" "${state_file}"
}

build_args_json_array() {
  local -a arr=("$@")
  local out="["; local first=1
  for a in "${arr[@]}"; do
    local esc; esc=$(json_escape_local "$a")
    if (( first == 1 )); then out+="\"${esc}\""; first=0; else out+=",\"${esc}\""; fi
  done
  out+="]"
  printf '%s' "${out}"
}

latest_file_by_mtime() {
  # Usage: latest_file_by_mtime <glob>
  local glob="$1"
  # shellcheck disable=SC2086
  ls -1t ${glob} 2>/dev/null | head -n1 || true
}

safe_classify() {
  # Usage: safe_classify <last_msg_file|""> <log_file> <exit_code>
  local last_msg_file="$1"; local log_file="$2"; local code="$3"
  SC_CLASSIFICATION="normal"; SC_TOKENS_USED=""
  # tokens used (best-effort)
  SC_TOKENS_USED=$(( (grep -Ei 'tokens used' "$log_file" 2>/dev/null | tail -n1 | sed -E 's/.*tokens used[^0-9]*([0-9,]+).*/\1/i' | tr -d ',') || true ) )
  SC_TOKENS_USED="${SC_TOKENS_USED:-}"
  if [[ "$code" -eq 0 ]]; then
    if [[ -n "$last_msg_file" ]] && grep -Eq 'CONTROL:[[:space:]]*DONE' "$last_msg_file" 2>/dev/null; then
      SC_CLASSIFICATION='done'
    elif [[ -n "$last_msg_file" ]] && grep -Eq 'CONTROL:[[:space:]]*CONTINUE' "$last_msg_file" 2>/dev/null; then
      SC_CLASSIFICATION='continue'
    else
      SC_CLASSIFICATION='normal'
    fi
  else
    if grep -Eqi 'context|token|length|too long|exceed|truncat' "$log_file" ${last_msg_file:+"$last_msg_file"} 2>/dev/null; then
      SC_CLASSIFICATION='context_overflow'
    elif grep -Eqi 'approval|require.*confirm|denied by approval' "$log_file" ${last_msg_file:+"$last_msg_file"} 2>/dev/null; then
      SC_CLASSIFICATION='approval_required'
    elif grep -Eqi 'sandbox|permission|not allowed|denied by sandbox' "$log_file" ${last_msg_file:+"$last_msg_file"} 2>/dev/null; then
      SC_CLASSIFICATION='sandbox_denied'
    elif grep -Eqi 'network|ENOTFOUND|ECONN|timeout|fetch failed|getaddrinfo' "$log_file" ${last_msg_file:+"$last_msg_file"} 2>/dev/null; then
      SC_CLASSIFICATION='network_error'
    elif grep -Eqi 'unauthorized|forbidden|invalid api key|401|403' "$log_file" ${last_msg_file:+"$last_msg_file"} 2>/dev/null; then
      SC_CLASSIFICATION='auth_error'
    elif grep -Eqi 'too many requests|rate limit|429' "$log_file" ${last_msg_file:+"$last_msg_file"} 2>/dev/null; then
      SC_CLASSIFICATION='rate_limited'
    elif grep -Eqi 'Command failed|non-zero exit|failed to execute' "$log_file" ${last_msg_file:+"$last_msg_file"} 2>/dev/null; then
      SC_CLASSIFICATION='tool_error'
    else
      SC_CLASSIFICATION='error'
    fi
  fi
}

derive_exit_code_from_log() {
  local log="$1"
  [[ -f "$log" ]] || { echo ""; return 0; }
  local ln
  ln=$(grep -E "^Exit Code:[[:space:]]*-?[0-9]+" "$log" | tail -n1 || true)
  if [[ -n "$ln" ]]; then
    echo "$ln" | sed -E 's/.*Exit Code:[[:space:]]*(-?[0-9]+).*/\1/'
  else
    echo ""
  fi
}

derive_title_from_instructions() {
  local run_dir="$1"
  local f
  f=$(latest_file_by_mtime "${run_dir}/*.instructions.md")
  if [[ -n "$f" && -f "$f" ]]; then
    awk 'NF {print; exit}' "$f" | cut -c1-160 || true
  else
    echo ""
  fi
}

status_compute_and_update() {
  local run_dir="$1"; local json_out="$2"
  local state_file="${run_dir}/state.json"
  local pid_file="${run_dir}/pid"
  local log_file="${run_dir}/job.log"
  local meta_glob="${run_dir}/*.meta.json"
  local last_glob="${run_dir}/*.last.txt"

  local id; id=$(basename "$run_dir")
  local pid=""; [[ -f "$pid_file" ]] && pid=$(cat "$pid_file" 2>/dev/null || echo "")
  local running=0
  if pid_alive "$pid"; then running=1; fi

  local state exit_code classification tokens_used title last_msg meta_file
  title=$(derive_title_from_instructions "$run_dir")

  if (( running == 1 )); then
    state="running"; exit_code="null"; classification="null"; tokens_used="null"
  else
    # derive exit code and classification
    local code; code=$(derive_exit_code_from_log "$log_file")
    if [[ -z "$code" ]]; then code="-1"; fi
    exit_code="$code"
    # latest last message and meta
    last_msg=$(latest_file_by_mtime "$last_glob")
    meta_file=$(latest_file_by_mtime "$meta_glob")
    classification="null"; tokens_used="null"
    safe_classify "${last_msg:-}" "${log_file}" "${code}"
    if [[ -n "${SC_CLASSIFICATION:-}" ]]; then classification="\"$(json_escape_local "${SC_CLASSIFICATION}")\""; fi
    if [[ -n "${SC_TOKENS_USED:-}" ]]; then tokens_used="\"$(json_escape_local "${SC_TOKENS_USED}")\""; fi
    # stopped vs completed/failed: rely on exit_code
    if [[ "$code" -eq 0 ]]; then state="completed"; else state="failed"; fi
  fi

  # Read tag/cwd from existing state if present to keep stable metadata
  local tag="" cwd=""
  if [[ -f "$state_file" ]]; then
    # Try to recover original fields
    tag=$(grep -E '"tag"' "$state_file" | sed -E 's/.*"tag"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
    cwd=$(grep -E '"cwd"' "$state_file" | sed -E 's/.*"cwd"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
  fi

  local updated_at; updated_at=$(now_iso)
  local created_at
  if [[ -f "$state_file" ]]; then
    created_at=$(grep -E '"created_at"' "$state_file" | sed -E 's/.*"created_at"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
  fi
  [[ -n "$created_at" ]] || created_at="$updated_at"

  local pid_json
  if [[ -n "$pid" ]]; then pid_json="$pid"; else pid_json="null"; fi

  local exit_json
  if [[ "$exit_code" == "null" ]]; then exit_json="null"; else exit_json="$exit_code"; fi

  local title_json
  if [[ -n "$title" ]]; then title_json="\"$(json_escape_local "$title")\""; else title_json="null"; fi

  local meta_glob_json="\"$(json_escape_local "$meta_glob")\""
  local last_glob_json="\"$(json_escape_local "$last_glob")\""

  local json
  json=$(cat <<EOF
{
  "id": "$(json_escape_local "$id")",
  "pid": ${pid_json},
  "state": "$(json_escape_local "$state")",
  "exit_code": ${exit_json},
  "classification": ${classification},
  "tokens_used": ${tokens_used},
  "cwd": "$(json_escape_local "${cwd}")",
  "created_at": "$(json_escape_local "$created_at")",
  "updated_at": "$(json_escape_local "$updated_at")",
  "tag": "$(json_escape_local "${tag}")",
  "log_file": "$(json_escape_local "$log_file")",
  "meta_glob": ${meta_glob_json},
  "last_message_glob": ${last_glob_json},
  "title": ${title_json}
}
EOF
)
  write_state "$state_file" "$json"
  if (( json_out == 1 )); then printf '%s\n' "$json"; else
    echo "id: $id"
    echo "state: $state"
    echo "pid: ${pid:-}"
    echo "exit_code: ${exit_code}"
    echo "log: $log_file"
    [[ -n "$title" ]] && echo "title: $title"
  fi
}

cmd_start() {
  local json_out=0 tag="" cwd=""; local -a pass_args=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json) json_out=1; shift ;;
      --tag) [[ $# -ge 2 ]] || { err "--tag 需要一个值"; exit 2; }; tag="$2"; shift 2 ;;
      --cwd) [[ $# -ge 2 ]] || { err "--cwd 需要一个路径"; exit 2; }; cwd="$2"; shift 2 ;;
      *) pass_args+=("$1"); shift ;;
    esac
  done

  local job_id; job_id=$(gen_job_id "$tag")
  local base_dir="${cwd:-$PWD}"
  local sess_root; sess_root=$(sessions_dir "$base_dir")
  mkdir -p "$sess_root"
  local run_dir="${sess_root}/${job_id}"
  mkdir -p "$run_dir"

  local log_file="${run_dir}/job.log"
  local agg_txt="${run_dir}/aggregate.txt"
  local agg_jsonl="${run_dir}/aggregate.jsonl"

  # Launch in background
  (
    if [[ -n "$cwd" ]]; then cd "$cwd"; fi
    setsid nohup env \
      CODEX_SESSION_DIR="$run_dir" \
      CODEX_LOG_FILE="$log_file" \
      CODEX_LOG_AGGREGATE=1 \
      CODEX_LOG_AGGREGATE_FILE="$agg_txt" \
      CODEX_LOG_AGGREGATE_JSONL_FILE="$agg_jsonl" \
      CODEX_LOG_SUBDIRS=0 \
      "$START_SH" --log-file "$log_file" --flat-logs "${pass_args[@]}" \
      >>"$run_dir/bootstrap.out" 2>>"$run_dir/bootstrap.err" & echo $! > "$run_dir/pid"
  )

  # Prepare initial state.json
  local pid; pid=$(cat "$run_dir/pid" 2>/dev/null || echo "")
  local created_at; created_at=$(now_iso)
  local updated_at="$created_at"
  local st_tag=""; [[ -n "$tag" ]] && st_tag=$(safe_tag "$tag")
  local args_json; args_json=$(build_args_json_array "${pass_args[@]}")

  local state_json
  state_json=$(cat <<EOF
{
  "id": "$(json_escape_local "$job_id")",
  "pid": ${pid:-null},
  "state": "running",
  "exit_code": null,
  "classification": null,
  "tokens_used": null,
  "cwd": "$(json_escape_local "${cwd:-$PWD}")",
  "created_at": "$(json_escape_local "$created_at")",
  "updated_at": "$(json_escape_local "$updated_at")",
  "tag": "$(json_escape_local "${st_tag}")",
  "log_file": "$(json_escape_local "$log_file")",
  "meta_glob": "$(json_escape_local "${run_dir}/*.meta.json")",
  "last_message_glob": "$(json_escape_local "${run_dir}/*.last.txt")",
  "args": ${args_json},
  "title": null
}
EOF
)
  write_state "${run_dir}/state.json" "$state_json"

  if (( json_out == 1 )); then
    cat <<JSON
{
  "jobId": "$(json_escape_local "$job_id")",
  "pid": ${pid:-null},
  "cwd": "$(json_escape_local "${cwd:-$PWD}")",
  "logFile": "$(json_escape_local "$log_file")",
  "metaGlob": "$(json_escape_local "${run_dir}/*.meta.json")",
  "lastMessageGlob": "$(json_escape_local "${run_dir}/*.last.txt")",
  "tag": "$(json_escape_local "${st_tag}")"
}
JSON
  else
    echo "Job started: ${job_id} (pid: ${pid:-})"
    echo "Run dir: ${run_dir}"
    echo "Log: ${log_file}"
  fi
}

cmd_status() {
  local json_out=0 cwd=""
  [[ $# -ge 1 ]] || { err "用法: job.sh status <job-id> [--json] [--cwd <dir>]"; exit 2; }
  local job_id="$1"; shift || true
  while [[ $# -gt 0 ]]; do case "$1" in --json) json_out=1; shift ;; --cwd) [[ $# -ge 2 ]] || { err "--cwd 需要路径"; exit 2; }; cwd="$2"; shift 2 ;; *) shift ;; esac; done
  local run_dir
  run_dir="$(sessions_dir "${cwd:-$PWD}")/${job_id}"
  [[ -d "$run_dir" ]] || { err "未找到任务目录: ${run_dir}"; exit 2; }
  status_compute_and_update "$run_dir" "$json_out"
}

cmd_logs() {
  local tail_n=""; local follow=0; local cwd=""
  [[ $# -ge 1 ]] || { err "用法: job.sh logs <job-id> [--tail N] [--follow] [--cwd <dir>]"; exit 2; }
  local job_id="$1"; shift || true
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --tail) [[ $# -ge 2 ]] || { err "--tail 需要数字"; exit 2; }; tail_n="$2"; shift 2 ;;
      --follow) follow=1; shift ;;
      --cwd) [[ $# -ge 2 ]] || { err "--cwd 需要路径"; exit 2; }; cwd="$2"; shift 2 ;;
      *) shift ;;
    esac
  done
  local log_file
  log_file="$(sessions_dir "${cwd:-$PWD}")/${job_id}/job.log"
  [[ -f "$log_file" ]] || { err "日志不存在: ${log_file}"; exit 2; }
  if (( follow == 1 )); then
    if [[ -n "$tail_n" ]]; then tail -n "$tail_n" -F "$log_file"; else tail -n 50 -F "$log_file"; fi
  else
    if [[ -n "$tail_n" ]]; then tail -n "$tail_n" "$log_file"; else cat "$log_file"; fi
  fi
}

cmd_stop() {
  local force=0 cwd=""
  [[ $# -ge 1 ]] || { err "用法: job.sh stop <job-id> [--force] [--cwd <dir>]"; exit 2; }
  local job_id="$1"; shift || true
  while [[ $# -gt 0 ]]; do case "$1" in --force) force=1; shift ;; --cwd) [[ $# -ge 2 ]] || { err "--cwd 需要路径"; exit 2; }; cwd="$2"; shift 2 ;; *) shift ;; esac; done
  local run_dir
  run_dir="$(sessions_dir "${cwd:-$PWD}")/${job_id}"
  local pid_file="${run_dir}/pid"
  [[ -f "$pid_file" ]] || { err "未找到 pid 文件: ${pid_file}"; exit 2; }
  local pid; pid=$(cat "$pid_file" 2>/dev/null || echo "")
  if [[ -z "$pid" ]]; then err "pid 为空"; exit 2; fi
  if ! pid_alive "$pid"; then err "进程已不在运行"; exit 0; fi
  if (( force == 1 )); then kill -9 "$pid" 2>/dev/null || true; else kill "$pid" 2>/dev/null || true; fi
  sleep 0.2
  # update state
  status_compute_and_update "$run_dir" 0 >/dev/null 2>&1 || true
  echo "已发送停止信号 (job: ${job_id}, pid: ${pid}, force: ${force})"
}

cmd_list() {
  local json_out=0 cwd=""
  while [[ $# -gt 0 ]]; do case "$1" in --json) json_out=1; shift ;; --cwd) [[ $# -ge 2 ]] || { err "--cwd 需要路径"; exit 2; }; cwd="$2"; shift 2 ;; *) shift ;; esac; done
  local sess_root; sess_root=$(sessions_dir "${cwd:-$PWD}")
  mkdir -p "$sess_root"
  local first=1
  if (( json_out == 1 )); then echo "["; fi
  for d in "${sess_root}"/*; do
    [[ -d "$d" ]] || continue
    local id; id=$(basename "$d")
    local state_file="${d}/state.json"
    local state="unknown" created_at="" updated_at="" tag="" title=""
    if [[ -f "$state_file" ]]; then
      state=$(grep -E '"state"' "$state_file" | sed -E 's/.*"state"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
      created_at=$(grep -E '"created_at"' "$state_file" | sed -E 's/.*"created_at"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
      updated_at=$(grep -E '"updated_at"' "$state_file" | sed -E 's/.*"updated_at"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
      tag=$(grep -E '"tag"' "$state_file" | sed -E 's/.*"tag"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
      title=$(grep -E '"title"' "$state_file" | sed -E 's/.*"title"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
    fi
    if (( json_out == 1 )); then
      local obj
      obj=$(cat <<J
{ "id": "$(json_escape_local "$id")", "state": "$(json_escape_local "$state")", "createdAt": "$(json_escape_local "$created_at")", "updatedAt": "$(json_escape_local "$updated_at")", "tag": "$(json_escape_local "$tag")", "title": "$(json_escape_local "$title")" }
J
)
      if (( first == 1 )); then printf '%s' "$obj"; first=0; else printf ',%s' "$obj"; fi
    else
      printf '%-28s %-10s %s\n' "$id" "$state" "$title"
    fi
  done
  if (( json_out == 1 )); then echo "]"; fi
}

main() {
  [[ $# -ge 1 ]] || { usage; exit 2; }
  local sub="$1"; shift || true
  case "$sub" in
    start) cmd_start "$@" ;;
    status) cmd_status "$@" ;;
    logs) cmd_logs "$@" ;;
    stop) cmd_stop "$@" ;;
    list) cmd_list "$@" ;;
    -h|--help|help) usage ;;
    *) err "未知命令: ${sub}"; usage; exit 2 ;;
  esac
}

main "$@"
