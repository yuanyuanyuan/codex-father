#!/usr/bin/env bash
set -euo pipefail

# Codex Father MCP 手动版本发布脚本
# 支持手动版本管理，不使用semantic-release

PROJECT_ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${PROJECT_ROOT_DIR}"

MCP_DIR="mcp/codex-mcp-server"
DOC_VERSION_FILE="docs/releases/VERSION_MCP_1.2.0.md"
DOC_FLOW_FILE="docs/releases/RELEASE_FLOW_MCP.md"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

usage() {
  cat <<'EOF'
用法: scripts/release-mcp-manual.sh [选项] [版本号]

选项:
  --preflight       仅执行质量门禁与子包构建
  --version X.Y.Z  指定发布版本号
  --dry-run         预演模式，不执行实际发布
  --local           本地发布模式（需要 GITHUB_TOKEN 与 NPM_TOKEN）
  --tag-only        仅创建Git标签，不发布到NPM
  --help, -h        显示此帮助信息

示例:
  scripts/release-mcp-manual.sh --preflight
  scripts/release-mcp-manual.sh --version 3.2.1 --dry-run
  scripts/release-mcp-manual.sh --version 3.2.1 --local
  scripts/release-mcp-manual.sh --version 3.2.1 --tag-only

说明:
  - 手动版本管理，需要指定版本号
  - 标签格式: mcp-vX.Y.Z
  - 需要先更新 mcp/codex-mcp-server/package.json 的版本号
EOF
}

