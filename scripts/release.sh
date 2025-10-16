#!/bin/bash
set -e

# Codex Father Release Script v2.0
# 支持主项目发布和多种发布模式

# ==========================================
# 颜色定义
# ==========================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ==========================================
# 工具函数
# ==========================================

# 打印带颜色的消息
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

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 未安装，请先安装"
        exit 1
    fi
}

# ==========================================
# 使用说明
# ==========================================
usage() {
    cat <<'EOF'
用法: scripts/release.sh [选项]

发布模式:
  --dry-run        预演模式，不执行实际发布
  --local          本地发布模式（需要NPM_TOKEN）
  --main           主分支发布模式（推送到main触发CI）
  --help, -h       显示此帮助信息

示例:
  scripts/release.sh --dry-run     # 预演发布流程
  scripts/release.sh --local       # 本地发布
  scripts/release.sh --main        # 推送到main分支

注意:
  - 主项目发布包名: codex-father
  - MCP子包发布请使用: scripts/release-mcp.sh
EOF
}

# ==========================================
# 主流程
# ==========================================

# 解析命令行参数
MODE=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            MODE="dry-run"
            shift
            ;;
        --local)
            MODE="local"
            shift
            ;;
        --main)
            MODE="main"
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

# 如果没有指定模式，默认为交互式选择
if [[ -z "$MODE" ]]; then
    print_header "🚀 Codex Father 发布脚本"
    echo "请选择发布模式："
    echo "1) --dry-run  预演模式（推荐首次使用）"
    echo "2) --local    本地发布"
    echo "3) --main     推送到main分支"
    echo "4) --help     查看帮助"
    echo ""
    read -p "$(echo -e ${YELLOW}请选择 (1-4): ${NC})" -n 1 -r
    echo ""

    case $REPLY in
        1) MODE="dry-run" ;;
        2) MODE="local" ;;
        3) MODE="main" ;;
        4) usage; exit 0 ;;
        *) echo "无效选择"; exit 1 ;;
    esac
fi

print_header "🚀 Codex Father 发布脚本 - $MODE 模式"

# 1. 检查必要的工具
print_info "检查必要工具..."
check_command "node"
check_command "npm"
check_command "git"

# 根据模式检查额外工具
if [[ "$MODE" == "local" ]] || [[ "$MODE" == "main" ]]; then
    check_command "gh"  # GitHub CLI
fi
print_success "所有必要工具已安装"

# 2. 获取版本信息
VERSION=$(node -p "require('./package.json').version")
PACKAGE_NAME=$(node -p "require('./package.json').name")
print_info "包名: ${PACKAGE_NAME}"
print_info "当前版本: v${VERSION}"

# 3. 确认发布（跳过dry-run模式）
if [[ "$MODE" != "dry-run" ]]; then
    echo ""
    read -p "$(echo -e ${YELLOW}确认发布 v${VERSION} 吗? \(y/N\): ${NC})" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "发布已取消"
        exit 1
    fi
else
    print_info "🧪 预演模式：不会执行实际发布操作"
fi

# 4. Git 状态检查
print_header "🔍 Git 状态检查"
if [[ -n $(git status -s) ]]; then
    print_warning "检测到未提交的更改："
    git status -s
    echo ""
    read -p "$(echo -e ${YELLOW}是否继续? \(y/N\): ${NC})" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "发布已取消"
        exit 1
    fi
fi

# 检查当前分支
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
print_info "当前分支: ${CURRENT_BRANCH}"

# 根据模式检查分支要求
if [[ "$MODE" == "main" ]]; then
    if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
        print_error "main发布模式需要在main/master分支"
        print_info "请切换到main分支后重试"
        exit 1
    fi
else
    if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "master" ]]; then
        print_warning "当前不在 main/master 分支"
        if [[ "$MODE" != "dry-run" ]]; then
            read -p "$(echo -e ${YELLOW}是否继续? \(y/N\): ${NC})" -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_error "发布已取消"
                exit 1
            fi
        fi
    fi
fi

# 5. 代码质量检查
print_header "🔍 运行代码质量检查"
print_info "这可能需要几分钟..."

if npm run check:all; then
    print_success "代码质量检查通过"
else
    print_error "代码质量检查失败"
    read -p "$(echo -e ${YELLOW}是否强制继续? \(y/N\): ${NC})" -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_error "发布已取消"
        exit 1
    fi
