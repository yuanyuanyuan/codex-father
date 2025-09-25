#!/usr/bin/env bash

set -euo pipefail

# 运行环境与默认值
DEFAULT_INSTRUCTIONS="你好，请解释当前脚本的能力和使用示例。"
DEFAULT_INSTRUCTIONS_FILE="$HOME/.codex/instructions.md"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

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
CODEX_LOG_DIR_DEFAULT="${PWD}/.codex-father/sessions"
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

usage() {
  cat <<'EOF'
用法: start.sh [选项]

选项:
  -f, --file <path>   叠加读取文件内容；可多次，也可一次跟多个值直至遇到下一个选项；支持通配符（*.md）；支持 '-' 从 STDIN 读取一次
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
      --docs <glob...>      简化形式，等价于一组 -f（支持通配符与多值）
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
  - 默认将日志保存在 ${CODEX_LOG_DIR_DEFAULT}，并按“日期/标签”分层：logs/YYYYMMDD/<tag|untagged>/codex-YYYYMMDD_HHMMSS-<tag>.log；
    可通过 --flat-logs 改为平铺至 --log-dir。摘要附加到 ${REPO_ROOT}/codex_run_recording.txt。
  - 日志默认回显“最终合成的指令”与“各来源列表”，可用 --no-echo-instructions 关闭；或用 --echo-limit 控制回显的行数。
  - 为简化常用场景，可使用 --preset：
    - sprint：多轮推进，直到输出 CONTROL: DONE；配合自动连续执行与宽松时限。
    - analysis：单轮快速分析，回显行数默认限制为 200。
    - secure：启用输出脱敏。
    - fast：缩短时间盒与步数限制，快速试探。
  - 上下文溢出自动重试（默认开启）：如检测到 context/token 限制导致退出，将自动读取最新指令并重试；可用 --no-overflow-retry 关闭，或用 --overflow-retries N 调整重试次数（默认2）。
  - 完成前置校验（可选）：
    - 使用 --require-change-in 与 --require-git-commit 可以在满足 repeat-until 之前强制验证“进度已写回且已提交”。
    - 如设置 --auto-commit-on-done，脚本会在检测到匹配变更未提交时自动提交后再允许结束。
EOF
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
          # Expand globs if present; fall back to literal if no match
          if [[ "$next" != "-" && ( "$next" == *'*'* || "$next" == *'?'* || "$next" == *'['* ) ]]; then
            # 使用 compgen -G 做通配符展开；无匹配则保持字面量
            mapfile -t _matches < <(compgen -G -- "$next" || true)
            if (( ${#_matches[@]} > 0 )); then
              for _m in "${_matches[@]}"; do
                SRC_TYPES+=("F"); SRC_VALUES+=("${_m}"); FILE_INPUTS+=("${_m}")
              done
            else
              SRC_TYPES+=("F"); SRC_VALUES+=("${next}"); FILE_INPUTS+=("${next}")
            fi
          else
            SRC_TYPES+=("F"); SRC_VALUES+=("${next}"); FILE_INPUTS+=("${next}")
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
    --preset)
      [[ $# -ge 2 ]] || { echo "错误: --preset 需要一个名称 (sprint|analysis|secure|fast)" >&2; exit 2; }
      PRESET_NAME="${2}"; shift 2 ;;
    --docs)
      shift
      [[ $# -ge 1 ]] || { echo "错误: --docs 需要至少一个路径参数" >&2; exit 2; }
      while [[ $# -gt 0 ]]; do
        next="$1"
        if [[ "$next" == "-" || "$next" != -* ]]; then
          if [[ "$next" != "-" && ( "$next" == *'*'* || "$next" == *'?'* || "$next" == *'['* ) ]]; then
            mapfile -t _matches < <(compgen -G -- "$next" || true)
            if (( ${#_matches[@]} > 0 )); then
              for _m in "${_matches[@]}"; do SRC_TYPES+=("F"); SRC_VALUES+=("${_m}"); FILE_INPUTS+=("${_m}"); done
            else
              SRC_TYPES+=("F"); SRC_VALUES+=("${next}"); FILE_INPUTS+=("${next}")
            fi
          else
            SRC_TYPES+=("F"); SRC_VALUES+=("${next}"); FILE_INPUTS+=("${next}")
          fi
          shift
        else
          break
        fi
      done ;;
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
    --approvals)
      [[ $# -ge 2 ]] || { echo "错误: --approvals 需要一个策略 (untrusted|on-failure|on-request|never)" >&2; exit 2; }
      CODEX_GLOBAL_ARGS+=("--approvals" "${2}"); shift 2 ;;
    --profile)
      [[ $# -ge 2 ]] || { echo "错误: --profile 需要一个配置名" >&2; exit 2; }
      CODEX_GLOBAL_ARGS+=("--profile" "${2}"); shift 2 ;;
    --full-auto)
      CODEX_GLOBAL_ARGS+=("--full-auto"); shift 1 ;;
    --dangerously-bypass-approvals-and-sandbox)
      CODEX_GLOBAL_ARGS+=("--dangerously-bypass-approvals-and-sandbox"); shift 1 ;;
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
      shift; break ;;
    *)
      echo "未知参数: ${1}" >&2
      usage
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
        [[ -f "$v" ]] || { echo "错误: 文件不存在: $v" >&2; exit 2; }
        INSTRUCTIONS="${INSTRUCTIONS}"$'\n\n'"$(cat "$v")"
        SOURCE_LINES+=("Add file: $v")
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

# 日志目录与文件准备（基础目录）
mkdir -p "${CODEX_LOG_DIR}"

# 规范化 tag
if [[ -n "${CODEX_LOG_TAG}" ]]; then
  SAFE_TAG="$(printf '%s' "${CODEX_LOG_TAG}" | tr -cs 'A-Za-z0-9_.-' '-' | sed 's/^-\+//; s/-\+$//')"
  TAG_SUFFIX="-${SAFE_TAG}"
else
  TAG_SUFFIX=""
fi

TS="$(date +%Y%m%d_%H%M%S)"

# 会话目录优先：若提供 CODEX_SESSION_DIR 则使用其中的 job.* 文件
if [[ -z "${CODEX_LOG_FILE}" ]]; then
  if [[ -n "${CODEX_SESSION_DIR:-}" ]]; then
    mkdir -p "${CODEX_SESSION_DIR}"
    CODEX_LOG_FILE="${CODEX_SESSION_DIR}/job.log"
  else
    # 构造默认的会话目录：.codex-father/sessions/exec-<ts>-<tag>
    SESSIONS_ROOT="${CODEX_SESSIONS_ROOT:-${PWD}/.codex-father/sessions}"
    mkdir -p "${SESSIONS_ROOT}"
    SESSION_ID="exec-${TS}${TAG_SUFFIX}"
    CODEX_SESSION_DIR="${SESSIONS_ROOT}/${SESSION_ID}"
    mkdir -p "${CODEX_SESSION_DIR}"
    CODEX_LOG_FILE="${CODEX_SESSION_DIR}/job.log"
  fi
fi

# 规范化相关文件路径
mkdir -p "$(dirname "${CODEX_LOG_FILE}")"
INSTR_FILE="${CODEX_LOG_FILE%.log}.instructions.md"
META_FILE="${CODEX_LOG_FILE%.log}.meta.json"

# 若未显式设置聚合路径，则使用会话目录内的聚合文件
if [[ -z "${CODEX_LOG_AGGREGATE_FILE}" ]]; then
  CODEX_LOG_AGGREGATE_FILE="$(dirname "${CODEX_LOG_FILE}")/aggregate.txt"
fi
if [[ -z "${CODEX_LOG_AGGREGATE_JSONL_FILE}" ]]; then
  CODEX_LOG_AGGREGATE_JSONL_FILE="$(dirname "${CODEX_LOG_FILE}")/aggregate.jsonl"
fi

# 构建脱敏 sed 参数
build_redact_sed_args() {
  local -n _arr=$1
  shift || true
  local patterns=("$@")
  _arr=()
  for re in "${patterns[@]}"; do
    _arr+=("-e" "s/${re}/${REDACT_REPLACEMENT}/g")
  done
}

# 上下文压缩函数：提取首部与关键行
compress_context_file() {
  local in_file=$1
  local out_file=$2
  local head_n=${3:-$CONTEXT_HEAD}
  shift || true
  shift || true
  shift || true
  local patterns=("$@")
  {
    if [[ ! -s "$in_file" ]]; then
      echo "[no previous context]"
    else
      echo "=== Head (first ${head_n} lines) ==="
      head -n "$head_n" "$in_file" || true
      if (( ${#patterns[@]} > 0 )); then
        local joined
        joined=$(printf '%s|' "${patterns[@]}")
        joined=${joined%|}
        echo
        echo "=== Key Lines (pattern match) ==="
        grep -E "$joined" -n "$in_file" 2>/dev/null | cut -d: -f2- | awk 'BEGIN{c=0} {if(seen[$0]++) next; print; c++; if(c>200) exit}' || true
      fi
    fi
  } > "$out_file"
}

# 重新组合指令（每轮可调用），为所有来源加标准边界标签
compose_instructions() {
  local ts_iso
  ts_iso=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  SOURCE_LINES=()
  local sections=""

  # 构造前置模板（如果有）
  if [[ -n "${PREPEND_FILE}" ]]; then
    if [[ -f "${PREPEND_FILE}" ]]; then
      sections+=$'\n'"<instructions-section type=\"prepend-file\" path=\"${PREPEND_FILE}\">"$'\n'
      sections+="$(cat "${PREPEND_FILE}")"$'\n''</instructions-section>'$'\n'
      SOURCE_LINES+=("Prepend file: ${PREPEND_FILE}")
    fi
  fi
  if [[ -n "${PREPEND_CONTENT}" ]]; then
    sections+=$'\n'"<instructions-section type=\"prepend-text\">"$'\n'
    sections+="${PREPEND_CONTENT}"$'\n''</instructions-section>'$'\n'
    local _pv
    _pv=$(printf '%s' "${PREPEND_CONTENT}" | tr '\n' ' ' | cut -c1-80)
    SOURCE_LINES+=("Prepend text: ${_pv}...")
  fi

  # 基底来源内容
  local base_content=""
  local base_desc="${BASE_SOURCE_DESC}"
  case "${BASE_SOURCE_KIND}" in
    override-file)
      base_content="$(cat "${OVERRIDE_FILE}")" ;;
    override-stdin)
      base_content="${STDIN_CONTENT}" ;;
    default-file)
      if [[ -f "${DEFAULT_INSTRUCTIONS_FILE}" ]]; then
        base_content="$(cat "${DEFAULT_INSTRUCTIONS_FILE}")"
      else
        base_content="${DEFAULT_INSTRUCTIONS}"
      fi ;;
    env)
      base_content="${INSTRUCTIONS}" ;;
    stdin)
      base_content="${STDIN_CONTENT}" ;;
    default-builtin|*)
      base_content="${DEFAULT_INSTRUCTIONS}" ;;
  esac

  sections+=$'\n'"<instructions-section type=\"base\" source=\"${BASE_SOURCE_KIND}\" desc=\"${base_desc}\" path=\"${DEFAULT_INSTRUCTIONS_FILE}\">"$'\n'
  sections+="${base_content}"$'\n''</instructions-section>'$'\n'
  SOURCE_LINES+=("Base: ${base_desc}")

  # 叠加 -f/-c 源
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
            # 不存在则标注为空块
            sections+=$'\n'"<instructions-section type=\"file\" path=\"${v}\">[missing]</instructions-section>"$'\n'
            SOURCE_LINES+=("Add file: $v (missing)")
          fi
        fi ;;
      C)
        sections+=$'\n'"<instructions-section type=\"text\">"$'\n'
        sections+="${v}"$'\n''</instructions-section>'$'\n'
        local _pv
        _pv=$(printf '%s' "${v}" | tr '\n' ' ' | cut -c1-80)
        SOURCE_LINES+=("Add text: ${_pv}...") ;;
    esac
  done

  # 后置模板
  if [[ -n "${APPEND_FILE}" ]]; then
    if [[ -f "${APPEND_FILE}" ]]; then
      sections+=$'\n'"<instructions-section type=\"append-file\" path=\"${APPEND_FILE}\">"$'\n'
      sections+="$(cat "${APPEND_FILE}")"$'\n''</instructions-section>'$'\n'
      SOURCE_LINES+=("Append file: ${APPEND_FILE}")
    fi
  fi
  if [[ -n "${APPEND_CONTENT}" ]]; then
    sections+=$'\n'"<instructions-section type=\"append-text\">"$'\n'
    sections+="${APPEND_CONTENT}"$'\n''</instructions-section>'$'\n'
    local _pv
    _pv=$(printf '%s' "${APPEND_CONTENT}" | tr '\n' ' ' | cut -c1-80)
    SOURCE_LINES+=("Append text: ${_pv}...")
  fi

  INSTRUCTIONS=$'<user-instructions>\n['"${ts_iso}"$'] Composed instructions:\n\n'"${sections}"$'\n</user-instructions>\n'
}

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
} >> "${CODEX_LOG_FILE}"

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
EXEC_ARGS=("${CODEX_EXEC_ARGS[@]}" "--output-last-message" "${RUN_LAST_MSG_FILE}")
  if [[ ${DRY_RUN} -eq 1 ]]; then
    echo "[DRY-RUN] 跳过 codex 执行，仅生成日志与指令文件" | tee -a "${CODEX_LOG_FILE}"
    CODEX_EXIT=0
  else
  if ! command -v codex >/dev/null 2>&1; then
    echo "[ERROR] codex CLI 未找到，请确认已安装并在 PATH 中。" | tee -a "${CODEX_LOG_FILE}"
    CODEX_EXIT=127
  else
    if [[ "${REDACT_ENABLE}" == "1" ]]; then
      # 通过 STDIN 传递指令，避免参数过长问题；仅对输出做脱敏
      printf '%s' "${INSTRUCTIONS}" | codex "${CODEX_GLOBAL_ARGS[@]}" exec "${EXEC_ARGS[@]}" 2>&1 \
        | sed -u -E "${REDACT_SED_ARGS[@]}" | tee -a "${CODEX_LOG_FILE}"
      CODEX_EXIT=${PIPESTATUS[1]}
    else
      printf '%s' "${INSTRUCTIONS}" | codex "${CODEX_GLOBAL_ARGS[@]}" exec "${EXEC_ARGS[@]}" 2>&1 \
        | tee -a "${CODEX_LOG_FILE}"
      CODEX_EXIT=${PIPESTATUS[1]}
    fi
  fi
  fi
set -e
if (( GIT_ENABLED == 1 )); then
  GIT_HEAD_AFTER=$(git rev-parse HEAD 2>/dev/null || echo "")
fi

# 尾部与汇总
{
  echo "----- End Codex Output -----"
  echo "Exit Code: ${CODEX_EXIT}"
  echo "===== Codex Run End: ${TS}${TAG_SUFFIX} ====="
  echo
} >> "${CODEX_LOG_FILE}"

if [[ "${CODEX_LOG_AGGREGATE}" == "1" ]]; then
  mkdir -p "$(dirname "${CODEX_LOG_AGGREGATE_FILE}")"
  {
    echo "=== [${TS}] Codex Run ${TAG_SUFFIX} ==="
    echo "Log: ${CODEX_LOG_FILE}"
    echo "Instructions: ${INSTR_FILE}"
    echo -n "Title: "
    awk 'NF {print; exit}' "${INSTR_FILE}" | cut -c1-120 || true
    echo "Exit: ${CODEX_EXIT}"
    echo
  } >> "${CODEX_LOG_AGGREGATE_FILE}"
fi

# 生成元数据 JSON（函数定义在顶部库中也存在，保留以确保可用）
json_escape() {
  local s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

classify_exit "${RUN_LAST_MSG_FILE}" "${CODEX_LOG_FILE}" "${CODEX_EXIT}"
INSTR_TITLE=$(awk 'NF {print; exit}' "${INSTR_FILE}" 2>/dev/null || echo "")
RUN_ID="codex-${TS}${TAG_SUFFIX}"

META_JSON=$(cat <<EOF
{
  "id": "$(json_escape "${RUN_ID}")",
  "timestamp": "${TS}",
  "tag": "$(json_escape "${SAFE_TAG:-}")",
  "classification": "$(json_escape "${CLASSIFICATION}")",
  "control_flag": "$(json_escape "${CONTROL_FLAG}")",
  "reason": "$(json_escape "${EXIT_REASON}")",
  "tokens_used": "$(json_escape "${TOKENS_USED}")",
  "cwd": "$(json_escape "$(pwd)")",
  "log_file": "$(json_escape "${CODEX_LOG_FILE}")",
  "instructions_file": "$(json_escape "${INSTR_FILE}")",
  "exit_code": ${CODEX_EXIT},
  "title": "$(json_escape "${INSTR_TITLE}")"
}
EOF
)

printf '%s\n' "${META_JSON}" > "${META_FILE}"

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
    if [[ "${JSON_OUTPUT}" == "1" ]]; then
      # 直接输出 meta JSON
      cat "${META_FILE}" 2>/dev/null || printf '%s\n' "${META_JSON}"
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
  EXEC_ARGS=("${CODEX_EXEC_ARGS[@]}" "--output-last-message" "${RUN_LAST_MSG_FILE}")
  if [[ ${DRY_RUN} -eq 1 ]]; then
    echo "[DRY-RUN] 跳过 codex 执行，仅生成日志与指令文件 (iteration ${RUN})" | tee -a "${CODEX_LOG_FILE}"
    CODEX_EXIT=0
  else
    if ! command -v codex >/dev/null 2>&1; then
      echo "[ERROR] codex CLI 未找到，请确认已安装并在 PATH 中。" | tee -a "${CODEX_LOG_FILE}"
      CODEX_EXIT=127
    else
      if [[ "${REDACT_ENABLE}" == "1" ]]; then
        printf '%s' "${CURRENT_INSTR}" | codex "${CODEX_GLOBAL_ARGS[@]}" exec "${EXEC_ARGS[@]}" 2>&1 \
          | sed -u -E "${REDACT_SED_ARGS[@]}" | tee -a "${CODEX_LOG_FILE}"
        CODEX_EXIT=${PIPESTATUS[1]}
      else
        printf '%s' "${CURRENT_INSTR}" | codex "${CODEX_GLOBAL_ARGS[@]}" exec "${EXEC_ARGS[@]}" 2>&1 \
          | tee -a "${CODEX_LOG_FILE}"
        CODEX_EXIT=${PIPESTATUS[1]}
      fi
    fi
  fi
  set -e
  {
    echo "----- End Codex Output (iteration ${RUN}) -----"
    echo "Exit Code: ${CODEX_EXIT}"
  } >> "${CODEX_LOG_FILE}"

  # 元数据与汇总（含分类）
  RUN_TS="$(date +%Y%m%d_%H%M%S)"
  INSTR_TITLE=$(awk 'NF {print; exit}' "${RUN_INSTR_FILE}" 2>/dev/null || echo "")
  RUN_ID="codex-${RUN_TS}${TAG_SUFFIX}-r${RUN}"
  classify_exit "${RUN_LAST_MSG_FILE}" "${CODEX_LOG_FILE}" "${CODEX_EXIT}"
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
  "cwd": "$(json_escape "$(pwd)")",
  "log_file": "$(json_escape "${CODEX_LOG_FILE}")",
  "instructions_file": "$(json_escape "${RUN_INSTR_FILE}")",
  "last_message_file": "$(json_escape "${RUN_LAST_MSG_FILE}")",
  "exit_code": ${CODEX_EXIT},
  "title": "$(json_escape "${INSTR_TITLE}")"
}
EOF
)
  printf '%s\n' "${META_JSON}" > "${RUN_META_FILE}"
  if [[ "${CODEX_LOG_AGGREGATE}" == "1" ]]; then
    mkdir -p "$(dirname "${CODEX_LOG_AGGREGATE_JSONL_FILE}")"
    printf '%s\n' "${META_JSON}" >> "${CODEX_LOG_AGGREGATE_JSONL_FILE}"
    mkdir -p "$(dirname "${CODEX_LOG_AGGREGATE_FILE}")"
    {
      echo "=== [${RUN_TS}] Codex Run r${RUN} ${TAG_SUFFIX} ==="
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
  # 输出最后一轮的 meta JSON（若无则回退第一次）
  LAST_META_FILE=$(ls -1t "${CODEX_LOG_FILE%.log}"*.meta.json 2>/dev/null | head -n1 || true)
  if [[ -n "${LAST_META_FILE}" && -f "${LAST_META_FILE}" ]]; then
    cat "${LAST_META_FILE}"
  else
    cat "${META_FILE}" 2>/dev/null || true
  fi
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
