#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# Stub codex to capture argv
stub_bin="$tmpdir/bin"
mkdir -p "$stub_bin"
cat > "$stub_bin/codex" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
echo "STUB_CODEX: begin"
for a in "$@"; do
  printf 'ARG: %s\n' "$a"
done
echo "STUB_CODEX: end"
exit 0
SH
chmod +x "$stub_bin/codex"

export PATH="${stub_bin}:$PATH"

log="$tmpdir/job.log"

# Use -- to pass through raw args. Also add --json to keep quiet output.
CODEX_LOG_FILE="$log" ./start.sh \
  --task "passthrough" \
  -- --profile dev --sandbox workspace-write --full-auto --ask-for-approval never --config foo.bar=1 \
  --json >/dev/null

[[ -f "$log" ]] || { echo "[smoke-ddash] missing log: $log" >&2; exit 1; }

grep -F -- "STUB_CODEX: begin" "$log" >/dev/null || { echo "[smoke-ddash] stub did not run" >&2; exit 1; }
grep -F -- "ARG: --profile" "$log" >/dev/null || { echo "[smoke-ddash] missing --profile" >&2; exit 1; }
grep -F -- "ARG: dev" "$log" >/dev/null || { echo "[smoke-ddash] missing profile value" >&2; exit 1; }
grep -F -- "ARG: --sandbox" "$log" >/dev/null || { echo "[smoke-ddash] missing --sandbox" >&2; exit 1; }
grep -F -- "ARG: workspace-write" "$log" >/dev/null || { echo "[smoke-ddash] missing sandbox value" >&2; exit 1; }
grep -F -- "ARG: --full-auto" "$log" >/dev/null || { echo "[smoke-ddash] missing --full-auto" >&2; exit 1; }
grep -F -- "ARG: --ask-for-approval" "$log" >/dev/null || { echo "[smoke-ddash] missing ask-for-approval" >&2; exit 1; }
grep -F -- "ARG: never" "$log" >/dev/null || { echo "[smoke-ddash] missing approval value" >&2; exit 1; }
grep -F -- "ARG: --config" "$log" >/dev/null || { echo "[smoke-ddash] missing --config" >&2; exit 1; }
grep -F -- "ARG: foo.bar=1" "$log" >/dev/null || { echo "[smoke-ddash] missing config kv" >&2; exit 1; }

echo "[smoke-ddash] PASS"