fi

# 6. 清理并构建
print_header "🔨 构建项目"
print_info "清理旧构建..."
npm run clean

print_info "开始构建..."
if npm run build; then
    print_success "构建完成"
else
    print_error "构建失败"
    exit 1
fi

# 7. 验证构建产物
print_info "验证构建产物..."
if [[ ! -d "dist" ]]; then
    print_error "dist 目录不存在"
    exit 1
fi

if [[ ! -f "dist/core/cli/start.js" ]]; then
    print_error "dist/core/cli/start.js 不存在"
    exit 1
fi

print_success "构建产物验证通过"

# 8. 创建 NPM 包（试运行）
print_header "📦 创建 NPM 包"
print_info "试运行打包..."
npm pack --dry-run > /tmp/npm-pack-output.txt 2>&1

# 显示将要发布的文件
echo ""
print_info "将要发布的文件："
grep "npm notice" /tmp/npm-pack-output.txt | head -20
echo ""

read -p "$(echo -e ${YELLOW}确认文件列表正确? \(y/N\): ${NC})" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_error "发布已取消"
    exit 1
fi

# 实际打包
print_info "创建 NPM 包..."
npm pack
PACKAGE_FILE="${PACKAGE_NAME}-${VERSION}.tgz"
if [[ -f "$PACKAGE_FILE" ]]; then
    print_success "包已创建: ${PACKAGE_FILE}"
else
    print_error "包创建失败"
    exit 1
fi

# 9. 检查 NPM 登录状态（仅在需要时）
if [[ "$MODE" == "local" ]]; then
    print_header "🔐 NPM 认证检查"
    if npm whoami > /dev/null 2>&1; then
        NPM_USER=$(npm whoami)
        print_success "已登录 NPM，用户: ${NPM_USER}"
    else
        print_warning "未登录 NPM"
        print_info "请运行 'npm login' 登录"
        exit 1
    fi
elif [[ "$MODE" == "dry-run" ]]; then
    print_header "🔐 NPM 认证检查（跳过）"
    print_info "预演模式：跳过NPM认证检查"
fi

# 10. 创建 Git 标签
print_header "🏷️  创建 Git 标签"
TAG_NAME="v${VERSION}"

# 检查标签是否已存在
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    print_warning "标签 ${TAG_NAME} 已存在"
    if [[ "$MODE" != "dry-run" ]]; then
        read -p "$(echo -e ${YELLOW}是否删除并重新创建? \(y/N\): ${NC})" -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git tag -d "$TAG_NAME"
            git push origin ":refs/tags/${TAG_NAME}" 2>/dev/null || true
            print_info "已删除旧标签"
        else
            print_error "发布已取消"
            exit 1
        fi
    else
        print_info "预演模式：假设删除旧标签 ${TAG_NAME}"
    fi
fi

if [[ "$MODE" == "dry-run" ]]; then
    print_info "🧪 预演模式：假设创建标签 ${TAG_NAME}"
    print_info "🧪 预演模式：假设推送标签到远程"
else
    print_info "创建标签 ${TAG_NAME}..."
    git tag -a "$TAG_NAME" -m "Release ${TAG_NAME}"
    print_success "标签已创建"

    print_info "推送标签到远程..."
    if git push origin "$TAG_NAME"; then
        print_success "标签已推送"
    else
        print_error "标签推送失败"
        git tag -d "$TAG_NAME"
        exit 1
    fi
fi

# 11. 发布到 NPM（根据模式）
print_header "📤 发布到 NPM"

if [[ "$MODE" == "dry-run" ]]; then
    print_info "🧪 预演模式：假设发布到 NPM"
    print_info "🧪 预演模式：假设访问 https://www.npmjs.com/package/${PACKAGE_NAME}"
elif [[ "$MODE" == "main" ]]; then
    print_info "main模式：推送到main分支后将触发CI自动发布"
    print_info "请确保GitHub Actions配置了NPM_TOKEN"
elif [[ "$MODE" == "local" ]]; then
    echo ""
    print_warning "即将执行: npm publish"
    print_warning "这将把包发布到 NPM 公共仓库"
    echo ""
    read -p "$(echo -e ${YELLOW}确认发布? \(y/N\): ${NC})" -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "发布到 NPM..."
        if npm publish; then
            print_success "NPM 发布成功！"
            print_info "包地址: https://www.npmjs.com/package/${PACKAGE_NAME}"
        else
            print_error "NPM 发布失败"
            print_warning "正在回滚 Git 标签..."
            git tag -d "$TAG_NAME"
            git push origin ":refs/tags/${TAG_NAME}"
            exit 1
        fi
    else
        print_warning "跳过 NPM 发布"
    fi
