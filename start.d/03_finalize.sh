set -e

TS_DISPLAY="${TS_DISPLAY:-$(date +%Y-%m-%dT%H:%M:%S%:z)}"

: "${CODEX_EXIT:=1}"
if (( GIT_ENABLED == 1 )); then
  GIT_HEAD_AFTER=$(git rev-parse HEAD 2>/dev/null || echo "")
fi

# 尾部与汇总
{
  echo "----- End Codex Output -----"
  echo "Exit Code: ${CODEX_EXIT}"
  echo "===== Codex Run End: ${TS}${TAG_SUFFIX} (${TS_DISPLAY}) ====="
  echo
} >> "${CODEX_LOG_FILE}"

if [[ "${CODEX_LOG_AGGREGATE}" == "1" ]]; then
  mkdir -p "$(dirname "${CODEX_LOG_AGGREGATE_FILE}")"
  {
    echo "=== [${TS_DISPLAY}] Codex Run ${TAG_SUFFIX} ==="
    echo "Log: ${CODEX_LOG_FILE}"
    echo "Instructions: ${INSTR_FILE}"
    echo -n "Title: "
    awk 'NF {print; exit}' "${INSTR_FILE}" | cut -c1-120 || true
    echo "Exit: ${CODEX_EXIT}"
    echo
  } >> "${CODEX_LOG_AGGREGATE_FILE}"
fi

