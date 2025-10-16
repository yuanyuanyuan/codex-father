#!/usr/bin/env bash
# 运行所有冒烟测试的主脚本

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Codex Father SIGPIPE 修复冒烟测试${NC}"
echo -e "${BLUE}=====================================${NC}"
echo -e "项目根目录: $PROJECT_ROOT"
echo -e "测试目录: $SCRIPT_DIR"
echo -e "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 切换到项目根目录
cd "$PROJECT_ROOT"

# 测试计数器
total_tests=0
passed_tests=0
failed_tests=0

# 运行单个测试
run_test() {
    local test_script="$1"
    local test_name=$(basename "$test_script" .sh | sed 's/test-//')
    local test_num=$(echo "$test_name" | cut -d'-' -f1)

    total_tests=$((total_tests + 1))

    echo -e "${YELLOW}[测试 $total_tests] $test_name${NC}"
    echo "----------------------------------------"

    # 记录开始时间
    start_time=$(date +%s)

    # 运行测试（带超时）
    if timeout 60 bash "$test_script"; then
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        echo -e "${GREEN}✓ 测试通过 (耗时: ${duration}秒)${NC}"
        passed_tests=$((passed_tests + 1))
    else
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        echo -e "${RED}✗ 测试失败 (耗时: ${duration}秒)${NC}"
        failed_tests=$((failed_tests + 1))
    fi

    echo ""
}

# 检查测试脚本是否存在
check_test_script() {
    local script="$1"
    if [ ! -f "$script" ]; then
        echo -e "${RED}✗ 测试脚本不存在: $script${NC}"
        return 1
    fi
    return 0
}

# 主测试列表
declare -a tests=(
    "$SCRIPT_DIR/test-1-basic.sh"
    "$SCRIPT_DIR/test-2-complex.sh"
    "$SCRIPT_DIR/test-3-title-extraction.sh"
    "$SCRIPT_DIR/test-4-large-content.sh"
    "$SCRIPT_DIR/test-5-node-heredoc.sh"
)

# 可选：运行汇总测试
if [ "${1:-}" = "--with-summary" ]; then
    tests+=("$SCRIPT_DIR/test-summary.sh")
fi

# 运行所有测试
echo -e "${BLUE}开始运行冒烟测试...${NC}"
echo ""

for test_script in "${tests[@]}"; do
    if check_test_script "$test_script"; then
        run_test "$test_script"
    else
        failed_tests=$((failed_tests + 1))
        total_tests=$((total_tests + 1))
    fi
done

# 生成测试报告
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}测试报告${NC}"
echo -e "${BLUE}=====================================${NC}"
echo -e "总测试数: $total_tests"
echo -e "${GREEN}通过: $passed_tests${NC}"
echo -e "${RED}失败: $failed_tests${NC}"
echo -e "成功率: $(( passed_tests * 100 / total_tests ))%"
echo ""

# 创建 JSON 报告
report_file="$PROJECT_ROOT/test-report-$(date +%Y%m%d_%H%M%S).json"
cat > "$report_file" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "projectRoot": "$PROJECT_ROOT",
  "summary": {
    "totalTests": $total_tests,
    "passedTests": $passed_tests,
    "failedTests": $failed_tests,
    "successRate": $(( passed_tests * 100 / total_tests ))
  },
  "status": "$([ $failed_tests -eq 0 ] && echo "PASSED" || echo "FAILED")"
}
EOF

echo -e "测试报告已保存到: $report_file"

# 最终结论
if [ $failed_tests -eq 0 ]; then
    echo -e "\n${GREEN}✓ 所有冒烟测试通过！SIGPIPE 修复验证成功！${NC}"
    exit 0
else
    echo -e "\n${RED}✗ 有 $failed_tests 个测试失败，请检查日志${NC}"
    exit 1
fi