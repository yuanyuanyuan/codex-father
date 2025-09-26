#!/usr/bin/env bash

set -euo pipefail

# 说明：在 Docker 容器中运行“真实写文件”的 E2E 用例，规避本机沙箱/审批限制。
# 依赖：已安装 Docker；本机可执行 codex CLI（默认会挂载到容器 /usr/local/bin/codex）。

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

IMAGE_TAG="codex-father-dev:latest"
BUILD_CONTEXT=".devcontainer"

if ! command -v docker >/dev/null 2>&1; then
  echo "[container-e2e] 缺少 docker 命令" >&2
  exit 2
fi

echo "[container-e2e] 构建镜像 ${IMAGE_TAG} …"
docker build -t "$IMAGE_TAG" "$BUILD_CONTEXT"

# 尝试挂载宿主 codex 二进制
CODEX_HOST_BIN="$(command -v codex || true)"
CODEX_MOUNT_ARGS=()
if [[ -n "$CODEX_HOST_BIN" && -x "$CODEX_HOST_BIN" ]]; then
  echo "[container-e2e] 将挂载宿主 codex: $CODEX_HOST_BIN"
  CODEX_MOUNT_ARGS=("-v" "$CODEX_HOST_BIN:/usr/local/bin/codex:ro")
else
  echo "[container-e2e] 警告：未找到宿主 codex，可在容器内自行安装后重试" >&2
fi

RUN_CMD=${1:-}
if [[ -z "$RUN_CMD" ]]; then
  # 默认执行写文件类 E2E
  RUN_CMD="bash -lc 'bash tests/e2e_start_write_file_real_codex.sh && bash tests/e2e_job_write_file_real_codex.sh'"
else
  # 允许用户传入自定义命令
  RUN_CMD="bash -lc ${RUN_CMD@Q}"
fi

echo "[container-e2e] 运行命令: $RUN_CMD"
docker run --rm -it \
  -v "$ROOT_DIR":/workspaces/codex-father \
  -w /workspaces/codex-father \
  -e CODEX_SESSIONS_ROOT=/workspaces/codex-father/.codex-father/sessions \
  "${CODEX_MOUNT_ARGS[@]}" \
  "$IMAGE_TAG" \
  /bin/bash -lc "$RUN_CMD"

