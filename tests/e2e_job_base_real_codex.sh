#!/usr/bin/env bash

# 用例：job.sh 基础真实执行
# 断言：start/status/logs 可用；日志含 Codex 开始与 Exit Code；聚合与元数据存在。

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
JOB_SH="$ROOT/job.sh"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[e2e-job-base] 缺少命令: $1" >&2; exit 1; }; }
require_cmd jq

# 使用仓库当前目录下的标准 .codex-father 进行持久化记录（工作子目录）
TS="$(date +%Y%m%d_%H%M%S)"
WORK_BASE="$ROOT/.codex-father/e2e-work"
tmpdir="$WORK_BASE/e2e_job_base_real_codex/$TS"
mkdir -p "$tmpdir"

# 启动后台任务
start_json=$("$JOB_SH" start --json --cwd "$tmpdir" --tag e2e-job-base \
  --task "E2E base real codex via job" --sandbox workspace-write --ask-for-approval never)
jobId=$(printf '%s' "$start_json" | jq -r '.jobId // empty')
[[ -n "$jobId" ]] || { echo "[e2e-job-base] 未返回 jobId" >&2; echo "$start_json" >&2; exit 1; }

# 轮询状态
tries=60
while (( tries-- > 0 )); do
  st=$("$JOB_SH" status "$jobId" --json --cwd "$tmpdir")
  state=$(printf '%s' "$st" | jq -r '.state // empty')
  [[ "$state" == "completed" || "$state" == "failed" ]] && break
  sleep 0.5
done
[[ "$tries" -gt 0 ]] || { echo "[e2e-job-base] 状态未在预期时间内结束" >&2; echo "$st" >&2; exit 1; }

log=$(printf '%s' "$st" | jq -r '.log_file // empty')
[[ -f "$log" ]] || { echo "[e2e-job-base] 缺少日志: $log" >&2; exit 1; }
grep -Fq '----- Begin Codex Output' "$log" || { echo "[e2e-job-base] 缺少 Codex 开始标记" >&2; exit 1; }
grep -Eq '^Exit Code: -?[0-9]+' "$log" || { echo "[e2e-job-base] 缺少 Exit Code" >&2; exit 1; }
! grep -Fq '[DRY-RUN]' "$log" || { echo "[e2e-job-base] 发现 DRY-RUN" >&2; exit 1; }

# logs 子命令校验
"$JOB_SH" logs "$jobId" --tail 50 --cwd "$tmpdir" | grep -Eq '^Exit Code: -?[0-9]+' || { echo "[e2e-job-base] logs 子命令缺少 Exit Code" >&2; exit 1; }

# 产物校验
run_dir="$tmpdir/.codex-father/sessions/$jobId"
[[ -f "$run_dir/aggregate.txt" ]] || { echo "[e2e-job-base] 缺少 aggregate.txt" >&2; exit 1; }
[[ -f "$run_dir/aggregate.jsonl" ]] || { echo "[e2e-job-base] 缺少 aggregate.jsonl" >&2; exit 1; }
ls -1 "$run_dir"/*.meta.json >/dev/null 2>&1 || { echo "[e2e-job-base] 缺少 meta.json" >&2; exit 1; }
ls -1 "$run_dir"/*.last.txt >/dev/null 2>&1 || { echo "[e2e-job-base] 缺少 last.txt" >&2; exit 1; }

echo "[e2e-job-base] PASS ($jobId)"
