#!/usr/bin/env bash
set -euo pipefail

SESSION_START=0
if [[ "${1:-}" == "--session-start" ]]; then
  SESSION_START=1
  shift
fi

payload_file=$(mktemp)
trap 'rm -f "$payload_file"' EXIT

if [ -t 0 ]; then
  printf '{}' >"$payload_file"
else
  cat >"$payload_file"
fi

# Ensure jq is available for payload parsing; skip silently if missing.
if ! command -v jq >/dev/null 2>&1; then
  echo "[docs-maintainer-hook] jq not found; skipping." >&2
  exit 0
fi

# Guard against running outside a git repository.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[docs-maintainer-hook] Not inside a git repository; skipping." >&2
  exit 0
fi

repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

state_dir=".claude/hooks/docs-maintainer"
mkdir -p "$state_dir"
log_file="$state_dir/hook.log"
context_file="$state_dir/last-context.md"
prompt_file="$state_dir/last-prompt.md"

timestamp=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
tool_name=$(jq -r '.tool_name // ""' "$payload_file")
tool_desc=$(jq -r '.tool_input.description // .tool_input.reason // ""' "$payload_file")

# Collect paths referenced in the payload (edits, writes, uploads).
mapfile -t payload_paths < <(jq -r '
  [
    .tool_input.file_path?,
    .tool_input.path?,
    (.tool_input.file_paths // [])[],
    (.tool_input.paths // [])[],
    (.tool_input.files // [])[]?.path?,
    (.tool_input.edits // [])[]?.path?,
    (.tool_input.operations // [])[]?.path?,
    (.tool_input.documents // [])[]?,
    (.tool_result.files_written // [])[]?.path?,
    (.tool_result.documents // [])[]?
  ]
  | map(select(type == "string" and length > 0))
  | unique[]
' "$payload_file" 2>/dev/null || true)

# Capture git status snapshots.
status_short=$(git status --short)
status_z=$(git status --porcelain -z)
if [[ -z "$status_short" && ${#payload_paths[@]} -eq 0 ]]; then
  # Nothing to do.
  exit 0
fi

diff_stat=$(git diff --stat=200 || true)

# Derive candidate documentation files from git status.
declare -a target_docs=()
if [[ -n "$status_z" ]]; then
  while IFS= read -r -d '' entry; do
    # Each entry begins with two status characters.
    path="${entry:3}"
    case "$path" in
      docs/*|AGENTS.md|CLAUDE.md|test-plan.md)
        target_docs+=("$path")
        ;;
    esac
  done < <(git status --porcelain -z)
fi
# Also include markdown files referenced directly by the payload.
for candidate in "${payload_paths[@]}"; do
  if [[ "$candidate" == *.md ]]; then
    target_docs+=("$candidate")
  fi
done

# De-duplicate target docs while preserving order.
if ((${#target_docs[@]} > 0)); then
  declare -A seen
  declare -a deduped=()
  for doc in "${target_docs[@]}"; do
    if [[ -n "$doc" && -z "${seen[$doc]:-}" ]]; then
      seen[$doc]=1
      deduped+=("$doc")
    fi
  done
  target_docs=("${deduped[@]}")
fi

# Build the context file consumed by the subagent.
{
  echo "# Trigger Summary"
  echo "- Timestamp: $timestamp"
  echo "- Session start: $SESSION_START"
  echo "- Tool: ${tool_name:-unknown}"
  if [[ -n "$tool_desc" && "$tool_desc" != "null" ]]; then
    echo "- Tool description: $tool_desc"
  fi
  if ((${#payload_paths[@]} > 0)); then
    echo "- Payload paths:"
    for p in "${payload_paths[@]}"; do
      echo "  - $p"
    done
  fi
  echo
  echo "# Changed Files"
  if [[ -n "$status_short" ]]; then
    echo '```'
    echo "$status_short"
    echo '```'
  else
    echo "None detected by git status."
  fi
  echo
  echo "# Git Diff Stat"
  if [[ -n "$diff_stat" ]]; then
    echo '```'
    echo "$diff_stat"
    echo '```'
  else
    echo "No diff output (working tree clean)."
  fi
  echo
  echo "# Target Docs"
  if ((${#target_docs[@]} > 0)); then
    for doc in "${target_docs[@]}"; do
      echo "- $doc"
    done
  else
    echo "- None identified yet."
  fi
  echo
  echo "# External Inputs"
  if ((${#payload_paths[@]} > 0)); then
    for p in "${payload_paths[@]}"; do
      if [[ "$p" != docs/* && "$p" != *.md ]]; then
        echo "- $p"
      fi
    done
  else
    echo "- None provided."
  fi
  if ((${#target_docs[@]} > 0)); then
    echo
    echo "# Doc Diff Preview"
    for doc in "${target_docs[@]}"; do
      if [[ -f "$doc" ]]; then
        echo "## $doc"
        git diff --no-color --unified=5 -- "$doc" | head -n 200
        echo
      fi
    done
  fi
} >"$context_file"

# Compose the prompt for the docs-maintenance-expert subagent.
{
  echo "You are docs-maintenance-expert. Use the repository context below to update documentation incrementally."
  echo
  cat "$context_file"
} >"$prompt_file"

echo "[$timestamp] Hook captured context -> $context_file" >>"$log_file"

# Determine execution command for the subagent.
run_template="${DOCS_MAINTAINER_SUBAGENT_CMD:-}"
if [[ -z "$run_template" ]] && command -v claude >/dev/null 2>&1; then
  run_template='claude subagents run docs-maintenance-expert --input-file "%PROMPT_FILE%" --non-interactive'
fi

if [[ -n "$run_template" ]]; then
  run_cmd=${run_template//%PROMPT_FILE%/$prompt_file}
  run_cmd=${run_cmd//%CONTEXT_FILE%/$context_file}
  if ! bash -lc "$run_cmd" >>"$log_file" 2>&1; then
    echo "[$timestamp] Auto invocation failed: $run_cmd" >>"$log_file"
  else
    echo "[$timestamp] Auto invocation completed." >>"$log_file"
  fi
else
  echo "[$timestamp] No subagent command configured; prompt saved to $prompt_file" >>"$log_file"
fi
