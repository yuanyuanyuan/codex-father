#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

# Conflict 1: bypass + ask-for-approval
set +e
out1=$(./start.sh --task "conflict1" --dangerously-bypass-approvals-and-sandbox --ask-for-approval on-request --json 2>&1)
rc1=$?
set -e
if [[ "$rc1" -eq 0 ]]; then
  echo "[smoke-start-conflicts] expected error for bypass+ask-for-approval (got rc=0)" >&2
  exit 1
fi
echo "$out1" | grep -Eq '参数冲突|冲突' >/dev/null || { echo "[smoke-start-conflicts] missing conflict message (1)" >&2; exit 1; }
echo "$out1" | grep -F -- '--dangerously-bypass-approvals-and-sandbox' >/dev/null || { echo "[smoke-start-conflicts] missing bypass flag mention (1)" >&2; exit 1; }
echo "$out1" | grep -F -- '--ask-for-approval' >/dev/null || { echo "[smoke-start-conflicts] missing ask-for-approval mention (1)" >&2; exit 1; }

# Conflict 2: bypass + full-auto
set +e
out2=$(./start.sh --task "conflict2" --dangerously-bypass-approvals-and-sandbox --full-auto --json 2>&1)
rc2=$?
set -e
if [[ "$rc2" -eq 0 ]]; then
  echo "[smoke-start-conflicts] expected error for bypass+full-auto (got rc=0)" >&2
  exit 1
fi
echo "$out2" | grep -Eq '参数冲突|冲突' >/dev/null || { echo "[smoke-start-conflicts] missing conflict message (2)" >&2; exit 1; }
echo "$out2" | grep -F -- '--dangerously-bypass-approvals-and-sandbox' >/dev/null || { echo "[smoke-start-conflicts] missing bypass flag mention (2)" >&2; exit 1; }
echo "$out2" | grep -F -- '--full-auto' >/dev/null || { echo "[smoke-start-conflicts] missing full-auto mention (2)" >&2; exit 1; }

echo "[smoke-start-conflicts] PASS"

