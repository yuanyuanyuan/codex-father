#!/usr/bin/env bash

# 参数验证和修复测试脚本
# 测试新的参数预检查机制

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试计数器
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_test() {
    echo -e "${BLUE}[TEST]${NC} $1"
}

# 测试函数
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_exit_code="${3:-0}"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    log_test "测试 $TESTS_TOTAL: $test_name"

    if eval "$test_command" >/dev/null 2>&1; then
        local actual_exit_code=$?
        if [[ $actual_exit_code -eq $expected_exit_code ]]; then
            log_success "✓ 通过"
            TESTS_PASSED=$((TESTS_PASSED + 1))
        else
            log_error "✗ 失败: 期望退出码 $expected_exit_code，实际 $actual_exit_code"
            TESTS_FAILED=$((TESTS_FAILED + 1))
        fi
    else
        log_error "✗ 失败: 命令执行错误"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo
}

# 测试参数验证器
test_param_validator() {
    local validator_script="$1"

    log_info "开始测试参数验证器..."

    # 测试1: 检查环境
    run_test "环境检查" "$validator_script check-env" 0

    # 测试2: 验证空参数（应该有建议）
    run_test "空参数验证" "$validator_script validate" 0

    # 测试3: 自动修复功能
    run_test "自动修复参数" "$validator_script auto-fix" 0

    # 测试4: 验证完整参数
    run_test "完整参数验证" "$validator_script validate --tag test --task 'hello world' --skip-git-repo-check" 0

    # 测试5: 验证错误用法
    run_test "错误用法检查" "$validator_script --invalid-option" 1
}

# 测试启动脚本集成
test_start_script_integration() {
    local start_script="$1"
    local temp_dir="/tmp/codex-test-$$"

    log_info "开始测试启动脚本集成..."

    # 创建临时测试目录
    mkdir -p "$temp_dir"
    cd "$temp_dir"

    # 测试1: 最小参数集
    run_test "最小参数集" "$start_script --task 'test task' --dry-run --json" 0

    # 测试2: 带标签的参数
    run_test "带标签参数" "$start_script --tag test-task --task 'test task' --dry-run --json" 0

    # 测试3: 非git仓库测试
    run_test "非git仓库" "$start_script --task 'test task' --skip-git-repo-check --dry-run --json" 0

    # 测试4: 错误参数
    run_test "错误参数" "$start_script --invalid-param" 2

    # 清理
    cd /
    rm -rf "$temp_dir"
}

# 主测试函数
main() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local validator_script="$script_dir/lib/param_validator.sh"
    local start_script="$script_dir/start.sh"

    echo "========================================"
    echo "🧪 Codex-Father 参数验证测试套件"
    echo "========================================"
    echo

    # 检查文件存在性
    if [[ ! -f "$validator_script" ]]; then
        log_error "参数验证器不存在: $validator_script"
        exit 1
    fi

    if [[ ! -f "$start_script" ]]; then
        log_error "启动脚本不存在: $start_script"
        exit 1
    fi

    # 设置可执行权限
    chmod +x "$validator_script"

    # 运行测试
    test_param_validator "$validator_script"
    test_start_script_integration "$start_script"

    # 输出测试结果
    echo "========================================"
    echo "📊 测试结果总结"
    echo "========================================"
    echo "总测试数: $TESTS_TOTAL"
    echo -e "通过: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "失败: ${RED}$TESTS_FAILED${NC}"

    if [[ $TESTS_FAILED -eq 0 ]]; then
        log_success "🎉 所有测试通过！"
        return 0
    else
        log_error "❌ 有 $TESTS_FAILED 个测试失败"
        return 1
    fi
}

# 如果直接执行脚本，运行主函数
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi