#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
START_SH="$ROOT_DIR/start.sh"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

pushd "$tmpdir" >/dev/null

export CODEX_SESSIONS_ROOT="$tmpdir/sessions"

set +e
out_err=$("$START_SH" --dry-run --flat-logs --tag docs-miss --docs "docs/technical/*.md" 2>&1)
rc=$?
set -e

if [[ "$rc" -eq 0 ]]; then
  echo "[smoke-start-docs-fail] expected failure (rc!=0) for missing glob" >&2
  exit 1
fi

grep -Fq "错误: 文件不存在: docs/technical/*.md" <<<"$out_err" || { echo "[smoke-start-docs-fail] missing missing-file error" >&2; exit 1; }
grep -Fq "搜索模式: docs/technical/*.md" <<<"$out_err" || { echo "[smoke-start-docs-fail] missing debug search pattern" >&2; exit 1; }
grep -Fq "匹配到的文件: 0" <<<"$out_err" || { echo "[smoke-start-docs-fail] missing matches count" >&2; exit 1; }

popd >/dev/null

echo "[smoke-start-docs-fail] PASS"
