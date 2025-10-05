#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for segment in 00_bootstrap 01_commands 02_main; do
  module="${SCRIPT_DIR}/job.d/${segment}.sh"
  if [[ ! -f "${module}" ]]; then
    echo "错误: 缺少模块 ${module}" >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  . "${module}"
done
