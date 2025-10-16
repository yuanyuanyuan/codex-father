#!/usr/bin/env bash

# 演示修复效果的脚本
# 展示参数预检查机制的工作

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "========================================"
echo -e "${BLUE}🚀 Codex-Father 修复效果演示${NC}"
echo "========================================"
echo

# 演示1: 参数验证器
echo -e "${YELLOW}演示1: 参数验证器功能${NC}"
echo "----------------------------------------"

echo "📋 测试空参数验证:"
./lib/param_validator.sh validate
echo

echo "📋 测试自动修复功能:"
echo "原始参数: --task 'hello world'"
echo "修复后参数:"
./lib/param_validator.sh auto-fix --task "hello world"
echo

echo "📋 测试完整参数验证:"
./lib/param_validator.sh validate --tag demo --task "hello world" --skip-git-repo-check
echo

# 演示2: 启动脚本集成
echo -e "${YELLOW}演示2: 启动脚本中的参数检查${NC}"
echo "----------------------------------------"

TEMP_LOG=$(mktemp)
echo "📋 运行启动脚本（带最小参数）:"
echo "命令: ./start.sh --task 'demo task' --tag 'demo' --log-file $TEMP_LOG --dry-run"

if ./start.sh --task "demo task" --tag "demo" --log-file "$TEMP_LOG" --dry-run >/dev/null 2>&1; then
    echo -e "${GREEN}✓ 启动脚本执行成功${NC}"
    echo
    echo "📝 日志中的参数检查记录:"
    grep -A1 -B1 "param-check" "$TEMP_LOG" || echo "未找到参数检查记录"
    echo
    echo "📝 完整日志路径: $TEMP_LOG"
    echo
    echo "📝 日志片段（前10行）:"
    head -10 "$TEMP_LOG" | sed 's/^/  /'
else
    echo -e "${RED}✗ 启动脚本执行失败${NC}"
fi

echo
echo "========================================"
echo -e "${GREEN}🎉 修复效果总结${NC}"
echo "========================================"
echo "✅ 添加了参数预检查机制"
echo "✅ 实现了自动参数修复功能"
echo "✅ 集成到启动脚本中"
echo "✅ 提供详细的日志记录"
echo "✅ 支持Git仓库状态检查"
echo "✅ 自动添加缺失的--tag参数"
echo "✅ 自动添加--skip-git-repo-check（如需要）"
echo
echo -e "${BLUE}📚 使用建议:${NC}"
echo "1. 所有任务都应添加 --tag 参数以便区分日志"
echo "2. 在非Git仓库中运行时，添加 --skip-git-repo-check"
echo "3. 使用参数验证器检查命令: ./lib/param_validator.sh validate [args...]"
echo "4. 使用自动修复功能: ./lib/param_validator.sh auto-fix [args...]"
echo

# 清理提示
if [[ -f "$TEMP_LOG" ]]; then
    echo "📝 完整日志文件保存在: $TEMP_LOG"
    echo "   可以查看详细内容: cat $TEMP_LOG"
fi

echo -e "${GREEN}演示完成！ 🎊${NC}"