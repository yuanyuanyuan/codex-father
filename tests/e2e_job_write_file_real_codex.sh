#!/usr/bin/env bash

# 用例：job.sh 真实写文件（非 --dry-run）
# 断言：在 --cwd 指定目录创建文件，内容包含标记文本。

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
JOB_SH="$ROOT/job.sh"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[e2e-job-write] 缺少命令: $1" >&2; exit 1; }; }
require_cmd jq
require_cmd codex

# 使用仓库当前目录下的标准 .codex-father 进行持久化记录
TS="$(date +%Y%m%d_%H%M%S)"
WORK_BASE="$ROOT/.codex-father/e2e-work"
work="$WORK_BASE/e2e_job_write_file_real_codex/$TS"
mkdir -p "$work"

target="e2e_written.txt"
marker="E2E_WRITE_OK"

start_json=$("$JOB_SH" start --json --cwd "$work" --tag e2e-job-write \
  --sandbox danger-full-access \
  --dangerously-bypass-approvals-and-sandbox \
  --task $'请在当前工作目录创建一个名为 e2e_written.txt 的文件，文件内容只包含一行：\nE2E_WRITE_OK\n\n要求：\n- 直接写入文件，不要输出补丁/patch/diff。\n- 完成后输出：CONTROL: DONE')

jobId=$(printf '%s' "$start_json" | jq -r '.jobId // empty')
[[ -n "$jobId" ]] || { echo "[e2e-job-write] 未返回 jobId" >&2; echo "$start_json" >&2; exit 1; }

tries=60
while (( tries-- > 0 )); do
  st=$("$JOB_SH" status "$jobId" --json --cwd "$work")
  state=$(printf '%s' "$st" | jq -r '.state // empty')
  [[ "$state" == "completed" || "$state" == "failed" ]] && break
  sleep 0.5
done
[[ "$tries" -gt 0 ]] || { echo "[e2e-job-write] 状态未在预期时间内结束" >&2; echo "$st" >&2; exit 1; }

log=$(printf '%s' "$st" | jq -r '.log_file // empty')
[[ -f "$log" ]] || { echo "[e2e-job-write] 缺少日志: $log" >&2; exit 1; }

if [[ ! -f "$work/$target" ]]; then
  echo "[e2e-job-write] 未找到写入的文件: $work/$target" >&2
  echo "[e2e-job-write] 日志路径: $log" >&2
  # 辅助诊断：输出 bootstrap 与日志尾部
  run_dir="$(dirname "$log")"
  if [[ -f "$run_dir/bootstrap.err" ]]; then
    echo "--- bootstrap.err (tail) ---" >&2
    tail -n 120 "$run_dir/bootstrap.err" >&2 || true
  fi
  if [[ -f "$run_dir/bootstrap.out" ]]; then
    echo "--- bootstrap.out (tail) ---" >&2
    tail -n 80 "$run_dir/bootstrap.out" >&2 || true
  fi
  echo "--- job.log (tail) ---" >&2
  tail -n 120 "$log" >&2 || true
  exit 1
fi
grep -Fq "$marker" "$work/$target" || { echo "[e2e-job-write] 文件内容不含标记: $marker" >&2; exit 1; }

echo "[e2e-job-write] PASS ($jobId)"
