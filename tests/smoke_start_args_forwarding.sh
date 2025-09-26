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

# Run start.sh without --dry-run so that stubbed codex is invoked
CODEX_LOG_FILE="$log" ./start.sh \
  --task "ArgFwd" \
  --approval-mode never \
  --sandbox workspace-write \
  --full-auto \
  --profile dev \
  --codex-config 'sandbox_workspace_write.network_access=true' \
  --codex-config 'foo.bar="baz"' \
  --codex-config 'a_number=42' \
  --codex-config 'a_bool=true' \
  --json >/dev/null

[[ -f "$log" ]] || { echo "[smoke-start-args] missing log: $log" >&2; exit 1; }

grep -F -- "STUB_CODEX: begin" "$log" >/dev/null || { echo "[smoke-start-args] stub did not run" >&2; exit 1; }
grep -F -- "ARG: --sandbox" "$log" >/dev/null || { echo "[smoke-start-args] missing --sandbox" >&2; exit 1; }
grep -F -- "ARG: workspace-write" "$log" >/dev/null || { echo "[smoke-start-args] missing sandbox value" >&2; exit 1; }
grep -F -- "ARG: --config" "$log" >/dev/null || { echo "[smoke-start-args] missing --config entries" >&2; exit 1; }
grep -F -- "ARG: --ask-for-approval" "$log" >/dev/null || { echo "[smoke-start-args] missing --ask-for-approval" >&2; exit 1; }
grep -F -- "ARG: never" "$log" >/dev/null || { echo "[smoke-start-args] missing approval policy value" >&2; exit 1; }
grep -F -- "ARG: sandbox_workspace_write.network_access=true" "$log" >/dev/null || { echo "[smoke-start-args] missing network config" >&2; exit 1; }
grep -F -- "ARG: --full-auto" "$log" >/dev/null || { echo "[smoke-start-args] missing --full-auto" >&2; exit 1; }
grep -F -- "ARG: --profile" "$log" >/dev/null || { echo "[smoke-start-args] missing --profile" >&2; exit 1; }
grep -F -- "ARG: dev" "$log" >/dev/null || { echo "[smoke-start-args] missing profile value" >&2; exit 1; }
grep -F -- 'ARG: foo.bar="baz"' "$log" >/dev/null || { echo "[smoke-start-args] missing codexConfig string kv" >&2; exit 1; }
grep -F -- "ARG: a_number=42" "$log" >/dev/null || { echo "[smoke-start-args] missing codexConfig number kv" >&2; exit 1; }
grep -F -- "ARG: a_bool=true" "$log" >/dev/null || { echo "[smoke-start-args] missing codexConfig boolean kv" >&2; exit 1; }

echo "[smoke-start-args] PASS"
