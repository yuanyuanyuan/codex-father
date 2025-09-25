#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
START_SH="$ROOT_DIR/start.sh"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

pushd "$tmpdir" >/dev/null

# Prepare docs tree
mkdir -p docs/technical docs/more/nested
echo "A content" > docs/technical/a.md
echo "B content" > docs/more/b.markdown
echo "N content" > docs/more/nested/n.md

# List file mixing glob and explicit
cat > docs-list.txt <<'EOF'
# comment line
docs/technical/*.md
docs/more/*.markdown
EOF

export CODEX_SESSIONS_ROOT="$tmpdir/sessions"

# Case 1: --docs with multiple globs
set +e
"$START_SH" --dry-run --flat-logs --tag docs-glob \
  --docs "docs/technical/*.md" "docs/more/*.markdown" >/dev/null 2>&1
rc=$?
set -e
[[ "$rc" -eq 0 ]] || { echo "[smoke-start-docs-success] rc!=0 for --docs globs: $rc" >&2; exit 1; }

instr1=$(ls -1 "$CODEX_SESSIONS_ROOT"/exec-*docs-glob*/ | head -n1)
instr_file1="$CODEX_SESSIONS_ROOT/${instr1%/}/job.instructions.md"
[[ -f "$instr_file1" ]] || instr_file1="$CODEX_SESSIONS_ROOT/${instr1%/}/codex-"*".instructions.md"
[[ -f "$instr_file1" ]] || { echo "[smoke-start-docs-success] instructions file not found (case1)" >&2; exit 1; }
grep -q 'path="docs/technical/a.md"' "$instr_file1" || { echo "[smoke-start-docs-success] missing a.md in instructions (case1)" >&2; exit 1; }
grep -q 'path="docs/more/b.markdown"' "$instr_file1" || { echo "[smoke-start-docs-success] missing b.markdown in instructions (case1)" >&2; exit 1; }

# Case 2: --docs-dir recursive
set +e
"$START_SH" --dry-run --flat-logs --tag docs-dir --docs-dir docs >/dev/null 2>&1
rc=$?
set -e
[[ "$rc" -eq 0 ]] || { echo "[smoke-start-docs-success] rc!=0 for --docs-dir: $rc" >&2; exit 1; }

instr2=$(ls -1 "$CODEX_SESSIONS_ROOT"/exec-*docs-dir*/ | head -n1)
instr_file2="$CODEX_SESSIONS_ROOT/${instr2%/}/job.instructions.md"
[[ -f "$instr_file2" ]] || instr_file2="$CODEX_SESSIONS_ROOT/${instr2%/}/codex-"*".instructions.md"
[[ -f "$instr_file2" ]] || { echo "[smoke-start-docs-success] instructions file not found (case2)" >&2; exit 1; }
grep -q 'path="docs/technical/a.md"' "$instr_file2" || { echo "[smoke-start-docs-success] missing a.md in instructions (case2)" >&2; exit 1; }
grep -q 'path="docs/more/b.markdown"' "$instr_file2" || { echo "[smoke-start-docs-success] missing b.markdown in instructions (case2)" >&2; exit 1; }
grep -q 'path="docs/more/nested/n.md"' "$instr_file2" || { echo "[smoke-start-docs-success] missing nested n.md (case2)" >&2; exit 1; }

# Case 3: @list file
set +e
"$START_SH" --dry-run --flat-logs --tag docs-list --docs @docs-list.txt >/dev/null 2>&1
rc=$?
set -e
[[ "$rc" -eq 0 ]] || { echo "[smoke-start-docs-success] rc!=0 for @list: $rc" >&2; exit 1; }

instr3=$(ls -1 "$CODEX_SESSIONS_ROOT"/exec-*docs-list*/ | head -n1)
instr_file3="$CODEX_SESSIONS_ROOT/${instr3%/}/job.instructions.md"
[[ -f "$instr_file3" ]] || instr_file3="$CODEX_SESSIONS_ROOT/${instr3%/}/codex-"*".instructions.md"
[[ -f "$instr_file3" ]] || { echo "[smoke-start-docs-success] instructions file not found (case3)" >&2; exit 1; }
grep -q 'path="docs/technical/a.md"' "$instr_file3" || { echo "[smoke-start-docs-success] missing a.md in instructions (case3)" >&2; exit 1; }
grep -q 'path="docs/more/b.markdown"' "$instr_file3" || { echo "[smoke-start-docs-success] missing b.markdown in instructions (case3)" >&2; exit 1; }

# Case 4: ** globstar
set +e
"$START_SH" --dry-run --flat-logs --tag docs-globstar --docs "docs/**/*.md" >/dev/null 2>&1
rc=$?
set -e
[[ "$rc" -eq 0 ]] || { echo "[smoke-start-docs-success] rc!=0 for ** globstar: $rc" >&2; exit 1; }

instr4=$(ls -1 "$CODEX_SESSIONS_ROOT"/exec-*docs-globstar*/ | head -n1)
instr_file4="$CODEX_SESSIONS_ROOT/${instr4%/}/job.instructions.md"
[[ -f "$instr_file4" ]] || instr_file4="$CODEX_SESSIONS_ROOT/${instr4%/}/codex-"*".instructions.md"
[[ -f "$instr_file4" ]] || { echo "[smoke-start-docs-success] instructions file not found (case4)" >&2; exit 1; }
grep -q 'path="docs/technical/a.md"' "$instr_file4" || { echo "[smoke-start-docs-success] missing a.md in instructions (case4)" >&2; exit 1; }
grep -q 'path="docs/more/nested/n.md"' "$instr_file4" || { echo "[smoke-start-docs-success] missing nested n.md (case4)" >&2; exit 1; }

popd >/dev/null

echo "[smoke-start-docs-success] PASS"

