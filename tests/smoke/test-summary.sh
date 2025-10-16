#!/usr/bin/env bash
# 测试汇总脚本

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}SIGPIPE 修复验证测试汇总${NC}"
echo -e "${BLUE}=====================================${NC}"

# 测试计数器
total_tests=0
passed_tests=0
failed_tests=0

# 测试结果数组
declare -a test_results=()

# 运行单个测试
run_single_test() {
    local test_name="$1"
    local test_cmd="$2"

    total_tests=$((total_tests + 1))
    echo -e "\n${YELLOW}[测试 $total_tests] $test_name${NC}"
    echo "命令: $test_cmd"

    # 设置超时
    timeout 15 bash -c "$test_cmd" > "/tmp/test-$total_tests.log" 2>&1
    local exit_code=$?

    if [ $exit_code -eq 0 ]; then
        echo -e "${GREEN}✓ 通过${NC}"
        passed_tests=$((passed_tests + 1))
        test_results+=("$test_name: ✓ 通过")
    else
        echo -e "${RED}✗ 失败 (退出码: $exit_code)${NC}"
        failed_tests=$((failed_tests + 1))
        test_results+=("$test_name: ✗ 失败")

        # 显示错误信息
        if [ -f "/tmp/test-$total_tests.log" ]; then
            echo "错误信息:"
            tail -5 "/tmp/test-$total_tests.log" | sed 's/^/  /'
        fi
    fi
}

# 测试 1: 基本 awk 管道（核心修复）
run_single_test "基本 awk 管道" 'printf "第一行\n第二行" | awk "NF {print; exit}" && echo "awk 成功"'

# 测试 2: 文件读取 awk
run_single_test "文件读取 awk" 'echo "测试内容" > /tmp/test.txt && cat /tmp/test.txt | awk "NF {print; exit}" && rm -f /tmp/test.txt'

# 测试 3: 复杂管道链
run_single_test "复杂管道链" 'printf "测试内容" | awk "NF {print; exit}" | cut -c1-5'

# 测试 4: start.sh 基本执行
run_single_test "start.sh 基本执行" './start.sh --tag basic-test --task "简单测试" --sandbox workspace-write --dry-run | grep -q "退出码: 0"'

# 测试 5: start.sh 标题提取
run_single_test "start.sh 标题提取" 'TITLE="任务：测试标题"; ./start.sh --tag title-test --task "$TITLE" --sandbox workspace-write --dry-run | grep -q "退出码: 0"'

# 测试 6: 临时文件处理
run_single_test "临时文件处理" 'content="临时内容"; echo "$content" > /tmp/temp.$$; result=$(cat /tmp/temp.$$); rm -f /tmp/temp.$$; [ "$result" = "临时内容" ]'

# 汇总结果
echo -e "\n${BLUE}=====================================${NC}"
echo -e "${BLUE}测试结果汇总${NC}"
echo -e "${BLUE}=====================================${NC}"
echo -e "总测试数: $total_tests"
echo -e "${GREEN}通过: $passed_tests${NC}"
echo -e "${RED}失败: $failed_tests${NC}"

# 详细结果
echo -e "\n${YELLOW}详细结果:${NC}"
for result in "${test_results[@]}"; do
    echo "  - $result"
done

# 最终结论
if [ $failed_tests -eq 0 ]; then
    echo -e "\n${GREEN}✓ 所有测试通过！SIGPIPE 错误已成功修复！${NC}"
    exit 0
else
    echo -e "\n${RED}✗ 有 $failed_tests 个测试失败，需要进一步检查${NC}"
    exit 1
fi