#!/usr/bin/env bash

# 用例：start.sh redact 真实执行
# 断言：日志中敏感信息被脱敏为 ***REDACTED***。

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
START_SH="$ROOT/start.sh"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[e2e-start-redact] 缺少命令: $1" >&2; exit 1; }; }
require_cmd jq

# 使用仓库当前目录下的标准 .codex-father 进行持久化记录（工作子目录）
TS="$(date +%Y%m%d_%H%M%S)"
WORK_BASE="$ROOT/.codex-father/e2e-work"
WORK_DIR="$WORK_BASE/e2e_start_redact_real_codex/$TS"
mkdir -p "$WORK_DIR"

secret="sk-ABCDE123456789012345"
pushd "$WORK_DIR" >/dev/null
raw=$("$START_SH" --flat-logs --json --tag e2e-start-redact \
  --task "token $secret" --redact 2>&1)
out=$(printf '%s\n' "$raw" | awk 'f{print} /^\s*\{/{f=1; print}')
echo "$out" | jq -e . >/dev/null 2>&1 || { echo "[e2e-start-redact] 非法 JSON" >&2; echo "$raw" >&2; exit 1; }
log=$(printf '%s' "$out" | jq -r '.log_file')

grep -Fq '----- Invocation Args -----' "$log" || { echo "[e2e-start-redact] 缺少 Invocation Args 段" >&2; exit 1; }
grep -Fq '***REDACTED***' "$log" || { echo "[e2e-start-redact] 未脱敏" >&2; exit 1; }
! grep -Fq "$secret" "$log" || { echo "[e2e-start-redact] 泄露敏感信息" >&2; exit 1; }

echo "[e2e-start-redact] PASS"
popd >/dev/null