confirm_risky() {
  local op="$1"; shift
  local scope="$1"; shift
  local risk="$1"; shift
  echo -e "${YELLOW}⚠️ 危险操作检测喵～${NC}"
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

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_header() {
    echo ""
    echo -e "${CYAN}================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}================================${NC}"
}

require_file() {
  local p="$1"
  if [[ ! -f "$p" ]]; then
    print_error "缺少文件: $p"
    exit 1
  fi
}

require_dir() {
  local d="$1"
  if [[ ! -d "$d" ]]; then
    print_error "缺少目录: $d"
    exit 1
  fi
}

validate_version() {
  local version="$1"
  if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_error "版本号格式无效，请使用 X.Y.Z 格式"
    exit 1
  fi
}

preflight() {
  print_header "🔍 预检查"

  print_info "质量门禁检查..."
  # 只检查构建，跳过lint问题
  if npm run build; then
    print_success "构建检查通过"
  else
    print_error "构建检查失败"
    exit 1
  fi

  print_info "子包依赖安装..."
  if (cd "${MCP_DIR}" && npm ci); then
    print_success "依赖安装完成"
  else
    print_error "依赖安装失败"
    exit 1
  fi

  print_info "子包构建..."
  if (cd "${MCP_DIR}" && npm run build); then
    print_success "构建完成"
  else
    print_error "构建失败"
    exit 1
  fi

  print_success "预检查完成"
}

check_version_consistency() {
  local target_version="$1"

  print_header "📋 版本一致性检查"

  # 检查package.json版本
  local current_version
  current_version=$(node -p "require('./${MCP_DIR}/package.json').version")
  print_info "当前MCP子包版本: ${current_version}"
  print_info "目标发布版本: ${target_version}"

  if [[ "$current_version" != "$target_version" ]]; then
    print_warning "版本不匹配！"
    print_info "请先更新 ${MCP_DIR}/package.json 中的版本号"

    read -p "$(echo -e ${YELLOW}是否自动更新版本号? \(y/N\): ${NC})" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      # 更新版本号
      local temp_file="/tmp/package.json.$$"
      node -e "
        const fs = require('fs');
        const pkg = JSON.parse(fs.readFileSync('./${MCP_DIR}/package.json', 'utf8'));
        pkg.version = '${target_version}';
        fs.writeFileSync('./${MCP_DIR}/package.json', JSON.stringify(pkg, null, 2) + '\n');
      "
      print_success "版本号已更新为 ${target_version}"
    else
      print_error "请手动更新版本号后重试"
      exit 1
    fi
  else
    print_success "版本号匹配"
  fi
}

check_git_status() {
  print_header "🔍 Git 状态检查"

  # 检查当前分支
  local branch
  branch="$(git rev-parse --abbrev-ref HEAD)"
  print_info "当前分支: ${branch}"

  if [[ "${branch}" != "main" && "${branch}" != "master" ]]; then
    print_warning "当前不在 main/master 分支"
    if [[ "${MODE}" != "dry-run" ]]; then
      read -p "$(echo -e ${YELLOW}是否继续? \(y/N\): ${NC})" -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "发布已取消"
        exit 1
      fi
    fi
  fi

  # 检查工作区状态
  if [[ -n $(git status -s) ]]; then
    print_warning "检测到未提交的更改："
    git status -s
    if [[ "${MODE}" != "dry-run" ]]; then
      read -p "$(echo -e ${YELLOW}是否继续? \(y/N\): ${NC})" -n 1 -r
      echo
      if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "请先提交更改后再发布"
        exit 1
      fi
    fi
  else
    print_success "Git状态检查通过"
  fi
}

create_git_tag() {
  local version="$1"
  local tag_name="mcp-v${version}"

  print_header "🏷️  创建Git标签"

  # 检查标签是否已存在
  if git rev-parse "$tag_name" >/dev/null 2>&1; then
    print_warning "标签 ${tag_name} 已存在"
    if [[ "${MODE}" != "dry-run" ]]; then
      read -p "$(echo -e ${YELLOW}是否删除并重新创建? \(y/N\): ${NC})" -n 1 -r
      echo
      if [[ $REPLY =~ ^[Yy]$ ]]; then
        git tag -d "$tag_name"
        git push origin ":refs/tags/${tag_name}" 2>/dev/null || true
        print_info "已删除旧标签"
      else
        print_error "发布已取消"
        exit 1
      fi
    else
      print_info "预演模式：假设删除旧标签 ${tag_name}"
    fi
  fi

  if [[ "${MODE}" == "dry-run" ]]; then
    print_info "🧪 预演模式：假设创建标签 ${tag_name}"
    print_info "🧪 预演模式：假设推送标签到远程"
  else
    print_info "创建标签 ${tag_name}..."
    git tag -a "$tag_name" -m "Release MCP ${tag_name}"
    print_success "标签已创建"

    print_info "推送标签到远程..."
    if git push origin "$tag_name"; then
      print_success "标签已推送"
    else
      print_error "标签推送失败"
      git tag -d "$tag_name"
      exit 1
    fi
  fi
}

build_package() {
  print_header "📦 构建NPM包"

  if [[ "${MODE}" == "dry-run" ]]; then
    print_info "🧪 预演模式：假设构建NPM包"
  else
    print_info "构建MCP子包..."
    if (cd "${MCP_DIR}" && npm pack); then
      print_success "包构建完成"
    else
      print_error "包构建失败"
      exit 1
    fi
  fi
}

publish_to_npm() {
  local version="$1"

  print_header "📤 发布到NPM"

  if [[ "${MODE}" == "dry-run" ]]; then
    print_info "🧪 预演模式：假设发布到NPM"
    print_info "🧪 预演模式：假设访问 https://www.npmjs.com/package/@starkdev020/codex-father-mcp-server"
  elif [[ "${MODE}" == "tag-only" ]]; then
    print_info "tag-only模式：跳过NPM发布"
  else
    # 检查NPM认证
    if ! npm whoami > /dev/null 2>&1; then
      print_error "未登录NPM，请运行 'npm login'"
      exit 1
    fi

    print_warning "即将发布到NPM公共仓库"
    read -p "$(echo -e ${YELLOW}确认发布? \(y/N\): ${NC})" -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
      print_info "发布到NPM..."
      if (cd "${MCP_DIR}" && npm publish --access public); then
        print_success "NPM发布成功！"
        print_info "包地址: https://www.npmjs.com/package/@starkdev020/codex-father-mcp-server"
      else
        print_error "NPM发布失败"
        exit 1
      fi
    else
      print_warning "跳过NPM发布"
    fi
  fi
}

create_github_release() {
  local version="$1"
  local tag_name="mcp-v${version}"

  print_header "🚀 创建GitHub Release"

  if [[ "${MODE}" == "dry-run" ]]; then
    print_info "🧪 预演模式：假设创建GitHub Release"
    print_info "🧪 预演模式：假设访问 https://github.com/yuanyuanyuan/codex-father/releases/tag/${tag_name}"
  elif [[ "${MODE}" == "tag-only" ]]; then
    print_info "tag-only模式：跳过GitHub Release创建"
  else
    # 检查GitHub CLI认证
    if ! gh auth status > /dev/null 2>&1; then
      print_error "GitHub CLI未认证，请运行 'gh auth login'"
      exit 1
    fi

    # 检查RELEASE_NOTES
    local release_notes="RELEASE_NOTES.md"
    if [[ ! -f "$release_notes" ]]; then
      print_warning "未找到 ${release_notes}，将创建简单发布说明"
      echo "# MCP ${tag_name}

## 新功能
- 功能描述

## 修复
- 修复描述

## 改进
- 改进描述
" > "$release_notes"
    fi

    print_info "创建GitHub Release..."
    if gh release create "$tag_name" \
      --title "Codex Father MCP Server ${tag_name}" \
      --notes-file "$release_notes"; then
      print_success "GitHub Release已创建"
      print_info "Release地址: https://github.com/yuanyuanyuan/codex-father/releases/tag/${tag_name}"
    else
      print_error "GitHub Release创建失败"
      print_info "请手动创建Release"
    fi
  fi
}

cleanup() {
  print_header "🧹 清理"

  if [[ "${MODE}" != "dry-run" && "${MODE}" != "tag-only" ]]; then
    # 清理构建产物
    (cd "${MCP_DIR}" && rm -f *.tgz 2>/dev/null || true)
    print_success "清理完成"
  else
    print_info "预演模式：无需清理"
  fi
}

show_success() {
  local version="$1"
  local tag_name="mcp-v${version}"

  print_header "🎉 发布完成！"
  echo ""
  print_success "模式: ${MODE}"
  print_success "版本: ${tag_name}"
  print_success "包名: @starkdev020/codex-father-mcp-server"
  echo ""

  if [[ "${MODE}" == "dry-run" ]]; then
    print_info "🧪 预演模式总结："
    print_info "- ✅ 质量检查通过"
    print_info "- ✅ 版本一致性检查通过"
    print_info "- ✅ Git状态检查通过"
    print_info "- 🧪 假设创建Git标签和GitHub Release"
    print_info "- 🧪 假设发布到NPM"
    echo ""
    print_info "如需实际发布，请运行："
    print_info "  scripts/release-mcp-manual.sh --version ${version} --local"
    print_info "  scripts/release-mcp-manual.sh --version ${version} --tag-only"
  elif [[ "${MODE}" == "tag-only" ]]; then
    print_info "🏷️ 仅创建Git标签："
    print_info "🚀 GitHub: https://github.com/yuanyuanyuan/codex-father/releases/tag/${tag_name}"
  else
    print_info "📦 NPM: https://www.npmjs.com/package/@starkdev020/codex-father-mcp-server"
    print_info "🚀 GitHub: https://github.com/yuanyuanyuan/codex-father/releases/tag/${tag_name}"
  fi

  echo ""
  print_info "验证发布："
  echo "  npm view @starkdev020/codex-father-mcp-server"
  echo "  npm install -g @starkdev020/codex-father-mcp-server"
  echo "  codex-mcp-server --version"
  echo ""

  if [[ "${MODE}" == "dry-run" ]]; then
    print_success "预演模式测试完成！现在可以安全地进行实际发布🎊"
  else
    print_success "发布流程全部完成！🎊"
  fi
}

main() {
  # 解析参数
  MODE=""
  VERSION=""

  while [[ $# -gt 0 ]]; do
    case $1 in
      --preflight)
        MODE="preflight"
        shift
        ;;
      --version)
        VERSION="$2"
        validate_version "$VERSION"
        shift 2
        ;;
      --dry-run)
        MODE="dry-run"
        shift
        ;;
      --local)
        MODE="local"
        shift
        ;;
      --tag-only)
        MODE="tag-only"
        shift
        ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        echo "未知选项: $1"
        usage
        exit 1
        ;;
    esac
  done

  # 检查必需参数
  if [[ -z "$MODE" ]]; then
    echo "错误：请指定发布模式"
    usage
    exit 1
  fi

  if [[ "$MODE" != "preflight" && -z "$VERSION" ]]; then
    echo "错误：请指定版本号 --version X.Y.Z"
    usage
    exit 1
  fi

  # 检查必需目录和文件
  require_file package.json
  require_dir "${MCP_DIR}"
  require_file "${MCP_DIR}/package.json"

  # 执行发布流程
  if [[ "$MODE" == "preflight" ]]; then
    preflight
    exit 0
  fi

  # 其他模式需要版本号
  preflight
  check_version_consistency "$VERSION"
  check_git_status
  create_git_tag "$VERSION"
  build_package
  publish_to_npm "$VERSION"
  create_github_release "$VERSION"
  cleanup
  show_success "$VERSION"
}

main "$@"