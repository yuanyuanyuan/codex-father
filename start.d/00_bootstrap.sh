# 运行环境与默认值
DEFAULT_INSTRUCTIONS="你好，请解释当前脚本的能力和使用示例。"
DEFAULT_INSTRUCTIONS_FILE="$HOME/.codex/instructions.md"

# 运行期有效配置（在 normalize_sandbox_and_approvals 后填充）
EFFECTIVE_SANDBOX=""
EFFECTIVE_APPROVAL_POLICY=""
EFFECTIVE_NETWORK_ACCESS=""
EFFECTIVE_BYPASS=0

# 加载模块化库（如果存在）
if [[ -f "${SCRIPT_DIR}/lib/common.sh" ]]; then
  # shellcheck disable=SC1091
  . "${SCRIPT_DIR}/lib/common.sh"
fi
if [[ -f "${SCRIPT_DIR}/lib/presets.sh" ]]; then
  # shellcheck disable=SC1091
  . "${SCRIPT_DIR}/lib/presets.sh"
fi

# 日志相关默认
# 默认将日志写入脚本所在目录的托管 sessions 路径，避免受调用时 PWD 影响
if [[ "$(basename "${SCRIPT_DIR}")" == ".codex-father" ]]; then
  # 当脚本已位于托管目录时，直接复用该目录下的 sessions，避免重复拼接
  CODEX_LOG_DIR_DEFAULT="${SCRIPT_DIR}/sessions"
else
  CODEX_LOG_DIR_DEFAULT="${SCRIPT_DIR}/.codex-father/sessions"
fi
CODEX_LOG_DIR="${CODEX_LOG_DIR:-$CODEX_LOG_DIR_DEFAULT}"
CODEX_LOG_FILE="${CODEX_LOG_FILE:-}"
CODEX_LOG_TAG="${CODEX_LOG_TAG:-}"
CODEX_LOG_SUBDIRS="${CODEX_LOG_SUBDIRS:-1}"
CODEX_LOG_AGGREGATE="${CODEX_LOG_AGGREGATE:-1}"
# 是否在日志中回显最终合成的指令与来源（默认开启）
CODEX_ECHO_INSTRUCTIONS="${CODEX_ECHO_INSTRUCTIONS:-1}"
# 回显的行数上限（0 表示不限制，全部输出）
CODEX_ECHO_INSTRUCTIONS_LIMIT="${CODEX_ECHO_INSTRUCTIONS_LIMIT:-0}"
# 聚合默认在会话目录内（若未显式覆盖）
CODEX_LOG_AGGREGATE_FILE="${CODEX_LOG_AGGREGATE_FILE:-}"
CODEX_LOG_AGGREGATE_JSONL_FILE="${CODEX_LOG_AGGREGATE_JSONL_FILE:-}"

# 脱敏相关默认
REDACT_ENABLE="${REDACT_ENABLE:-0}"
REDACT_PATTERNS_DEFAULT=(
  'sk-[A-Za-z0-9]{10,}'                    # OpenAI-like API key
  'gh[pouas]_[A-Za-z0-9]{20,}'             # GitHub tokens (ghp_, gho_, ghu_, gha_, ghs_)
  'xox[aboprst]-[A-Za-z0-9-]{10,}'         # Slack tokens
  'AIza[0-9A-Za-z_-]{10,}'                 # Google API key
  'AKIA[0-9A-Z]{16}'                       # AWS Access Key ID
  'ASIA[0-9A-Z]{16}'                       # AWS STS Key ID
  'secret[_-]?access[_-]?key[[:space:]]*[:=][[:space:]]*[A-Za-z0-9/+]{20,}'
  'SECRET[_-]?ACCESS[_-]?KEY[[:space:]]*[:=][[:space:]]*[A-Za-z0-9/+]{20,}'
  'password[[:space:]]*[:=][[:space:]]*[^[:space:]]+'
  'PASSWORD[[:space:]]*[:=][[:space:]]*[^[:space:]]+'
)
REDACT_REPLACEMENT="${REDACT_REPLACEMENT:-***REDACTED***}"

# 运行期状态：是否已写入标准日志头（用于确保任意异常退出也能落日志）
RUN_LOGGED=0

