
# 按版本拦截 0.44-only 参数（严格模式）
check_version_param_compatibility
if [[ -n "${VALIDATION_ERROR}" ]]; then
  {
    echo "===== Codex Run Start: ${TS}${TAG_SUFFIX} ====="
    echo "Script: $(basename "$0")  PWD: $(pwd)"
    echo "Log: ${CODEX_LOG_FILE}"
    echo "Meta: ${META_FILE}"
    echo "[arg-check] ${VALIDATION_ERROR}"
  } >> "${CODEX_LOG_FILE}"
  printf '%s\n' "${VALIDATION_ERROR}" >&2
  exit 2
fi

compute_effective_runtime_flags

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

# 如果早前检测到参数冲突，则现在写入日志并退出
if [[ -n "${VALIDATION_ERROR}" ]]; then
  {
    echo "===== Codex Run Start: ${TS}${TAG_SUFFIX} ====="
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
    local ts_iso; ts_iso=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
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
    echo "===== Codex Run Start: ${TS}${TAG_SUFFIX} ====="
    echo "Script: $(basename "$0")  PWD: $(pwd)"
  echo "Log: ${CODEX_LOG_FILE}"
  echo "Instructions: ${INSTR_FILE}"
  echo "Meta: ${META_FILE}"
  echo "Patch Mode: $([[ ${PATCH_MODE} -eq 1 ]] && echo on || echo off)"
  if [[ -n "${DFA_NOTE:-}" ]]; then echo "[arg-normalize] ${DFA_NOTE}"; fi
  if [[ -n "${APPROVAL_NOTE:-}" ]]; then echo "[arg-normalize] ${APPROVAL_NOTE}"; fi
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
    } | sed -E "${REDACT_SED_ARGS[@]}" >> "${CODEX_LOG_FILE}"
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
    } >> "${CODEX_LOG_FILE}"
  fi
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
    if [[ "${REDACT_ENABLE}" == "1" ]]; then
      # 通过 STDIN 传递指令，避免参数过长问题；仅对输出做脱敏
      if [[ "${JSON_OUTPUT}" == "1" ]]; then
        printf '%s' "${INSTRUCTIONS}" | codex "${CODEX_GLOBAL_ARGS[@]}" exec "${EXEC_ARGS[@]}" 2>&1 \
          | sed -u -E "${REDACT_SED_ARGS[@]}" >> "${CODEX_LOG_FILE}"
        CODEX_EXIT=${PIPESTATUS[1]}
      else
        printf '%s' "${INSTRUCTIONS}" | codex "${CODEX_GLOBAL_ARGS[@]}" exec "${EXEC_ARGS[@]}" 2>&1 \
          | sed -u -E "${REDACT_SED_ARGS[@]}" | tee -a "${CODEX_LOG_FILE}"
        CODEX_EXIT=${PIPESTATUS[1]}
      fi
    else
      if [[ "${JSON_OUTPUT}" == "1" ]]; then
        printf '%s' "${INSTRUCTIONS}" | codex "${CODEX_GLOBAL_ARGS[@]}" exec "${EXEC_ARGS[@]}" 2>&1 \
          >> "${CODEX_LOG_FILE}"
        CODEX_EXIT=${PIPESTATUS[1]}
      else
        printf '%s' "${INSTRUCTIONS}" | codex "${CODEX_GLOBAL_ARGS[@]}" exec "${EXEC_ARGS[@]}" 2>&1 \
          | tee -a "${CODEX_LOG_FILE}"

      fi
    fi
  fi
fi
set -e
