#!/usr/bin/env bash
set -euo pipefail

SESSION_ID="smoke-$(date +%s)"
OUT_JSON=$(SESSION_ID="$SESSION_ID" npm run -s demo:orchestrate -- --tasks 2 --pattern chain --concurrency 2)
printf '%s
' "$OUT_JSON"

events_path=$(printf '%s' "$OUT_JSON" | sed -n 's/.*"eventsPath"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')
if [[ -z "$events_path" ]]; then
  echo "Failed to parse eventsPath from output" >&2
  exit 2
fi

if [[ ! -f "$events_path" ]]; then
  echo "events.jsonl not found at $events_path" >&2
  exit 3
fi

head -n 5 "$events_path" || true

grep -q 'orchestration_completed' "$events_path" || { echo "orchestration_completed not found" >&2; exit 4; }

echo "Smoke OK: $events_path"
