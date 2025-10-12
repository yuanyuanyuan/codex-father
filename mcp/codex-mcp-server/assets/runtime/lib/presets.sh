#!/usr/bin/env bash

apply_preset() {
  local name="$1"
  case "$name" in
    sprint)
      # Single-run, low-friction execution within sandbox
      CODEX_GLOBAL_ARGS+=("--full-auto")
      CODEX_GLOBAL_ARGS+=("--config" 'execution.auto_continue=true')
      CODEX_GLOBAL_ARGS+=("--config" 'execution.max_consecutive_steps=200')
      CODEX_GLOBAL_ARGS+=("--config" 'execution.timebox_minutes=60')
      ;;
    analysis)
      # Single run, keep output concise in log
      CODEX_ECHO_INSTRUCTIONS_LIMIT=${CODEX_ECHO_INSTRUCTIONS_LIMIT:-200}
      ;;
    secure)
      # Redact output by default
      REDACT_ENABLE=1
      # Patch preview: secure preset prefers no preview unless user explicitly set
      if [[ -z "${PATCH_PREVIEW_USER_SET:-}" ]]; then
        PATCH_PREVIEW_LINES=0
      fi
      ;;
    fast)
      CODEX_GLOBAL_ARGS+=("--config" 'execution.timebox_minutes=5')
      CODEX_GLOBAL_ARGS+=("--config" 'execution.max_consecutive_steps=20')
      ;;
    *)
      echo "[preset] 未知预设: ${name}" >&2
      return 1
      ;;
  esac
}