# 生成元数据 JSON（函数定义在顶部库中也存在，保留以确保可用）
if ! declare -F json_escape >/dev/null 2>&1; then
  json_escape() {
    local s=$1
    s=${s//\\/\\\\}
    s=${s//\"/\\\"}
    s=${s//$'\n'/\\n}
    s=${s//$'\r'/}
    s=${s//$'\t'/\\t}
    printf '%s' "$s"
  }
fi

if ! declare -F classify_exit >/dev/null 2>&1; then
  classify_exit() {
    local _last="$1" _log="$2" _code="${3:-0}"
    CLASSIFICATION=$([[ "${_code}" -eq 0 ]] && echo "normal" || echo "error")
    CONTROL_FLAG=""
    EXIT_REASON=$([[ "${_code}" -eq 0 ]] && echo "Run completed normally" || echo "Unknown error")
    TOKENS_USED=""
  }
fi

codex_write_session_state() {
  local file="$1"
  local payload="$2"
  umask 077
  printf '%s\n' "$payload" > "${file}.tmp"
  mv -f "${file}.tmp" "$file"
}

codex_update_session_state() {
  [[ -n "${CODEX_SESSION_DIR:-}" ]] || return 0
  local state_file="${CODEX_SESSION_DIR}/state.json"
  [[ -f "$state_file" ]] || return 0

  local job_id; job_id=$(basename "$CODEX_SESSION_DIR")
  local updated_at; updated_at=$(date -u "+%Y-%m-%dT%H:%M:%SZ")

  set +e
  local created_at
  created_at=$(grep -E '"created_at"' "$state_file" | sed -E 's/.*"created_at"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
  local tag
  tag=$(grep -E '"tag"' "$state_file" | sed -E 's/.*"tag"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
  local cwd
  cwd=$(grep -E '"cwd"' "$state_file" | sed -E 's/.*"cwd"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
  local existing_title
  existing_title=$(grep -E '"title"' "$state_file" | sed -E 's/.*"title"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
  local existing_log_file
  existing_log_file=$(grep -E '"log_file"' "$state_file" | sed -E 's/.*"log_file"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
  local existing_meta_glob
  existing_meta_glob=$(grep -E '"meta_glob"' "$state_file" | sed -E 's/.*"meta_glob"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
  local existing_last_glob
  existing_last_glob=$(grep -E '"last_message_glob"' "$state_file" | sed -E 's/.*"last_message_glob"\s*:\s*"([^"]*)".*/\1/' | head -n1 || true)
  set -e

  [[ -n "$created_at" ]] || created_at="$updated_at"
  [[ -n "$cwd" ]] || cwd="$(pwd)"

  local log_file="${CODEX_LOG_FILE:-$existing_log_file}"
  [[ -n "$log_file" ]] || log_file="$existing_log_file"

  local meta_glob="${CODEX_SESSION_DIR}/*.meta.json"
  [[ -n "$existing_meta_glob" ]] && meta_glob="$existing_meta_glob"
  local last_glob="${CODEX_SESSION_DIR}/*.last.txt"
  [[ -n "$existing_last_glob" ]] && last_glob="$existing_last_glob"

  local exit_code="${CODEX_EXIT:-}"
  local state="failed"
  local exit_json="null"
  if [[ "$exit_code" =~ ^-?[0-9]+$ ]]; then
    if (( exit_code == 0 )); then
      state="completed"
      exit_json="$exit_code"
    elif (( exit_code < 0 )); then
      state="stopped"
    else
      state="failed"
      exit_json="$exit_code"
    fi
  fi

  local cls="${CLASSIFICATION:-}"
  if [[ "$state" == "stopped" && -z "$cls" ]]; then
    cls="user_cancelled"
  fi
  local classification_json="null"
  if [[ -n "$cls" ]]; then
    classification_json="\"$(json_escape "$cls")\""
  fi

  local tokens_json="null"
  local tok="${TOKENS_USED:-}"
  if [[ "$tok" =~ ^[0-9]+$ ]]; then
    tokens_json="$tok"
  fi

  local eff_sandbox_json="null"
  if [[ -n "${EFFECTIVE_SANDBOX:-}" ]]; then
    eff_sandbox_json="\"$(json_escape "${EFFECTIVE_SANDBOX:-}")\""
  fi
  local eff_network_json="null"
  if [[ -n "${EFFECTIVE_NETWORK_ACCESS:-}" ]]; then
    eff_network_json="\"$(json_escape "${EFFECTIVE_NETWORK_ACCESS:-}")\""
  fi
  local eff_approval_json="null"
  if [[ -n "${EFFECTIVE_APPROVAL_POLICY:-}" ]]; then
    eff_approval_json="\"$(json_escape "${EFFECTIVE_APPROVAL_POLICY:-}")\""
  fi
  local sandbox_bypass_json="null"
  if [[ -n "${EFFECTIVE_BYPASS:-}" && "${EFFECTIVE_BYPASS:-}" =~ ^[0-9]+$ ]]; then
    sandbox_bypass_json="${EFFECTIVE_BYPASS:-}"
  fi

  local title_value="${INSTR_TITLE:-}"; [[ -n "$title_value" ]] || title_value="$existing_title"
  local title_json="null"
  if [[ -n "$title_value" ]]; then
    title_json="\"$(json_escape "$title_value")\""
  fi

  local tag_json="\"$(json_escape "${tag:-}")\""
  local state_json
  state_json=$(cat <<EOF
{
  "id": "$(json_escape "$job_id")",
  "pid": null,
  "state": "$(json_escape "$state")",
  "exit_code": ${exit_json},
  "classification": ${classification_json},
  "tokens_used": ${tokens_json},
  "effective_sandbox": ${eff_sandbox_json},
  "effective_network_access": ${eff_network_json},
  "effective_approval_policy": ${eff_approval_json},
  "sandbox_bypass": ${sandbox_bypass_json},
  "cwd": "$(json_escape "$cwd")",
  "created_at": "$(json_escape "$created_at")",
  "updated_at": "$(json_escape "$updated_at")",
  "tag": ${tag_json},
  "log_file": "$(json_escape "$log_file")",
  "meta_glob": "$(json_escape "$meta_glob")",
  "last_message_glob": "$(json_escape "$last_glob")",
  "title": ${title_json}
}
EOF
  )

  codex_write_session_state "$state_file" "$state_json"
  rm -f "${CODEX_SESSION_DIR}/pid" 2>/dev/null || true
}

classify_exit "${RUN_LAST_MSG_FILE}" "${CODEX_LOG_FILE}" "${CODEX_EXIT}"
INSTR_TITLE=$(awk 'NF {print; exit}' "${INSTR_FILE}" 2>/dev/null || echo "")
RUN_ID="codex-${TS}${TAG_SUFFIX}"

# 根据运行时日志回填网络实际生效状态，避免仅依据入参产生偏差
if [[ -f "${CODEX_LOG_FILE}" ]]; then
  if grep -Eqi 'network access enabled' "${CODEX_LOG_FILE}" 2>/dev/null; then
    EFFECTIVE_NETWORK_ACCESS="enabled"
  elif grep -Eqi 'network access (disabled|restricted)' "${CODEX_LOG_FILE}" 2>/dev/null; then
    EFFECTIVE_NETWORK_ACCESS="restricted"
  fi
fi

TOKENS_JSON="null"
if [[ -n "${TOKENS_USED}" ]]; then
  if [[ "${TOKENS_USED}" =~ ^[0-9]+$ ]]; then
    TOKENS_JSON="${TOKENS_USED}"
  else
    TOKENS_JSON="\"$(json_escape "${TOKENS_USED}")\""
  fi
fi

PATCH_ARTIFACT_JSON="null"
if [[ -n "${PATCH_ARTIFACT_PATHS[1]:-}" ]]; then
  _patch_path="${PATCH_ARTIFACT_PATHS[1]}"
  _patch_hash="${PATCH_ARTIFACT_HASHES[1]:-}"
  _patch_lines="${PATCH_ARTIFACT_LINES[1]:-0}"
  _patch_bytes="${PATCH_ARTIFACT_BYTES[1]:-0}"
  _hash_json="null"
  if [[ -n "${_patch_hash}" ]]; then
    _hash_json="\"$(json_escape "${_patch_hash}")\""
  fi
  if [[ ! "${_patch_lines}" =~ ^[0-9]+$ ]]; then
    _patch_lines="\"$(json_escape "${_patch_lines}")\""
  fi
  if [[ ! "${_patch_bytes}" =~ ^[0-9]+$ ]]; then
    _patch_bytes="\"$(json_escape "${_patch_bytes}")\""
  fi
  PATCH_ARTIFACT_JSON=$(cat <<EOF
{
  "path": "$(json_escape "${_patch_path}")",
  "sha256": ${_hash_json},
  "lines": ${_patch_lines},
  "bytes": ${_patch_bytes}
}
EOF
  )
fi

META_JSON=$(cat <<EOF
{
  "id": "$(json_escape "${RUN_ID}")",
  "timestamp": "${TS}",
  "tag": "$(json_escape "${SAFE_TAG:-}")",
  "classification": "$(json_escape "${CLASSIFICATION}")",
  "control_flag": "$(json_escape "${CONTROL_FLAG}")",
  "reason": "$(json_escape "${EXIT_REASON}")",
  "tokens_used": ${TOKENS_JSON},
  "patch_artifact": ${PATCH_ARTIFACT_JSON},
  "cwd": "$(json_escape "$(pwd)")",
  "log_file": "$(json_escape "${CODEX_LOG_FILE}")",
  "instructions_file": "$(json_escape "${INSTR_FILE}")",
  "exit_code": ${CODEX_EXIT},
  "title": "$(json_escape "${INSTR_TITLE}")",
  "effective_sandbox": "$(json_escape "${EFFECTIVE_SANDBOX:-}")",
  "effective_approval_policy": "$(json_escape "${EFFECTIVE_APPROVAL_POLICY:-}")",
  "effective_network_access": "$(json_escape "${EFFECTIVE_NETWORK_ACCESS:-}")",
  "sandbox_bypass": ${EFFECTIVE_BYPASS}
}
EOF
)

printf '%s\n' "${META_JSON}" > "${META_FILE}"

# 如网络为受限模式，给出新手友好提示（仅写入日志，不影响 JSON）
if [[ "${EFFECTIVE_NETWORK_ACCESS}" == "restricted" ]]; then
  {
    echo "[hint] 网络为受限模式：如需联网，请添加 --codex-config sandbox_workspace_write.network_access=true 或在 MCP 工具入参传 network=true。"
  } >> "${CODEX_LOG_FILE}"
fi

if [[ "${CODEX_LOG_AGGREGATE}" == "1" ]]; then
  mkdir -p "$(dirname "${CODEX_LOG_AGGREGATE_JSONL_FILE}")"
  printf '%s\n' "${META_JSON}" >> "${CODEX_LOG_AGGREGATE_JSONL_FILE}"
fi

DO_LOOP=0
if (( MAX_RUNS > 1 )) || [[ -n "${REPEAT_UNTIL}" ]]; then
  DO_LOOP=1
fi

if (( DO_LOOP == 0 )); then
  # 如果是上下文溢出，按策略自动进入重试多轮
  if [[ "${ON_CONTEXT_OVERFLOW_RETRY}" == "1" ]]; then
    classify_exit "${RUN_LAST_MSG_FILE}" "${CODEX_LOG_FILE}" "${CODEX_EXIT}"
    if [[ "${CLASSIFICATION:-}" == "context_overflow" ]]; then
      MAX_RUNS=$(( 1 + ${ON_CONTEXT_OVERFLOW_MAX_RETRIES:-2} ))
      DO_LOOP=1
    fi
  fi
  if (( DO_LOOP == 0 )); then
    # 执行结果摘要（单轮）
    echo "[debug] JSON_OUTPUT=${JSON_OUTPUT} writing summary (single-run)" >> "${CODEX_LOG_FILE}"
    codex_update_session_state || true
    if [[ "${JSON_OUTPUT}" == "1" ]]; then
      set +e
      # 直接输出 meta JSON；若文件缺失则使用内存中的 META_JSON；再退化为即时拼装
      if [[ -f "${META_FILE}" ]]; then
        cat "${META_FILE}"
      elif [[ -n "${META_JSON:-}" ]]; then
        printf '%s\n' "${META_JSON}"
      else
        printf '{"exit_code": %s, "log_file": "%s", "instructions_file": "%s"}\n' "${CODEX_EXIT}" "$(json_escape "${CODEX_LOG_FILE}")" "$(json_escape "${INSTR_FILE}")"
      fi
      set -e
    else
      echo "Codex 运行完成。退出码: ${CODEX_EXIT}"
      echo "日志文件: ${CODEX_LOG_FILE}"
      echo "指令文件: ${INSTR_FILE}"
      echo "元数据: ${META_FILE}"
      if [[ "${CODEX_LOG_AGGREGATE}" == "1" ]]; then
        echo "汇总记录: ${CODEX_LOG_AGGREGATE_FILE}"
        echo "JSONL 汇总: ${CODEX_LOG_AGGREGATE_JSONL_FILE}"
      fi
    fi
    exit "${CODEX_EXIT}"
  fi
fi

# 多轮执行：每轮重新读取并组合最新指令（支持文档已被模型更新）
PREV_LAST_MSG_FILE="${RUN_LAST_MSG_FILE}"
PREV_HEAD_BEFORE="${GIT_HEAD_BEFORE}"
PREV_HEAD_AFTER="${GIT_HEAD_AFTER}"
RUN=2
while (( RUN <= MAX_RUNS )); do
  # 每轮注入补丁模式 policy-note（如启用）
  if (( PATCH_MODE == 1 )); then
    POLICY_NOTE="${PATCH_POLICY_NOTE}"
  fi
  # 如果设置了 repeat-until 且上一轮已满足，则停止
  if [[ -n "${REPEAT_UNTIL}" ]] && [[ -f "${PREV_LAST_MSG_FILE}" ]]; then
    if grep -Eq "${REPEAT_UNTIL}" "${PREV_LAST_MSG_FILE}"; then
      # 在停止前做完成前置校验
      ENFORCE_OK=1
      ENFORCE_REASON=""
      if (( ${#REQUIRE_CHANGE_GLOBS[@]} > 0 )) || (( REQUIRE_GIT_COMMIT == 1 )); then
        # 计算本轮改动情况
        HEAD_ADVANCED=0
        CHANGED_LIST=()
        if (( GIT_ENABLED == 1 )); then
          if [[ -n "${PREV_HEAD_BEFORE}" && -n "${PREV_HEAD_AFTER}" && "${PREV_HEAD_BEFORE}" != "${PREV_HEAD_AFTER}" ]]; then
            HEAD_ADVANCED=1
            # 取本轮提交范围
            while IFS= read -r f; do CHANGED_LIST+=("$f"); done < <(git diff --name-only "${PREV_HEAD_BEFORE}" "${PREV_HEAD_AFTER}" 2>/dev/null)
          else
            # 没有提交，取工作区改动
            while IFS= read -r f; do CHANGED_LIST+=("$f"); done < <(git status --porcelain=v1 2>/dev/null | awk '{print $2}')
          fi
        fi

        # 检查 require-git-commit
        if (( REQUIRE_GIT_COMMIT == 1 )) && (( GIT_ENABLED == 1 )); then
          if (( HEAD_ADVANCED == 0 )); then
            ENFORCE_OK=0
            ENFORCE_REASON+="缺少提交；"
          fi
        fi

        # 检查 require-change-in（若提供）
        if (( ${#REQUIRE_CHANGE_GLOBS[@]} > 0 )); then
          MATCHED_ANY=0
          for f in "${CHANGED_LIST[@]}"; do
            for g in "${REQUIRE_CHANGE_GLOBS[@]}"; do
              case "$f" in
                $g) MATCHED_ANY=1 ;;
              esac
              (( MATCHED_ANY == 1 )) && break
            done
            (( MATCHED_ANY == 1 )) && break
          done
          if (( MATCHED_ANY == 0 )); then
            ENFORCE_OK=0
            ENFORCE_REASON+="未检测到匹配变更；"
          fi
        fi

        # 如未满足且允许自动提交，尝试提交
        if (( ENFORCE_OK == 0 )) && (( AUTO_COMMIT_ON_DONE == 1 )) && (( GIT_ENABLED == 1 )); then
          TO_ADD=()
          while IFS= read -r f; do TO_ADD+=("$f"); done < <(git status --porcelain=v1 2>/dev/null | awk '{print $2}')
          ADDED_ANY=0
          if (( ${#REQUIRE_CHANGE_GLOBS[@]} > 0 )); then
            SEL=()
            for f in "${TO_ADD[@]}"; do
              for g in "${REQUIRE_CHANGE_GLOBS[@]}"; do
                case "$f" in $g) SEL+=("$f");; esac
              done
            done
            if (( ${#SEL[@]} > 0 )); then
              git add -- "${SEL[@]}" 2>/dev/null && ADDED_ANY=1
            fi
          else
            if (( ${#TO_ADD[@]} > 0 )); then
              git add -A 2>/dev/null && ADDED_ANY=1
            fi
          fi
          if (( ADDED_ANY == 1 )); then
            git commit -m "${AUTO_COMMIT_MESSAGE}" 2>/dev/null || true
            # 重新计算提交与变更
            PREV_HEAD_AFTER=$(git rev-parse HEAD 2>/dev/null || echo "")
            HEAD_ADVANCED=1
            ENFORCE_OK=1
            ENFORCE_REASON=""
          fi
        fi
      fi

      if (( ENFORCE_OK == 1 )); then
        echo "[repeat] 条件已满足（${REPEAT_UNTIL}），停止迭代。" >> "${CODEX_LOG_FILE}"
        break
      else
        echo "[repeat] 条件满足但未通过完成校验（${ENFORCE_REASON}）→ 继续执行下一轮。" >> "${CODEX_LOG_FILE}"
        # 给下一轮注入提示
        POLICY_NOTE=$'完成前置校验未通过：请确保已更新进度文件并完成提交，然后再输出 CONTROL: DONE。'
        # 不 break，继续下一轮
      fi
    fi
  fi

  RUN_INSTR_FILE="${CODEX_LOG_FILE%.log}.r${RUN}.instructions.md"
  RUN_META_FILE="${CODEX_LOG_FILE%.log}.r${RUN}.meta.json"
  RUN_SUMMARY_FILE="${CODEX_LOG_FILE%.log}.r$((RUN-1)).summary.txt"

  if (( CARRY_CONTEXT == 1 )); then
    if (( COMPRESS_CONTEXT == 1 )); then
      compress_context_file "${PREV_LAST_MSG_FILE}" "${RUN_SUMMARY_FILE}" "${CONTEXT_HEAD}" "${CONTEXT_GREP[@]}"
    else
      cp -f "${PREV_LAST_MSG_FILE}" "${RUN_SUMMARY_FILE}" 2>/dev/null || :
    fi
  fi

  # 重新组合（读取最新的文件内容）
  compose_instructions
  CURRENT_INSTR="${INSTRUCTIONS}"
  if [[ -n "${POLICY_NOTE:-}" ]]; then
    CURRENT_INSTR+=$'\n\n<instructions-section type="policy-note">\n'
    CURRENT_INSTR+="${POLICY_NOTE}"
    CURRENT_INSTR+=$'\n</instructions-section>\n'
    POLICY_NOTE=""
  fi
  if (( CARRY_CONTEXT == 1 )); then
    CURRENT_INSTR+=$'\n\n'"----- Previous Run (r$((RUN-1))) Summary (compressed) -----"$'\n'
    if [[ -f "${RUN_SUMMARY_FILE}" ]]; then
      CURRENT_INSTR+="$(cat "${RUN_SUMMARY_FILE}")"
    else
      CURRENT_INSTR+="[no previous context]"
    fi
    CURRENT_INSTR+=$'\n'"----- End Previous Run Summary -----"$'\n'
  fi

  # 写入当前轮指令快照
  umask 077
  if [[ "${REDACT_ENABLE}" == "1" ]]; then
    printf '%s' "${CURRENT_INSTR}" | sed -E "${REDACT_SED_ARGS[@]}" > "${RUN_INSTR_FILE}"
  else
    printf '%s' "${CURRENT_INSTR}" > "${RUN_INSTR_FILE}"
  fi

  # 日志记录
  {
    echo "--- Iteration ${RUN} ---"
    echo "Instructions: ${RUN_INSTR_FILE}"
    if (( CARRY_CONTEXT == 1 )); then
      echo "Attached previous summary: ${RUN_SUMMARY_FILE}"
    fi
  } >> "${CODEX_LOG_FILE}"

  # 回显合成内容（遵守 echo-limit）
  if [[ "${CODEX_ECHO_INSTRUCTIONS}" == "1" ]]; then
    {
      echo "----- Begin Composed Instructions -----"
    } >> "${CODEX_LOG_FILE}"
    if [[ "${REDACT_ENABLE}" == "1" ]]; then
      if [[ "${CODEX_ECHO_INSTRUCTIONS_LIMIT}" != "0" ]]; then
        printf '%s' "${CURRENT_INSTR}" | sed -E "${REDACT_SED_ARGS[@]}" | sed -n "1,${CODEX_ECHO_INSTRUCTIONS_LIMIT}p" >> "${CODEX_LOG_FILE}"
        echo >> "${CODEX_LOG_FILE}"
        echo "----- [Truncated after ${CODEX_ECHO_INSTRUCTIONS_LIMIT} lines] -----" >> "${CODEX_LOG_FILE}"
      else
        printf '%s' "${CURRENT_INSTR}" | sed -E "${REDACT_SED_ARGS[@]}" >> "${CODEX_LOG_FILE}"
        echo >> "${CODEX_LOG_FILE}"
      fi
    else
      if [[ "${CODEX_ECHO_INSTRUCTIONS_LIMIT}" != "0" ]]; then
        printf '%s' "${CURRENT_INSTR}" | sed -n "1,${CODEX_ECHO_INSTRUCTIONS_LIMIT}p" >> "${CODEX_LOG_FILE}"
        echo >> "${CODEX_LOG_FILE}"
        echo "----- [Truncated after ${CODEX_ECHO_INSTRUCTIONS_LIMIT} lines] -----" >> "${CODEX_LOG_FILE}"
      else
        printf '%s' "${CURRENT_INSTR}" >> "${CODEX_LOG_FILE}"
        echo >> "${CODEX_LOG_FILE}"
      fi
    fi
    echo "----- End Composed Instructions -----" >> "${CODEX_LOG_FILE}"
  fi

  echo "----- Begin Codex Output (iteration ${RUN}) -----" >> "${CODEX_LOG_FILE}"
  set +e
  RUN_LAST_MSG_FILE="${CODEX_LOG_FILE%.log}.r${RUN}.last.txt"
  RUN_OUTPUT_FILE="${CODEX_LOG_FILE%.log}.r${RUN}.output.txt"
  EXEC_ARGS=("${CODEX_EXEC_ARGS[@]}" "--output-last-message" "${RUN_LAST_MSG_FILE}")
  CODEX_EXECUTED=0
  if [[ ${DRY_RUN} -eq 1 ]]; then
    if [[ "${JSON_OUTPUT}" == "1" ]]; then
      echo "[DRY-RUN] 跳过 codex 执行，仅生成日志与指令文件 (iteration ${RUN})" >> "${CODEX_LOG_FILE}"
    else
      echo "[DRY-RUN] 跳过 codex 执行，仅生成日志与指令文件 (iteration ${RUN})" | tee -a "${CODEX_LOG_FILE}"
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
      if [[ "${JSON_OUTPUT}" == "1" ]]; then
        if [[ "${REDACT_ENABLE}" == "1" ]]; then
          printf '%s' "${CURRENT_INSTR}" | codex "${CODEX_GLOBAL_ARGS[@]}" exec "${EXEC_ARGS[@]}" 2>&1 \
            | sed -u -E "${REDACT_SED_ARGS[@]}" | tee "${RUN_OUTPUT_FILE}" >/dev/null
          CODEX_EXIT=${PIPESTATUS[1]}
        else
          printf '%s' "${CURRENT_INSTR}" | codex "${CODEX_GLOBAL_ARGS[@]}" exec "${EXEC_ARGS[@]}" 2>&1 \
            | tee "${RUN_OUTPUT_FILE}" >/dev/null
          CODEX_EXIT=${PIPESTATUS[1]}
        fi
      else
        if [[ "${REDACT_ENABLE}" == "1" ]]; then
          printf '%s' "${CURRENT_INSTR}" | codex "${CODEX_GLOBAL_ARGS[@]}" exec "${EXEC_ARGS[@]}" 2>&1 \
            | sed -u -E "${REDACT_SED_ARGS[@]}" | tee "${RUN_OUTPUT_FILE}"
          CODEX_EXIT=${PIPESTATUS[1]}
        else
          printf '%s' "${CURRENT_INSTR}" | codex "${CODEX_GLOBAL_ARGS[@]}" exec "${EXEC_ARGS[@]}" 2>&1 \
            | tee "${RUN_OUTPUT_FILE}"
          CODEX_EXIT=${PIPESTATUS[1]}
        fi
      fi
    fi
  fi
  set -e
  if (( CODEX_EXECUTED == 1 )) && [[ -f "${RUN_OUTPUT_FILE}" ]]; then
    codex_publish_output "${RUN_OUTPUT_FILE}" "${RUN}"
  fi
  {
    echo "----- End Codex Output (iteration ${RUN}) -----"
    echo "Exit Code: ${CODEX_EXIT}"
  } >> "${CODEX_LOG_FILE}"

  # 元数据与汇总（含分类）
  if (( RUN == 1 )) && [[ -n "${TS}" ]]; then
    RUN_TS="${TS}"
  else
    RUN_TS="$(date +%Y%m%d_%H%M%S)"
  fi
  if (( RUN == 1 )) && [[ -n "${TS_DISPLAY}" ]]; then
    RUN_TS_DISPLAY="${TS_DISPLAY}"
  else
    RUN_TS_DISPLAY="$(date +%Y-%m-%dT%H:%M:%S%:z)"
  fi
  INSTR_TITLE=$(awk 'NF {print; exit}' "${RUN_INSTR_FILE}" 2>/dev/null || echo "")
  RUN_ID="codex-${RUN_TS}${TAG_SUFFIX}-r${RUN}"
  classify_exit "${RUN_LAST_MSG_FILE}" "${CODEX_LOG_FILE}" "${CODEX_EXIT}"
  PATCH_ARTIFACT_JSON="null"
  if [[ -n "${PATCH_ARTIFACT_PATHS[${RUN}]:-}" ]]; then
    _patch_path="${PATCH_ARTIFACT_PATHS[${RUN}]}"
    _patch_hash="${PATCH_ARTIFACT_HASHES[${RUN}]:-}"
    _patch_lines="${PATCH_ARTIFACT_LINES[${RUN}]:-0}"
    _patch_bytes="${PATCH_ARTIFACT_BYTES[${RUN}]:-0}"
    _hash_json="null"
    if [[ -n "${_patch_hash}" ]]; then
      _hash_json="\"$(json_escape "${_patch_hash}")\""
    fi
    if [[ ! "${_patch_lines}" =~ ^[0-9]+$ ]]; then
      _patch_lines="\"$(json_escape "${_patch_lines}")\""
    fi
    if [[ ! "${_patch_bytes}" =~ ^[0-9]+$ ]]; then
      _patch_bytes="\"$(json_escape "${_patch_bytes}")\""
    fi
    PATCH_ARTIFACT_JSON=$(cat <<EOF
{
  "path": "$(json_escape "${_patch_path}")",
  "sha256": ${_hash_json},
  "lines": ${_patch_lines},
  "bytes": ${_patch_bytes}
}
EOF
    )
  fi
  META_JSON=$(cat <<EOF
{
  "id": "$(json_escape "${RUN_ID}")",
  "timestamp": "${RUN_TS}",
  "tag": "$(json_escape "${SAFE_TAG:-}")",
  "classification": "$(json_escape "${CLASSIFICATION}")",
  "control_flag": "$(json_escape "${CONTROL_FLAG}")",
  "reason": "$(json_escape "${EXIT_REASON}")",
  "tokens_used": "$(json_escape "${TOKENS_USED}")",
  "iteration": ${RUN},
  "patch_artifact": ${PATCH_ARTIFACT_JSON},
  "cwd": "$(json_escape "$(pwd)")",
  "log_file": "$(json_escape "${CODEX_LOG_FILE}")",
  "instructions_file": "$(json_escape "${RUN_INSTR_FILE}")",
  "last_message_file": "$(json_escape "${RUN_LAST_MSG_FILE}")",
  "exit_code": ${CODEX_EXIT},
  "title": "$(json_escape "${INSTR_TITLE}")",
  "effective_sandbox": "$(json_escape "${EFFECTIVE_SANDBOX:-}")",
  "effective_approval_policy": "$(json_escape "${EFFECTIVE_APPROVAL_POLICY:-}")",
  "effective_network_access": "$(json_escape "${EFFECTIVE_NETWORK_ACCESS:-}")",
  "sandbox_bypass": ${EFFECTIVE_BYPASS}
}
EOF
)
  printf '%s\n' "${META_JSON}" > "${RUN_META_FILE}"
  if [[ "${CODEX_LOG_AGGREGATE}" == "1" ]]; then
    mkdir -p "$(dirname "${CODEX_LOG_AGGREGATE_JSONL_FILE}")"
    printf '%s\n' "${META_JSON}" >> "${CODEX_LOG_AGGREGATE_JSONL_FILE}"
    mkdir -p "$(dirname "${CODEX_LOG_AGGREGATE_FILE}")"
    {
      echo "=== [${RUN_TS_DISPLAY}] Codex Run r${RUN} ${TAG_SUFFIX} ==="
      echo "Log: ${CODEX_LOG_FILE}"
      echo "Instructions: ${RUN_INSTR_FILE}"
      echo -n "Title: "; awk 'NF {print; exit}' "${RUN_INSTR_FILE}" | cut -c1-120 || true
      echo "Exit: ${CODEX_EXIT}"
      echo
    } >> "${CODEX_LOG_AGGREGATE_FILE}"
  fi

  PREV_LAST_MSG_FILE="${RUN_LAST_MSG_FILE}"
  if (( SLEEP_SECONDS > 0 )); then sleep "${SLEEP_SECONDS}"; fi
  (( RUN++ ))
done

# 最终摘要（多轮）
if [[ "${JSON_OUTPUT}" == "1" ]]; then
  codex_update_session_state || true
  set +e
  # 输出最后一轮的 meta JSON（若无则回退第一次；仍无则即时拼装简版 JSON）
  LAST_META_FILE=$(ls -1t "${CODEX_LOG_FILE%.log}"*.meta.json 2>/dev/null | head -n1 || true)
  if [[ -n "${LAST_META_FILE}" && -f "${LAST_META_FILE}" ]]; then
    cat "${LAST_META_FILE}"
  elif [[ -f "${META_FILE}" ]]; then
    cat "${META_FILE}"
  else
    printf '{"exit_code": %s, "log_file": "%s", "instructions_file": "%s"}\n' "${CODEX_EXIT}" "$(json_escape "${CODEX_LOG_FILE}")" "$(json_escape "${INSTR_FILE}")"
  fi
  set -e
else
  codex_update_session_state || true
  echo "Codex 运行完成。退出码: ${CODEX_EXIT}"
  echo "日志文件: ${CODEX_LOG_FILE}"
  echo "指令文件: ${INSTR_FILE}"
  echo "元数据: ${META_FILE}"
  if [[ "${CODEX_LOG_AGGREGATE}" == "1" ]]; then
    echo "汇总记录: ${CODEX_LOG_AGGREGATE_FILE}"
    echo "JSONL 汇总: ${CODEX_LOG_AGGREGATE_JSONL_FILE}"
  fi
fi
exit "${CODEX_EXIT}"
