#!/usr/bin/env bash

# 用例：start.sh 参数透传（--profile/--full-auto/--codex-config/--codex-arg）
# 断言：Invocation Args 中包含相应参数与取值。

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
START_SH="$ROOT/start.sh"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[e2e-start-args] 缺少命令: $1" >&2; exit 1; }; }
require_cmd jq

# 使用仓库当前目录下的标准 .codex-father 进行持久化记录（工作子目录）
TS="$(date +%Y%m%d_%H%M%S)"
WORK_BASE="$ROOT/.codex-father/e2e-work"
WORK_DIR="$WORK_BASE/e2e_start_args_passthrough_real_codex/$TS"
mkdir -p "$WORK_DIR"

pushd "$WORK_DIR" >/dev/null
raw=$("$START_SH" --flat-logs --json --tag e2e-start-args \
  --task "Args pass-through" \
  --sandbox workspace-write --ask-for-approval on-request \
  --profile dev --full-auto --codex-config 'a_bool=true' --codex-arg '--verbose' 2>&1)
out=$(printf '%s\n' "$raw" | awk 'f{print} /^\s*\{/{f=1; print}')
echo "$out" | jq -e . >/dev/null 2>&1 || { echo "[e2e-start-args] 非法 JSON" >&2; echo "$raw" >&2; exit 1; }
log=$(printf '%s' "$out" | jq -r '.log_file')

grep -Fq 'codex global args:' "$log" || { echo "[e2e-start-args] 缺少 Invocation Args 段" >&2; exit 1; }
grep -Fq ' --profile' "$log" || { echo "[e2e-start-args] 缺少 --profile" >&2; exit 1; }
grep -Fq ' dev' "$log" || { echo "[e2e-start-args] 缺少 profile 值" >&2; exit 1; }
grep -Fq ' --full-auto' "$log" || { echo "[e2e-start-args] 缺少 --full-auto" >&2; exit 1; }
grep -Fq ' --ask-for-approval' "$log" || { echo "[e2e-start-args] 缺少 --ask-for-approval" >&2; exit 1; }
grep -Eiq ' on-request' "$log" || { echo "[e2e-start-args] 缺少 on-request 值" >&2; exit 1; }
grep -Fq ' a_bool=true' "$log" || { echo "[e2e-start-args] 缺少 codex-config 值" >&2; exit 1; }
grep -Fq ' --verbose' "$log" || { echo "[e2e-start-args] 缺少 codex-arg 值" >&2; exit 1; }

echo "[e2e-start-args] PASS"
popd >/dev/null
