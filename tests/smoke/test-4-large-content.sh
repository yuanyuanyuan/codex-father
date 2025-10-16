#!/usr/bin/env bash
# 测试4: 大量内容处理（测试临时文件修复）

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}测试 4: 大量内容处理${NC}"

TEST_OUTPUT_DIR="/tmp/codex-father-test-4"
mkdir -p "$TEST_OUTPUT_DIR"

test_tag="test-4-$(date +%Y%m%d_%H%M%S)"
log_file="$TEST_OUTPUT_DIR/test4.log"

# 创建大量内容（可能导致管道问题）
echo "生成大量测试内容..."
LARGE_CONTENT=$(printf "这是大量内容的第 %d 行，用于测试临时文件处理能力，避免管道导致的 SIGPIPE 错误。\n" {1..200})

echo "内容行数: $(echo "$LARGE_CONTENT" | wc -l)"

# 运行大量内容测试
./start.sh --tag "$test_tag" --task "$LARGE_CONTENT 请处理这些内容" --sandbox workspace-write --dry-run > "$log_file" 2>&1
exit_code=$?

if [ $exit_code -eq 0 ]; then
    # 检查退出码
    if grep -q "退出码: 0" "$log_file"; then
        echo -e "${GREEN}✓ 大量内容处理通过${NC}"

        # 检查是否有 SIGPIPE 错误
        if grep -q "Exit Code: 141" "$log_file"; then
            echo -e "${RED}✗ 大量内容处理检测到 SIGPIPE 错误${NC}"
            echo "错误详情:"
            grep -A2 -B2 "Exit Code: 141" "$log_file" || echo "无详细信息"
            exit 1
        else
            echo -e "${GREEN}✓ 无 SIGPIPE 错误${NC}"
        fi
    else
        echo -e "${RED}✗ 大量内容处理退出码不正确${NC}"
        tail -20 "$log_file"
        exit 1
    fi
else
    echo -e "${RED}✗ 大量内容处理失败${NC}"
    echo "查看日志内容："
    tail -30 "$log_file"
    exit 1
fi

# 清理
rm -rf "$TEST_OUTPUT_DIR"

echo -e "${GREEN}✓ 测试 4 完成：通过${NC}"