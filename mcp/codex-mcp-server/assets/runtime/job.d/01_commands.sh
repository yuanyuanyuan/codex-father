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
  local base_dir; base_dir=$(resolve_workspace_base "$cwd")
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
  "effective_sandbox": null,
  "effective_network_access": null,
  "effective_approval_policy": null,
  "sandbox_bypass": null,
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
  local base_dir; base_dir=$(resolve_workspace_base "$cwd")
  local run_dir
  run_dir="$(sessions_dir "$base_dir")/${job_id}"
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
  local base_dir; base_dir=$(resolve_workspace_base "$cwd")
  local log_file
  log_file="$(sessions_dir "$base_dir")/${job_id}/job.log"
  [[ -f "$log_file" ]] || { err "日志不存在: ${log_file}"; exit 2; }
  if (( follow == 1 )); then
    if [[ -n "$tail_n" ]]; then tail -n "$tail_n" -F "$log_file"; else tail -n 50 -F "$log_file"; fi
  else
    if [[ -n "$tail_n" ]]; then tail -n "$tail_n" "$log_file"; else cat "$log_file"; fi
  fi
}

cmd_stop() {
  local force=0 cwd="" json_out=0
  [[ $# -ge 1 ]] || { err "用法: job.sh stop <job-id> [--force] [--cwd <dir>] [--json]"; exit 2; }
  local job_id="$1"; shift || true
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --force) force=1; shift ;;
      --cwd)
        [[ $# -ge 2 ]] || { err "--cwd 需要路径"; exit 2; }
        cwd="$2"; shift 2 ;;
      --json) json_out=1; shift ;;
      *) shift ;;
    esac
  done
  local base_dir; base_dir=$(resolve_workspace_base "$cwd")
  local run_dir
  run_dir="$(sessions_dir "$base_dir")/${job_id}"
  if [[ ! -d "$run_dir" ]]; then
    if (( json_out == 1 )); then
      cat <<JSON
{
  "jobId": "$(json_escape_local "$job_id")",
  "previousState": null,
  "newState": null,
  "forced": $([[ $force -eq 1 ]] && echo true || echo false),
  "signal": null,
  "action": "not_found",
  "message": "$(json_escape_local "未找到任务目录")"
}
JSON
      return 0
    fi
    err "未找到任务目录: ${run_dir}"
    exit 2
  fi

  local pid_file="${run_dir}/pid"
  local pid=""
  [[ -f "$pid_file" ]] && pid=$(cat "$pid_file" 2>/dev/null || echo "")

  local state_before="unknown"
  local state_json_before=""
  state_json_before=$(status_compute_and_update "$run_dir" 1 2>/dev/null || true)
  if [[ -f "${run_dir}/state.json" ]]; then
    state_before=$(grep -E '"state"' "${run_dir}/state.json" | sed -E 's/.*"state"\s*:\s*"([^"]*)".*/\1/' | head -n1 || echo "unknown")
  fi

  local signal_sent="SIGTERM"
  if (( force == 1 )); then signal_sent="SIGKILL"; fi

  if [[ -z "$pid" ]] || ! pid_alive "$pid"; then
    if (( json_out == 1 )); then
      cat <<JSON
{
  "jobId": "$(json_escape_local "$job_id")",
  "previousState": "$(json_escape_local "$state_before")",
  "newState": "$(json_escape_local "$state_before")",
  "forced": $([[ $force -eq 1 ]] && echo true || echo false),
  "signal": "${signal_sent}",
  "action": "noop",
  "message": "$(json_escape_local "任务已结束")"
}
JSON
      return 0
    fi
    echo "任务已结束 (job: ${job_id})"
    return 0
  fi

  if (( force == 1 )); then kill -9 "$pid" 2>/dev/null || true; else kill "$pid" 2>/dev/null || true; fi
  sleep 0.2
  local state_json_after
  state_json_after=$(status_compute_and_update "$run_dir" 1 2>/dev/null || true)
  local state_after="unknown"
  if [[ -f "${run_dir}/state.json" ]]; then
    state_after=$(grep -E '"state"' "${run_dir}/state.json" | sed -E 's/.*"state"\s*:\s*"([^"]*)".*/\1/' | head -n1 || echo "unknown")
  fi

  if (( json_out == 1 )); then
    cat <<JSON
{
  "jobId": "$(json_escape_local "$job_id")",
  "previousState": "$(json_escape_local "$state_before")",
  "newState": "$(json_escape_local "$state_after")",
  "forced": $([[ $force -eq 1 ]] && echo true || echo false),
  "signal": "${signal_sent}",
  "action": "stop_requested"
}
JSON
  else
    echo "已发送停止信号 (job: ${job_id}, pid: ${pid}, force: ${force})"
  fi
}

