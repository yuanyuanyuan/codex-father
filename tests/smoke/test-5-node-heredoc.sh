#!/usr/bin/env bash
# 测试5: Node.js heredoc 处理

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}测试 5: Node.js heredoc 处理${NC}"

TEST_OUTPUT_DIR="/tmp/codex-father-test-5"
mkdir -p "$TEST_OUTPUT_DIR"

test_tag="test-5-$(date +%Y%m%d_%H%M%S)"
log_file="$TEST_OUTPUT_DIR/test5.log"

# 创建 Node.js 任务
NODE_TASK="请创建一个 Node.js 脚本 test-node.js，该脚本：
1. 导入必要的模块
2. 定义一个简单的函数
3. 输出执行结果
4. 确保脚本可以正常运行"

echo "运行 Node.js heredoc 测试..."

# 运行 Node.js heredoc 测试
./start.sh --tag "$test_tag" --task "$NODE_TASK" --sandbox workspace-write --dry-run > "$log_file" 2>&1
exit_code=$?

if [ $exit_code -eq 0 ]; then
    # 检查退出码
    if grep -q "退出码: 0" "$log_file"; then
        echo -e "${GREEN}✓ Node.js heredoc 处理通过${NC}"

        # 检查是否有 SIGPIPE 错误
        if grep -q "Exit Code: 141" "$log_file"; then
            echo -e "${RED}✗ Node.js heredoc 处理检测到 SIGPIPE 错误${NC}"
            echo "错误详情:"
            grep -A2 -B2 "Exit Code: 141" "$log_file" || echo "无详细信息"
            exit 1
        else
            echo -e "${GREEN}✓ 无 SIGPIPE 错误${NC}"
        fi
    else
        echo -e "${RED}✗ Node.js heredoc 处理退出码不正确${NC}"
        tail -20 "$log_file"
        exit 1
    fi
else
    echo -e "${RED}✗ Node.js heredoc 处理失败${NC}"
    echo "查看日志内容："
    tail -30 "$log_file"
    exit 1
fi

# 清理
rm -rf "$TEST_OUTPUT_DIR"

echo -e "${GREEN}✓ 测试 5 完成：通过${NC}"