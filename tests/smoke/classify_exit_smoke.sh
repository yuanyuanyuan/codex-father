#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
source "${REPO_ROOT}/lib/common.sh"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# Helper to invoke classify_exit and print key outputs
run_case() {
  local name="$1"; shift
  local log="$1"; shift
  local last="$1"; shift
  local code="$1"; shift
  CLASSIFICATION=""; CONTROL_FLAG=""; EXIT_REASON=""
  classify_exit "${last}" "${log}" "${code}"
  echo "$name: code=${code} classification=${CLASSIFICATION} reason=${EXIT_REASON}"
}

# Case A: non-zero exit but benign approval status lines should NOT trigger approval_required
loga="$tmpdir/log-a.txt"; lasta="$tmpdir/last-a.txt"
printf 'some info...\napproval: never\nmore...' > "$loga"
printf '' > "$lasta"
out_a=$(run_case A "$loga" "$lasta" 1)
echo "$out_a"
[[ "$out_a" =~ classification=approval_required ]] && { echo "[FAIL] benign approval status misclassified"; exit 1; }

# Case B: explicit approval required phrase should trigger approval_required
logb="$tmpdir/log-b.txt"; lastb="$tmpdir/last-b.txt"
printf 'error: approval required to proceed' > "$logb"
printf '' > "$lastb"
out_b=$(run_case B "$logb" "$lastb" 1)
echo "$out_b"
[[ "$out_b" =~ classification=approval_required ]] || { echo "[FAIL] explicit approval required not detected"; exit 1; }

echo "OK"

