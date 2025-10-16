#!/usr/bin/env bash
# SIGPIPE 修复验证冒烟测试

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试配置
TEST_TAG="sigpipe-smoke-$(date +%Y%m%d_%H%M%S)"
TEST_OUTPUT_DIR="/tmp/codex-father-sigpipe-smoke"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${YELLOW}开始 SIGPIPE 修复验证冒烟测试${NC}"
echo "项目根目录: $PROJECT_ROOT"
echo "测试标签: $TEST_TAG"
echo "测试输出目录: $TEST_OUTPUT_DIR"
echo ""

# 清理函数
cleanup() {
    echo -e "${YELLOW}清理测试环境...${NC}"
    rm -rf "$TEST_OUTPUT_DIR"
}

# 错误处理
handle_error() {
    echo -e "${RED}✗ 测试失败: $1${NC}"
    cleanup
    exit 1
}

# 成功标记
mark_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# 设置清理陷阱
trap cleanup EXIT

# 创建测试输出目录
mkdir -p "$TEST_OUTPUT_DIR"

# 测试 1: 基本脚本执行（无 SIGPIPE）
echo "测试 1: 基本脚本执行..."
if ./start.sh --tag "$TEST_TAG" --task "创建测试文件验证脚本运行" --sandbox workspace-write > "$TEST_OUTPUT_DIR/test1.log" 2>&1; then
    # 检查退出码
    if grep -q "退出码: 0" "$TEST_OUTPUT_DIR/test1.log"; then
        mark_success "基本脚本执行通过"
    else
        handle_error "脚本退出码不正确"
    fi

    # 检查是否有 SIGPIPE 错误
    if grep -q "Exit Code: 141" "$TEST_OUTPUT_DIR/test1.log"; then
        handle_error "检测到 SIGPIPE 错误 (Exit Code: 141)"
    fi
else
    handle_error "脚本执行失败"
fi

# 测试 2: 复杂指令内容（测试管道处理）
echo ""
echo "测试 2: 复杂指令内容处理..."
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

if ./start.sh --tag "${TEST_TAG}-complex" --task "$COMPLEX_TASK" --sandbox workspace-write > "$TEST_OUTPUT_DIR/test2.log" 2>&1; then
    if grep -q "退出码: 0" "$TEST_OUTPUT_DIR/test2.log"; then
        mark_success "复杂指令内容处理通过"
    else
        handle_error "复杂指令处理退出码不正确"
    fi

    if grep -q "Exit Code: 141" "$TEST_OUTPUT_DIR/test2.log"; then
        handle_error "复杂指令处理检测到 SIGPIPE 错误"
    fi
else
    handle_error "复杂指令处理失败"
fi

# 测试 3: 标题提取功能（测试 awk 修复）
echo ""
echo "测试 3: 标题提取功能..."
TITLE_TASK="任务：验证标题提取功能

这是一个专门用于测试 awk 和管道修复的任务。
标题应该能够正确提取，不会导致 SIGPIPE 错误。
包含多行内容的任务应该能够正常处理。

完成测试后输出：标题提取成功。"

if ./start.sh --tag "${TEST_TAG}-title" --task "$TITLE_TASK" --sandbox workspace-write > "$TEST_OUTPUT_DIR/test3.log" 2>&1; then
    if grep -q "退出码: 0" "$TEST_OUTPUT_DIR/test3.log"; then
        mark_success "标题提取功能通过"
    else
        handle_error "标题提取功能退出码不正确"
    fi

    if grep -q "Exit Code: 141" "$TEST_OUTPUT_DIR/test3.log"; then
        handle_error "标题提取功能检测到 SIGPIPE 错误"
    fi
else
    handle_error "标题提取功能失败"
fi

# 测试 4: 大量内容处理（测试临时文件修复）
echo ""
echo "测试 4: 大量内容处理..."
LARGE_CONTENT=$(printf "这是大量内容的第 %d 行，用于测试临时文件处理能力，避免管道导致的 SIGPIPE 错误。\n" {1..200})

if ./start.sh --tag "${TEST_TAG}-large" --task "$LARGE_CONTENT 请处理这些内容" --sandbox workspace-write > "$TEST_OUTPUT_DIR/test4.log" 2>&1; then
    if grep -q "退出码: 0" "$TEST_OUTPUT_DIR/test4.log"; then
        mark_success "大量内容处理通过"
    else
        handle_error "大量内容处理退出码不正确"
    fi

    if grep -q "Exit Code: 141" "$TEST_OUTPUT_DIR/test4.log"; then
        handle_error "大量内容处理检测到 SIGPIPE 错误"
    fi
else
    handle_error "大量内容处理失败"
fi

# 测试 5: Node.js heredoc 处理
echo ""
echo "测试 5: Node.js heredoc 处理..."
NODE_TASK="请创建一个 Node.js 脚本 test-node.js，该脚本：
1. 导入必要的模块
2. 定义一个简单的函数
3. 输出执行结果
4. 确保脚本可以正常运行"

if ./start.sh --tag "${TEST_TAG}-node" --task "$NODE_TASK" --sandbox workspace-write > "$TEST_OUTPUT_DIR/test5.log" 2>&1; then
    if grep -q "退出码: 0" "$TEST_OUTPUT_DIR/test5.log"; then
        mark_success "Node.js heredoc 处理通过"
    else
        handle_error "Node.js heredoc 处理退出码不正确"
    fi

    if grep -q "Exit Code: 141" "$TEST_OUTPUT_DIR/test5.log"; then
        handle_error "Node.js heredoc 处理检测到 SIGPIPE 错误"
    fi
else
    handle_error "Node.js heredoc 处理失败"
fi

# 汇总测试结果
echo ""
echo "==================================="
echo "测试结果汇总："
echo "==================================="

# 统计日志文件数量
TOTAL_LOGS=$(find "$TEST_OUTPUT_DIR" -name "*.log" | wc -l)
SUCCESS_LOGS=$(grep -l "退出码: 0" "$TEST_OUTPUT_DIR"/*.log 2>/dev/null | wc -l)
SIGPIPE_ERRORS=$(grep -l "Exit Code: 141" "$TEST_OUTPUT_DIR"/*.log 2>/dev/null | wc -l || echo 0)

echo -e "总测试数: ${GREEN}$TOTAL_LOGS${NC}"
echo -e "成功测试: ${GREEN}$SUCCESS_LOGS${NC}"
echo -e "SIGPIPE 错误: ${RED}$SIGPIPE_ERRORS${NC}"

# 生成测试报告
cat > "$TEST_OUTPUT_DIR/test-report.json" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "testTag": "$TEST_TAG",
  "summary": {
    "totalTests": $TOTAL_LOGS,
    "successfulTests": $SUCCESS_LOGS,
    "sigpipeErrors": $SIGPIPE_ERRORS,
    "successRate": "$(echo "scale=2; $SUCCESS_LOGS * 100 / $TOTAL_LOGS" | bc)%"
  },
  "status": "$([ $SIGPIPE_ERRORS -eq 0 ] && echo "PASSED" || echo "FAILED")"
}
EOF

if [ $SIGPIPE_ERRORS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ 所有测试通过！SIGPIPE 错误已成功修复。${NC}"
    echo ""
    echo "测试报告已保存到: $TEST_OUTPUT_DIR/test-report.json"

    # 显示测试报告的简要信息
    if command -v jq >/dev/null 2>&1; then
        echo ""
        echo "测试报告详情："
        jq '.summary' "$TEST_OUTPUT_DIR/test-report.json"
    fi

    exit 0
else
    echo ""
    echo -e "${RED}✗ 检测到 $SIGPIPE_ERRORS 个 SIGPIPE 错误！${NC}"
    echo ""
    echo "请检查日志文件："
    grep -l "Exit Code: 141" "$TEST_OUTPUT_DIR"/*.log | sed 's/^/  /'

    exit 1
fi