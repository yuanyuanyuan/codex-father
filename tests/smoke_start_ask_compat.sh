#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

tmpdir="$(mktemp -d)"; trap 'rm -rf "$tmpdir"' EXIT

# Stub codex to capture argv into the start.sh log via stdout piping
stub_bin="$tmpdir/bin"; mkdir -p "$stub_bin"
cat > "$stub_bin/codex" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
echo "STUB_CODEX: begin"
for a in "$@"; do printf 'ARG: %s\n' "$a"; done
echo "STUB_CODEX: end"
exit 0
SH
chmod +x "$stub_bin/codex"
export PATH="${stub_bin}:$PATH"

# Case A: direct --ask-for-approval
log1="$tmpdir/log1.txt"
CODEX_LOG_FILE="$log1" ./start.sh --task "ask-direct" \
  --ask-for-approval never --sandbox workspace-write --json >/dev/null

grep -F -- "STUB_CODEX: begin" "$log1" >/dev/null || { echo "[ask-compat] stub did not run (A)" >&2; exit 1; }
grep -F -- "ARG: --ask-for-approval" "$log1" >/dev/null || { echo "[ask-compat] missing --ask-for-approval (A)" >&2; exit 1; }
grep -F -- "ARG: never" "$log1" >/dev/null || { echo "[ask-compat] missing value 'never' (A)" >&2; exit 1; }

# Case B: legacy --approval-mode -> --ask-for-approval
log2="$tmpdir/log2.txt"
CODEX_LOG_FILE="$log2" ./start.sh --task "ask-legacy1" \
  --approval-mode on-request --sandbox workspace-write --json >/dev/null

grep -F -- "ARG: --ask-for-approval" "$log2" >/dev/null || { echo "[ask-compat] missing --ask-for-approval (B)" >&2; exit 1; }
grep -F -- "ARG: on-request" "$log2" >/dev/null || { echo "[ask-compat] missing value 'on-request' (B)" >&2; exit 1; }

# Case C: legacy --approvals -> --ask-for-approval
log3="$tmpdir/log3.txt"
CODEX_LOG_FILE="$log3" ./start.sh --task "ask-legacy2" \
  --approvals untrusted --sandbox workspace-write --json >/dev/null

grep -F -- "ARG: --ask-for-approval" "$log3" >/dev/null || { echo "[ask-compat] missing --ask-for-approval (C)" >&2; exit 1; }
grep -F -- "ARG: untrusted" "$log3" >/dev/null || { echo "[ask-compat] missing value 'untrusted' (C)" >&2; exit 1; }

echo "[smoke-start-ask-compat] PASS"