# 兜底：任何非零退出都至少写一条错误日志
trap 'code=$?; if [[ $code -ne 0 ]]; then \
  ts=$(date +%Y%m%d_%H%M%S); \
  ts_display=$(date +%Y-%m-%dT%H:%M:%S%:z); \
  # 若尚未确定日志文件，尽力用默认规则生成一个
  if [[ -z "${CODEX_LOG_FILE:-}" ]]; then \
    CODEX_LOG_DIR="${CODEX_LOG_DIR:-${SCRIPT_DIR}/.codex-father/sessions}"; \
    mkdir -p "$CODEX_LOG_DIR"; \
    CODEX_LOG_FILE="${CODEX_LOG_DIR}/codex-${ts}.log"; \
  fi; \
  mkdir -p "$(dirname "${CODEX_LOG_FILE}")"; \
  if [[ "${RUN_LOGGED:-0}" -eq 0 ]]; then \
    { \
      echo "===== Codex Run Start: ${ts} (${ts_display}) ====="; \
      echo "Script: $(basename "$0")  PWD: $(pwd)"; \
      echo "Log: ${CODEX_LOG_FILE}"; \
      echo "[trap] 非零退出（可能为早期错误或参数问题）。Exit Code: ${code}"; \
    } >> "${CODEX_LOG_FILE}"; \
  fi; \
fi' EXIT

KNOWN_FLAGS=(
  "-f" "--file" "-F" "--file-override" "-c" "--content" "-l" "--log-file"
  "--log-dir" "--tag" "--log-subdirs" "--flat-logs" "--echo-instructions"
  "--no-echo-instructions" "--echo-limit" "--preset" "--docs" "--docs-dir"
  "--task" "--require-change-in" "--require-git-commit" "--auto-commit-on-done"
  "--auto-commit-message" "--no-overflow-retry" "--overflow-retries" "--repeat-until"
  "--max-runs" "--sleep-seconds" "--no-carry-context" "--no-compress-context"
  "--context-head" "--context-grep" "--sandbox" "--ask-for-approval" "--approval-mode" "--approvals" "--profile" "--model"
  "--full-auto" "--dangerously-bypass-approvals-and-sandbox" "--codex-config"
  "--codex-arg" "--no-aggregate" "--aggregate-file" "--aggregate-jsonl-file"
  "--redact" "--redact-pattern" "--prepend" "--append" "--prepend-file"
  "--append-file" "--patch-mode" "--dry-run" "--json" "-h" "--help"
  "--patch-output" "--patch-preview-lines" "--no-patch-preview" "--no-patch-artifact"
)

# --- Codex 版本检测与参数兼容性校验（严格模式） ---
# 若在旧版本 Codex 环境（<0.44）传入 0.44-only 参数，直接拒绝执行，提示调用方修正

normalize_semver() {
  local v="$1"
  # Bash ERE 不支持 (?:...) 非捕获组，改用标准捕获组
  if [[ "$v" =~ ^([0-9]+)\.([0-9]+)(\.([0-9]+))?$ ]]; then
    local maj=${BASH_REMATCH[1]}
    local min=${BASH_REMATCH[2]}
    local pat=${BASH_REMATCH[4]:-0}  # 第4个捕获组才是patch版本号
    printf '%s.%s.%s' "$maj" "$min" "$pat"
    return 0
  fi
  return 1
}

cmp_semver() {
  # echo negative if $1 < $2, zero if equal, positive if $1 > $2
  local a b
  a=$(normalize_semver "$1") || { echo 0; return; }
  b=$(normalize_semver "$2") || { echo 0; return; }
  local A IFS=.
  read -r -a A <<<"$a"
  local B
  read -r -a B <<<"$b"
  for i in 0 1 2; do
    local da=${A[$i]:-0}
    local db=${B[$i]:-0}
    if (( da < db )); then echo -1; return; fi
    if (( da > db )); then echo 1; return; fi
  done
  echo 0
}

