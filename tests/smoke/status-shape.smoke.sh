#!/usr/bin/env bash
set -euo pipefail

file="docs/schemas/examples/status-running.json"
command -v jq >/dev/null 2>&1 || { echo "jq is required" >&2; exit 1; }

test_field() {
  local path="$1"; local type="$2"
  local q; q=$(jq -e ".${path} | type == \"${type}\"" "$file" 2>/dev/null || echo false)
  if [[ "$q" != "true" ]]; then
    echo "[FAIL] .${path} is not ${type}" >&2; exit 1
  fi
}

test_field "id" "string"
test_field "state" "string"
test_field "cwd" "string"
test_field "created_at" "string"
test_field "updated_at" "string"
test_field "progress" "object"
test_field "progress.current" "number"
test_field "progress.total" "number"
test_field "progress.percentage" "number"

echo "[OK] status-running.json shape looks valid"

