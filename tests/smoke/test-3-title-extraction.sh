#!/usr/bin/env bash
# 测试3: 标题提取功能（测试 awk 修复）

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}测试 3: 标题提取功能${NC}"

TEST_OUTPUT_DIR="/tmp/codex-father-test-3"
mkdir -p "$TEST_OUTPUT_DIR"

test_tag="test-3-$(date +%Y%m%d_%H%M%S)"
log_file="$TEST_OUTPUT_DIR/test3.log"

# 创建标题提取任务
TITLE_TASK="任务：验证标题提取功能

这是一个专门用于测试 awk 和管道修复的任务。
标题应该能够正确提取，不会导致 SIGPIPE 错误。
包含多行内容的任务应该能够正常处理。

完成测试后输出：标题提取成功。"

echo "运行标题提取测试..."

# 运行标题提取任务
./start.sh --tag "$test_tag" --task "$TITLE_TASK" --sandbox workspace-write --dry-run > "$log_file" 2>&1
exit_code=$?

if [ $exit_code -eq 0 ]; then
    # 检查退出码
    if grep -q "退出码: 0" "$log_file"; then
        echo -e "${GREEN}✓ 标题提取功能通过${NC}"

        # 检查是否有 SIGPIPE 错误
        if grep -q "Exit Code: 141" "$log_file"; then
            echo -e "${RED}✗ 标题提取功能检测到 SIGPIPE 错误${NC}"
            echo "错误详情:"
            grep -A2 -B2 "Exit Code: 141" "$log_file" || echo "无详细信息"
            exit 1
        else
            echo -e "${GREEN}✓ 无 SIGPIPE 错误${NC}"
        fi
    else
        echo -e "${RED}✗ 标题提取功能退出码不正确${NC}"
        tail -20 "$log_file"
        exit 1
    fi
else
    echo -e "${RED}✗ 标题提取功能失败${NC}"
    echo "查看日志内容："
    tail -30 "$log_file"
    exit 1
fi

# 清理
rm -rf "$TEST_OUTPUT_DIR"

echo -e "${GREEN}✓ 测试 3 完成：通过${NC}"