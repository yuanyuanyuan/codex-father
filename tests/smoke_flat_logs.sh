#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

# Stub codex to capture argv (and succeed)
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

sess_root="$tmpdir/sessions"
mkdir -p "$sess_root"

# Flat logs should write directly to CODEX_LOG_DIR
CODEX_LOG_DIR="$sess_root" ./start.sh \
  --flat-logs \
  --tag flat \
  --task "flat logs test" \
  --json >/dev/null

# Expect a single-level log file codex-<ts>-flat.log in sess_root
log_file=$(compgen -G "$sess_root/codex-*-flat.log" || true)
[[ -n "${log_file:-}" ]] || { echo "[smoke-flat-logs] missing flat log file in $sess_root" >&2; exit 1; }

# Ensure no nested exec-* subdir with job.log exists
if compgen -G "$sess_root/exec-*/job.log" >/dev/null; then
  echo "[smoke-flat-logs] unexpected nested exec-* directory created under flat logs" >&2
  exit 1
fi

echo "[smoke-flat-logs] PASS"

