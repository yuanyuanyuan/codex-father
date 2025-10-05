#!/usr/bin/env bash
set -euo pipefail

run_full() {
  npx vitest run "$@"
}

run_related() {
  # Collect changed files relative to HEAD
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && git rev-parse --verify HEAD >/dev/null 2>&1; then
    mapfile -t ALL_CHANGED < <(git diff --name-only --diff-filter=ACMRTUXB HEAD -- . 2>/dev/null || true)
  else
    ALL_CHANGED=()
  fi

  # Determine if code areas changed (core/src/tests)
  CODE_CHANGED=()
  for f in "${ALL_CHANGED[@]:-}"; do
    if [[ "$f" =~ ^(core/|src/|tests/) ]]; then
      CODE_CHANGED+=("$f")
    fi
  done

  # If no code changes, skip tests entirely
  if (( ${#CODE_CHANGED[@]} == 0 )); then
    echo "[test-smart] No code changes detected (core/src/tests). Skipping tests."
    return 0
  fi

  # Filter to existing files only
  EXISTING=()
  for f in "${CODE_CHANGED[@]}"; do
    [[ -f "$f" ]] && EXISTING+=("$f")
  done

  if (( ${#EXISTING[@]} == 0 )); then
    # Code paths changed but files not present (renames/deletes) → run full
    run_full "$@"
    return
  fi

  # Use vitest related for precision
  npx vitest related "${EXISTING[@]}"
}

# Prefer precision run when we can detect relevant changes, otherwise full
run_related "$@" || run_full "$@"