DETECTED_CODEX_VERSION=""
detect_codex_version() {
  if [[ -n "${DETECTED_CODEX_VERSION}" ]]; then
    return 0
  fi
  if [[ -n "${CODEX_VERSION_OVERRIDE:-}" ]]; then
    if v=$(normalize_semver "${CODEX_VERSION_OVERRIDE}"); then
      DETECTED_CODEX_VERSION="$v"; return 0
    else
      VALIDATION_ERROR="错误: 无效的环境变量 CODEX_VERSION_OVERRIDE='${CODEX_VERSION_OVERRIDE}'"; return 1
    fi
  fi
  if ! command -v codex >/dev/null 2>&1; then
    VALIDATION_ERROR=$'错误: 无法检测 Codex 版本 (codex 未安装或不在 PATH)。\n- 请安装/配置 codex CLI，或设置 CODEX_VERSION_OVERRIDE=0.44.0 临时覆盖'
    return 1
  fi
  local out
  if ! out=$(codex --version 2>&1); then
    VALIDATION_ERROR="错误: 无法检测 Codex 版本: ${out}"
    return 1
  fi
  if [[ "$out" =~ ([0-9]+\.[0-9]+(\.[0-9]+)?) ]]; then
    local v="${BASH_REMATCH[1]}"
    if v=$(normalize_semver "$v"); then
      DETECTED_CODEX_VERSION="$v"; return 0
    fi
  fi
  VALIDATION_ERROR="错误: 解析 Codex 版本失败: ${out}"
  return 1
}

check_version_param_compatibility() {
  # 仅当存在潜在 0.44-only 参数时才需要判定
  detect_codex_version || return 0 # VALIDATION_ERROR 已设置
  local v="${DETECTED_CODEX_VERSION}"
  # v < 0.44.0 视为不兼容 0.44-only
  # 标记是否可安全使用 --output-last-message（Codex 0.44+）
  ALLOW_OUTPUT_LAST_MESSAGE=1
  if (( $(cmp_semver "$v" "0.44.0") < 0 )); then
    ALLOW_OUTPUT_LAST_MESSAGE=0
    local violations=()
    # CLI 旗标（0.44 专属）
    local i=0
    while (( i < ${#CODEX_GLOBAL_ARGS[@]} )); do
      local a="${CODEX_GLOBAL_ARGS[$i]}"
      case "$a" in
        --profile) violations+=("--profile"); i=$((i+2)); continue ;;
        --full-auto) violations+=("--full-auto"); i=$((i+1)); continue ;;
        --dangerously-bypass-approvals-and-sandbox)
          violations+=("--dangerously-bypass-approvals-and-sandbox"); i=$((i+1)); continue ;;
        --config)
          if (( i+1 < ${#CODEX_GLOBAL_ARGS[@]} )); then
            local kv="${CODEX_GLOBAL_ARGS[$((i+1))]}"
            local k="${kv%%=*}"
            case "$k" in
              model_reasoning_effort|model_reasoning_summary|model_supports_reasoning_summaries|model_verbosity|profile)
                violations+=("config:${k}") ;;
            esac
          fi
          i=$((i+2)); continue ;;
      esac
      i=$((i+1))
    done
    if (( ${#violations[@]} > 0 )); then
      VALIDATION_ERROR=$'错误: 参数与 Codex 版本不兼容\n'
      VALIDATION_ERROR+="- 当前 Codex 版本: ${v}\n"
      VALIDATION_ERROR+="- 需要 Codex >= 0.44 才能使用以下选项： ${violations[*]}\n"
      VALIDATION_ERROR+=$'- 修复建议：移除这些参数或升级 Codex 到 >= 0.44\n'
      return 1
    fi
  fi
  return 0
}

flag_help_line() {
  case "$1" in
    --task) echo "--task <text>         设置任务描述" ;;
    --preset) echo "--preset <name>       使用预设(sprint|analysis|secure|fast)" ;;
    --docs) echo "--docs <files...>     指定参考文档（支持通配符与多值/@列表/目录）" ;;
    --docs-dir) echo "--docs-dir <dir>     指定目录内的文档（递归 *.md）" ;;
    -f|--file) echo "-f, --file <path>    叠加文件（支持通配符/多值/@列表/目录）" ;;
    -F|--file-override) echo "-F, --file-override <path> 覆盖基底为指定文件" ;;
    --model) echo "--model <name>       指定 Codex 模型（转为 config model=<name>）" ;;
    -h|--help) echo "-h, --help           查看完整帮助" ;;
    *) echo "$1" ;;
  esac
}

