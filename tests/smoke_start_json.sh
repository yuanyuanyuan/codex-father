#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "[smoke-start-json] missing command: $1" >&2; exit 1; }; }

require_cmd jq

cd "$ROOT_DIR"

out="$('./start.sh' --task "smoke json test" --dry-run --json)"

echo "$out" | jq -e . >/dev/null 2>&1 || { echo "[smoke-start-json] output is not valid JSON" >&2; exit 1; }

exit_code=$(printf '%s' "$out" | jq -r '.exit_code // empty')
log_file=$(printf '%s' "$out" | jq -r '.log_file // empty')
instr_file=$(printf '%s' "$out" | jq -r '.instructions_file // empty')

[[ "$exit_code" == "0" ]] || { echo "[smoke-start-json] exit_code != 0: $exit_code" >&2; exit 1; }
[[ -f "$log_file" ]] || { echo "[smoke-start-json] log file not found: $log_file" >&2; exit 1; }
[[ -f "$instr_file" ]] || { echo "[smoke-start-json] instructions file not found: $instr_file" >&2; exit 1; }

echo "[smoke-start-json] PASS"

