#!/usr/bin/env bash

# 目的：作为“start.* 真实调用”用例集合的执行器（wrapper）。
# 说明：遵循“一用例一文件”，本脚本仅顺序调用子用例，便于一键运行。

if [ -z "${BASH_VERSION:-}" ]; then exec bash "$0" "$@"; fi
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"

tests=(
  e2e_start_base_real_codex.sh
  e2e_start_args_passthrough_real_codex.sh
  e2e_start_docs_real_codex.sh
  e2e_start_patchmode_real_codex.sh
  e2e_start_redact_real_codex.sh
  e2e_start_write_file_real_codex.sh
)

fail=0
for t in "${tests[@]}"; do
  echo "[e2e-start-wrapper] RUN tests/${t}"
  if ! bash "${ROOT_DIR}/tests/${t}"; then
    echo "[e2e-start-wrapper] FAIL tests/${t}" >&2
    fail=1
  fi
done

if (( fail == 0 )); then
  echo "[e2e-start-wrapper] ALL PASS"
else
  echo "[e2e-start-wrapper] SOME FAILED" >&2
  exit 1
fi
