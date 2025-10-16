#!/usr/bin/env bash
# 测试1: 基本脚本执行

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}测试 1: 基本脚本执行${NC}"

TEST_OUTPUT_DIR="/tmp/codex-father-test-1"
mkdir -p "$TEST_OUTPUT_DIR"

test_tag="test-1-$(date +%Y%m%d_%H%M%S)"
log_file="$TEST_OUTPUT_DIR/test1.log"

# 运行简单任务
./start.sh --tag "$test_tag" --task "创建测试文件验证脚本运行" --sandbox workspace-write --dry-run > "$log_file" 2>&1
exit_code=$?

if [ $exit_code -eq 0 ]; then
    # 检查退出码
    if grep -q "退出码: 0" "$log_file"; then
        echo -e "${GREEN}✓ 基本脚本执行通过${NC}"

        # 检查是否有 SIGPIPE 错误
        if grep -q "Exit Code: 141" "$log_file"; then
            echo -e "${RED}✗ 检测到 SIGPIPE 错误 (Exit Code: 141)${NC}"
            echo "错误详情:"
            grep -A2 -B2 "Exit Code: 141" "$log_file" || echo "无详细信息"
            exit 1
        else
            echo -e "${GREEN}✓ 无 SIGPIPE 错误${NC}"
        fi
    else
        echo -e "${RED}✗ 脚本退出码不正确${NC}"
        tail -20 "$log_file"
        exit 1
    fi
else
    echo -e "${RED}✗ 脚本执行失败${NC}"
    tail -20 "$log_file"
    exit 1
fi

# 清理
rm -rf "$TEST_OUTPUT_DIR"

echo -e "${GREEN}✓ 测试 1 完成：通过${NC}"