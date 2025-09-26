#!/usr/bin/env bash

# 用例：start.sh 文档收集（--docs 多值/通配 + --docs-dir 递归）真实执行
# 断言：instructions 中包含各文档路径标记；日志含 Codex 开始标记。

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
START_SH="$ROOT/start.sh"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[e2e-start-docs] 缺少命令: $1" >&2; exit 1; }; }
require_cmd jq

# 使用仓库当前目录下的标准 .codex-father 进行持久化记录（工作子目录）
TS="$(date +%Y%m%d_%H%M%S)"
WORK_BASE="$ROOT/.codex-father/e2e-work"
work="$WORK_BASE/e2e_start_docs_real_codex/$TS"
mkdir -p "$work/docs/technical" "$work/docs/more/nested"
echo "A content" > "$work/docs/technical/a.md"
echo "B content" > "$work/docs/more/b.markdown"
echo "N content" > "$work/docs/more/nested/n.md"

pushd "$work" >/dev/null
raw=$("$START_SH" --flat-logs --json --tag e2e-start-docs \
  --docs "docs/technical/*.md" "docs/more/*.markdown" \
  --docs-dir docs \
  --task "docs real run" 2>&1)
popd >/dev/null

out=$(printf '%s\n' "$raw" | awk 'f{print} /^\s*\{/{f=1; print}')
echo "$out" | jq -e . >/dev/null 2>&1 || { echo "[e2e-start-docs] 非法 JSON" >&2; echo "$raw" >&2; exit 1; }
instr=$(printf '%s' "$out" | jq -r '.instructions_file')
log=$(printf '%s' "$out" | jq -r '.log_file')

[[ -f "$instr" ]] || { echo "[e2e-start-docs] 缺少指令文件" >&2; exit 1; }
grep -q 'path="docs/technical/a.md"' "$instr" || { echo "[e2e-start-docs] 缺少 a.md" >&2; exit 1; }
grep -q 'path="docs/more/b.markdown"' "$instr" || { echo "[e2e-start-docs] 缺少 b.markdown" >&2; exit 1; }
grep -q 'path="docs/more/nested/n.md"' "$instr" || { echo "[e2e-start-docs] 缺少 nested n.md" >&2; exit 1; }
grep -Fq '----- Begin Codex Output' "$log" || { echo "[e2e-start-docs] 未执行 codex" >&2; exit 1; }

echo "[e2e-start-docs] PASS"
