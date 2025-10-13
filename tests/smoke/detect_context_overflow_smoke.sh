#!/usr/bin/env bash
set -euo pipefail

# Locate repo root (this script lives in tests/smoke)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

source "${REPO_ROOT}/lib/common.sh"

pass=0; fail=0
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# Case 1: clear positive – real overflow phrase should be detected
f1="$tmpdir/overflow.txt"
printf 'maximum context length exceeded by 123 tokens' > "$f1"
if detect_context_overflow_in_files "$f1" 2>"$tmpdir/err1"; then
  if [[ ! -s "$tmpdir/err1" ]]; then pass=$((pass+1)); else echo "[ERR] stderr not empty (case1)"; cat "$tmpdir/err1"; fail=$((fail+1)); fi
else
  echo "[FAIL] expected overflow detected (case1)"; fail=$((fail+1))
fi

# Case 2: excluded noise – config-like tokens should NOT trigger
f2="$tmpdir/noise.txt"
printf 'CODEX_ECHO_INSTRUCTIONS_LIMIT=1200 INPUT_TOKEN_LIMIT=80000' > "$f2"
if detect_context_overflow_in_files "$f2" 2>"$tmpdir/err2"; then
  echo "[FAIL] false positive detected on noise (case2)"; fail=$((fail+1))
else
  if [[ ! -s "$tmpdir/err2" ]]; then pass=$((pass+1)); else echo "[ERR] stderr not empty (case2)"; cat "$tmpdir/err2"; fail=$((fail+1)); fi
fi

echo "passed=$pass failed=$fail"
(( fail == 0 )) || exit 1

