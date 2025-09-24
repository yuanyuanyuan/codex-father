#!/usr/bin/env bash

apply_preset() {
  local name="$1"
  case "$name" in
    sprint)
      # Multi-iteration until CONTROL: DONE with sensible defaults
      REPEAT_UNTIL=${REPEAT_UNTIL:-'CONTROL: DONE'}
      MAX_RUNS=${MAX_RUNS:-20}
      SLEEP_SECONDS=${SLEEP_SECONDS:-2}
      # Enable low-friction execution within sandbox
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