print_unknown_arg_help() {
  local unknown="$1"
  local u=${unknown#--}; u=${u#-}
  local u_tokens; IFS='-' read -r -a u_tokens <<< "$u"
  local scored=()
  local f
  for f in "${KNOWN_FLAGS[@]}"; do
    local clean=${f#--}; clean=${clean#-}
    local score=0
    # 前缀/包含加权
    if [[ "$clean" == "$u" ]]; then score=200; fi
    if [[ "$clean" == "$u"* ]] || [[ "$u" == "$clean"* ]]; then score=$((score+120)); fi
    if [[ "$clean" == *"$u"* ]] || [[ "$u" == *"$clean"* ]]; then score=$((score+40)); fi
    # token 重合
    local t; for t in "${u_tokens[@]}"; do
      [[ -z "$t" ]] && continue
      if [[ "$clean" == *"$t"* ]]; then score=$((score+10)); fi
    done
    scored+=("$score $f")
  done
  # 取前 5 个候选
  mapfile -t suggestions < <(printf '%s\n' "${scored[@]}" | sort -nr | awk 'NR<=5{print $2}')
  {
    echo "❌ 未知参数: ${unknown}"
    echo "💡 是否想使用以下参数？"
    local s; for s in "${suggestions[@]}"; do flag_help_line "$s"; done | sed 's/^/   /'
    echo "🔎 如果你是直接把一句话当作参数传入，CLI 会自动将其视为 --task 的内容；建议改为显式写法：--task \"<文本>\"。"
    echo "📖 运行 --help 查看完整参数列表"
  } >&2
}

expand_arg_to_files() {
  # $1: input token; returns via global arrays: EXP_FILES, EXP_ERRORS(optional text)
  EXP_FILES=()
  EXP_ERRORS=""
  local token="$1"
  # @list 文件
  if [[ "$token" == @* ]]; then
    local list_file=${token#@}
    if [[ ! -f "$list_file" ]]; then
      EXP_ERRORS="列表文件不存在: $list_file"; return 1
    fi
    local had_any=0
    while IFS= read -r line || [[ -n "$line" ]]; do
      line="${line%%$'\r'}" # trim CR
      [[ -z "$line" || "$line" == \#* ]] && continue
      if [[ -d "$line" ]]; then
        while IFS= read -r f; do EXP_FILES+=("$f"); had_any=1; done < <(find "$line" -type f \( -name '*.md' -o -name '*.markdown' \) -print | sort)
        continue
      fi
      if [[ "$line" == *'*'* || "$line" == *'?'* || "$line" == *'['* ]]; then
        local old_nullglob; old_nullglob=$(shopt -p nullglob || true)
        shopt -s nullglob
        local expanded_line=( $line )
        eval "$old_nullglob" || true
        if (( ${#expanded_line[@]} > 0 )); then
          local m; for m in "${expanded_line[@]}"; do EXP_FILES+=("$m"); done
          had_any=1
        fi
        continue
      fi
      if [[ -f "$line" ]]; then EXP_FILES+=("$line"); had_any=1; continue; fi
      # otherwise ignore silently; caller会在最终读取阶段提示缺失项
    done < "$list_file"
    if (( had_any == 0 )); then EXP_ERRORS="列表中未解析到任何文件: $list_file"; return 1; fi
    return 0
  fi
  # 目录：递归匹配 *.md
  if [[ -d "$token" ]]; then
    while IFS= read -r f; do EXP_FILES+=("$f"); done < <(find "$token" -type f \( -name '*.md' -o -name '*.markdown' \) -print | sort)
    if (( ${#EXP_FILES[@]} == 0 )); then
      EXP_ERRORS="目录内未找到 Markdown 文件: $token"; return 1
    fi
    return 0
  fi
  # 通配符
  if [[ "$token" == *'*'* || "$token" == *'?'* || "$token" == *'['* ]]; then
    local old_nullglob
    old_nullglob=$(shopt -p nullglob || true)
    shopt -s nullglob
    local expanded=( $token )
    # 恢复 nullglob 之前的设置
    eval "$old_nullglob" || true
    if (( ${#expanded[@]} > 0 )); then
      local m; for m in "${expanded[@]}"; do EXP_FILES+=("$m"); done
      return 0
    else
      EXP_ERRORS="未匹配到任何文件: $token"; return 1
    fi
  fi
  # 常规文件
  if [[ -f "$token" ]]; then EXP_FILES+=("$token"); return 0; fi
  EXP_ERRORS="文件不存在: $token"; return 1
}

usage() {
  cat <<'EOF'
用法: start.sh [选项]

选项:
  -f, --file <path>   叠加读取文件内容；可多次，也可一次跟多个值直至遇到下一个选项；支持通配符（*.md）；支持 '-' 从 STDIN 读取一次；支持目录/文件列表(@list.txt)
  -F, --file-override <path>
                      覆盖基底为指定文件（支持 '-' 表示从 STDIN 读取一次；与 -f 可同时使用，-f 将继续在其后叠加）
  -c, --content <txt> 叠加一段文本内容（可多次，保持顺序）
  -l, --log-file <p>  将运行日志写入到指定文件路径
      --log-dir <dir> 将运行日志写入到指定目录（自动生成文件名）
      --tag <name>    日志文件名附加标签（便于检索）
      --log-subdirs   启用按日期/标签分层目录（默认启用）
      --flat-logs     禁用分层目录（将日志直接写入 --log-dir）
      --echo-instructions   在日志中回显最终合成的指令与来源（默认启用）
      --no-echo-instructions 不在日志中回显最终合成的指令与来源
      --echo-limit <n>      限制在日志中回显的指令最大行数（0 表示不限制）
      --preset <name>       使用预设参数集（sprint|analysis|secure|fast）
      --docs <glob...>      简化形式，等价于一组 -f（支持通配符、多值、目录、@列表文件）
      --docs-dir <dir>      递归添加目录下的 Markdown 文档（*.md|*.markdown）
      --task <text>         简化形式，等价于一次 -c 文本
      --require-change-in <glob>  要求最后完成前这些文件（通配符）必须有变更（可多次）
      --require-git-commit       要求最后完成前 HEAD 必须前进（至少一次提交）
      --auto-commit-on-done      如检测到未提交且存在匹配变更，自动 git add/commit 后再判定完成
      --auto-commit-message <s>  自动提交时使用的提交信息（默认：docs(progress): auto update）
      --no-aggregate  不写入根部汇总文件（默认写入）
      --aggregate-file <p> 自定义根部汇总文件路径
      --aggregate-jsonl-file <p> 自定义 JSONL 汇总文件路径
      --redact         启用输出与指令的敏感信息脱敏
      --redact-pattern <re> 追加自定义脱敏正则（可多次）
      --prepend <txt>  在指令前追加文本
      --append <txt>   在指令后追加文本
      --prepend-file <p> 从文件读入前置文本
      --append-file <p>  从文件读入后置文本
      --model <name>     指定 Codex 模型（内部转为 --config model=<name>，兼容 0.42/0.44）
      --codex-config <kv> 追加 Codex 配置项（等价于 --config key=value，可多次）
      --patch-mode      启用“补丁模式”：自动追加 policy-note，要求模型仅输出补丁（patch/diff）而不直接写仓库
      --dry-run        仅生成文件与日志头，不实际执行 codex
      --json           以 JSON 输出（打印最终 meta.json 内容到 STDOUT，并尽量减少人类可读回显）
  -h, --help          显示帮助并退出

其他:
  - 默认基底：若存在 ~/.codex/instructions.md 则使用其内容，否则使用脚本内置默认文本；
    可通过 -F/--file-override 显式覆盖基底。
  - -f/--file 与 -c/--content 为“叠加”语义，可多次出现并保持命令行顺序；-f 支持一次接收多个值与通配符。
  - 使用 '-' 作为 -f 或 -F 的参数时，从 STDIN 读取一次；若多处请求 STDIN 将报错。
  - 如果未提供 -f/-F/-c/--prepend/--append 等输入且存在环境变量 INSTRUCTIONS，则使用该变量作为基底。
  - 如果仍无输入且通过管道/重定向提供了 STDIN，则使用 STDIN 作为基底。
  - 以上均不满足时，使用脚本内置默认内容。
  - 容错：若传入了非选项的“位置参数”，将自动视为 --task 的文本内容；为避免歧义，推荐显式书写：--task "<文本>"。
  - 默认将日志保存在 ${CODEX_LOG_DIR_DEFAULT}，并按“日期/标签”分层：logs/YYYYMMDD/<tag|untagged>/codex-YYYYMMDD_HHMMSS-<tag>.log；
    可通过 --flat-logs 改为平铺至 --log-dir。摘要附加到 ${REPO_ROOT}/codex_run_recording.txt。
  - 日志默认回显“最终合成的指令”与“各来源列表”，可用 --no-echo-instructions 关闭；或用 --echo-limit 控制回显的行数。
  - 审批策略：通过 `--approval-mode <策略>`（untrusted|on-failure|on-request|never）或 `-c approval_policy=<策略>` 配置；兼容别名 `--approvals` 将自动映射为 `-c approval_policy=<策略>`。
  - 透传参数：在选项后使用 `--`，其后的所有参数将原样传递给 codex（例如：`-- --sandbox danger-full-access`).
  - 为简化常用场景，可使用 --preset：
    - sprint：单轮低摩擦推进（自动连续执行、合理时限与步数上限）。
    - analysis：单轮快速分析，回显行数默认限制为 200。
    - secure：启用输出脱敏。
    - fast：缩短时间盒与步数限制，快速试探。
  - 上下文溢出自动重试（默认开启）：如检测到 context/token 限制导致退出，将自动读取最新指令并重试；可用 --no-overflow-retry 关闭，或用 --overflow-retries N 调整重试次数（默认2）。
  - 完成前置校验（可选）：
    - 使用 --require-change-in 与 --require-git-commit 可以在结束前强制验证“进度已写回且已提交”。
    - 如设置 --auto-commit-on-done，脚本会在检测到匹配变更未提交时自动提交后再允许结束。
EOF
}

## 校验 Codex 透传参数的冲突组合（参照官方 CLI 规则）
validate_conflicting_codex_args() {
  local has_bypass=0
  local has_full_auto=0
  local has_ask=0
  local i=0
  while (( i < ${#CODEX_GLOBAL_ARGS[@]} )); do
    local a="${CODEX_GLOBAL_ARGS[$i]}"
    case "$a" in
      --dangerously-bypass-approvals-and-sandbox)
        has_bypass=1 ;;
      --full-auto)
        has_full_auto=1 ;;
      --ask-for-approval)
        has_ask=1; i=$((i+1)) ;; # 跳过其值
      # 跳过带值选项的值，避免被当作独立标记参与判断
      --sandbox|--profile|--config)
        i=$((i+1)) ;;
    esac
    i=$((i+1))
  done

  if (( has_bypass == 1 )) && { (( has_full_auto == 1 )) || (( has_ask == 1 )); }; then
    VALIDATION_ERROR=$'错误: 参数冲突\n- --dangerously-bypass-approvals-and-sandbox 不可与 --ask-for-approval 或 --full-auto 同时使用\n  请参考 refer-research/openai-codex/docs/sandbox.md 的组合规范'
    return 0
  fi
  # 始终返回 0，避免在 set -e 下因条件为假导致脚本提前退出
  return 0
}

# 当用户请求 --sandbox danger-full-access 时，确保审批策略可用
# - 若未显式设置 --ask-for-approval，默认补上 on-request（可通过环境 DEFAULT_APPROVAL_FOR_DFA 覆盖）
# - 若显式设置为 never，则提示错误，因为 never 禁止升级权限，无法进入 full-access
set_codex_flag_value() {
  local flag="$1" value="$2"
  local -a new_args=()
  local i=0
  local total=${#CODEX_GLOBAL_ARGS[@]}
  while (( i < total )); do
    local current="${CODEX_GLOBAL_ARGS[$i]}"
    if [[ "$current" == "$flag" ]]; then
      # 跳过 flag 以及紧随其后的值，避免重复追加
      ((i+=1))
      if (( i < total )); then
        ((i+=1))
      fi
      continue
    fi
    new_args+=("$current")
    ((i+=1))
  done
  CODEX_GLOBAL_ARGS=("${new_args[@]}" "$flag" "$value")
}
