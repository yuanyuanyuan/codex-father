#!/usr/bin/env bash
# 测试2: 复杂指令内容处理

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}测试 2: 复杂指令内容处理${NC}"

TEST_OUTPUT_DIR="/tmp/codex-father-test-2"
mkdir -p "$TEST_OUTPUT_DIR"

test_tag="test-2-$(date +%Y%m%d_%H%M%S)"
log_file="$TEST_OUTPUT_DIR/test2.log"

# 创建复杂任务
COMPLEX_TASK=$(cat <<'EOF'
请执行以下任务：
1. 创建一个名为 complex-test.txt 的文件
2. 文件内容包含：
   - 项目名称：Codex Father
   - 版本：1.7.0
   - 功能：CLI 工具架构
   - 特性：支持 MCP 服务器模块
3. 列出文件内容
4. 输出任务完成标记
EOF
)

echo "运行复杂任务测试..."

# 运行复杂任务
./start.sh --tag "$test_tag" --task "$COMPLEX_TASK" --sandbox workspace-write --dry-run > "$log_file" 2>&1
exit_code=$?

if [ $exit_code -eq 0 ]; then
    # 检查退出码
    if grep -q "退出码: 0" "$log_file"; then
        echo -e "${GREEN}✓ 复杂指令内容处理通过${NC}"

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
        echo -e "${RED}✗ 复杂指令处理退出码不正确${NC}"
        tail -20 "$log_file"
        exit 1
    fi
else
    echo -e "${RED}✗ 复杂指令处理失败${NC}"
    echo "查看日志内容："
    tail -30 "$log_file"
    exit 1
fi

# 清理
rm -rf "$TEST_OUTPUT_DIR"

echo -e "${GREEN}✓ 测试 2 完成：通过${NC}"