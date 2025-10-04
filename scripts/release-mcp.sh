#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_ROOT_DIR}"

MCP_DIR="mcp/codex-mcp-server"
DOC_VERSION_FILE="docs/VERSION_MCP_1.2.0.md"
DOC_FLOW_FILE="docs/RELEASE_FLOW_MCP.md"

usage() {
  cat <<'EOF'
用法: scripts/release-mcp.sh [--preflight|--dry-run|--local|--ci|--ci-commit-docs]

选项:
  --preflight       仅执行质量门禁与子包构建
  --dry-run         语义化发布预览，不写入、不发版
  --local           本地发版（需要 GITHUB_TOKEN 与 NPM_TOKEN）
  --ci              推送到 main 触发 CI（工作区必须干净，交互确认）
  --ci-commit-docs  仅提交文档与脚本后推送 main（交互确认）

说明:
  - 该脚本只发布 MCP 子包：@starkdev020/codex-father-mcp-server
  - 语义化发版配置见 .releaserc，标签格式 mcp-vX.Y.Z
EOF
}

confirm_risky() {
  local op="$1"; shift
  local scope="$1"; shift
  local risk="$1"; shift
  echo "⚠️ 危险操作检测喵～"
  echo "操作类型：${op}"
  echo "影响范围：${scope}"
  echo "风险评估：${risk}"
  echo -n "(有点紧张呢，请确认是否继续？) [是/确认/继续]: "
  read -r ans
  case "${ans}" in
    是|确认|继续) ;;
    *) echo "已取消。"; exit 1;;
  esac
}

require_file() {
  local p="$1"
  if [[ ! -f "$p" ]]; then
    echo "[错误] 缺少文件: $p" >&2
    exit 1
  fi
}

require_dir() {
  local d="$1"
  if [[ ! -d "$d" ]]; then
    echo "[错误] 缺少目录: $d" >&2
    exit 1
  fi
}

preflight() {
  echo "[1/3] 质量门禁: npm run check:all"
  npm run check:all

  echo "[2/3] 子包安装依赖: (cd ${MCP_DIR} && npm ci)"
  (cd "${MCP_DIR}" && npm ci)

  echo "[3/3] 子包构建: (cd ${MCP_DIR} && npm run build)"
  (cd "${MCP_DIR}" && npm run build)

  echo "[✓] 预检完成"
}

ensure_docs() {
  # 文档存在性检查（不强制生成，仅提示）
  if [[ -f "${DOC_VERSION_FILE}" && -f "${DOC_FLOW_FILE}" ]]; then
    echo "[docs] 已检测到发布文档: ${DOC_VERSION_FILE} / ${DOC_FLOW_FILE}"
  else
    echo "[docs] 提示: 建议补齐发布文档: ${DOC_VERSION_FILE} 与 ${DOC_FLOW_FILE}" >&2
  fi
}

sr_install() {
  echo "[semantic-release] 安装工具（no-save）"
  npm i --no-save \
    semantic-release \
    @semantic-release/commit-analyzer \
    @semantic-release/release-notes-generator \
    @semantic-release/changelog \
    @semantic-release/exec \
    @semantic-release/git \
    @semantic-release/github
}

sr_dry_run() {
  sr_install
  echo "[semantic-release] dry-run 预览"
  npx semantic-release --dry-run
}

sr_local() {
  : "${GITHUB_TOKEN:?需要设置 GITHUB_TOKEN 环境变量}"
  : "${NPM_TOKEN:?需要设置 NPM_TOKEN 环境变量}"
  sr_install
  echo "[semantic-release] 本地发布开始"
  npx semantic-release
}

ci_push() {
  # 确保在 main
  local branch
  branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "${branch}" != "main" ]]; then
    echo "[错误] 当前分支为 ${branch}，请切换到 main 后再试。" >&2
    exit 1
  fi

  # 工作区必须干净，避免误提交构建产物（如 *.tgz / .tsbuildinfo）
  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "[错误] 工作区存在未提交变更。请先手动提交，或使用 --ci-commit-docs 仅提交文档与脚本。" >&2
    git status --porcelain || true
    exit 1
  fi

  confirm_risky \
    "推送到 main 触发 CI 发布" \
    "推送 main 将触发语义化发版到 GitHub 与 npmjs（若配置 NPM_TOKEN）" \
    "此操作会创建新版本，且不可逆"

  git push origin main

  echo "[✓] 已推送到 main，等待 GitHub Actions 完成发布。"
}

ci_commit_docs_and_push() {
  # 确保在 main
  local branch
  branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "${branch}" != "main" ]]; then
    echo "[错误] 当前分支为 ${branch}，请切换到 main 后再试。" >&2
    exit 1
  fi

  confirm_risky \
    "提交文档与脚本并推送 main 触发 CI 发布" \
    "仅提交 README.md、docs/**/*.md、scripts/release-mcp.sh、package.json、.gitignore、config/templates/codex-father.env.example" \
    "将触发语义化发版到 GitHub 与 npmjs（若配置 NPM_TOKEN），忽略 *.tgz 与构建产物"

  # 有选择地提交文档与脚本
  git add README.md || true
  git add docs || true
  git add scripts/release-mcp.sh || true
  git add package.json || true
  git add .gitignore || true
  git add config/templates/codex-father.env.example || true

  if git diff --cached --quiet; then
    echo "[提示] 暂存区无可提交的文档/脚本更改，已取消。"
    exit 0
  fi

  git commit -m "docs(release): update MCP release docs & script"
  git push origin main
  echo "[✓] 已推送到 main，等待 GitHub Actions 完成发布。"
}

main() {
  require_file package.json
  require_dir "${MCP_DIR}"

  local mode=""
  mode=${1:-}

  case "${mode}" in
    --preflight)
      preflight
      ensure_docs
      ;;
    --dry-run)
      preflight
      ensure_docs
      sr_dry_run
      ;;
    --local)
      preflight
      ensure_docs
      confirm_risky \
        "本地语义化发布 (semantic-release)" \
        "写入 mcp 子包版本与 CHANGELOG + 发布 npmjs + 创建 GitHub Release" \
        "需要本地 GITHUB_TOKEN/NPM_TOKEN，操作不可逆"
      sr_local
      ;;
    --ci)
      preflight
      ensure_docs
      ci_push
      ;;
    --ci-commit-docs)
      preflight
      ensure_docs
      ci_commit_docs_and_push
      ;;
    *)
      usage
      ;;
  esac
}

main "$@"
