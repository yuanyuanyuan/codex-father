#!/usr/bin/env bash

# 用例：start.sh 基础真实执行（非 --dry-run）
# 断言：JSON 输出合法；日志/指令/meta/聚合产物存在；日志含 Codex 开始与 Exit Code；无 DRY-RUN。

# 如果被 sh 调用，自动切换到 bash
if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
START_SH="$ROOT/start.sh"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[e2e-start-base] 缺少命令: $1" >&2; exit 1; }; }
require_cmd jq

# 使用仓库当前目录下的标准 .codex-father 进行持久化记录（工作子目录）
TS="$(date +%Y%m%d_%H%M%S)"
WORK_BASE="$ROOT/.codex-father/e2e-work"
WORK_DIR="$WORK_BASE/e2e_start_base_real_codex/$TS"
mkdir -p "$WORK_DIR"

pushd "$WORK_DIR" >/dev/null
raw=$("$START_SH" --flat-logs --json --tag e2e-start-base \
  --task "E2E base real codex via start.sh" \
  --sandbox workspace-write --ask-for-approval never 2>&1)
out=$(printf '%s\n' "$raw" | awk 'f{print} /^\s*\{/{f=1; print}')
echo "$out" | jq -e . >/dev/null 2>&1 || { echo "[e2e-start-base] 非法 JSON" >&2; echo "$raw" >&2; exit 1; }

log=$(printf '%s' "$out" | jq -r '.log_file')
instr=$(printf '%s' "$out" | jq -r '.instructions_file')
meta="${log%.log}.meta.json"; agg_txt="$(dirname "$log")/aggregate.txt"; agg_jsonl="$(dirname "$log")/aggregate.jsonl"

[[ -f "$log" && -f "$instr" && -f "$meta" && -f "$agg_txt" && -f "$agg_jsonl" ]] || { echo "[e2e-start-base] 缺少产物" >&2; exit 1; }
grep -Fq '----- Begin Codex Output' "$log" || { echo "[e2e-start-base] 缺少 Codex 输出开始标记" >&2; exit 1; }
grep -Eq '^Exit Code: -?[0-9]+' "$log" || { echo "[e2e-start-base] 缺少 Exit Code" >&2; exit 1; }
! grep -Fq '[DRY-RUN]' "$log" || { echo "[e2e-start-base] 发现 DRY-RUN 提示" >&2; exit 1; }

echo "[e2e-start-base] PASS"
popd >/dev/null
