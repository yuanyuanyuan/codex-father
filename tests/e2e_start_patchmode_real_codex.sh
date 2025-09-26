#!/usr/bin/env bash

# 用例：start.sh patch-mode 真实执行
# 断言：instructions 含补丁策略说明文案。

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
START_SH="$ROOT/start.sh"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[e2e-start-patch] 缺少命令: $1" >&2; exit 1; }; }
require_cmd jq

# 使用仓库当前目录下的标准 .codex-father 进行持久化记录（工作子目录）
TS="$(date +%Y%m%d_%H%M%S)"
WORK_BASE="$ROOT/.codex-father/e2e-work"
WORK_DIR="$WORK_BASE/e2e_start_patchmode_real_codex/$TS"
mkdir -p "$WORK_DIR"

pushd "$WORK_DIR" >/dev/null
raw=$("$START_SH" --flat-logs --json --tag e2e-start-patch \
  --task "patch mode" --patch-mode 2>&1)
out=$(printf '%s\n' "$raw" | awk 'f{print} /^\s*\{/{f=1; print}')
echo "$out" | jq -e . >/dev/null 2>&1 || { echo "[e2e-start-patch] 非法 JSON" >&2; echo "$raw" >&2; exit 1; }
instr=$(printf '%s' "$out" | jq -r '.instructions_file')

grep -q '请仅输出可应用的补丁' "$instr" || { echo "[e2e-start-patch] 策略说明缺失" >&2; exit 1; }
echo "[e2e-start-patch] PASS"
popd >/dev/null
