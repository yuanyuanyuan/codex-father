#!/usr/bin/env bash

# npx 使用测试脚本
# 测试 codex-father 通过 npx 的各种使用方式

set -euo pipefail

echo "🧪 测试 npx codex-father 使用方式"
echo "================================"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 测试计数器
TESTS_TOTAL=0
TESTS_PASSED=0

# 测试函数
run_test() {
    local test_name="$1"
    local command="$2"

    echo -e "\n${YELLOW}测试 ${TESTS_TOTAL}: $test_name${NC}"
    echo "命令: $command"
    echo "---"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    if eval "$command"; then
        echo -e "${GREEN}✅ 测试通过${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ 测试失败${NC}"
    fi
}

# 1. 测试基本 npx 命令
run_test "基本 npx 命令 - 显示帮助" "npx codex-father --help"

# 2. 测试 npx codex-father-start
run_test "npx codex-father-start - 显示帮助" "npx codex-father-start --help"

# 3. 测试 npx codex-father-job
run_test "npx codex-father-job - 显示帮助" "npx codex-father-job --help"

# 4. 测试 status 命令
run_test "status 命令 - 检查系统状态" "npx codex-father status"

# 5. 测试 version 命令
run_test "version 命令 - 显示版本信息" "npx codex-father version --json"

# 6. 测试 MCP 相关命令
run_test "mcp 命令 - 显示 MCP 帮助" "npx codex-father mcp --help"

# 7. 测试 start.sh 的参数传递
run_test "start.sh 参数传递 - 测试任务参数" "npx codex-father-start --task '测试任务' --dry-run"

# 8. 测试文件路径解析
echo -e "\n${YELLOW}测试 8: 文件路径解析测试${NC}"
echo "检查脚本是否能正确找到依赖的模块..."
TESTS_TOTAL=$((TESTS_TOTAL + 1))

# 创建临时测试目录
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# 初始化一个简单的 npm 项目
npm init -y >/dev/null 2>&1

# 尝试使用 npx codex-father-start
if npx codex-father-start --help >/dev/null 2>&1; then
    echo -e "${GREEN}✅ 脚本路径解析正常${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
else
    echo -e "${RED}❌ 脚本路径解析失败${NC}"
fi

# 清理
cd - >/dev/null
rm -rf "$TEMP_DIR"

# 9. 测试配置文件加载
run_test "配置文件加载 - 检查默认配置" "npx codex-father config show"

# 10. 测试日志功能
run_test "日志功能 - 检查日志命令" "npx codex-father logs --help"

# 测试结果汇总
echo -e "\n================================"
echo -e "${YELLOW}测试结果汇总:${NC}"
echo -e "总测试数: $TESTS_TOTAL"
echo -e "${GREEN}通过: $TESTS_PASSED${NC}"
echo -e "${RED}失败: $((TESTS_TOTAL - TESTS_PASSED))${NC}"

if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
    echo -e "\n${GREEN}🎉 所有测试通过！npx 使用方式配置正确。${NC}"
    exit 0
else
    echo -e "\n${RED}⚠️  部分测试失败，需要检查配置。${NC}"
    exit 1
fi