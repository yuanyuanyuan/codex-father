#!/usr/bin/env bash

set -euo pipefail

# Async job manager for start.sh

JOB_ROOT_DIR="${SCRIPT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
# 允许通过环境变量覆盖 start.sh 的路径，便于测试/替换实现
if [[ -n "${CODEX_START_SH:-}" && -x "${CODEX_START_SH}" ]]; then
  START_SH="${CODEX_START_SH}"
else
  START_SH="${JOB_ROOT_DIR}/start.sh"
fi

# shellcheck disable=SC1091
if [[ -f "${JOB_ROOT_DIR}/lib/common.sh" ]]; then . "${JOB_ROOT_DIR}/lib/common.sh"; fi

usage() {
  cat <<'EOF'
用法: job.sh <命令> [参数]

命令:
  start [start.sh 同参…] [--tag <t>] [--cwd <dir>] [--json]
        后台启动一次 codex 运行，立刻返回 job-id 与句柄。
  resume <job-id> [--tag <t>] [--cwd <dir>] [--json] [-- <start 参数…>]
        复用既有任务的参数重新启动 start.sh，返回新的 job-id。
  status <job-id> [--json]
        查询任务状态，若已结束则补充分类与摘要。
  logs <job-id> [--tail N] [--follow]
        查看任务日志；--follow 持续跟随。
  stop <job-id> [--force]
        终止任务；默认 SIGTERM，--force 使用 SIGKILL。
  list [--json]
        罗列已知任务（runs/*）。
  clean [--state <s>] [--older-than-hours N] [--limit M] [--dry-run] [--json]
        按条件清理历史任务，默认处理 completed/failed/stopped。
  metrics [--json]
        输出任务状态分布与基础统计。

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
  # Usage: sessions_dir [workspace_dir]
  local hint="${1:-}"
  if [[ -n "${CODEX_SESSIONS_ROOT:-}" ]]; then
    printf '%s' "${CODEX_SESSIONS_ROOT%/}"
    return
  fi
  local base parent
  if [[ -n "$hint" ]]; then
    base="$hint"
  else
    base="$JOB_ROOT_DIR"
  fi
  parent="$(dirname "$base")"
  local -a candidates=(
    "$base/.codex-father/sessions"
    "$base/.codex-father-sessions"
    "$parent/.codex-father-sessions"
    "$parent/.codex-father/sessions"
  )
  local c
  for c in "${candidates[@]}"; do
    if [[ -d "$c" ]]; then printf '%s' "$c"; return; fi
  done
  printf '%s' "${candidates[0]}"
}

# 追加一条 events.jsonl 事件（最小统一格式）
# Usage: append_jsonl_event <run_dir> <event> [data_json]
append_jsonl_event() {
  local run_dir="$1"; shift || true
  local evt="$1"; shift || true
  local data_json="${1:-"{}"}"
  [[ -n "$run_dir" && -n "$evt" ]] || return 0
  local events_file="${run_dir}/events.jsonl"
  local seq_file="${run_dir}/events.seq"
  umask 077
  mkdir -p "$run_dir" 2>/dev/null || true
  if [[ ! -f "$seq_file" ]]; then echo 0 >"$seq_file" 2>/dev/null || true; fi
  # shellcheck disable=SC2155
  local seq; seq=$(cat "$seq_file" 2>/dev/null || echo 0)
  if [[ ! "$seq" =~ ^[0-9]+$ ]]; then seq=0; fi
  seq=$((seq+1))
  printf '%s' "$seq" >"$seq_file" 2>/dev/null || true
  local ts; ts=$(now_iso)
  local job_id; job_id="$(basename "$run_dir")"
  # data_json 允许调用方传入已是 JSON 对象的字符串
  local line
  line=$(cat <<EOF
{"event":"${evt}","timestamp":"${ts}","orchestrationId":"${job_id}","seq":${seq},"data":${data_json}}
EOF
)
  printf '%s\n' "$line" >> "$events_file"
}

resolve_workspace_base() {
  # Usage: resolve_workspace_base [cwd_override]
  local explicit="${1:-}"
  if [[ -n "$explicit" ]]; then
    printf '%s' "$explicit"
  else
    printf '%s' "$JOB_ROOT_DIR"
  fi
}

safe_tag() {
  local t="$1"
  printf '%s' "${t}" | tr -cs 'A-Za-z0-9_.-' '-' | sed 's/^-\+//; s/-\+$//'
}

gen_job_id() {
  local tag="$1"
  local ts; ts=$(date +%Y%m%d_%H%M%S)
  # 增加毫秒与短随机后缀，避免并发/同秒碰撞
  local ms; ms=$(date +%N 2>/dev/null | cut -c1-3)
  local rnd
  if command -v tr >/dev/null 2>&1 && command -v head >/dev/null 2>&1; then
    rnd=$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom 2>/dev/null | head -c4 || printf '%04d' "$RANDOM")
  else
    rnd=$(printf '%04d' "$RANDOM")
  fi
  local suffix="${ms:+.${ms}}-${rnd}"
  if [[ -n "${tag}" ]]; then
    local st; st=$(safe_tag "${tag}")
    printf 'cdx-%s%s-%s' "${ts}" "${suffix}" "${st}"
  else
    printf 'cdx-%s%s' "${ts}" "${suffix}"
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

extract_args_from_state() {
  local state_file="$1"
  [[ -f "$state_file" ]] || return 1
  if ! command -v node >/dev/null 2>&1; then
    return 2
  fi
  node - "$state_file" <<'EOF'
const fs = require('fs');
const file = process.argv[2] || process.argv[1];
if (!file || file === '-') {
  process.exit(4);
}
try {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(data.args)) {
    process.exit(3);
  }
  for (const arg of data.args) {
    const value = typeof arg === 'string' ? arg : String(arg ?? '');
    process.stdout.write(value);
    process.stdout.write('\u0000');
  }
} catch (error) {
  process.exit(4);
}
EOF
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
  local err_file
  err_file="$(dirname "$log_file")/bootstrap.err"
  SC_CLASSIFICATION="normal"; SC_TOKENS_USED=""
  if declare -F classify_exit >/dev/null 2>&1; then
    classify_exit "$last_msg_file" "$log_file" "$code"
    SC_CLASSIFICATION="${CLASSIFICATION:-normal}"
    SC_TOKENS_USED="${TOKENS_USED:-}"
    return 0
  fi
  # Fallback grep-based classification
  SC_TOKENS_USED="$(grep -Ei 'tokens used' "$log_file" 2>/dev/null | tail -n1 | sed -E 's/.*tokens used[^0-9]*([0-9,]+).*/\1/i' | tr -d ',' || true)"
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
    # 输入/参数错误优先识别，避免误判为网络/鉴权
    if grep -Eqi '(未知参数|未知预设|Unknown[[:space:]]+(argument|option|preset)|invalid[[:space:]]+(option|argument)|错误:[[:space:]]+--[A-Za-z0-9_-]+[[:space:]]*需要|用法:[[:space:]]*start\.sh|Usage:[[:space:]]*start\.sh)' "$log_file" ${last_msg_file:+"$last_msg_file"} ${err_file:+"$err_file"} 2>/dev/null; then
      SC_CLASSIFICATION='input_error'
    elif declare -F detect_context_overflow_in_files >/dev/null 2>&1 \
         && detect_context_overflow_in_files ${log_file:+"$log_file"} ${last_msg_file:+"$last_msg_file"} ${err_file:+"$err_file"}; then
      SC_CLASSIFICATION='context_overflow'
    elif grep -Eqi 'approval|require.*confirm|denied by approval' "$log_file" ${last_msg_file:+"$last_msg_file"} ${err_file:+"$err_file"} 2>/dev/null; then
      SC_CLASSIFICATION='approval_required'
    elif grep -Eqi 'sandbox|permission|not allowed|denied by sandbox' "$log_file" ${last_msg_file:+"$last_msg_file"} ${err_file:+"$err_file"} 2>/dev/null; then
      SC_CLASSIFICATION='sandbox_denied'
    elif grep -Eqi '(ETIMEDOUT|EAI_AGAIN|ENOTFOUND|ECONN(REFUSED|RESET|ABORTED)?|ENET(UNREACH|DOWN)|EHOSTUNREACH|getaddrinfo|socket[[:space:]]+hang[[:space:]]+up|TLS[[:space:]]+handshake[[:space:]]+failed|DNS( lookup)? failed|connection[[:space:]]+(reset|refused|timed[[:space:]]+out)|request[[:space:]]+tim(ed|e)[[:space:]]+out|deadline[ _-]?exceeded|fetch[[:space:]]+failed)' "$log_file" ${err_file:+"$err_file"} 2>/dev/null; then
      SC_CLASSIFICATION='network_error'
    elif grep -Eqi 'unsupported[[:space:]]+model|unknown[[:space:]]+model|model[[:space:]]+not[[:space:]]+found' "$log_file" ${last_msg_file:+"$last_msg_file"} ${err_file:+"$err_file"} 2>/dev/null; then
      SC_CLASSIFICATION='config_error'
    elif grep -Eqi 'unauthorized|forbidden|invalid api key|401|403' "$log_file" ${last_msg_file:+"$last_msg_file"} ${err_file:+"$err_file"} 2>/dev/null; then
      SC_CLASSIFICATION='auth_error'
    elif grep -Eqi 'too many requests|rate limit|429' "$log_file" ${last_msg_file:+"$last_msg_file"} ${err_file:+"$err_file"} 2>/dev/null; then
      SC_CLASSIFICATION='rate_limited'
    elif grep -Eqi 'Command failed|non-zero exit|failed to execute' "$log_file" ${last_msg_file:+"$last_msg_file"} ${err_file:+"$err_file"} 2>/dev/null; then
      SC_CLASSIFICATION='tool_error'
    else
      SC_CLASSIFICATION='error'
    fi
  fi
}

# 检测“仅产出补丁(补丁模式)”是否满足成功条件：
# - 启用了 --patch-mode（从日志推断）
# - last_msg 中包含可应用的补丁片段与控制信号 CONTROL: DONE
patch_only_success() {
  local last_msg_file="$1"; local log_file="$2"
  [[ -n "$last_msg_file" && -f "$last_msg_file" ]] || return 1
  # 判断是否是补丁模式（多种线索，尽量宽松匹配）
  if ! grep -Eiq -- "(--patch-mode|补丁模式|patch[ -]?mode)" "$log_file" 2>/dev/null; then
    return 2
  fi
  # 判断补丁与控制标记
  grep -Eq "^\*\*\* Begin Patch" "$last_msg_file" 2>/dev/null || return 3
  grep -Eq "^\*\*\* End Patch" "$last_msg_file" 2>/dev/null   || return 4
  grep -Eq "CONTROL:[[:space:]]*DONE" "$last_msg_file" 2>/dev/null || return 5
  return 0
}

derive_exit_code_from_log() {
  local log="$1"
  [[ -f "$log" ]] || { echo ""; return 0; }
  local ln
  # 匹配包含 Exit Code 的行（不要求行首），兼容 trap 合并行写法
  ln=$(grep -E "Exit Code:[[:space:]]*-?[0-9]+" "$log" | tail -n1 || true)
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
  # 防止 grep/awk 等返回非零导致整个脚本在 set -e/-u 下退出
  set +e
  set +u
  local state_file="${run_dir}/state.json"
  local pid_file="${run_dir}/pid"
  local log_file="${run_dir}/job.log"
  local meta_glob="${run_dir}/*.meta.json"
  local last_glob="${run_dir}/*.last.txt"

  local id; id=$(basename "$run_dir")
  local pid=""; [[ -f "$pid_file" ]] && pid=$(cat "$pid_file" 2>/dev/null || echo "")
  local running=0
  if pid_alive "$pid"; then running=1; fi

  local state exit_code classification tokens_used title last_msg meta_file resumed_from=""
  local effective_sandbox_json="null" effective_network_json="null" effective_approval_json="null" sandbox_bypass_json="null"
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
    # Prefer meta.json if present
    if [[ -n "${meta_file}" && -f "${meta_file}" ]]; then
      local m_cls m_tok m_sandbox m_network m_approval m_bypass
      m_cls=$(grep -E '"classification"' "$meta_file" | sed -E 's/.*"classification"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
      m_tok=$(grep -E '"tokens_used"' "$meta_file" | sed -E 's/.*"tokens_used"\s*:\s*"?([^",}]*)"?.*/\1/' | head -n1 || true)
      m_tok="${m_tok//\"/}"
      m_tok="${m_tok// /}"
      m_tok="${m_tok%,}"
      m_sandbox=$(grep -E '"effective_sandbox"' "$meta_file" | sed -E 's/.*"effective_sandbox"\s*:\s*"?([^",}]*)"?.*/\1/' | head -n1 || true)
      m_network=$(grep -E '"effective_network_access"' "$meta_file" | sed -E 's/.*"effective_network_access"\s*:\s*"?([^",}]*)"?.*/\1/' | head -n1 || true)
      m_approval=$(grep -E '"effective_approval_policy"' "$meta_file" | sed -E 's/.*"effective_approval_policy"\s*:\s*"?([^",}]*)"?.*/\1/' | head -n1 || true)
      m_bypass=$(grep -E '"sandbox_bypass"' "$meta_file" | sed -E 's/.*"sandbox_bypass"\s*:\s*([^",}\s]+).*/\1/' | head -n1 || true)
      if [[ -n "$m_cls" && "$m_cls" != "null" ]]; then classification="\"$(json_escape_local "$m_cls")\""; fi
      if [[ -n "$m_tok" && "$m_tok" != "null" ]]; then
        local numeric_tok="${m_tok//,/}"
        if [[ "$numeric_tok" =~ ^[0-9]+$ ]]; then
          tokens_used="$numeric_tok"
        else
          tokens_used="null"
        fi
      fi
      if [[ -n "$m_sandbox" && "$m_sandbox" != "null" ]]; then
        effective_sandbox_json="\"$(json_escape_local "$m_sandbox")\""
      fi
      if [[ -n "$m_network" && "$m_network" != "null" ]]; then
        effective_network_json="\"$(json_escape_local "$m_network")\""
      fi
      if [[ -n "$m_approval" && "$m_approval" != "null" ]]; then
        effective_approval_json="\"$(json_escape_local "$m_approval")\""
      fi
      if [[ -n "$m_bypass" && "$m_bypass" != "null" ]]; then
        sandbox_bypass_json="$m_bypass"
      fi
    fi
    # Fallback to on-the-fly classification
    if [[ "$classification" == "null" || "$tokens_used" == "null" ]]; then
      safe_classify "${last_msg:-}" "${log_file}" "${code}"
      if [[ "$classification" == "null" && -n "${SC_CLASSIFICATION:-}" ]]; then classification="\"$(json_escape_local "${SC_CLASSIFICATION}")\""; fi
      if [[ "$tokens_used" == "null" && -n "${SC_TOKENS_USED:-}" ]]; then
        local normalized_tok="${SC_TOKENS_USED//,/}"
        if [[ "$normalized_tok" =~ ^[0-9]+$ ]]; then
          tokens_used="${normalized_tok}"
        else
          tokens_used="null"
        fi
      fi
    fi

    # 优化：若为“仅产出补丁”任务且补丁已正确生成，则将状态视为成功
    # 条件：非零退出码 + 补丁模式 + last_msg 含有效补丁 + CONTROL: DONE
    if [[ "$code" -ne 0 ]] && patch_only_success "${last_msg:-}" "${log_file}"; then
      code=0
      exit_code="0"
      state="completed"
      classification="\"patch_only\""
    fi
    # stopped vs completed/failed: rely on exit_code
    if [[ "$code" -eq 0 ]]; then
      state="completed"
    elif [[ "$code" -lt 0 ]]; then
      state="stopped"
      # 强制覆盖为用户中断，避免误判为审批等其他分类
      classification="\"user_cancelled\""
      exit_code="null"
    else
      state="failed"
    fi
  fi

  # Read tag/cwd from existing state if present to keep stable metadata
  local tag="" cwd="" created_at=""
  local -a existing_args=()
  local args_json="[]"
  if [[ -f "$state_file" ]]; then
    # Try to recover original fields
    tag=$(grep -E '"tag"' "$state_file" | sed -E 's/.*"tag"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
    cwd=$(grep -E '"cwd"' "$state_file" | sed -E 's/.*"cwd"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
    resumed_from=$(grep -E '"resumed_from"' "$state_file" | sed -E 's/.*"resumed_from"\s*:\s*"?([^",}]*)"?.*/\1/' | head -n1 || true)
    if [[ "$resumed_from" == "null" ]]; then resumed_from=""; fi
    if mapfile -t -d '' existing_args < <(extract_args_from_state "$state_file"); then
      if (( ${#existing_args[@]} > 0 )) && [[ -z "${existing_args[-1]}" ]]; then
        unset 'existing_args[-1]'
      fi
      if (( ${#existing_args[@]} > 0 )); then
        args_json=$(build_args_json_array "${existing_args[@]}")
      fi
    fi
  fi

  local updated_at; updated_at=$(now_iso)
  if [[ -f "$state_file" ]]; then
    created_at=$(grep -E '"created_at"' "$state_file" | sed -E 's/.*"created_at"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
  fi
  if [[ -z "$created_at" ]]; then
    created_at="$updated_at"
  fi

  local pid_json
  if [[ -n "$pid" ]]; then pid_json="$pid"; else pid_json="null"; fi

  local exit_json
  if [[ "$exit_code" == "null" ]]; then exit_json="null"; else exit_json="$exit_code"; fi

  local title_json
  if [[ -n "$title" ]]; then title_json="\"$(json_escape_local "$title")\""; else title_json="null"; fi

  local meta_glob_json="\"$(json_escape_local "$meta_glob")\""
  local last_glob_json="\"$(json_escape_local "$last_glob")\""

  local resumed_json="null"
  if [[ -n "$resumed_from" ]]; then
    resumed_json="\"$(json_escape_local "$resumed_from")\""
  fi

  local json
  json=$(cat <<EOF
{
  "id": "$(json_escape_local "$id")",
  "pid": ${pid_json},
  "state": "$(json_escape_local "$state")",
  "exit_code": ${exit_json},
  "classification": ${classification},
  "tokens_used": ${tokens_used},
  "effective_sandbox": ${effective_sandbox_json},
  "effective_network_access": ${effective_network_json},
  "effective_approval_policy": ${effective_approval_json},
  "sandbox_bypass": ${sandbox_bypass_json},
  "cwd": "$(json_escape_local "${cwd}")",
  "created_at": "$(json_escape_local "$created_at")",
  "updated_at": "$(json_escape_local "$updated_at")",
  "tag": "$(json_escape_local "${tag}")",
  "log_file": "$(json_escape_local "$log_file")",
  "meta_glob": ${meta_glob_json},
  "last_message_glob": ${last_glob_json},
  "args": ${args_json},
  "title": ${title_json},
  "resumed_from": ${resumed_json}
}
EOF
)
  write_state "$state_file" "$json"
  # 恢复严格模式
  set -u
  set -e
  if (( json_out == 1 )); then printf '%s\n' "$json"; else
    echo "id: $id"
    echo "state: $state"
    echo "pid: ${pid:-}"
    echo "exit_code: ${exit_code}"
    echo "log: $log_file"
    if [[ ${effective_sandbox_json} != "null" ]]; then
      echo "effective_sandbox: ${effective_sandbox_json//\"/}"
    fi
    if [[ ${effective_network_json} != "null" ]]; then
      echo "effective_network: ${effective_network_json//\"/}"
    fi
    if [[ ${effective_approval_json} != "null" ]]; then
      echo "effective_approval: ${effective_approval_json//\"/}"
    fi
    [[ -n "$title" ]] && echo "title: $title"
    [[ -n "$resumed_from" ]] && echo "resumed_from: $resumed_from"
  fi
}