cmd_list() {
  local json_out=0 cwd="" tag_filter="" limit=0 offset=0
  local -a state_filters=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json) json_out=1; shift ;;
      --cwd)
        [[ $# -ge 2 ]] || { err "--cwd 需要路径"; exit 2; }
        cwd="$2"; shift 2 ;;
      --state)
        [[ $# -ge 2 ]] || { err "--state 需要值"; exit 2; }
        state_filters+=("$2"); shift 2 ;;
      --tag-contains)
        [[ $# -ge 2 ]] || { err "--tag-contains 需要值"; exit 2; }
        tag_filter="$2"; shift 2 ;;
      --limit)
        [[ $# -ge 2 ]] || { err "--limit 需要数字"; exit 2; }
        [[ "$2" =~ ^[0-9]+$ ]] || { err "--limit 必须是非负整数"; exit 2; }
        limit=$2; shift 2 ;;
      --offset)
        [[ $# -ge 2 ]] || { err "--offset 需要数字"; exit 2; }
        [[ "$2" =~ ^[0-9]+$ ]] || { err "--offset 必须是非负整数"; exit 2; }
        offset=$2; shift 2 ;;
      *) shift ;;
    esac
  done

  local base_dir; base_dir=$(resolve_workspace_base "$cwd")
  local sess_root; sess_root=$(sessions_dir "$base_dir")
  mkdir -p "$sess_root"

  local first=1
  if (( json_out == 1 )); then printf '[\n'; fi

  local emitted=0
  for d in "${sess_root}"/*; do
    [[ -d "$d" ]] || continue
    local id; id=$(basename "$d")
    local state_json
    state_json=$(status_compute_and_update "$d" 1 2>/dev/null || true)

    local state_file="${d}/state.json"
    local state="unknown" created_at="" updated_at="" tag="" title=""
    local classification="" tokens_used=""
    if [[ -f "$state_file" ]]; then
      state=$(grep -E '"state"' "$state_file" | sed -E 's/.*"state"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
      created_at=$(grep -E '"created_at"' "$state_file" | sed -E 's/.*"created_at"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
      updated_at=$(grep -E '"updated_at"' "$state_file" | sed -E 's/.*"updated_at"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
      tag=$(grep -E '"tag"' "$state_file" | sed -E 's/.*"tag"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
      title=$(grep -E '"title"' "$state_file" | sed -E 's/.*"title"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
      classification=$(grep -E '"classification"' "$state_file" | sed -E 's/.*"classification"\s*:\s*"?([^",}]*)"?.*/\1/' | head -n1 || true)
      tokens_used=$(grep -E '"tokens_used"' "$state_file" | sed -E 's/.*"tokens_used"\s*:\s*("?[^"]*"?).*/\1/' | head -n1 || true)
    fi

    if (( ${#state_filters[@]} > 0 )); then
      local match_state=0
      for want in "${state_filters[@]}"; do
        if [[ "$state" == "$want" ]]; then match_state=1; break; fi
      done
      if (( match_state == 0 )); then continue; fi
    fi

    if [[ -n "$tag_filter" && "$tag" != *"$tag_filter"* ]]; then
      continue
    fi

    if (( offset > 0 )); then
      offset=$((offset - 1))
      continue
    fi

    if (( json_out == 1 )); then
      [[ -n "$state_json" ]] || continue
      if (( first == 0 )); then printf ',\n'; fi
      printf '%s\n' "$state_json" | sed 's/^/  /'
      first=0
    else
      printf '%-28s %-10s %-18s %s\n' "$id" "$state" "$tag" "$title"
    fi

    emitted=$((emitted + 1))
    if (( limit > 0 && emitted >= limit )); then break; fi
  done

  if (( json_out == 1 )); then
    if (( first == 0 )); then printf '\n'; fi
    printf ']\n'
  fi
}

cmd_clean() {
  local json_out=0 cwd="" dry_run=0 limit=0 older_than_hours=""
  local -a states=()
  set +e
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json) json_out=1; shift ;;
      --cwd)
        [[ $# -ge 2 ]] || { err "--cwd 需要路径"; exit 2; }
        cwd="$2"; shift 2 ;;
      --state)
        [[ $# -ge 2 ]] || { err "--state 需要值"; exit 2; }
        states+=("$2"); shift 2 ;;
      --older-than-hours)
        [[ $# -ge 2 ]] || { err "--older-than-hours 需要数字"; exit 2; }
        older_than_hours="$2"; shift 2 ;;
      --limit)
        [[ $# -ge 2 ]] || { err "--limit 需要数字"; exit 2; }
        limit="$2"; shift 2 ;;
      --dry-run)
        dry_run=1; shift ;;
      *)
        err "未知参数: $1"; usage; exit 2 ;;
    esac
  done

  if [[ ${#states[@]} -eq 0 ]]; then
    states=("completed" "failed" "stopped")
  fi

  local base_dir; base_dir=$(resolve_workspace_base "$cwd")
  local sess_root; sess_root=$(sessions_dir "$base_dir")
  mkdir -p "$sess_root"

  local -a targets=()
  local -a kept_ids=()
  local -a deleted_ids=()
  local now_epoch; now_epoch=$(date +%s)

  for dir in "$sess_root"/*; do
    [[ -d "$dir" ]] || continue
    local id; id=$(basename "$dir")
    local state_json
    state_json=$(status_compute_and_update "$dir" 1 2>/dev/null || true)
    if [[ -z "$state_json" ]]; then
      kept_ids+=("$id")
      continue
    fi
    local job_state
    job_state=$(printf '%s' "$state_json" | sed -n 's/.*"state"[[:space:]]*:[[:space:]]*"\([^"}]*\)".*/\1/p' | head -n1 || echo "")
    local match=0
    for st in "${states[@]}"; do
      if [[ "$job_state" == "$st" ]]; then match=1; break; fi
    done
    if (( match == 0 )); then
      kept_ids+=("$id")
      continue
    fi
    if [[ -n "$older_than_hours" ]]; then
      local updated_at
      updated_at=$(printf '%s' "$state_json" | sed -n 's/.*"updated_at"[[:space:]]*:[[:space:]]*"\([^"}]*\)".*/\1/p' | head -n1 || echo "")
      if [[ -n "$updated_at" ]]; then
        local updated_epoch
        updated_epoch=$(date -d "$updated_at" +%s 2>/dev/null || date -u -d "$updated_at" +%s 2>/dev/null || echo "")
        if [[ -n "$updated_epoch" ]]; then
          local diff_hours=$(( (now_epoch - updated_epoch) / 3600 ))
          if (( diff_hours < older_than_hours )); then
            kept_ids+=("$id")
            continue
          fi
        fi
      fi
    fi
    targets+=("$id::$dir")
  done

  if (( limit > 0 && ${#targets[@]} > limit )); then
    targets=(${targets[@]:0:limit})
  fi

  for item in "${targets[@]}"; do
    local id="${item%%::*}" dir="${item##*::}"
    deleted_ids+=("$id")
    if (( dry_run == 0 )); then
      rm -rf -- "$dir"
    fi
  done

  if (( json_out == 1 )); then
    local dr_str=$([[ $dry_run -eq 1 ]] && echo true || echo false)
    printf '{"dryRun": %s, "deleted": [' "$dr_str"
    local first=1
    for id in "${deleted_ids[@]}"; do
      local esc; esc=$(json_escape_local "$id")
      if (( first == 1 )); then printf '"%s"' "$esc"; first=0; else printf ',"%s"' "$esc"; fi
    done
    printf '], "kept": ['
    first=1
    for id in "${kept_ids[@]}"; do
      local esc; esc=$(json_escape_local "$id")
      if (( first == 1 )); then printf '"%s"' "$esc"; first=0; else printf ',"%s"' "$esc"; fi
    done
    printf '], "limit": %s}\n' "$limit"
  else
    if (( dry_run == 1 )); then
      echo "[dry-run] 将清理以下任务: ${deleted_ids[*]:-无}"
    else
      echo "已清理任务: ${deleted_ids[*]:-无}"
    fi
    if (( ${#kept_ids[@]} > 0 )); then
      echo "保留任务: ${kept_ids[*]}"
    fi
  fi
  set -e
}

cmd_metrics() {
  local json_out=0 cwd=""
  local -a states=()
  set +e
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --json) json_out=1; shift ;;
      --cwd)
        [[ $# -ge 2 ]] || { err "--cwd 需要路径"; exit 2; }
        cwd="$2"; shift 2 ;;
      --state)
        [[ $# -ge 2 ]] || { err "--state 需要值"; exit 2; }
        states+=("$2"); shift 2 ;;
      *)
        err "未知参数: $1"; usage; exit 2 ;;
    esac
  done

  local base_dir; base_dir=$(resolve_workspace_base "$cwd")
  local sess_root; sess_root=$(sessions_dir "$base_dir")
  mkdir -p "$sess_root"

  local total=0
  declare -A state_counts=()
  declare -A class_counts=()
  local tokens_sum=0

  for dir in "$sess_root"/*; do
    [[ -d "$dir" ]] || continue
    local state_json
    state_json=$(status_compute_and_update "$dir" 1 2>/dev/null || true)
    [[ -n "$state_json" ]] || continue
    local job_state
    job_state=$(printf '%s' "$state_json" | sed -n 's/.*"state"[[:space:]]*:[[:space:]]*"\([^"}]*\)".*/\1/p' | head -n1 || echo "")
    if [[ ${#states[@]} -gt 0 ]]; then
      local match=0
      for st in "${states[@]}"; do
        if [[ "$job_state" == "$st" ]]; then match=1; break; fi
      done
      (( match == 1 )) || continue
    fi
    (( total++ ))
    state_counts["$job_state"]=$(( ${state_counts["$job_state"]:-0} + 1 ))
    local cls
    cls=$(printf '%s' "$state_json" | sed -n 's/.*"classification"[[:space:]]*:[[:space:]]*"\([^"}]*\)".*/\1/p' | head -n1 || echo "")
    if [[ -n "$cls" && "$cls" != "null" ]]; then
      class_counts["$cls"]=$(( ${class_counts["$cls"]:-0} + 1 ))
    fi
    local tok
    tok=$(printf '%s' "$state_json" | sed -n 's/.*"tokens_used"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' | head -n1 || echo "")
    if [[ -n "$tok" ]]; then
      tokens_sum=$(( tokens_sum + tok ))
    fi
  done

  if (( json_out == 1 )); then
    printf '{"total": %s, "byState": {' "$total"
    local first=1
    for key in "${!state_counts[@]}"; do
      local esc; esc=$(json_escape_local "$key")
      if (( first == 1 )); then printf '"%s": %s' "$esc" "${state_counts[$key]}"; first=0; else printf ',"%s": %s' "$esc" "${state_counts[$key]}"; fi
    done
    printf '}, "byClassification": {'
    first=1
    for key in "${!class_counts[@]}"; do
      local esc; esc=$(json_escape_local "$key")
      if (( first == 1 )); then printf '"%s": %s' "$esc" "${class_counts[$key]}"; first=0; else printf ',"%s": %s' "$esc" "${class_counts[$key]}"; fi
    done
    printf '}, "tokensUsed": %s}\n' "$tokens_sum"
  else
    echo "任务总数: ${total}"
    for key in "${!state_counts[@]}"; do
      printf '  %s: %s\n' "$key" "${state_counts[$key]}"
    done
    if (( ${#class_counts[@]} > 0 )); then
      echo "分类统计:"
      for key in "${!class_counts[@]}"; do
        printf '  %s: %s\n' "$key" "${class_counts[$key]}"
      done
    fi
    echo "tokens_used 总计: ${tokens_sum}"
  fi
  set -e
}
