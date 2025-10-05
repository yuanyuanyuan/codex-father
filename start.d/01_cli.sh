# 将 --config key=value 形式的配置去重后设置，避免相同键多次出现导致旧值覆盖逻辑不确定
set_codex_config_kv() {
  local key="$1" value="$2"
  local -a rebuilt=()
  local i=0
  while (( i < ${#CODEX_GLOBAL_ARGS[@]} )); do
    local current="${CODEX_GLOBAL_ARGS[$i]}"
    if [[ "$current" == "--config" ]] && (( i + 1 < ${#CODEX_GLOBAL_ARGS[@]} )); then
      local kv="${CODEX_GLOBAL_ARGS[$((i+1))]}"
      local existing_key="${kv%%=*}"
      if [[ "$existing_key" == "$key" ]]; then
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
  CODEX_GLOBAL_ARGS=("${rebuilt[@]}" "--config" "${key}=${value}")
}

normalize_sandbox_and_approvals() {
  local sandbox="" approval="" has_bypass=0
  local i=0
  while (( i < ${#CODEX_GLOBAL_ARGS[@]} )); do
    local a="${CODEX_GLOBAL_ARGS[$i]}"
    case "$a" in
      --sandbox)
        if (( i+1 < ${#CODEX_GLOBAL_ARGS[@]} )); then sandbox="${CODEX_GLOBAL_ARGS[$((i+1))]}"; fi
        i=$((i+1)) ;;
      --ask-for-approval)
        if (( i+1 < ${#CODEX_GLOBAL_ARGS[@]} )); then approval="${CODEX_GLOBAL_ARGS[$((i+1))]}"; fi
        i=$((i+1)) ;;
      --dangerously-bypass-approvals-and-sandbox)
        has_bypass=1 ;;
    esac
    i=$((i+1))
  done

  if [[ "$sandbox" == "danger-full-access" && $has_bypass -ne 1 ]]; then
    if [[ -z "$approval" ]]; then
      # 未指定审批策略，默认补 on-request（交互式）
      local policy="${DEFAULT_APPROVAL_FOR_DFA:-on-request}"
      set_codex_flag_value "--ask-for-approval" "$policy"
      approval="$policy"
      DFA_NOTE="已自动附加 --ask-for-approval ${policy} 以配合 --sandbox danger-full-access"
    elif [[ "$approval" == "never" ]]; then
      # 非交互且请求 full-access：默认降级 sandbox，或在显式允许时自动添加 bypass
      local allow_bypass="${ALLOW_DFA_WITH_NEVER:-0}"
      local degrade_on_never="${DFA_DEGRADE_ON_NEVER:-1}"
      local degrade_target="${DFA_DEGRADE_TARGET:-workspace-write}"
      if [[ "$allow_bypass" == "1" ]]; then
        CODEX_GLOBAL_ARGS+=("--dangerously-bypass-approvals-and-sandbox")
        DFA_NOTE="已在非交互模式下启用 full-access（自动附加 --dangerously-bypass-approvals-and-sandbox，危险）"
      elif [[ "$degrade_on_never" == "1" ]]; then
        # 在原地修改 --sandbox 的值
        local j=0
        while (( j < ${#CODEX_GLOBAL_ARGS[@]} )); do
          if [[ "${CODEX_GLOBAL_ARGS[$j]}" == "--sandbox" ]] && (( j+1 < ${#CODEX_GLOBAL_ARGS[@]} )); then
            CODEX_GLOBAL_ARGS[$((j+1))]="$degrade_target"
            DFA_NOTE="已自动降级 sandbox: danger-full-access -> ${degrade_target}（非交互模式不提权）"
            break
          fi
          j=$((j+1))
        done
      else
        VALIDATION_ERROR=$'错误: 组合无效\n- 非交互 (--ask-for-approval never) 不允许直接启用 --sandbox danger-full-access\n  可设置环境变量 ALLOW_DFA_WITH_NEVER=1 自动附加 --dangerously-bypass-approvals-and-sandbox（危险），\n  或设置 DFA_DEGRADE_ON_NEVER=1 将 sandbox 降级（默认行为），\n  或改为 --ask-for-approval on-request（交互）。'
      fi
    fi
  fi

  local allow_never_writable="${ALLOW_NEVER_WITH_WRITABLE_SANDBOX:-0}"
  if [[ $has_bypass -eq 0 && "$allow_never_writable" != "1" ]]; then
    local effective_sandbox="$sandbox"
    if [[ -z "$effective_sandbox" ]]; then effective_sandbox="workspace-write"; fi
    if [[ "$effective_sandbox" != "read-only" ]]; then
      local override="${WRITABLE_SANDBOX_APPROVAL_OVERRIDE:-on-request}"
      if [[ "$approval" == "never" ]]; then
        set_codex_flag_value "--ask-for-approval" "$override"
        approval="$override"
        APPROVAL_NOTE="已将审批策略调整为 ${override}（避免 never 与可写沙箱组合触发只读降级）"
      elif [[ -z "$approval" ]]; then
        set_codex_flag_value "--ask-for-approval" "$override"
        approval="$override"
        APPROVAL_NOTE="已设置审批策略为 ${override}（可写沙箱需要审批以避免只读降级）"
      fi
    fi
  fi
  return 0
}

compute_effective_runtime_flags() {
  local sandbox="workspace-write"
  local approval="on-failure"
  local network="restricted"
  local has_bypass=0
  local i=0
  while (( i < ${#CODEX_GLOBAL_ARGS[@]} )); do
    local token="${CODEX_GLOBAL_ARGS[$i]}"
    case "$token" in
      --sandbox)
        if (( i + 1 < ${#CODEX_GLOBAL_ARGS[@]} )); then
          sandbox="${CODEX_GLOBAL_ARGS[$((i + 1))]}"
        fi
        i=$((i + 2))
        continue
        ;;
      --ask-for-approval)
        if (( i + 1 < ${#CODEX_GLOBAL_ARGS[@]} )); then
          approval="${CODEX_GLOBAL_ARGS[$((i + 1))]}"
        fi
        i=$((i + 2))
        continue
        ;;
      --dangerously-bypass-approvals-and-sandbox)
        has_bypass=1
        i=$((i + 1))
        continue
        ;;
      --config|--codex-config)
        if (( i + 1 < ${#CODEX_GLOBAL_ARGS[@]} )); then
          local kv="${CODEX_GLOBAL_ARGS[$((i + 1))]}"
          local key="${kv%%=*}"
          local raw_val="${kv#*=}"
          local val="${raw_val//\"/}"
          if [[ "$key" == "network_access" || "$key" == *".network_access" ]]; then
            case "${val,,}" in
              1|true|enabled|allow|yes) network="enabled" ;;
              0|false|disabled|deny|no) network="restricted" ;;
              *) network="$val" ;;
            esac
          fi
        fi
        i=$((i + 2))
        continue
        ;;
    esac
    i=$((i + 1))
  done

  if (( has_bypass == 1 )); then
    sandbox="danger-full-access"
  fi

  EFFECTIVE_SANDBOX="$sandbox"
  EFFECTIVE_APPROVAL_POLICY="$approval"
  EFFECTIVE_NETWORK_ACCESS="$network"
  EFFECTIVE_BYPASS=$has_bypass
}

FILE_INPUT=""
CLI_CONTENT=""
PREPEND_CONTENT=""
APPEND_CONTENT=""
PREPEND_FILE=""
APPEND_FILE=""
DRY_RUN=0
PATCH_MODE=0
JSON_OUTPUT=0

# 补丁模式提示文案（仅输出可应用补丁，不执行写入）
PATCH_POLICY_NOTE=$'请仅输出可应用的补丁（patch/diff），不要执行任何写文件、运行命令或直接修改仓库。\n优先使用统一 diff（git apply）或 Codex CLI apply_patch 片段，逐文件展示新增/修改/删除。\n如需迁移脚本或测试，请以新增文件形式包含于补丁中。完成后输出 “CONTROL: DONE”。'

# 动态收集自定义脱敏正则
REDACT_PATTERNS=()

# 叠加输入相关：按命令行顺序记录 -f/-c
SRC_TYPES=()   # 元素: F | C
SRC_VALUES=()  # 与 SRC_TYPES 对应的值（文件路径或文本）
FILE_INPUTS=() # 仅用于校验，例如 '-' 次数
OVERRIDE_FILE="" # -F/--file-override 指定的基底文件（可为 '-' 表示 STDIN）

# 透传给 codex 的参数
CODEX_GLOBAL_ARGS=()
CODEX_EXEC_ARGS=()
VALIDATION_ERROR=""

# 循环运行与上下文压缩参数（默认关闭循环，不携带上下文）
REPEAT_UNTIL=""
MAX_RUNS=1
SLEEP_SECONDS=0
CARRY_CONTEXT=0
COMPRESS_CONTEXT=1
CONTEXT_HEAD=120
CONTEXT_GREP=(
  '^CONTROL:'
  '^STATUS'
  '^NEXT_ACTIONS'
  '^COMMANDS'
  '^DIFF'
  '^BLOCKERS'
  '^PLAN'
  '^RESULTS'
  '^ERROR'
  '^RISK'
  '^TODO'
  '^DONE'
  '^GOAL'
  '^SUMMARY'
)

# 完成前置校验（require-*）与自动提交
REQUIRE_CHANGE_GLOBS=()   # --require-change-in <glob>（可多次）
REQUIRE_GIT_COMMIT=0      # --require-git-commit
AUTO_COMMIT_ON_DONE=0     # --auto-commit-on-done
AUTO_COMMIT_MESSAGE=${AUTO_COMMIT_MESSAGE:-"docs(progress): auto update"}

# 上下文溢出自动重试（默认开启，最多重试2次）
ON_CONTEXT_OVERFLOW_RETRY="${ON_CONTEXT_OVERFLOW_RETRY:-1}"
ON_CONTEXT_OVERFLOW_MAX_RETRIES="${ON_CONTEXT_OVERFLOW_MAX_RETRIES:-2}"

while [[ $# -gt 0 ]]; do
  case "${1}" in
    -f|--file)
      shift
      [[ $# -ge 1 ]] || { echo "错误: -f/--file 需要至少一个路径参数" >&2; exit 2; }
      # 连续吸收非选项参数作为文件值；特殊值 '-' 也作为文件值；支持通配符展开
      while [[ $# -gt 0 ]]; do
        next="$1"
        if [[ "$next" == "-" || "$next" != -* ]]; then
          if [[ "$next" == "-" ]]; then
            SRC_TYPES+=("F"); SRC_VALUES+=("${next}"); FILE_INPUTS+=("${next}")
          else
            if expand_arg_to_files "$next"; then
              for _m in "${EXP_FILES[@]}"; do SRC_TYPES+=("F"); SRC_VALUES+=("${_m}"); FILE_INPUTS+=("${_m}"); done
            else
              # 记录原始 token 以便下游报错时输出调试信息
              SRC_TYPES+=("F"); SRC_VALUES+=("${next}"); FILE_INPUTS+=("${next}")
            fi
          fi
          shift
        else
          break
        fi
      done
      ;;
    -F|--file-override)
      [[ $# -ge 2 ]] || { echo "错误: -F/--file-override 需要一个路径参数" >&2; exit 2; }
      OVERRIDE_FILE="${2}"; shift 2 ;;
    -c|--content)
      [[ $# -ge 2 ]] || { echo "错误: -c/--content 需要文本参数" >&2; exit 2; }
      SRC_TYPES+=("C"); SRC_VALUES+=("${2}"); shift 2 ;;
    -l|--log-file)
      [[ $# -ge 2 ]] || { echo "错误: -l/--log-file 需要一个路径参数" >&2; exit 2; }
      CODEX_LOG_FILE="${2}"; shift 2 ;;
    --log-dir)
      [[ $# -ge 2 ]] || { echo "错误: --log-dir 需要一个目录参数" >&2; exit 2; }
      CODEX_LOG_DIR="${2}"; shift 2 ;;
    --tag)
      [[ $# -ge 2 ]] || { echo "错误: --tag 需要一个名称参数" >&2; exit 2; }
      CODEX_LOG_TAG="${2}"; shift 2 ;;
    --log-subdirs)
      CODEX_LOG_SUBDIRS=1; shift 1 ;;
    --flat-logs)
      CODEX_LOG_SUBDIRS=0; shift 1 ;;
    --echo-instructions)
      CODEX_ECHO_INSTRUCTIONS=1; shift 1 ;;
    --no-echo-instructions)
      CODEX_ECHO_INSTRUCTIONS=0; shift 1 ;;
    --echo-limit)
      [[ $# -ge 2 ]] || { echo "错误: --echo-limit 需要一个数字参数" >&2; exit 2; }
      CODEX_ECHO_INSTRUCTIONS_LIMIT="${2}"; shift 2 ;;
    --require-change-in)
      [[ $# -ge 2 ]] || { echo "错误: --require-change-in 需要一个路径通配符参数" >&2; exit 2; }
      REQUIRE_CHANGE_GLOBS+=("${2}"); shift 2 ;;
    --require-git-commit)
      REQUIRE_GIT_COMMIT=1; shift 1 ;;
    --auto-commit-on-done)
      AUTO_COMMIT_ON_DONE=1; shift 1 ;;
    --auto-commit-message)
      [[ $# -ge 2 ]] || { echo "错误: --auto-commit-message 需要一个提交信息参数" >&2; exit 2; }
      AUTO_COMMIT_MESSAGE="${2}"; shift 2 ;;
    --no-overflow-retry)
      ON_CONTEXT_OVERFLOW_RETRY=0; shift 1 ;;
    --overflow-retries)
      [[ $# -ge 2 ]] || { echo "错误: --overflow-retries 需要一个数字参数" >&2; exit 2; }
      ON_CONTEXT_OVERFLOW_MAX_RETRIES="${2}"; shift 2 ;;
    -p)
      echo "错误: -p 参数已移除。请使用 --preset <name>，并搭配 --task <text>（建议加上 --tag <name>）" >&2
      exit 2 ;;
    --preset)
      [[ $# -ge 2 ]] || { echo "错误: --preset 需要一个名称 (sprint|analysis|secure|fast)" >&2; exit 2; }
      PRESET_NAME="${2}"; shift 2 ;;
    --docs)
      shift
      [[ $# -ge 1 ]] || { echo "错误: --docs 需要至少一个路径参数" >&2; exit 2; }
      while [[ $# -gt 0 ]]; do
        next="$1"
        if [[ "$next" == "-" || "$next" != -* ]]; then
          if [[ "$next" == "-" ]]; then
            SRC_TYPES+=("F"); SRC_VALUES+=("${next}"); FILE_INPUTS+=("${next}")
          else
            if expand_arg_to_files "$next"; then
              for _m in "${EXP_FILES[@]}"; do SRC_TYPES+=("F"); SRC_VALUES+=("${_m}"); FILE_INPUTS+=("${_m}"); done
            else
              SRC_TYPES+=("F"); SRC_VALUES+=("${next}"); FILE_INPUTS+=("${next}")
            fi
          fi
          shift
        else
          break
        fi
      done ;;
    --docs-dir)
      [[ $# -ge 2 ]] || { echo "错误: --docs-dir 需要一个目录参数" >&2; exit 2; }
      DOCS_DIR_IN="$2"
      if [[ -d "$DOCS_DIR_IN" ]]; then
        mapfile -t _docs_dir_files < <(find "$DOCS_DIR_IN" -type f \( -name '*.md' -o -name '*.markdown' \) -print | sort)
        if (( ${#_docs_dir_files[@]} == 0 )); then
          echo "错误: 目录内未找到 Markdown 文件: $DOCS_DIR_IN" >&2; exit 2
        fi
        for _m in "${_docs_dir_files[@]}"; do SRC_TYPES+=("F"); SRC_VALUES+=("${_m}"); FILE_INPUTS+=("${_m}"); done
      else
        echo "错误: 目录不存在: $DOCS_DIR_IN" >&2; exit 2
      fi
      shift 2 ;;
    --instruction-override)
      echo "错误: --instruction-override 参数已移除。请使用 --task <text> 传递任务说明，并搭配 --tag <name> 区分日志" >&2
      exit 2 ;;
    --task)
      [[ $# -ge 2 ]] || { echo "错误: --task 需要文本参数" >&2; exit 2; }
      SRC_TYPES+=("C"); SRC_VALUES+=("${2}"); shift 2 ;;
    # 循环与上下文压缩相关
    --repeat-until)
      [[ $# -ge 2 ]] || { echo "错误: --repeat-until 需要一个正则参数" >&2; exit 2; }
      REPEAT_UNTIL="${2}"; shift 2 ;;
    --max-runs)
      [[ $# -ge 2 ]] || { echo "错误: --max-runs 需要一个数字参数" >&2; exit 2; }
      MAX_RUNS="${2}"; shift 2 ;;
    --sleep-seconds)
      [[ $# -ge 2 ]] || { echo "错误: --sleep-seconds 需要一个数字参数" >&2; exit 2; }
      SLEEP_SECONDS="${2}"; shift 2 ;;
    --no-carry-context)
      CARRY_CONTEXT=0; shift 1 ;;
    --no-compress-context)
      COMPRESS_CONTEXT=0; shift 1 ;;
    --context-head)
      [[ $# -ge 2 ]] || { echo "错误: --context-head 需要一个数字参数" >&2; exit 2; }
      CONTEXT_HEAD="${2}"; shift 2 ;;
    --context-grep)
      [[ $# -ge 2 ]] || { echo "错误: --context-grep 需要一个正则参数" >&2; exit 2; }
      CONTEXT_GREP+=("${2}"); shift 2 ;;
    # Codex CLI pass-through (safe subset)
    --sandbox)
      [[ $# -ge 2 ]] || { echo "错误: --sandbox 需要一个值 (read-only|workspace-write|danger-full-access)" >&2; exit 2; }
      CODEX_GLOBAL_ARGS+=("--sandbox" "${2}"); shift 2 ;;
    --ask-for-approval)
      [[ $# -ge 2 ]] || { echo "错误: --ask-for-approval 需要一个策略 (untrusted|on-failure|on-request|never)" >&2; exit 2; }
      CODEX_GLOBAL_ARGS+=("--ask-for-approval" "${2}"); shift 2 ;;
    --approval-mode)
      [[ $# -ge 2 ]] || { echo "错误: --approval-mode 需要一个策略 (untrusted|on-failure|on-request|never)" >&2; exit 2; }
      CODEX_GLOBAL_ARGS+=("--ask-for-approval" "${2}"); shift 2 ;;
    --approvals)
      [[ $# -ge 2 ]] || { echo "错误: --approvals 需要一个策略 (untrusted|on-failure|on-request|never)" >&2; exit 2; }
      echo "[warn] --approvals 为兼容别名，将映射为 --ask-for-approval ${2}" >&2
      CODEX_GLOBAL_ARGS+=("--ask-for-approval" "${2}"); shift 2 ;;
    --profile)
      [[ $# -ge 2 ]] || { echo "错误: --profile 需要一个配置名" >&2; exit 2; }
      CODEX_GLOBAL_ARGS+=("--profile" "${2}"); shift 2 ;;
    --full-auto)
      CODEX_GLOBAL_ARGS+=("--full-auto"); shift 1 ;;
    --dangerously-bypass-approvals-and-sandbox)
      CODEX_GLOBAL_ARGS+=("--dangerously-bypass-approvals-and-sandbox"); shift 1 ;;
    --model)
      [[ $# -ge 2 ]] || { echo "错误: --model 需要一个模型名称" >&2; exit 2; }
      # 支持两种形式：
      #  1) --model gpt-5-codex
      #  2) --model "gpt-5-codex high" 或 --model gpt-5-codex high （附带推理力度）
      __raw_model_val="${2}"
      __model_name="${__raw_model_val}"
      __effort=""
      # 情况 A：值本身包含空格（被调用方作为单个参数传入）
      if [[ "${__raw_model_val}" =~ ^([^[:space:]]+)[[:space:]]+(minimal|low|medium|high)$ ]]; then
        __model_name="${BASH_REMATCH[1]}"; __effort="${BASH_REMATCH[2]}"
        shift 2
      else
        # 情况 B：下一位置单独给出 effort
        if [[ $# -ge 3 ]]; then
          case "${3}" in
            minimal|low|medium|high)
              __effort="${3}"; shift 3 ;;
            *)
              shift 2 ;;
          esac
        else
          shift 2
        fi
      fi
      set_codex_config_kv "model" "${__model_name}"
      if [[ -n "${__effort}" ]]; then
        set_codex_config_kv "model_reasoning_effort" "${__effort}"
      fi
      # 预检提示：当 --model 值中包含空格但未识别为合法 effort，提醒用户检查写法
      if [[ "${__raw_model_val}" =~ [[:space:]]+ ]] && [[ ! "${__raw_model_val}" =~ ^([^[:space:]]+)[[:space:]]+(minimal|low|medium|high)$ ]]; then
        MODEL_NOTE="检测到 --model 包含空格但未识别推理力度；将整体视为模型名。若需设置推理力度，请使用 minimal|low|medium|high，例如 --model \"<model> high\"。"
      fi
      ;;
    --codex-config)
      [[ $# -ge 2 ]] || { echo "错误: --codex-config 需要一个 key=value" >&2; exit 2; }
      CODEX_GLOBAL_ARGS+=("--config" "${2}"); shift 2 ;;
    --codex-arg)
      [[ $# -ge 2 ]] || { echo "错误: --codex-arg 需要一个参数字符串" >&2; exit 2; }
      CODEX_GLOBAL_ARGS+=("${2}"); shift 2 ;;
    --no-aggregate)
      CODEX_LOG_AGGREGATE=0; shift 1 ;;
    --aggregate-file)
      [[ $# -ge 2 ]] || { echo "错误: --aggregate-file 需要一个路径参数" >&2; exit 2; }
      CODEX_LOG_AGGREGATE_FILE="${2}"; shift 2 ;;
    --aggregate-jsonl-file)
      [[ $# -ge 2 ]] || { echo "错误: --aggregate-jsonl-file 需要一个路径参数" >&2; exit 2; }
      CODEX_LOG_AGGREGATE_JSONL_FILE="${2}"; shift 2 ;;
    --redact)
      REDACT_ENABLE=1; shift 1 ;;
    --redact-pattern)
      [[ $# -ge 2 ]] || { echo "错误: --redact-pattern 需要一个正则参数" >&2; exit 2; }
      REDACT_PATTERNS+=("${2}"); shift 2 ;;
    --prepend)
      [[ $# -ge 2 ]] || { echo "错误: --prepend 需要文本参数" >&2; exit 2; }
      PREPEND_CONTENT="${2}"; shift 2 ;;
    --append)
      [[ $# -ge 2 ]] || { echo "错误: --append 需要文本参数" >&2; exit 2; }
      APPEND_CONTENT="${2}"; shift 2 ;;
    --prepend-file)
      [[ $# -ge 2 ]] || { echo "错误: --prepend-file 需要路径参数" >&2; exit 2; }
      PREPEND_FILE="${2}"; shift 2 ;;
    --append-file)
      [[ $# -ge 2 ]] || { echo "错误: --append-file 需要路径参数" >&2; exit 2; }
      APPEND_FILE="${2}"; shift 2 ;;
    --patch-mode)
      PATCH_MODE=1; shift 1 ;;
    --dry-run)
      DRY_RUN=1; shift 1 ;;
    --json)
      JSON_OUTPUT=1; shift 1 ;;
    -h|--help)
      usage; exit 0 ;;
    --)
      # 停止本脚本参数解析，余下参数作为透传参数追加给 codex
      shift
      if [[ $# -gt 0 ]]; then
        CODEX_GLOBAL_ARGS+=("$@")
      fi
      # 清空余下参数并跳出解析循环
      set --
      break ;;
    *)
      print_unknown_arg_help "${1}"
      exit 2 ;;
  esac
done

# 应用预设（如提供）
if [[ -n "${PRESET_NAME:-}" ]]; then
  if declare -F apply_preset >/dev/null 2>&1; then
    apply_preset "${PRESET_NAME}" || true
  else
    echo "[warn] 预设功能不可用：缺少 lib/presets.sh" >&2
  fi
fi

# ——— 日志路径提前初始化（确保任何早期错误都有日志） ———
mkdir -p "${CODEX_LOG_DIR}"
if [[ -n "${CODEX_LOG_TAG}" ]]; then
  SAFE_TAG="$(printf '%s' "${CODEX_LOG_TAG}" | tr -cs 'A-Za-z0-9_.-' '-' | sed 's/^-\+//; s/-\+$//')"
  TAG_SUFFIX="-${SAFE_TAG}"
else
  echo "[hint] 未指定 --tag，日志目录将使用默认标签 untagged；建议调用时通过 --tag <name> 区分任务" >&2
  TAG_SUFFIX=""
fi
TS="$(date +%Y%m%d_%H%M%S)"
TS_DISPLAY="$(date +%Y-%m-%dT%H:%M:%S%:z)"
if [[ -z "${CODEX_LOG_FILE}" ]]; then
  if [[ -n "${CODEX_SESSION_DIR:-}" ]]; then
    mkdir -p "${CODEX_SESSION_DIR}"
    CODEX_LOG_FILE="${CODEX_SESSION_DIR}/job.log"
  else
    SESSIONS_ROOT="${CODEX_SESSIONS_ROOT:-${CODEX_LOG_DIR}}"
    mkdir -p "${SESSIONS_ROOT}"
    if [[ "${CODEX_LOG_SUBDIRS}" == "1" ]]; then
      SESSION_ID="exec-${TS}${TAG_SUFFIX}"
      CODEX_SESSION_DIR="${SESSIONS_ROOT}/${SESSION_ID}"
      mkdir -p "${CODEX_SESSION_DIR}"
      CODEX_LOG_FILE="${CODEX_SESSION_DIR}/job.log"
    else
      CODEX_SESSION_DIR="${SESSIONS_ROOT}"
      CODEX_LOG_FILE="${SESSIONS_ROOT}/codex-${TS}${TAG_SUFFIX}.log"
    fi
  fi
fi
mkdir -p "$(dirname "${CODEX_LOG_FILE}")"
INSTR_FILE="${CODEX_LOG_FILE%.log}.instructions.md"
META_FILE="${CODEX_LOG_FILE%.log}.meta.json"
if [[ -z "${CODEX_LOG_AGGREGATE_FILE}" ]]; then
  CODEX_LOG_AGGREGATE_FILE="$(dirname "${CODEX_LOG_FILE}")/aggregate.txt"
fi
if [[ -z "${CODEX_LOG_AGGREGATE_JSONL_FILE}" ]]; then
  CODEX_LOG_AGGREGATE_JSONL_FILE="$(dirname "${CODEX_LOG_FILE}")/aggregate.jsonl"
fi

# 校验 Codex 旗标冲突（预设可能注入 --full-auto）。如有问题，写入日志并退出。
validate_conflicting_codex_args
if [[ -n "${VALIDATION_ERROR}" ]]; then
  {
    echo "===== Codex Run Start: ${TS}${TAG_SUFFIX} (${TS_DISPLAY:-${TS}}) ====="
    echo "Script: $(basename "$0")  PWD: $(pwd)"
    echo "Log: ${CODEX_LOG_FILE}"
    echo "Meta: ${META_FILE}"
    echo "[arg-check] ${VALIDATION_ERROR}"
  } >> "${CODEX_LOG_FILE}"
  RUN_LOGGED=1
  printf '%s\n' "${VALIDATION_ERROR}" >&2
  exit 2
  exit 2
  exit 2
fi

# 规范化 sandbox 与审批策略的组合（可能会自动补充 on-request）
normalize_sandbox_and_approvals
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
