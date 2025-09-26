#!/bin/bash
# 统一测试入口脚本
# Codex-Father 项目测试套件

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TESTS_DIR="$ROOT_DIR/tests"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

# 检查依赖
check_dependencies() {
    log_info "检查测试依赖..."

    # 检查 BATS
    if ! command -v bats >/dev/null 2>&1; then
        log_error "BATS 测试框架未安装"
        echo "请安装 BATS: npm install -g bats"
        echo "或者: apt-get install bats (Ubuntu)"
        echo "或者: brew install bats-core (macOS)"
        return 1
    fi

    # 检查 jq
    if ! command -v jq >/dev/null 2>&1; then
        log_error "jq 命令未找到"
        echo "请安装 jq: apt-get install jq"
        return 1
    fi

    # 检查 codex (可选)
    if command -v codex >/dev/null 2>&1; then
        log_info "Codex CLI 可用 - 将运行完整测试"
        export HAS_CODEX=1
    else
        log_warning "Codex CLI 未安装 - 将跳过 Codex 集成测试"
        export HAS_CODEX=0
    fi

    log_success "依赖检查完成"
}

# 运行单元测试 (无 Codex)
run_unit_tests() {
    log_info "运行单元测试 (无 Codex)"

    if [[ ! -d "$TESTS_DIR/unit" ]]; then
        log_warning "单元测试目录不存在: $TESTS_DIR/unit"
        return 0
    fi

    local test_files=("$TESTS_DIR"/unit/*.bats)
    if [[ ${#test_files[@]} -eq 0 || ! -f "${test_files[0]}" ]]; then
        log_warning "未找到单元测试文件"
        return 0
    fi

    echo
    echo "=================================================="
    echo "           单元测试 (不包含 Codex)"
    echo "=================================================="

    if bats "${test_files[@]}"; then
        log_success "单元测试通过"
        return 0
    else
        log_error "单元测试失败"
        return 1
    fi
}

# 运行单元测试 (包含 Codex)
run_unit_codex_tests() {
    if [[ "${HAS_CODEX:-0}" -eq 0 ]]; then
        log_warning "跳过 Codex 单元测试: Codex CLI 未安装"
        return 0
    fi

    log_info "运行单元测试 (包含 Codex)"

    if [[ ! -d "$TESTS_DIR/unit-codex" ]]; then
        log_warning "Codex 单元测试目录不存在: $TESTS_DIR/unit-codex"
        return 0
    fi

    local test_files=("$TESTS_DIR"/unit-codex/*.bats)
    if [[ ${#test_files[@]} -eq 0 || ! -f "${test_files[0]}" ]]; then
        log_warning "未找到 Codex 单元测试文件"
        return 0
    fi

    echo
    echo "=================================================="
    echo "           单元测试 (包含 Codex)"
    echo "=================================================="

    if bats "${test_files[@]}"; then
        log_success "Codex 单元测试通过"
        return 0
    else
        log_error "Codex 单元测试失败"
        return 1
    fi
}

# 运行 E2E 测试 (无 Codex)
run_e2e_tests() {
    log_info "运行 E2E 测试 (无 Codex)"

    if [[ ! -d "$TESTS_DIR/e2e" ]]; then
        log_warning "E2E 测试目录不存在: $TESTS_DIR/e2e"
        return 0
    fi

    local test_files=("$TESTS_DIR"/e2e/*.bats)
    if [[ ${#test_files[@]} -eq 0 || ! -f "${test_files[0]}" ]]; then
        log_warning "未找到 E2E 测试文件"
        return 0
    fi

    echo
    echo "=================================================="
    echo "            E2E 测试 (不包含 Codex)"
    echo "=================================================="

    if bats "${test_files[@]}"; then
        log_success "E2E 测试通过"
        return 0
    else
        log_error "E2E 测试失败"
        return 1
    fi
}

# 运行 E2E 测试 (包含 Codex)
run_e2e_codex_tests() {
    if [[ "${HAS_CODEX:-0}" -eq 0 ]]; then
        log_warning "跳过 Codex E2E 测试: Codex CLI 未安装"
        return 0
    fi

    log_info "运行 E2E 测试 (包含 Codex)"

    if [[ ! -d "$TESTS_DIR/e2e-codex" ]]; then
        log_warning "Codex E2E 测试目录不存在: $TESTS_DIR/e2e-codex"
        return 0
    fi

    local test_files=("$TESTS_DIR"/e2e-codex/*.bats)
    if [[ ${#test_files[@]} -eq 0 || ! -f "${test_files[0]}" ]]; then
        log_warning "未找到 Codex E2E 测试文件"
        return 0
    fi

    echo
    echo "=================================================="
    echo "            E2E 测试 (包含 Codex)"
    echo "=================================================="

    if bats "${test_files[@]}"; then
        log_success "Codex E2E 测试通过"
        return 0
    else
        log_error "Codex E2E 测试失败"
        return 1
    fi
}

# 运行现有测试（兼容性）
run_existing_tests() {
    log_info "运行现有测试套件"

    local existing_tests=(
        "$ROOT_DIR/tests/smoke_start_json.sh"
        "$ROOT_DIR/tests/smoke_job_json.sh"
        "$ROOT_DIR/tests/smoke_start_docs_success.sh"
    )

    local passed=0
    local failed=0

    echo
    echo "=================================================="
    echo "              现有测试套件"
    echo "=================================================="

    for test_file in "${existing_tests[@]}"; do
        if [[ -x "$test_file" ]]; then
            echo "运行: $(basename "$test_file")"
            if "$test_file"; then
                log_success "$(basename "$test_file") 通过"
                ((passed++))
            else
                log_error "$(basename "$test_file") 失败"
                ((failed++))
            fi
        else
            log_warning "测试文件不存在或不可执行: $test_file"
        fi
    done

    echo
    log_info "现有测试结果: $passed 通过, $failed 失败"
    return $failed
}

# 生成测试报告
generate_report() {
    local unit_result=$1
    local unit_codex_result=$2
    local e2e_result=$3
    local e2e_codex_result=$4
    local existing_result=$5

    echo
    echo "=================================================="
    echo "                测试报告摘要"
    echo "=================================================="

    local total_passed=0
    local total_failed=0

    # 统计结果
    local results=(
        "单元测试 (无 Codex):$unit_result"
        "单元测试 (含 Codex):$unit_codex_result"
        "E2E 测试 (无 Codex):$e2e_result"
        "E2E 测试 (含 Codex):$e2e_codex_result"
        "现有测试套件:$existing_result"
    )

    for result in "${results[@]}"; do
        local name="${result%:*}"
        local code="${result#*:}"

        if [[ $code -eq 0 ]]; then
            log_success "$name: 通过"
            ((total_passed++))
        elif [[ $code -eq 99 ]]; then
            log_warning "$name: 跳过"
        else
            log_error "$name: 失败"
            ((total_failed++))
        fi
    done

    echo
    if [[ $total_failed -eq 0 ]]; then
        log_success "所有测试通过! ($total_passed/$((total_passed + total_failed)))"
        echo "🎉 测试套件执行成功!"
    else
        log_error "有测试失败: $total_failed 个测试套件失败"
        echo "❌ 请检查失败的测试并修复问题"
    fi

    return $total_failed
}

# 主函数
main() {
    local test_type="${1:-all}"

    echo "Codex-Father 测试套件"
    echo "======================"
    echo

    # 检查依赖
    if ! check_dependencies; then
        exit 1
    fi

    # 初始化结果变量
    local unit_result=99
    local unit_codex_result=99
    local e2e_result=99
    local e2e_codex_result=99
    local existing_result=99

    case "$test_type" in
        unit)
            run_unit_tests && unit_result=0 || unit_result=1
            ;;
        unit-codex)
            run_unit_codex_tests && unit_codex_result=0 || unit_codex_result=1
            ;;
        e2e)
            run_e2e_tests && e2e_result=0 || e2e_result=1
            ;;
        e2e-codex)
            run_e2e_codex_tests && e2e_codex_result=0 || e2e_codex_result=1
            ;;
        existing)
            run_existing_tests && existing_result=0 || existing_result=$?
            ;;
        all)
            # 运行所有测试
            run_unit_tests && unit_result=0 || unit_result=1
            run_unit_codex_tests && unit_codex_result=0 || unit_codex_result=1
            run_e2e_tests && e2e_result=0 || e2e_result=1
            run_e2e_codex_tests && e2e_codex_result=0 || e2e_codex_result=1
            run_existing_tests && existing_result=0 || existing_result=$?
            ;;
        *)
            echo "用法: $0 [unit|unit-codex|e2e|e2e-codex|existing|all]"
            echo
            echo "测试类型:"
            echo "  unit        - 单元测试 (不包含 Codex)"
            echo "  unit-codex  - 单元测试 (包含 Codex)"
            echo "  e2e         - E2E 测试 (不包含 Codex)"
            echo "  e2e-codex   - E2E 测试 (包含 Codex)"
            echo "  existing    - 运行现有测试套件"
            echo "  all         - 运行所有测试 (默认)"
            exit 1
            ;;
    esac

    # 生成报告
    generate_report $unit_result $unit_codex_result $e2e_result $e2e_codex_result $existing_result
}

# 如果脚本被直接执行
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi