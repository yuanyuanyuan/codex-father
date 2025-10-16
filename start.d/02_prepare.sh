
# Missing function definition - add fallback
safe_truncate_utf8() {
  local input="$1"
  local max_length="${2:-80}"
  echo "$input" | cut -c1-"$max_length"
}

# 按版本拦截 0.44-only 参数（严格模式）
check_version_param_compatibility
if [[ -n "${VALIDATION_ERROR}" ]]; then
  {
    echo "===== Codex Run Start: ${TS}${TAG_SUFFIX} (${TS_DISPLAY:-${TS}}) ====="
    echo "Script: $(basename "$0")  PWD: $(pwd)"
    echo "Log: ${CODEX_LOG_FILE}"
    echo "Meta: ${META_FILE}"
    echo "[arg-check] ${VALIDATION_ERROR}"
  } >> "${CODEX_LOG_FILE}"
  printf '%s\n' "${VALIDATION_ERROR}" >&2
  exit 2
fi

compute_effective_runtime_flags

# 兼容性归一化：将 --config model=gpt-5-codex-<effort> 规范化为
# --config model=gpt-5-codex + --config model_reasoning_effort=<effort>
normalize_model_effort_compat() {
  local -a rebuilt=()
  local i=0
  local effort_seen=0
  while (( i < ${#CODEX_GLOBAL_ARGS[@]} )); do
    local current="${CODEX_GLOBAL_ARGS[$i]}"
    if [[ "$current" == "--config" ]] && (( i + 1 < ${#CODEX_GLOBAL_ARGS[@]} )); then
      local kv="${CODEX_GLOBAL_ARGS[$((i+1))]}"
      local key="${kv%%=*}"
      local val="${kv#*=}"
      if [[ "$key" == "model_reasoning_effort" ]]; then
        effort_seen=1
      fi
      # 仅对 gpt-5-codex-<effort> 进行安全拆分
      if [[ "$key" == "model" && "$val" =~ ^(gpt-5-codex)-(minimal|low|medium|high)$ ]]; then
        local base="${BASH_REMATCH[1]}"; local eff="${BASH_REMATCH[2]}"
        rebuilt+=("--config" "model=${base}")
        # 若未看到已有的 effort 配置，再追加一条
        if (( effort_seen == 0 )); then
          rebuilt+=("--config" "model_reasoning_effort=${eff}")
          effort_seen=1
        fi
        i=$((i+2))
        continue
      fi
      rebuilt+=("--config" "$kv")
      i=$((i+2))
      continue
    fi
    rebuilt+=("$current")
    i=$((i+1))
  done
  CODEX_GLOBAL_ARGS=("${rebuilt[@]}")
}

normalize_model_effort_compat

# 组合规则（叠加语义）
STDIN_USED=0
STDIN_CONTENT=""
BASE_SOURCE_DESC=""
BASE_SOURCE_KIND="default"

# 计算基底
if [[ -n "${OVERRIDE_FILE}" ]]; then
  if [[ "${OVERRIDE_FILE}" == "-" ]]; then
    if [[ -t 0 ]]; then
      echo "错误: 标准输入为空，无法从 '-' 读取（用于 --file-override）" >&2
      exit 2
    fi
    STDIN_CONTENT="$(cat)"; STDIN_USED=1
    INSTRUCTIONS="${STDIN_CONTENT}"
    BASE_SOURCE_DESC="override: STDIN"
    BASE_SOURCE_KIND="override-stdin"
  else
    [[ -f "${OVERRIDE_FILE}" ]] || { echo "错误: 文件不存在: ${OVERRIDE_FILE}" >&2; exit 2; }
    INSTRUCTIONS="$(cat "${OVERRIDE_FILE}")"
    BASE_SOURCE_DESC="override file: ${OVERRIDE_FILE}"
    BASE_SOURCE_KIND="override-file"
  fi
else
  if [[ -f "${DEFAULT_INSTRUCTIONS_FILE}" ]]; then
    INSTRUCTIONS="$(cat "${DEFAULT_INSTRUCTIONS_FILE}")"
    BASE_SOURCE_DESC="default file: ${DEFAULT_INSTRUCTIONS_FILE}"
    BASE_SOURCE_KIND="default-file"
  else
    INSTRUCTIONS="${DEFAULT_INSTRUCTIONS}"
    BASE_SOURCE_DESC="builtin default"
    BASE_SOURCE_KIND="default-builtin"
  fi
  # 沿用旧优先级：当未提供任何叠加/覆盖输入时，允许环境变量或 STDIN 作为基底
  if [[ ${#SRC_TYPES[@]} -eq 0 && -z "${PREPEND_FILE}" && -z "${APPEND_FILE}" && -z "${PREPEND_CONTENT}" && -z "${APPEND_CONTENT}" ]]; then
    if [[ -n "${INSTRUCTIONS:-}" ]]; then
      INSTRUCTIONS="${INSTRUCTIONS}"
      BASE_SOURCE_DESC="env: INSTRUCTIONS"
      BASE_SOURCE_KIND="env"
    elif ! [[ -t 0 ]]; then
      STDIN_CONTENT="$(cat)"; STDIN_USED=1
      INSTRUCTIONS="${STDIN_CONTENT}"
      BASE_SOURCE_DESC="STDIN"
      BASE_SOURCE_KIND="stdin"
    fi
  fi
fi

# 校验 STDIN 使用次数（'-' 只能出现一次）
STDIN_REQ_COUNT=0
for f in "${FILE_INPUTS[@]}"; do
  if [[ "$f" == "-" ]]; then ((STDIN_REQ_COUNT++)); fi
done
if [[ "${OVERRIDE_FILE}" == "-" ]]; then ((STDIN_REQ_COUNT++)); fi
if (( STDIN_REQ_COUNT > 1 )); then
  echo "错误: 多处请求从 STDIN 读取（通过 '-'），请只在一个位置使用 '-'。" >&2
  exit 2
fi

# 叠加 -f/-c 源（保持命令行顺序）
SOURCE_LINES=()
SOURCE_LINES+=("Base: ${BASE_SOURCE_DESC}")
for i in "${!SRC_TYPES[@]}"; do
  t="${SRC_TYPES[$i]}"; v="${SRC_VALUES[$i]}"
  case "$t" in
    F)
      if [[ "$v" == "-" ]]; then
        if (( STDIN_USED == 1 )); then
          echo "错误: STDIN 已被使用，无法再次从 '-' 读取" >&2
          exit 2
        fi
        if [[ -t 0 ]]; then
          echo "错误: 标准输入为空，无法从 '-' 读取" >&2
          exit 2
        fi
        STDIN_CONTENT="$(cat)"; STDIN_USED=1
        INSTRUCTIONS="${INSTRUCTIONS}"$'\n\n'"${STDIN_CONTENT}"
        SOURCE_LINES+=("Add file: STDIN")
      else
        if [[ -f "$v" ]]; then
          INSTRUCTIONS="${INSTRUCTIONS}"$'\n\n'"$(cat "$v")"
          SOURCE_LINES+=("Add file: $v")
        else
          # 更友好的调试信息
          if [[ "$v" == *'*'* || "$v" == *'?'* || "$v" == *'['* ]]; then
            mapfile -t _dbg_matches < <(compgen -G -- "$v" || true)
            echo "错误: 文件不存在: $v" >&2
            echo "🔎 调试信息:" >&2
            echo "   - 搜索模式: $v" >&2
            echo "   - 工作目录: $(pwd)" >&2
            echo "   - 匹配到的文件: ${#_dbg_matches[@]} 个" >&2
            if (( ${#_dbg_matches[@]} > 0 )); then
              printf '     • %s\n' "${_dbg_matches[@]}" >&2
            fi
            echo "   - 建议: 确认路径/通配符是否正确；必要时改用具体文件或 --docs-dir 目录" >&2
          else
            echo "错误: 文件不存在: $v" >&2
            echo "   - 工作目录: $(pwd)" >&2
          fi
          exit 2
        fi
      fi
      ;;
    C)
      INSTRUCTIONS="${INSTRUCTIONS}"$'\n\n'"${v}"
      # 仅记录首 80 字符，换行替换为空格
      _preview=$(printf '%s' "${v}" | tr '\n' ' ' | cut -c1-80)
      SOURCE_LINES+=("Add text: ${_preview}...")
      ;;
  esac
done

# 组合前后模板
if [[ -n "${PREPEND_FILE}" ]]; then
  [[ -f "${PREPEND_FILE}" ]] || { echo "错误: 前置文件不存在: ${PREPEND_FILE}" >&2; exit 2; }
  PREPEND_CONTENT+="$([[ -n "${PREPEND_CONTENT}" ]] && echo -e "\n")$(cat "${PREPEND_FILE}")"
  SOURCE_LINES+=("Prepend file: ${PREPEND_FILE}")
fi
if [[ -n "${APPEND_FILE}" ]]; then
  [[ -f "${APPEND_FILE}" ]] || { echo "错误: 后置文件不存在: ${APPEND_FILE}" >&2; exit 2; }
  APPEND_CONTENT+="$([[ -n "${APPEND_CONTENT}" ]] && echo -e "\n")$(cat "${APPEND_FILE}")"
  SOURCE_LINES+=("Append file: ${APPEND_FILE}")
fi
if [[ -n "${PREPEND_CONTENT}" ]]; then
  INSTRUCTIONS="${PREPEND_CONTENT}

${INSTRUCTIONS}"
  _pv=$(printf '%s' "${PREPEND_CONTENT}" | tr '\n' ' ' | cut -c1-80)
  SOURCE_LINES+=("Prepend text: ${_pv}...")
fi
if [[ -n "${APPEND_CONTENT}" ]]; then
  INSTRUCTIONS="${INSTRUCTIONS}

${APPEND_CONTENT}"
  _pv=$(printf '%s' "${APPEND_CONTENT}" | tr '\n' ' ' | cut -c1-80)
  SOURCE_LINES+=("Append text: ${_pv}...")
fi

## 注意：上面的“日志路径提前初始化”已完成上述逻辑，以下保留变量用于后续步骤。

# =============== 协作共享上下文：跨 job 继承（可选） ===============
if [[ -n "${CODEX_SHARED_CONTEXT_INHERIT:-}" && -n "${CODEX_SESSION_DIR:-}" ]]; then
  IFS=',' read -r -a _ctx_jobs <<< "${CODEX_SHARED_CONTEXT_INHERIT}"
  for _jid in "${_ctx_jobs[@]}"; do
    _jid_trimmed="$(echo "${_jid}" | sed 's/^\s\+//;s/\s\+$//')"
    [[ -n "${_jid_trimmed}" ]] || continue
    _sess_root="$(dirname "${CODEX_SESSION_DIR}")"
    _other_dir="${_sess_root}/${_jid_trimmed}"
    if [[ -d "${_other_dir}" ]]; then
      _last_file=$(ls -1t "${_other_dir}"/*.last.txt 2>/dev/null | head -n1 || true)
      if [[ -n "${_last_file}" && -f "${_last_file}" ]]; then
        header=$'\n\n<!-- imported-context -->\n[context] Imported from '
        PREPEND_CONTENT+="$header${_jid_trimmed}:\n$(cat "${_last_file}")\n"
        SOURCE_LINES+=("Import context: ${_jid_trimmed} -> ${_last_file}")
      fi
    fi
  done
fi

# =============== 进度文件 (progress.json) 写入 ===============
progress_write() {
  local current="$1"; local total="$2"; local task="$3"; local eta="$4"
  [[ -n "${CODEX_SESSION_DIR:-}" ]] || return 0
  local out="${CODEX_SESSION_DIR}/progress.json"
  local pct=0
  if [[ "$total" =~ ^[0-9]+$ && "$total" -gt 0 && "$current" =~ ^[0-9]+$ ]]; then
    pct=$(( 100 * current / total ))
    if (( pct > 100 )); then pct=100; fi
  fi
  local eta_json="null"
  local eta_h=""
  if [[ -n "$eta" && "$eta" =~ ^[0-9]+$ ]]; then
    eta_json="$eta"
    if (( eta < 60 )); then eta_h="${eta}s";
    elif (( eta < 3600 )); then eta_h="$((eta/60))m";
    else eta_h="$((eta/3600))h"; fi
  fi
  local task_json="null"; [[ -n "$task" ]] && task_json="\"$(printf '%s' "$task" | sed 's/\\/\\\\/g; s/\"/\\\"/g')\""
  umask 077
  cat >"$out.tmp" <<JSON
{"current": ${current:-0}, "total": ${total:-1}, "percentage": ${pct}, "currentTask": ${task_json}, "etaSeconds": ${eta_json}, "etaHuman": $( [[ -n "$eta_h" ]] && printf '"%s"' "$eta_h" || printf null ), "estimatedTimeLeft": $( [[ -n "$eta_h" ]] && printf '"%s"' "$eta_h" || printf null )}
JSON
  mv -f "$out.tmp" "$out"
  # 同步写入 progress_updated 事件
  if [[ -n "${CODEX_SESSION_DIR:-}" ]]; then
    local data
    data=$(cat "$out" 2>/dev/null || echo '{}')
    append_jsonl_event "${CODEX_SESSION_DIR}" "progress_updated" "${data}"
  fi
}

# 初始进度：准备阶段完成（current=0）
if [[ -n "${CODEX_SESSION_DIR:-}" ]]; then
  local_total=${MAX_RUNS:-1}
  _title_preview=$(printf '%s' "${INSTRUCTIONS}" | awk 'NF {print; exit}' | safe_truncate_utf8 80)
  progress_write 0 "${local_total}" "准备指令: ${_title_preview}" ""
fi

# =============== Checkpoint 记录（JSONL） ===============
checkpoint_add() {
  [[ -n "${CODEX_SESSION_DIR:-}" ]] || return 0
  local step="$1"; local status="$2"; local artifact="$3"; local err_msg="${4:-}"; local dur_ms="${5:-}"; local ctx="${6:-}"
  local out="${CODEX_SESSION_DIR}/checkpoints.jsonl"
  local ts; ts=$(date -u "+%Y-%m-%dT%H:%M:%SZ")
  local esc_art="$(printf '%s' "$artifact" | sed 's/\\/\\\\/g; s/\"/\\\"/g')"
  local esc_err="" esc_ctx=""
  if [[ -n "$err_msg" ]]; then esc_err=",\"error\":\"$(printf '%s' "$err_msg" | sed 's/\\/\\\\/g; s/\"/\\\"/g')\""; fi
  if [[ -n "$ctx" ]]; then esc_ctx=",\"context\":\"$(printf '%s' "$ctx" | sed 's/\\/\\\\/g; s/\"/\\\"/g')\""; fi
  local dur_json=""; if [[ -n "$dur_ms" && "$dur_ms" =~ ^[0-9]+$ ]]; then dur_json=",\"durationMs\":${dur_ms}"; fi
  umask 077
  printf '{"step":%s,"status":"%s","artifact":"%s","timestamp":"%s"%s%s%s}\n' \
    "${step}" "${status}" "${esc_art}" "${ts}" "$esc_err" "$dur_json" "$esc_ctx" >> "$out"
  # 追加 checkpoint_saved 事件
  if [[ -n "${CODEX_SESSION_DIR:-}" ]]; then
    local data_json
    data_json=$(cat <<JSON
{"step": ${step}, "status": "${status}", "artifact": "${esc_art}"}
JSON
)
    append_jsonl_event "${CODEX_SESSION_DIR}" "checkpoint_saved" "${data_json}"
  fi
}

# 记录：Step 1 准备完成
checkpoint_add 1 "completed" "${INSTR_FILE}"

# =============== 审批策略细化：基于规则的动态调整（最小可用） ===============
apply_approval_rules() {
  [[ -n "${APPROVAL_POLICY_RULES:-}" ]] || return 0
  local rules_json="${APPROVAL_POLICY_RULES}"
  # 仅识别 operation 规则：delete / npm-install
  local want_delete=0 want_npm=0 policy_delete="on-request" policy_npm="on-request"
  # 简易提取（避免引入 jq），容忍空白
  if echo "$rules_json" | grep -Eqi 'operation"\s*:\s*"delete"'; then
    want_delete=1
    local p; p=$(echo "$rules_json" | sed -n 's/.*operation"\s*:\s*"delete"[^}]*policy"\s*:\s*"\([^"]*\)".*/\1/p' | head -n1)
    [[ -n "$p" ]] && policy_delete="$p"
  fi
  if echo "$rules_json" | grep -Eqi 'operation"\s*:\s*"npm-install"'; then
    want_npm=1
    local p2; p2=$(echo "$rules_json" | sed -n 's/.*operation"\s*:\s*"npm-install"[^}]*policy"\s*:\s*"\([^"]*\)".*/\1/p' | head -n1)
    [[ -n "$p2" ]] && policy_npm="$p2"
  fi
  local need_policy=""
  if (( want_delete == 1 )); then
    if printf '%s' "$INSTRUCTIONS" | grep -Eiq '\*\*\* Delete File:|\brm\s+-rf\b|\bgit\s+rm\b'; then
      need_policy="$policy_delete"
    fi
  fi
  if (( want_npm == 1 )); then
    if printf '%s' "$INSTRUCTIONS" | grep -Eiq '\bnpm\s+install\b|\bpnpm\s+(add|install)\b|\byarn\s+add\b'; then
      # 如果已有更严格策略则保持；否则采用 npm 规则
      if [[ -z "$need_policy" ]]; then need_policy="$policy_npm"; fi
    fi
  fi
  if [[ -n "$need_policy" ]]; then
    # 将策略注入到 CODEX_GLOBAL_ARGS，若未显式指定 approval 或当前为更宽松策略
    local has_flag=0 cur_policy=""
    local i=0
    while (( i < ${#CODEX_GLOBAL_ARGS[@]} )); do
      if [[ "${CODEX_GLOBAL_ARGS[$i]}" == "--ask-for-approval" ]] && (( i + 1 < ${#CODEX_GLOBAL_ARGS[@]} )); then
        has_flag=1; cur_policy="${CODEX_GLOBAL_ARGS[$((i+1))]}"; break
      fi
      i=$((i+1))
    done
    # 简易比较：never < on-failure < on-request < untrusted （从宽到严）
    rank() { case "$1" in never) echo 0;; on-failure) echo 1;; on-request) echo 2;; untrusted) echo 3;; *) echo 1;; esac }
    if (( has_flag == 0 )) || (( $(rank "$cur_policy") < $(rank "$need_policy") )); then
      CODEX_GLOBAL_ARGS+=("--ask-for-approval" "$need_policy")
    fi
  fi
}

apply_approval_rules || true

# 粗略估算输入上下文体积，提前阻断显著超限的任务
estimate_instruction_tokens() {
  local content="$1"
  local bytes
  bytes=$(printf '%s' "$content" | LC_ALL=C wc -c | awk '{print $1}')
  # 约定 4 字节 ≈ 1 token，向上取整
  printf '%s\n' $(((bytes + 3) / 4))
}

INPUT_TOKEN_LIMIT=${INPUT_TOKEN_LIMIT:-32000}
INPUT_TOKEN_SOFT_LIMIT=${INPUT_TOKEN_SOFT_LIMIT:-30000}
ESTIMATED_TOKENS=$(estimate_instruction_tokens "${INSTRUCTIONS}")

if (( ESTIMATED_TOKENS > INPUT_TOKEN_LIMIT )); then
  {
    echo "===== Codex Run Start: ${TS}${TAG_SUFFIX} (${TS_DISPLAY:-${TS}}) ====="
    echo "Script: $(basename "$0")  PWD: $(pwd)"
    echo "Log: ${CODEX_LOG_FILE}"
    echo "Meta: ${META_FILE}"
    echo "[input-check] Estimated tokens ${ESTIMATED_TOKENS} exceed hard limit ${INPUT_TOKEN_LIMIT}"
    printf 'Sources:\n'
    printf '  • %s\n' "${SOURCE_LINES[@]}"
  } >> "${CODEX_LOG_FILE}"

  cat <<EOF >&2
错误: 任务输入内容过大 (约 ${ESTIMATED_TOKENS} tokens)，超过当前限制 ${INPUT_TOKEN_LIMIT}。

请拆分任务或精简输入，例如：
- 先单独运行一轮任务读取/总结长文档，再用下一轮执行写入；
- 只传入关键片段，或结合 --docs / --context-head / --context-grep 控制范围；
- 通过 --tag <name> 为拆分后的子任务打上统一标签，方便检索日志。

如需临时放宽限制，可设置环境变量 INPUT_TOKEN_LIMIT=<token 上限> 后重试。
EOF
  exit 2
fi

if (( ESTIMATED_TOKENS > INPUT_TOKEN_SOFT_LIMIT )); then
  printf '[info] 输入体积约 %s tokens，已接近限制 %s；建议拆分任务或精简上下文。\n' \
    "${ESTIMATED_TOKENS}" "${INPUT_TOKEN_LIMIT}" >&2
fi

# 如果早前检测到参数冲突，则现在写入日志并退出
if [[ -n "${VALIDATION_ERROR}" ]]; then
  {
    echo "===== Codex Run Start: ${TS}${TAG_SUFFIX} (${TS_DISPLAY:-${TS}}) ====="
    echo "Script: $(basename "$0")  PWD: $(pwd)"
    echo "Log: ${CODEX_LOG_FILE}"
    echo "Meta: ${META_FILE}"
    echo "[arg-check] ${VALIDATION_ERROR}"
  } >> "${CODEX_LOG_FILE}"
  printf '%s\n' "${VALIDATION_ERROR}" >&2
  exit 2
fi

# 构建脱敏 sed 参数（如 lib 已提供则不覆盖）
if ! declare -F build_redact_sed_args >/dev/null 2>&1; then
  build_redact_sed_args() {
    local -n _arr=$1
    shift || true
    local patterns=("$@")
    _arr=()
    for re in "${patterns[@]}"; do
      _arr+=("-e" "s/${re}/${REDACT_REPLACEMENT}/g")
    done
  }
fi

# 上下文压缩（如 lib 已提供则不覆盖）
if ! declare -F compress_context_file >/dev/null 2>&1; then
  compress_context_file() {
    local in_file=$1
    local out_file=$2
    local head_n=${3:-$CONTEXT_HEAD}
    shift || true; shift || true; shift || true
    local patterns=("$@")
    {
      if [[ ! -s "$in_file" ]]; then
        echo "[no previous context]"
      else
        echo "=== Head (first ${head_n} lines) ==="
        head -n "$head_n" "$in_file" || true
        if (( ${#patterns[@]} > 0 )); then
          local joined; joined=$(printf '%s|' "${patterns[@]}"); joined=${joined%|}
          echo; echo "=== Key Lines (pattern match) ==="
          grep -E "$joined" -n "$in_file" 2>/dev/null | cut -d: -f2- | awk 'BEGIN{c=0} {if(seen[$0]++) next; print; c++; if(c>200) exit}' || true
        fi
      fi
    } > "$out_file"
  }
fi

## 重新组合指令（如 lib 已提供则不覆盖）
if ! declare -F compose_instructions >/dev/null 2>&1; then
  compose_instructions() {
  local ts_iso; ts_iso=$(date +"%Y-%m-%dT%H:%M:%S%:z")
    SOURCE_LINES=()
    local sections=""
    if [[ -n "${PREPEND_FILE}" && -f "${PREPEND_FILE}" ]]; then
      sections+=$'\n'"<instructions-section type=\"prepend-file\" path=\"${PREPEND_FILE}\">"$'\n'
      sections+="$(cat "${PREPEND_FILE}")"$'\n''</instructions-section>'$'\n'
      SOURCE_LINES+=("Prepend file: ${PREPEND_FILE}")
    fi
    if [[ -n "${PREPEND_CONTENT}" ]]; then
      sections+=$'\n'"<instructions-section type=\"prepend-text\">"$'\n'
      sections+="${PREPEND_CONTENT}"$'\n''</instructions-section>'$'\n'
      local _pv; _pv=$(printf '%s' "${PREPEND_CONTENT}" | tr '\n' ' ' | cut -c1-80)
      SOURCE_LINES+=("Prepend text: ${_pv}...")
    fi
    # 当处于补丁模式时，跳过 base 指令以避免与 policy-note 冲突
    if (( ${PATCH_MODE:-0} == 1 )); then
      SOURCE_LINES+=("Base: skipped due to patch-mode")
    else
      local base_content=""; local base_desc="${BASE_SOURCE_DESC}"
      case "${BASE_SOURCE_KIND}" in
        override-file)   base_content="$(cat "${OVERRIDE_FILE}")" ;;
        override-stdin)  base_content="${STDIN_CONTENT}" ;;
        default-file)    if [[ -f "${DEFAULT_INSTRUCTIONS_FILE}" ]]; then base_content="$(cat "${DEFAULT_INSTRUCTIONS_FILE}")"; else base_content="${DEFAULT_INSTRUCTIONS}"; fi ;;
        env)             base_content="${INSTRUCTIONS}" ;;
        stdin)           base_content="${STDIN_CONTENT}" ;;
        default-builtin|*) base_content="${DEFAULT_INSTRUCTIONS}" ;;
      esac
      sections+=$'\n'"<instructions-section type=\"base\" source=\"${BASE_SOURCE_KIND}\" desc=\"${BASE_SOURCE_DESC}\" path=\"${DEFAULT_INSTRUCTIONS_FILE}\">"$'\n'
      sections+="${base_content}"$'\n''</instructions-section>'$'\n'
      SOURCE_LINES+=("Base: ${base_desc}")
    fi
    for i in "${!SRC_TYPES[@]}"; do
      local t="${SRC_TYPES[$i]}"; local v="${SRC_VALUES[$i]}"
      case "$t" in
        F)
          if [[ "$v" == "-" ]]; then
            sections+=$'\n'"<instructions-section type=\"file\" path=\"STDIN\">"$'\n'
            sections+="${STDIN_CONTENT}"$'\n''</instructions-section>'$'\n'
            SOURCE_LINES+=("Add file: STDIN")
          else
            if [[ -f "$v" ]]; then
              sections+=$'\n'"<instructions-section type=\"file\" path=\"${v}\">"$'\n'
              sections+="$(cat "$v")"$'\n''</instructions-section>'$'\n'
              SOURCE_LINES+=("Add file: $v")
            else
              sections+=$'\n'"<instructions-section type=\"file\" path=\"${v}\">[missing]</instructions-section>"$'\n'
              SOURCE_LINES+=("Add file: $v (missing)")
            fi
          fi ;;
        C)
          sections+=$'\n'"<instructions-section type=\"text\">"$'\n'
          sections+="${v}"$'\n''</instructions-section>'$'\n'
          local _pv; _pv=$(printf '%s' "${v}" | tr '\n' ' ' | cut -c1-80)
          SOURCE_LINES+=("Add text: ${_pv}...") ;;
      esac
    done
    if [[ -n "${APPEND_FILE}" && -f "${APPEND_FILE}" ]]; then
      sections+=$'\n'"<instructions-section type=\"append-file\" path=\"${APPEND_FILE}\">"$'\n'
      sections+="$(cat "${APPEND_FILE}")"$'\n''</instructions-section>'$'\n'
      SOURCE_LINES+=("Append file: ${APPEND_FILE}")
    fi
    if [[ -n "${APPEND_CONTENT}" ]]; then
      sections+=$'\n'"<instructions-section type=\"append-text\">"$'\n'
      sections+="${APPEND_CONTENT}"$'\n''</instructions-section>'$'\n'
      local _pv; _pv=$(printf '%s' "${APPEND_CONTENT}" | tr '\n' ' ' | cut -c1-80)
      SOURCE_LINES+=("Append text: ${_pv}...")
    fi
    INSTRUCTIONS=$'<user-instructions>\n['"${ts_iso}"$'] Composed instructions:\n\n'"${sections}"$'\n</user-instructions>\n'
  }
fi

ALL_PATTERNS=("${REDACT_PATTERNS[@]}")
if [[ ${#ALL_PATTERNS[@]} -eq 0 ]]; then
  ALL_PATTERNS=("${REDACT_PATTERNS_DEFAULT[@]}")
fi

REDACT_SED_ARGS=()
if [[ "${REDACT_ENABLE}" == "1" ]]; then
  build_redact_sed_args REDACT_SED_ARGS "${ALL_PATTERNS[@]}"
fi

# 重新组合一次（带标准分隔标签）
# 补丁模式下强制跳过 Base（双保险）：即便外部函数判断失效也不拼接 Base
if (( PATCH_MODE == 1 )); then
  FORCE_SKIP_BASE=1
fi
compose_instructions

# 如启用补丁模式，在初始轮指令中追加 policy-note
if (( PATCH_MODE == 1 )); then
  INSTRUCTIONS+=$'\n\n<instructions-section type="policy-note">\n'
  INSTRUCTIONS+="${PATCH_POLICY_NOTE}"
  INSTRUCTIONS+=$'\n</instructions-section>\n'
fi

# 写入指令内容到独立文件（便于复盘），可选脱敏
umask 077
if [[ "${REDACT_ENABLE}" == "1" ]]; then
  printf '%s' "${INSTRUCTIONS}" | sed -E "${REDACT_SED_ARGS[@]}" > "${INSTR_FILE}"
else
  printf '%s' "${INSTRUCTIONS}" > "${INSTR_FILE}"
fi

# 写入日志头部
  {
    echo "===== Codex Run Start: ${TS}${TAG_SUFFIX} (${TS_DISPLAY:-${TS}}) ====="
    echo "Script: $(basename "$0")  PWD: $(pwd)"
  echo "Log: ${CODEX_LOG_FILE}"
  echo "Instructions: ${INSTR_FILE}"
  echo "Meta: ${META_FILE}"
  echo "Patch Mode: $([[ ${PATCH_MODE} -eq 1 ]] && echo on || echo off)"
  if [[ -n "${DFA_NOTE:-}" ]]; then echo "[arg-normalize] ${DFA_NOTE}"; fi
  if [[ -n "${APPROVAL_NOTE:-}" ]]; then echo "[arg-normalize] ${APPROVAL_NOTE}"; fi
  if [[ -n "${MODEL_NOTE:-}" ]]; then echo "[arg-check] ${MODEL_NOTE}"; fi
  if [[ -n "${FLAT_LOGS_NOTE:-}" ]]; then echo "${FLAT_LOGS_NOTE}"; fi
  if (( PATCH_MODE == 1 )); then
    echo "[hint] 已启用补丁模式：如不需要仅输出补丁，请移除 --patch-mode"
    if (( PATCH_CAPTURE_ARTIFACT == 1 )); then
      echo "[hint] 补丁输出写入 ${PATCH_ARTIFACT_FILE}，日志仅保留预览（可用 --no-patch-artifact 关闭）。"
      if [[ "${PATCH_PREVIEW_LINES}" == "0" ]]; then
        echo "[hint] 已通过 --no-patch-preview 禁用补丁回显。"
      else
        echo "[hint] 补丁预览行数: ${PATCH_PREVIEW_LINES}（可用 --patch-preview-lines 调整）。"
      fi
    else
      echo "[hint] 已禁用补丁落盘，日志会完整回显 diff；可用 --patch-output 指定文件。"
    fi
  fi
} >> "${CODEX_LOG_FILE}"
RUN_LOGGED=1

# 可选回显最终合成的指令及其来源
if [[ "${CODEX_ECHO_INSTRUCTIONS}" == "1" ]]; then
  {
    echo "----- Composed Instructions (Sources) -----"
    for line in "${SOURCE_LINES[@]}"; do
      echo "- ${line}"
    done
    echo "----- Begin Composed Instructions -----"
  } >> "${CODEX_LOG_FILE}"

  if [[ "${REDACT_ENABLE}" == "1" ]]; then
    if [[ "${CODEX_ECHO_INSTRUCTIONS_LIMIT}" != "0" ]]; then
      printf '%s' "${INSTRUCTIONS}" | sed -E "${REDACT_SED_ARGS[@]}" | sed -n "1,${CODEX_ECHO_INSTRUCTIONS_LIMIT}p" >> "${CODEX_LOG_FILE}"
      echo >> "${CODEX_LOG_FILE}"
      echo "----- [Truncated after ${CODEX_ECHO_INSTRUCTIONS_LIMIT} lines] -----" >> "${CODEX_LOG_FILE}"
    else
      printf '%s' "${INSTRUCTIONS}" | sed -E "${REDACT_SED_ARGS[@]}" >> "${CODEX_LOG_FILE}"
      echo >> "${CODEX_LOG_FILE}"
    fi
  else
    if [[ "${CODEX_ECHO_INSTRUCTIONS_LIMIT}" != "0" ]]; then
      printf '%s' "${INSTRUCTIONS}" | sed -n "1,${CODEX_ECHO_INSTRUCTIONS_LIMIT}p" >> "${CODEX_LOG_FILE}"
      echo >> "${CODEX_LOG_FILE}"
      echo "----- [Truncated after ${CODEX_ECHO_INSTRUCTIONS_LIMIT} lines] -----" >> "${CODEX_LOG_FILE}"
    else
      printf '%s' "${INSTRUCTIONS}" >> "${CODEX_LOG_FILE}"
      echo >> "${CODEX_LOG_FILE}"
    fi
  fi

  echo "----- End Composed Instructions -----" >> "${CODEX_LOG_FILE}"
fi

# 输出开始标记
echo "----- Begin Codex Output -----" >> "${CODEX_LOG_FILE}"

# 运行 codex 并捕获输出与退出码
set +e
# 准备本轮 last-message 输出文件
RUN_LAST_MSG_FILE="${CODEX_LOG_FILE%.log}.r1.last.txt"
GIT_ENABLED=0; GIT_HEAD_BEFORE=""; GIT_HEAD_AFTER=""
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  GIT_ENABLED=1
  GIT_HEAD_BEFORE=$(git rev-parse HEAD 2>/dev/null || echo "")
fi
if [[ "${ALLOW_OUTPUT_LAST_MESSAGE:-1}" == "1" ]]; then
  if [[ "${ALLOW_OUTPUT_LAST_MESSAGE:-1}" == "1" ]]; then
    EXEC_ARGS=("${CODEX_EXEC_ARGS[@]}" "--output-last-message" "${RUN_LAST_MSG_FILE}")
  else
    EXEC_ARGS=("${CODEX_EXEC_ARGS[@]}")
  fi
else
  EXEC_ARGS=("${CODEX_EXEC_ARGS[@]}")
fi
  # 记录调用参数（原始 CLI 与传递给 codex 的参数），便于排错
  # 添加 SIGPIPE 处理，避免管道断裂导致 141 退出码
  (
    # 忽略 SIGPIPE 信号
    trap '' PIPE

    if [[ "${REDACT_ENABLE}" == "1" ]]; then
      {
        echo "----- Invocation Args -----"
        echo "start.sh argv (raw):"
        for a in "${ORIG_ARGV[@]}"; do printf '  %s\n' "$a"; done
        echo "codex global args:"
        for a in "${CODEX_GLOBAL_ARGS[@]}"; do printf '  %s\n' "$a"; done
        echo "codex exec args:"
        for a in "${EXEC_ARGS[@]}"; do printf '  %s\n' "$a"; done
        echo "----- End Invocation Args -----"
      } | sed -E "${REDACT_SED_ARGS[@]}" >> "${CODEX_LOG_FILE}" 2>/dev/null || true
    else
      {
        echo "----- Invocation Args -----"
        echo "start.sh argv (raw):"
        for a in "${ORIG_ARGV[@]}"; do printf '  %s\n' "$a"; done
        echo "codex global args:"
        for a in "${CODEX_GLOBAL_ARGS[@]}"; do printf '  %s\n' "$a"; done
        echo "codex exec args:"
        for a in "${EXEC_ARGS[@]}"; do printf '  %s\n' "$a"; done
        echo "----- End Invocation Args -----"
      } >> "${CODEX_LOG_FILE}" 2>/dev/null || true
    fi
  )
  RUN_OUTPUT_FILE="${CODEX_LOG_FILE%.log}.r1.output.txt"
  CODEX_EXECUTED=0
  if [[ ${DRY_RUN} -eq 1 ]]; then
    if [[ "${JSON_OUTPUT}" == "1" ]]; then
      echo "[DRY-RUN] 跳过 codex 执行，仅生成日志与指令文件" >> "${CODEX_LOG_FILE}"
    else
      echo "[DRY-RUN] 跳过 codex 执行，仅生成日志与指令文件" | tee -a "${CODEX_LOG_FILE}"
    fi
    CODEX_EXIT=0
  else
    if ! command -v codex >/dev/null 2>&1; then
      if [[ "${JSON_OUTPUT}" == "1" ]]; then
        echo "[ERROR] codex CLI 未找到，请确认已安装并在 PATH 中。" >> "${CODEX_LOG_FILE}"
      else
        echo "[ERROR] codex CLI 未找到，请确认已安装并在 PATH 中。" | tee -a "${CODEX_LOG_FILE}"
      fi
      CODEX_EXIT=127
    else
      CODEX_EXECUTED=1

      # 使用临时文件避免管道问题
      tmp_output_file="${RUN_OUTPUT_FILE}.tmp"

      # 先运行 codex 并捕获到临时文件
      if ! printf '%s' "${INSTRUCTIONS}" | codex "${CODEX_GLOBAL_ARGS[@]}" exec "${EXEC_ARGS[@]}" > "${tmp_output_file}" 2>&1; then
        CODEX_EXIT=${PIPESTATUS[0]}
      else
        CODEX_EXIT=0
      fi

      # 处理输出（如果需要脱敏）
      if [[ "${REDACT_ENABLE}" == "1" ]] && [[ -s "${tmp_output_file}" ]]; then
        sed -u -E "${REDACT_SED_ARGS[@]}" "${tmp_output_file}" > "${RUN_OUTPUT_FILE}" 2>/dev/null || {
          # 如果 sed 失败，直接复制原文件
          cp "${tmp_output_file}" "${RUN_OUTPUT_FILE}"
        }
      else
        cp "${tmp_output_file}" "${RUN_OUTPUT_FILE}"
      fi

      # 显示输出（如果不是 JSON 模式）
      if [[ "${JSON_OUTPUT}" != "1" ]]; then
        cat "${RUN_OUTPUT_FILE}"
      fi

      # 清理临时文件
      rm -f "${tmp_output_file}"
    fi
  fi
set -e
if (( CODEX_EXECUTED == 1 )) && [[ -f "${RUN_OUTPUT_FILE}" ]]; then
  codex_publish_output "${RUN_OUTPUT_FILE}" 1
fi
# Normalize last message file for the first run as well to avoid
# "UTF-8 text, with no line terminators" surprises downstream
if [[ -f "${RUN_LAST_MSG_FILE}" ]]; then
  if declare -F ensure_trailing_newline >/dev/null 2>&1; then
    ensure_trailing_newline "${RUN_LAST_MSG_FILE}"
  fi
fi
