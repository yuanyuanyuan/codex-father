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
"$START_SH" --dry-run --flat-logs --tag docs-glob \
  --docs "docs/technical/*.md" "docs/more/*.markdown" >/dev/null 2>&1 || true

instr1=$(find "$CODEX_SESSIONS_ROOT" -maxdepth 1 -type d -name "exec-*docs-glob*" | head -n1)
instr_file1="$instr1/job.instructions.md"
[[ -f "$instr_file1" ]] || instr_file1=$(find "$instr1" -maxdepth 1 -type f -name "*.instructions.md" | head -n1)
[[ -f "$instr_file1" ]] || { echo "[smoke-start-docs-success] instructions file not found (case1)" >&2; exit 1; }
grep -q 'path="docs/technical/a.md"' "$instr_file1" || { echo "[smoke-start-docs-success] missing a.md in instructions (case1)" >&2; exit 1; }
grep -q 'path="docs/more/b.markdown"' "$instr_file1" || { echo "[smoke-start-docs-success] missing b.markdown in instructions (case1)" >&2; exit 1; }

# Case 2: --docs-dir recursive
"$START_SH" --dry-run --flat-logs --tag docs-dir --docs-dir docs >/dev/null 2>&1 || true

instr2=$(find "$CODEX_SESSIONS_ROOT" -maxdepth 1 -type d -name "exec-*docs-dir*" | head -n1)
instr_file2="$instr2/job.instructions.md"
[[ -f "$instr_file2" ]] || instr_file2=$(find "$instr2" -maxdepth 1 -type f -name "*.instructions.md" | head -n1)
[[ -f "$instr_file2" ]] || { echo "[smoke-start-docs-success] instructions file not found (case2)" >&2; exit 1; }
grep -q 'path="docs/technical/a.md"' "$instr_file2" || { echo "[smoke-start-docs-success] missing a.md in instructions (case2)" >&2; exit 1; }
grep -q 'path="docs/more/b.markdown"' "$instr_file2" || { echo "[smoke-start-docs-success] missing b.markdown in instructions (case2)" >&2; exit 1; }
grep -q 'path="docs/more/nested/n.md"' "$instr_file2" || { echo "[smoke-start-docs-success] missing nested n.md (case2)" >&2; exit 1; }

# Case 3: @list file
"$START_SH" --dry-run --flat-logs --tag docs-list --docs @docs-list.txt >/dev/null 2>&1 || true

instr3=$(find "$CODEX_SESSIONS_ROOT" -maxdepth 1 -type d -name "exec-*docs-list*" | head -n1)
instr_file3="$instr3/job.instructions.md"
[[ -f "$instr_file3" ]] || instr_file3=$(find "$instr3" -maxdepth 1 -type f -name "*.instructions.md" | head -n1)
[[ -f "$instr_file3" ]] || { echo "[smoke-start-docs-success] instructions file not found (case3)" >&2; exit 1; }
grep -q 'path="docs/technical/a.md"' "$instr_file3" || { echo "[smoke-start-docs-success] missing a.md in instructions (case3)" >&2; exit 1; }
grep -q 'path="docs/more/b.markdown"' "$instr_file3" || { echo "[smoke-start-docs-success] missing b.markdown in instructions (case3)" >&2; exit 1; }

# Case 4: ** globstar
"$START_SH" --dry-run --flat-logs --tag docs-globstar --docs "docs/**/*.md" >/dev/null 2>&1 || true

instr4=$(find "$CODEX_SESSIONS_ROOT" -maxdepth 1 -type d -name "exec-*docs-globstar*" | head -n1)
instr_file4="$instr4/job.instructions.md"
[[ -f "$instr_file4" ]] || instr_file4=$(find "$instr4" -maxdepth 1 -type f -name "*.instructions.md" | head -n1)
[[ -f "$instr_file4" ]] || { echo "[smoke-start-docs-success] instructions file not found (case4)" >&2; exit 1; }
grep -q 'path="docs/technical/a.md"' "$instr_file4" || { echo "[smoke-start-docs-success] missing a.md in instructions (case4)" >&2; exit 1; }
grep -q 'path="docs/more/nested/n.md"' "$instr_file4" || { echo "[smoke-start-docs-success] missing nested n.md (case4)" >&2; exit 1; }

popd >/dev/null

echo "[smoke-start-docs-success] PASS"
