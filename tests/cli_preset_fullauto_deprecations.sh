#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

fail() { echo "[deprecations] ERROR: $*" >&2; exit 1; }
info() { echo "[deprecations] $*"; }

info "Case 1: --preset should be rejected with clear message"
set +e
out=$(./start.sh --preset sprint --task demo 2>&1)
code=$?
set -e
[[ $code -eq 2 ]] || fail "expected exit 2 for --preset; got $code"
grep -F -- "错误: --preset 已移除" <<<"$out" >/dev/null || fail "missing removal message for --preset"

info "Case 2: --full-auto should be rejected with clear message"
set +e
out=$(./start.sh --full-auto --task demo 2>&1)
code=$?
set -e
[[ $code -eq 2 ]] || fail "expected exit 2 for --full-auto; got $code"
grep -F -- "错误: --full-auto 已移除" <<<"$out" >/dev/null || fail "missing removal message for --full-auto"

info "Case 3: normal dry-run should succeed"
./start.sh --task "noop" --dry-run --json >/dev/null 2>&1 || fail "dry-run failed"

info "Case 4: help should not advertise preset values"
help=$(./start.sh --help 2>&1 || true)
grep -E -- 'sprint|analysis|secure|fast' <<<"$help" >/dev/null && fail "help still mentions preset values"

echo "[deprecations] PASS"

