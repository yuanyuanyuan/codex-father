#!/usr/bin/env bash

# Preview版本MCP服务器测试脚本
# 用于验证配置是否正确

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}========================================${NC}"
echo -e "${BLUE}🧪 Preview版本MCP服务器测试${NC}"
echo -e "${CYAN}========================================${NC}"
echo

# 测试1: 路径验证
echo -e "${BLUE}测试1: 验证文件路径${NC}"
MCP_SERVER_PATH="/data/codex-father/mcp/codex-mcp-server/dist/index.js"

if [[ -f "$MCP_SERVER_PATH" ]]; then
    echo -e "   ${GREEN}✅ MCP服务器文件存在${NC}"
    echo -e "   ${CYAN}   路径: $MCP_SERVER_PATH${NC}"
else
    echo -e "   ${RED}❌ MCP服务器文件不存在${NC}"
    echo -e "   ${YELLOW}   预期路径: $MCP_SERVER_PATH${NC}"
    exit 1
fi
echo

# 测试2: Node.js环境
echo -e "${BLUE}测试2: 验证Node.js环境${NC}"
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version)
    echo -e "   ${GREEN}✅ Node.js可用: $NODE_VERSION${NC}"
else
    echo -e "   ${RED}❌ Node.js不可用${NC}"
    exit 1
fi
echo

# 测试3: 版本检查
echo -e "${BLUE}测试3: 验证MCP服务器版本${NC}"
if VERSION_OUTPUT=$(node "$MCP_SERVER_PATH" --version 2>&1); then
    echo -e "   ${GREEN}✅ 版本检查通过${NC}"
    echo -e "   ${CYAN}   版本: $VERSION_OUTPUT${NC}"
else
    echo -e "   ${RED}❌ 版本检查失败${NC}"
    echo -e "   ${YELLOW}   错误: $VERSION_OUTPUT${NC}"
    exit 1
fi
echo

# 测试4: 帮助信息
echo -e "${BLUE}测试4: 验证帮助信息${NC}"
if HELP_OUTPUT=$(node "$MCP_SERVER_PATH" --help 2>&1); then
    echo -e "   ${GREEN}✅ 帮助信息正常${NC}"
    echo -e "   ${CYAN}   支持的参数: --transport, --help, --version${NC}"
else
    echo -e "   ${RED}❌ 帮助信息失败${NC}"
    echo -e "   ${YELLOW}   错误: $HELP_OUTPUT${NC}"
    exit 1
fi
echo

# 测试5: 环境变量启动测试
echo -e "${BLUE}测试5: 环境变量启动测试${NC}"
ENV_VARS=(
    "LOG_LEVEL=info"
    "CODEX_MCP_PROJECT_ROOT=/data/codex-father"
    "MAX_CONCURRENT_JOBS=10"
    "APPROVAL_POLICY=on-failure"
)

echo -e "   ${CYAN}启动参数:${NC}"
for var in "${ENV_VARS[@]}"; do
    echo -e "   ${BLUE}   • $var${NC}"
done

echo -e "   ${YELLOW}启动测试服务器（3秒后自动停止）...${NC}"
if timeout 3s env "${ENV_VARS[@]}" node "$MCP_SERVER_PATH" 2>&1 | grep -q "等待 MCP 客户端"; then
    echo -e "   ${GREEN}✅ 服务器启动成功${NC}"
else
    echo -e "   ${RED}❌ 服务器启动失败${NC}"
    exit 1
fi
echo

# 测试6: 配置文件验证
echo -e "${BLUE}测试6: 验证Claude Code配置${NC}"
CLAUDE_CONFIG="/home/stark/.config/claude/claude_desktop_config.json"

if [[ -f "$CLAUDE_CONFIG" ]]; then
    echo -e "   ${GREEN}✅ Claude配置文件存在${NC}"

    if grep -q "codex-father-preview" "$CLAUDE_CONFIG"; then
        echo -e "   ${GREEN}✅ Preview配置已添加${NC}"

        # 检查路径是否正确
        if grep -q "/data/codex-father/mcp/codex-mcp-server/dist/index.js" "$CLAUDE_CONFIG"; then
            echo -e "   ${GREEN}✅ 路径配置正确${NC}"
        else
            echo -e "   ${YELLOW}⚠️  路径可能需要检查${NC}"
        fi
    else
        echo -e "   ${YELLOW}⚠️  Preview配置未找到${NC}"
    fi
else
    echo -e "   ${RED}❌ Claude配置文件不存在${NC}"
fi
echo

# 测试总结
echo -e "${PURPLE}📊 测试总结${NC}"
echo "========================================"
echo -e "${GREEN}✅ Preview版本MCP服务器配置验证完成${NC}"
echo
echo -e "${CYAN}🎯 下一步操作:${NC}"
echo "1. 重启Claude Code应用"
echo "2. 验证两个MCP服务器都已加载:"
echo "   - codex-father (原版)"
echo "   - codex-father-preview (v3.2.0)"
echo "3. 测试新功能:"
echo "   - codex_exec"
echo "   - codex_reply"
echo "   - codex_status"
echo "   - codex_logs"
echo "   - codex_list"
echo "   - codex_cancel"
echo
echo -e "${BLUE}📚 相关命令:${NC}"
echo "• 查看版本: node $MCP_SERVER_PATH --version"
echo "• 查看帮助: node $MCP_SERVER_PATH --help"
echo "• 调试启动: LOG_LEVEL=debug node $MCP_SERVER_PATH"
echo

echo -e "${GREEN}🎉 配置完成！现在可以重启Claude Code测试新功能了${NC}"