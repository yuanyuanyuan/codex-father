#!/usr/bin/env bash
set -euo pipefail

# Minimal placeholder to satisfy pre-push hook in CI/automation contexts.
# If a stricter bilingual docs policy is desired, implement checks here.
# Current behavior: detect README pair additions in staging and warn only.

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  exit 0
fi

changed=$(git status --porcelain)
warn=0
if echo "$changed" | grep -E '(^|\s)A\s+README\.en\.md' >/dev/null; then
  echo "[bilingual-check] README.en.md added; ensure README.md is updated accordingly." >&2
  warn=1
fi
if echo "$changed" | grep -E '(^|\s)A\s+docs/.+\.en\.md' >/dev/null; then
  echo "[bilingual-check] English doc added under docs/; ensure corresponding non-en version is paired." >&2
  warn=1
fi

# Non-blocking for now; switch to 'exit 1' to enforce strictly.
exit 0

