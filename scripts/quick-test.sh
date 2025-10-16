#!/bin/bash

# 快速测试脚本 - 用于开发阶段的轻量级测试
# 使用方法: ./scripts/quick-test.sh [unit|integration|contract|e2e]

set -e

TYPE=${1:-"unit"}
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'
COLOR_YELLOW='\033[1;33m'
COLOR_BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${COLOR_BLUE}🚀 快速测试执行器 - 类型: $TYPE${NC}"
echo "=================================================="

# 根据类型选择测试文件
case $TYPE in
    "unit")
        TEST_FILES=(
            "tests/unit/mcp/MCPServer.unit.test.ts"
            "tests/unit/core/TaskRunner.unit.test.ts"
            "tests/unit/http/HTTPServer.unit.test.ts"
            "tests/unit/version-command.test.ts"
            "tests/unit/schemas/status-example.test.ts"
            "tests/unit/bulk-sdk.test.ts"
        )
        MEMORY="2048"
        ;;
    "integration")
        TEST_FILES=(
            "tests/integration/configHandlers.test.ts"
            "tests/integration/utilHandlers.test.ts"
            "tests/integration/bridge-happy-path.test.ts"
            "tests/integration/eventHandler.test.ts"
        )
        MEMORY="3072"
        ;;
    "contract")
        TEST_FILES=(
            "tests/contract/codex-jsonrpc.test.ts"
            "tests/contract/mcp-tools-list.test.ts"
            "tests/contract/mcp-initialize.test.ts"
            "tests/contract/getAuthStatus.contract.test.ts"
            "tests/contract/loginApiKey.contract.test.ts"
        )
        MEMORY="2048"
        ;;
    "http")
        TEST_FILES=(
            "tests/unit/http/HTTPServer.unit.test.ts"
        )
        MEMORY="4096"
        ;;
    "mcp")
        TEST_FILES=(
            "tests/unit/mcp/MCPServer.unit.test.ts"
        )
        MEMORY="4096"
        ;;
    "e2e")
        echo -e "${COLOR_YELLOW}⚠️  E2E测试需要较长时间，是否继续? (y/N)${NC}"
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo "测试已取消"
            exit 0
        fi
        
        TEST_FILES=(
            "tests/e2e/http-api.e2e.test.ts"
        )
        MEMORY="6144"
        ;;
    *)
        echo -e "${COLOR_RED}❌ 未知的测试类型: $TYPE${NC}"
        echo "支持的类型: unit, integration, contract, http, mcp, e2e"
        exit 1
        ;;
esac

echo -e "${COLOR_BLUE}📝 测试文件数量: ${#TEST_FILES[@]}${NC}"
echo -e "${COLOR_BLUE}💾 内存限制: ${MEMORY}MB${NC}"
echo ""

# 构建测试文件数组
VALID_FILES=()
for file in "${TEST_FILES[@]}"; do
    if [ -f "$file" ]; then
        VALID_FILES+=("$file")
    else
        echo -e "${COLOR_YELLOW}⚠️  跳过不存在的文件: $file${NC}"
    fi
done

if [ ${#VALID_FILES[@]} -eq 0 ]; then
    echo -e "${COLOR_RED}❌ 没有找到有效的测试文件${NC}"
    exit 1
fi

# 执行测试
echo -e "${COLOR_BLUE}🔧 开始执行测试...${NC}"
START_TIME=$(date +%s)

export NODE_OPTIONS="--max-old-space-size=$MEMORY"

if npx vitest run "${VALID_FILES[@]}" --reporter=verbose --no-coverage; then
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo -e "${COLOR_GREEN}✅ 测试完成！耗时: ${DURATION}秒${NC}"
else
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    echo -e "${COLOR_RED}❌ 测试失败！耗时: ${DURATION}秒${NC}"
    exit 1
fi