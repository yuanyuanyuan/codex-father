#!/usr/bin/env bash
set -euo pipefail

command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 1; }

# If dev deps are missing (no chalk/winston), skip gracefully
if [[ ! -d node_modules/chalk && ! -d node_modules/winston ]]; then
  echo "[SKIP] bulk e2e smoke skipped (npm deps not installed)"
  exit 0
fi

TMP_DIR=$(mktemp -d)
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

SESS="$TMP_DIR/.codex-father/sessions"
mkdir -p "$SESS/job-run" "$SESS/job-fail"

# job-run: running; job-fail: failed + resume_from = 7
cat >"$SESS/job-run/state.json" <<JSON
{
  "id":"job-run","state":"running","cwd":"$TMP_DIR","created_at":"2025-10-13T10:00:00Z","updated_at":"2025-10-13T10:00:00Z"
}
JSON
cat >"$SESS/job-fail/state.json" <<JSON
{
  "id":"job-fail","state":"failed","resume_from":7,"cwd":"$TMP_DIR","created_at":"2025-10-13T10:00:00Z","updated_at":"2025-10-13T10:00:00Z"
}
JSON

# Preview bulk:stop
out1=$(node bin/codex-father bulk:stop job-run job-fail --json --repo-root "$TMP_DIR")
echo "$out1" | jq -e '.success == true' >/dev/null
echo "$out1" | jq -e '.data.dryRun == true' >/dev/null
echo "$out1" | jq -e '.data.preview[] | select(.jobId=="job-run").eligible == true' >/dev/null
echo "$out1" | jq -e '.data.preview[] | select(.jobId=="job-fail").eligible == false' >/dev/null

# Preview bulk:resume
out2=$(node bin/codex-father bulk:resume job-run job-fail --json --repo-root "$TMP_DIR")
echo "$out2" | jq -e '.success == true' >/dev/null
echo "$out2" | jq -e '.data.dryRun == true' >/dev/null
echo "$out2" | jq -e '.data.preview[] | select(.jobId=="job-fail").resumeFrom == 7' >/dev/null
echo "[OK] bulk e2e smoke passed"
