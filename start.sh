#!/usr/bin/env bash

set -euo pipefail

# 保留原始 CLI 参数以便日志调试
ORIG_ARGV=("$@")
# 提升通配符能力（支持 **）
shopt -s globstar

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

for segment in 00_bootstrap 01_cli 02_prepare 03_finalize; do
  module="${SCRIPT_DIR}/start.d/${segment}.sh"
  if [[ ! -f "${module}" ]]; then
    echo "错误: 缺少模块 ${module}" >&2
    exit 1
  fi
  # shellcheck disable=SC1090
  . "${module}"
done
