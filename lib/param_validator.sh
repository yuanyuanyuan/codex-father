#!/usr/bin/env bash

# 参数预检查和修复机制 (修复版)
# 作者: 浮浮酱
# 功能: 验证和修复常见的codex-father启动参数问题

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

# 检查git仓库状态
check_git_repo() {
    local cwd="${1:-$(pwd)}"

    if ! command -v git >/dev/null 2>&1; then
        return 1
    fi

    if ! git -C "$cwd" rev-parse --git-dir >/dev/null 2>&1; then
        return 1
    fi

    return 0
}

# 验证参数完整性
validate_args() {
    local cwd="${1:-$(pwd)}"
    shift
    local -a args=("$@")
    local has_tag=0
    local has_task=0
    local has_skip_git_check=0
    local errors=()
    local suggestions=()

    # 检查关键参数
    local i=0
    while (( i < ${#args[@]} )); do
        case "${args[$i]}" in
            --tag)
                has_tag=1
                if (( i + 1 >= ${#args[@]} )); then
                    errors+=("--tag 缺少参数值")
                else
                    i=$((i + 1)) # 跳过tag值
                fi
                ;;
            --task)
                has_task=1
                if (( i + 1 >= ${#args[@]} )); then
                    errors+=("--task 缺少参数值")
                else
                    i=$((i + 1)) # 跳过task值
                fi
                ;;
            --skip-git-repo-check)
                has_skip_git_check=1
                ;;
        esac
        i=$((i + 1))
    done

    # 生成建议
    if (( has_tag == 0 )); then
        suggestions+=("添加 --tag \"descriptive-task-name\" 以便区分日志")
    fi

    if (( has_task == 0 )); then
        suggestions+=("添加 --task \"your task description\" 指定任务内容")
    fi

    if (( has_skip_git_check == 0 )); then
        if ! check_git_repo "$cwd"; then
            suggestions+=("添加 --skip-git-repo-check 因为不在git仓库中")
        fi
    fi

    # 输出结果
    if (( ${#errors[@]} > 0 )); then
        log_error "发现参数错误:"
        for error in "${errors[@]}"; do
            echo "  - $error" >&2
        done
        return 1
    fi

    if (( ${#suggestions[@]} > 0 )); then
        log_info "参数优化建议:"
        for suggestion in "${suggestions[@]}"; do
            echo "  - $suggestion" >&2
        done
    fi

    return 0
}

# 自动修复参数
auto_fix_args() {
    local cwd="${1:-$(pwd)}"
    shift
    local -a original_args=("$@")
    local -a fixed_args=("${original_args[@]}")

    # 如果没有--tag，生成一个基于时间的标签
    local has_tag=0
    local i=0
    while (( i < ${#fixed_args[@]} )); do
        if [[ "${fixed_args[$i]}" == "--tag" ]]; then
            has_tag=1
            break
        fi
        i=$((i + 1))
    done

    if (( has_tag == 0 )); then
        local timestamp=$(date +%H%M%S)
        local tag="task-${timestamp}"
        fixed_args+=("--tag" "$tag")
        log_info "自动添加标签: --tag $tag"
    fi

    # 如果不在git仓库中且没有--skip-git-repo-check，添加该参数
    local has_skip_git=0
    i=0
    while (( i < ${#fixed_args[@]} )); do
        if [[ "${fixed_args[$i]}" == "--skip-git-repo-check" ]]; then
            has_skip_git=1
            break
        fi
        i=$((i + 1))
    done

    if (( has_skip_git == 0 )) && ! check_git_repo "$cwd"; then
        fixed_args+=("--skip-git-repo-check")
        log_info "自动添加: --skip-git-repo-check (不在git仓库中)"
    fi

    # 输出修复后的参数
    printf '%s\n' "${fixed_args[@]}"
}

# 主函数
main() {
    local action="${1:-validate}"
    local cwd="${2:-$(pwd)}"

    case "$action" in
        validate)
            log_info "验证codex-father启动参数..."
            shift 2 # 移除action和cwd
            if validate_args "$cwd" "$@"; then
                log_success "参数验证通过"
                return 0
            else
                log_error "参数验证失败"
                return 1
            fi
            ;;
        auto-fix)
            log_info "自动修复codex-father启动参数..."
            shift 2 # 移除action和cwd
            auto_fix_args "$cwd" "$@"
            ;;
        check-env)
            log_info "检查运行环境..."

            # 检查git
            if command -v git >/dev/null 2>&1; then
                log_success "git 已安装: $(git --version)"
            else
                log_warn "git 未安装"
            fi

            # 检查codex
            if command -v codex >/dev/null 2>&1; then
                log_success "codex 已安装: $(codex --version 2>/dev/null || echo 'unknown version')"
            else
                log_error "codex 未安装或不在PATH中"
                return 1
            fi

            # 检查工作目录
            if check_git_repo "$cwd"; then
                log_success "在git仓库中: $cwd"
            else
                log_warn "不在git仓库中: $cwd"
            fi
            ;;
        *)
            echo "用法: $0 {validate|auto-fix|check-env} [work-directory] [args...]" >&2
            echo "  validate  - 验证参数并提供优化建议" >&2
            echo "  auto-fix  - 自动修复常见参数问题" >&2
            echo "  check-env - 检查运行环境" >&2
            return 1
            ;;
    esac
}

# 如果直接执行脚本，运行主函数
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi