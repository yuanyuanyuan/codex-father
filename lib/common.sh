#!/usr/bin/env bash
# Common helper functions for codex-command scripts

# JSON escape for embedding strings in JSON
json_escape() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

# Build sed -E arguments to redact sensitive patterns
build_redact_sed_args() {
  local -n _arr=$1
  shift || true
  local patterns=("$@")
  _arr=()
  for re in "${patterns[@]}"; do
    _arr+=("-e" "s/${re}/${REDACT_REPLACEMENT}/g")
  done
}

# Compress a previous context file: keep head and key matched lines
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
        local joined
        joined=$(printf '%s|' "${patterns[@]}"); joined=${joined%|}
        echo
        echo "=== Key Lines (pattern match) ==="
        grep -E "$joined" -n "$in_file" 2>/dev/null | cut -d: -f2- | awk 'BEGIN{c=0} {if(seen[$0]++) next; print; c++; if(c>200) exit}' || true
      fi
    fi
  } > "$out_file"
}

# Compose final instructions with explicit section wrappers
compose_instructions() {
  local ts_iso; ts_iso=$(date +"%Y-%m-%dT%H:%M:%S%:z")
  SOURCE_LINES=()
  local sections=""

  # Prepend sections
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

  # Base content from the decided base source
  local base_content=""; local base_desc="${BASE_SOURCE_DESC}"
  case "${BASE_SOURCE_KIND}" in
    override-file)   base_content="$(cat "${OVERRIDE_FILE}")" ;;
    override-stdin)  base_content="${STDIN_CONTENT}" ;;
    default-file)    if [[ -f "${DEFAULT_INSTRUCTIONS_FILE}" ]]; then base_content="$(cat "${DEFAULT_INSTRUCTIONS_FILE}")"; else base_content="${DEFAULT_INSTRUCTIONS}"; fi ;;
    env)             base_content="${INSTRUCTIONS}" ;;
    stdin)           base_content="${STDIN_CONTENT}" ;;
    default-builtin|*) base_content="${DEFAULT_INSTRUCTIONS}" ;;
  esac
  sections+=$'\n'"<instructions-section type=\"base\" source=\"${BASE_SOURCE_KIND}\" desc=\"${base_desc}\" path=\"${DEFAULT_INSTRUCTIONS_FILE}\">"$'\n'
  sections+="${base_content}"$'\n''</instructions-section>'$'\n'
  SOURCE_LINES+=("Base: ${base_desc}")

  # Overlay sources in order
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

  # Append sections
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

# Detect control flags and classify exit conditions
classify_exit() {
  local last_msg_file="$1"; local log_file="$2"; local code="$3"
  CLASSIFICATION="normal"; CONTROL_FLAG=""; EXIT_REASON=""; TOKENS_USED=""
  # Control flag
  if [[ -f "$last_msg_file" ]]; then
    if grep -Eq 'CONTROL:[[:space:]]*DONE' "$last_msg_file"; then CONTROL_FLAG="DONE"; fi
    if [[ -z "$CONTROL_FLAG" ]] && grep -Eq 'CONTROL:[[:space:]]*CONTINUE' "$last_msg_file"; then CONTROL_FLAG="CONTINUE"; fi
  fi
  # Tokens used
  if [[ -f "$log_file" ]]; then
    local tok
    # Be resilient under 'set -e -o pipefail': allow no-match
    tok="$(awk 'BEGIN{IGNORECASE=1}
      /tokens used/ {
        if (match($0, /[0-9][0-9,]*/)) {
          num = substr($0, RSTART, RLENGTH);
          gsub(/,/, "", num);
          print num;
          exit;
        }
        if (getline line) {
          if (match(line, /[0-9][0-9,]*/)) {
            num = substr(line, RSTART, RLENGTH);
            gsub(/,/, "", num);
            print num;
            exit;
          }
        }
      }
    ' "$log_file" 2>/dev/null || true)"
    [[ -n "$tok" ]] && TOKENS_USED="$tok"
  fi
  # Classification
  if [[ "$code" -ne 0 ]]; then
    # 更精确的网络错误判定：避免将“network access enabled”等正常提示误判为网络错误
    if grep -Eqi 'timeout|timed[[:space:]]+out|deadline[ _-]?exceeded|fetch[[:space:]]+failed|ENOTFOUND|EAI_AGAIN|ECONN(REFUSED|RESET|ABORTED)?|ENET(UNREACH|DOWN)|EHOSTUNREACH|getaddrinfo|socket[[:space:]]+hang[[:space:]]+up|TLS[[:space:]]+handshake[[:space:]]+failed|DNS( lookup)? failed|connection[[:space:]]+(reset|refused|timed[[:space:]]+out)' "$log_file" "$last_msg_file" 2>/dev/null; then
      CLASSIFICATION='network_error'; EXIT_REASON='Network error or timeout'
    # 显式识别“模型不支持/无效模型”之类的配置错误
    elif grep -Eqi 'unsupported[[:space:]]+model|unknown[[:space:]]+model|model[[:space:]]+not[[:space:]]+found' "$log_file" "$last_msg_file" 2>/dev/null; then
      CLASSIFICATION='config_error'; EXIT_REASON='Unsupported or invalid model'
    elif grep -Eqi '(context|token).*(limit|overflow|exceed|max|length|truncat|too (long|large))|maximum context|prompt too large' "$log_file" "$last_msg_file" 2>/dev/null; then
      CLASSIFICATION='context_overflow'; EXIT_REASON='Context or token limit exceeded'
    elif grep -Eqi 'approval|require.*confirm|denied by approval' "$log_file" "$last_msg_file" 2>/dev/null; then
      CLASSIFICATION='approval_required'; EXIT_REASON='Approval policy blocked a command'
    elif grep -Eqi 'sandbox|permission|not allowed|denied by sandbox' "$log_file" "$last_msg_file" 2>/dev/null; then
      CLASSIFICATION='sandbox_denied'; EXIT_REASON='Sandbox policy denied operation'
    elif grep -Eqi 'unauthorized|forbidden|invalid api key|401|403' "$log_file" "$last_msg_file" 2>/dev/null; then
      CLASSIFICATION='auth_error'; EXIT_REASON='Authentication/authorization error'
    elif grep -Eqi 'too many requests|rate limit|429' "$log_file" "$last_msg_file" 2>/dev/null; then
      CLASSIFICATION='rate_limited'; EXIT_REASON='Rate limit encountered'
    elif grep -Eqi 'Command failed|non-zero exit|failed to execute' "$log_file" "$last_msg_file" 2>/dev/null; then
      CLASSIFICATION='tool_error'; EXIT_REASON='Tool/command execution failed'
    else
      CLASSIFICATION='error'; EXIT_REASON='Unknown error'
    fi
  else
    if [[ "$CONTROL_FLAG" == 'DONE' ]]; then
      CLASSIFICATION='done'; EXIT_REASON='Task signaled DONE'
    elif [[ "$CONTROL_FLAG" == 'CONTINUE' ]]; then
      CLASSIFICATION='continue'; EXIT_REASON='Task signaled CONTINUE'
    else
      CLASSIFICATION='normal'; EXIT_REASON='Run completed normally'
    fi
  fi
}
