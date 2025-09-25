#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[smoke-job-json] missing command: $1" >&2; exit 1; }; }

require_cmd jq

cd "$ROOT_DIR"

start_json=$(./job.sh start --task "smoke job json" --dry-run --tag smoke-json --json)
jobId=$(printf '%s' "$start_json" | jq -r '.jobId // empty')
[[ -n "$jobId" ]] || { echo "[smoke-job-json] jobId missing" >&2; exit 1; }

# wait loop
tries=30
while (( tries-- > 0 )); do
  st=$(./job.sh status "$jobId" --json)
  state=$(printf '%s' "$st" | jq -r '.state // empty')
  if [[ "$state" == "completed" || "$state" == "failed" ]]; then
    break
  fi
  sleep 0.2
done
[[ "$tries" -gt 0 ]] || { echo "[smoke-job-json] status did not settle" >&2; exit 1; }

exit_code=$(printf '%s' "$st" | jq -r '.exit_code // empty')
[[ "$exit_code" == "0" ]] || { echo "[smoke-job-json] exit_code != 0: $exit_code" >&2; exit 1; }

echo "[smoke-job-json] PASS ($jobId)"