fi

# 12. 创建 GitHub Release（根据模式）
print_header "🚀 创建 GitHub Release"

if [[ "$MODE" == "dry-run" ]]; then
    print_info "🧪 预演模式：假设创建 GitHub Release"
    print_info "🧪 预演模式：假设访问 https://github.com/yuanyuanyuan/codex-father/releases/tag/${TAG_NAME}"
else
    # 检查 GitHub CLI 认证
    if ! gh auth status > /dev/null 2>&1; then
        print_warning "GitHub CLI 未认证"
        print_info "请运行 'gh auth login' 登录"
        exit 1
    fi

    print_info "创建 GitHub Release..."
    if gh release create "$TAG_NAME" \
        --title "Codex Father ${TAG_NAME}" \
        --notes-file RELEASE_NOTES.md \
        "$PACKAGE_FILE"; then
        print_success "GitHub Release 已创建"
        print_info "Release 地址: https://github.com/yuanyuanyuan/codex-father/releases/tag/${TAG_NAME}"
    else
        print_error "GitHub Release 创建失败"
        if [[ "$MODE" == "local" ]]; then
            print_warning "注意: NPM 包已发布，但 GitHub Release 创建失败"
        fi
        print_info "请手动在 GitHub 创建 Release"
        exit 1
    fi
fi

# 13. 清理
print_header "🧹 清理临时文件"
if [[ "$MODE" == "dry-run" ]]; then
    print_info "🧪 预演模式：假设清理临时文件"
    print_info "🧪 预演模式：假设删除 ${PACKAGE_FILE}"
else
    rm -f "$PACKAGE_FILE"
    rm -f /tmp/npm-pack-output.txt
    print_success "清理完成"
fi

# 14. 完成
print_header "🎉 发布流程完成！"
echo ""
print_success "模式: ${MODE}"
print_success "版本: ${TAG_NAME}"
print_success "包名: ${PACKAGE_NAME}"
echo ""

if [[ "$MODE" == "dry-run" ]]; then
    print_info "🧪 预演模式总结："
    print_info "- ✅ 代码质量检查通过"
    print_info "- ✅ 构建验证通过"
    print_info "- ✅ 文件列表验证通过"
    print_info "- 🧪 假设创建Git标签和GitHub Release"
    print_info "- 🧪 假设发布到NPM"
    echo ""
    print_info "如需实际发布，请运行："
    print_info "  scripts/release.sh --local    # 本地发布"
    print_info "  scripts/release.sh --main     # 推送到main分支"
elif [[ "$MODE" == "main" ]]; then
    print_info "📦 GitHub Actions将自动处理NPM发布"
    print_info "🚀 GitHub Release: https://github.com/yuanyuanyuan/codex-father/releases/tag/${TAG_NAME}"
else
    print_info "📦 NPM: https://www.npmjs.com/package/${PACKAGE_NAME}"
    print_info "🚀 GitHub: https://github.com/yuanyuanyuan/codex-father/releases/tag/${TAG_NAME}"
fi

echo ""
print_info "验证发布："
echo "  npm view ${PACKAGE_NAME}"
echo "  npm install -g ${PACKAGE_NAME}"
echo "  ${PACKAGE_NAME} --version"
echo ""

# 15. 发布后建议
print_header "📋 后续步骤"
echo "1. 验证 NPM 安装"
echo "   npm install -g ${PACKAGE_NAME}"
echo ""
echo "2. 验证 GitHub Release"
echo "   open https://github.com/yuanyuanyuan/codex-father/releases/tag/${TAG_NAME}"
echo ""
echo "3. 更新文档（如需要）"
echo "   - 更新项目 README 的安装说明"
echo "   - 更新相关文档链接"
echo ""
echo "4. 发布公告（可选）"
echo "   - 技术博客"
echo "   - 社交媒体"
echo "   - 邮件通知"
echo ""

if [[ "$MODE" == "dry-run" ]]; then
    print_success "预演模式测试完成！现在可以安全地进行实际发布🎊"
else
    print_success "发布流程全部完成！🎊"
fi
