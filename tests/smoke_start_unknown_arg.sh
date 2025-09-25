#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

set +e
out_err=$(./start.sh --execute-remaining-tasks 2>&1)
rc=$?
set -e

if [[ "$rc" -ne 2 ]]; then
  echo "[smoke-start-unknown-arg] expected rc=2, got rc=$rc" >&2
  echo "--- stderr ---" >&2
  printf '%s\n' "$out_err" >&2
  exit 1
fi

grep -Fq "未知参数" <<<"$out_err" || { echo "[smoke-start-unknown-arg] missing '未知参数' hint" >&2; exit 1; }
grep -Fq "--help" <<<"$out_err" || { echo "[smoke-start-unknown-arg] missing '--help' hint" >&2; exit 1; }
grep -Fq -- "--task" <<<"$out_err" || { echo "[smoke-start-unknown-arg] missing '--task' suggestion" >&2; exit 1; }
grep -Fq -- "--docs" <<<"$out_err" || { echo "[smoke-start-unknown-arg] missing '--docs' suggestion" >&2; exit 1; }
grep -Fq -- "--docs-dir" <<<"$out_err" || { echo "[smoke-start-unknown-arg] missing '--docs-dir' suggestion" >&2; exit 1; }

echo "[smoke-start-unknown-arg] PASS"
