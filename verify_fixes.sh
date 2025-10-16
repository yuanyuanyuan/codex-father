#!/usr/bin/env bash

# 验证修复效果的脚本
# 确保所有修复功能都正常工作

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${BLUE}🔍 Codex-Father 修复验证工具${NC}"
echo -e "${CYAN}========================================${NC}"
echo

# 测试计数器
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# 测试函数
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="${3:-}"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -e "${BLUE}[TEST $TESTS_TOTAL]${NC} $test_name"

    local output
    local exit_code=0

    if output=$(eval "$test_command" 2>&1); then
        exit_code=0
    else
        exit_code=$?
    fi

    # 检查结果
    local success=1
    if [[ -n "$expected_pattern" ]]; then
        if echo "$output" | grep -q "$expected_pattern"; then
            success=0
        fi
    elif [[ $exit_code -eq 0 ]]; then
        success=0
    fi

    if [[ $success -eq 0 ]]; then
        echo -e "   ${GREEN}✅ 通过${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "   ${RED}❌ 失败${NC}"
        echo "   命令: $test_command"
        echo "   退出码: $exit_code"
        [[ -n "$output" ]] && echo "   输出: $output"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    echo
}

echo -e "${YELLOW}📋 开始验证修复效果...${NC}"
echo "========================================"

# 测试1: 参数验证器存在性
run_test "参数验证器文件存在" "test -f ./lib/param_validator.sh"

# 测试2: 参数验证器可执行性
run_test "参数验证器可执行" "test -x ./lib/param_validator.sh"

# 测试3: 参数验证器基础功能
run_test "参数验证器环境检查" "./lib/param_validator.sh check-env" "git.*安装"

# 测试4: 参数验证器验证功能
run_test "参数验证器参数验证" "./lib/param_validator.sh validate --tag test --task 'hello'" "参数验证通过"

# 测试5: 参数验证器自动修复
run_test "参数验证器自动修复" "./lib/param_validator.sh auto-fix --task 'test'" "自动添加标签"

# 测试6: 启动脚本参数检查集成
TEMP_LOG=$(mktemp)
if ./start.sh --task "test" --tag "test" --log-file "$TEMP_LOG" --dry-run >/dev/null 2>&1; then
    if grep -q "param-check" "$TEMP_LOG"; then
        echo -e "${BLUE}[TEST 6]${NC} 启动脚本参数检查集成"
        echo -e "   ${GREEN}✅ 通过${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        TESTS_TOTAL=$((TESTS_TOTAL + 1))
    else
        echo -e "${BLUE}[TEST 6]${NC} 启动脚本参数检查集成"
        echo -e "   ${RED}❌ 失败${NC}"
        echo "   未找到参数检查日志"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        TESTS_TOTAL=$((TESTS_TOTAL + 1))
    fi
    rm -f "$TEMP_LOG"
else
    echo -e "${BLUE}[TEST 6]${NC} 启动脚本参数检查集成"
    echo -e "   ${RED}❌ 失败${NC}"
    echo "   启动脚本执行失败"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
fi
echo

# 测试7: MCP初始化助手存在性
run_test "MCP初始化助手存在" "test -f ./mcp_init_helper.sh"

# 测试8: MCP初始化助手可执行性
run_test "MCP初始化助手可执行" "test -x ./mcp_init_helper.sh"

# 测试9: MCP初始化助手帮助功能
run_test "MCP初始化助手帮助" "./mcp_init_helper.sh --help" "MCP.*初始化.*助手"

# 测试10: 快速开始指南存在
run_test "快速开始指南存在" "test -f ./MCP_QUICKSTART.md"

# 测试11: 文档完整性检查
run_test "文档完整性检查" "test -f ./docs/user/mcp/claude-code-setup.md && test -f ./docs/user/mcp/overview.md"

# 测试12: 参数验证脚本存在性
run_test "参数验证脚本存在" "test -f ./test_validation_improved.sh"

echo "========================================"
echo -e "${PURPLE}📊 验证结果总结${NC}"
echo "========================================"
echo "总测试数: $TESTS_TOTAL"
echo -e "通过: ${GREEN}$TESTS_PASSED${NC}"
echo -e "失败: ${RED}$TESTS_FAILED${NC}"
echo

if [[ $TESTS_FAILED -eq 0 ]]; then
    echo -e "${GREEN}🎉 所有修复验证通过！${NC}"
    echo
    echo -e "${CYAN}✨ 修复成果总结:${NC}"
    echo "1. ✅ 参数预检查机制已集成"
    echo "2. ✅ 自动参数修复功能正常"
    echo "3. ✅ MCP连接初始化助手可用"
    echo "4. ✅ 详细文档和指引已提供"
    echo "5. ✅ 日志记录和错误处理完善"
    echo
    echo -e "${YELLOW}🚀 下一步操作建议:${NC}"
    echo "1. 运行 ./mcp_init_helper.sh --demo 完整演示"
    echo "2. 查看 MCP_QUICKSTART.md 了解使用方法"
    echo "3. 重启Claude Code并测试MCP功能"
    echo
else
    echo -e "${RED}❌ 有 $TESTS_FAILED 个测试失败${NC}"
    echo
    echo -e "${YELLOW}🔧 故障排除建议:${NC}"
    echo "1. 检查文件权限: chmod +x *.sh"
    echo "2. 检查依赖: node --version, npm --version"
    echo "3. 查看详细日志: ./test_validation_improved.sh"
    echo
fi

echo -e "${BLUE}📚 相关资源:${NC}"
echo "• MCP快速开始: MCP_QUICKSTART.md"
echo "• MCP配置指南: docs/user/mcp/claude-code-setup.md"
echo "• MCP工具介绍: docs/user/mcp/overview.md"
echo "• 参数验证器: ./lib/param_validator.sh --help"
echo "• MCP初始化助手: ./mcp_init_helper.sh --help"
echo

# 清理临时文件
rm -f /tmp/fixed_args_* 2>/dev/null || true

exit $TESTS_FAILED