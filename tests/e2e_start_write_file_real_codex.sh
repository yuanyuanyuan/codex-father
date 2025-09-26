#!/usr/bin/env bash

# 用例：start.sh 真实写文件（非 --dry-run）
# 断言：在工作目录创建指定文件，内容包含标记文本。

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
START_SH="$ROOT/start.sh"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[e2e-start-write] 缺少命令: $1" >&2; exit 1; }; }
require_cmd jq

# 使用仓库当前目录下的标准 .codex-father 进行持久化记录
TS="$(date +%Y%m%d_%H%M%S)"
WORK_BASE="$ROOT/.codex-father/e2e-work"
WORK_DIR="$WORK_BASE/e2e_start_write_file_real_codex/$TS"
mkdir -p "$WORK_DIR"

target="e2e_written.txt"
marker="E2E_WRITE_OK"

pushd "$WORK_DIR" >/dev/null
raw=$("$START_SH" --flat-logs --json --tag e2e-start-write \
  --sandbox danger-full-access \
  --dangerously-bypass-approvals-and-sandbox \
  --task $'请在当前工作目录创建一个名为 e2e_written.txt 的文件，文件内容只包含一行：\nE2E_WRITE_OK\n\n要求：\n- 直接写入文件，不要输出补丁/patch/diff。\n- 完成后输出：CONTROL: DONE' 2>&1)
popd >/dev/null

out=$(printf '%s\n' "$raw" | awk 'f{print} /^\s*\{/{f=1; print}')
echo "$out" | jq -e . >/dev/null 2>&1 || { echo "[e2e-start-write] 非法 JSON" >&2; echo "$raw" >&2; exit 1; }
log=$(printf '%s' "$out" | jq -r '.log_file')

# 诊断 sandbox 情况
grep -E "sandbox:\s" "$log" >/dev/null 2>&1 && grep -E "sandbox:\s" "$log" | tail -n1 || true

# 验证写入（在工作目录中）
if [[ ! -f "$WORK_DIR/$target" ]]; then
  echo "[e2e-start-write] 未找到写入的文件: $WORK_DIR/$target" >&2
  echo "[e2e-start-write] 日志路径: $log" >&2
  # 辅助诊断：展示日志末尾
  if [[ -f "$log" ]]; then
    echo "--- job.log (tail) ---" >&2
    tail -n 120 "$log" >&2 || true
  fi
  exit 1
fi

grep -Fq "$marker" "$WORK_DIR/$target" || { echo "[e2e-start-write] 文件内容不含标记: $marker" >&2; exit 1; }

echo "[e2e-start-write] PASS"
