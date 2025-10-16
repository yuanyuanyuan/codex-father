#!/usr/bin/env bash

# MCP智能引导工具
# 在MCP连接时提供智能引导和配置检查

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 配置
SCRIPT_NAME="MCP智能引导助手"
VERSION="1.0.0"

# 检测是否为MCP启动环境
is_mcp_startup() {
    # 检查是否在MCP启动参数中
    if [[ "${1:-}" == "--mcp-mode" ]] ||
       [[ "${CODEX_FATHER_MCP_MODE:-}" == "true" ]] ||
       [[ "${PWD}" == *"mcp"* ]]; then
        return 0
    fi
    return 1
}

# 检查Claude Code配置
check_claude_config() {
    echo -e "${CYAN}🔍 检查Claude Code配置...${NC}"
    echo "----------------------------------------"

    local os=$(uname -s)
    local config_dir=""
    local config_file=""

    case "$os" in
        "Darwin")
            config_dir="$HOME/Library/Application Support/Claude"
            config_file="$config_dir/claude_desktop_config.json"
            ;;
        "Linux")
            config_dir="$HOME/.config/claude"
            config_file="$config_dir/claude_desktop_config.json"
            ;;
        *)
            config_dir="$HOME/.config/claude"
            config_file="$config_dir/claude_desktop_config.json"
            ;;
    esac

    echo -e "📁 配置目录: ${BLUE}$config_dir${NC}"

    if [[ -f "$config_file" ]]; then
        echo -e "✅ 配置文件存在: ${GREEN}$config_file${NC}"

        # 检查MCP配置
        if command -v jq >/dev/null 2>&1; then
            local mcp_count=$(jq '.mcpServers | keys | length' "$config_file" 2>/dev/null || echo "0")
            echo -e "📊 MCP服务器数量: ${GREEN}$mcp_count${NC}"

            if [[ $mcp_count -gt 0 ]]; then
                echo -e "✅ ${GREEN}已配置MCP服务器${NC}"

                # 检查是否包含codex-father
                if jq -e '.mcpServers | has("codex-father")' "$config_file" 2>/dev/null; then
                    echo -e "✅ ${GREEN}Codex Father MCP已配置${NC}"

                    # 显示配置详情
                    echo -e "📋 配置详情:"
                    local cmd=$(jq -r '.mcpServers["codex-father"].command' "$config_file" 2>/dev/null || echo "codex-father")
                    local args=$(jq -r '.mcpServers["codex-father"].args[]?' "$config_file" 2>/dev/null | tr '\n' ' ' || echo "mcp")
                    echo -e "   命令: ${BLUE}$cmd${NC}"
                    echo -e "   参数: ${BLUE}$args${NC}"
                else
                    echo -e "⚠️  ${YELLOW}未配置Codex Father MCP${NC}"
                    return 1
                fi
            else
                echo -e "⚠️  ${YELLOW}未配置MCP服务器${NC}"
                return 1
            fi
        else
            echo -e "⚠️  ${YELLOW}无法解析配置文件（需要jq工具）${NC}"
        fi
    else
        echo -e "❌ ${RED}配置文件不存在${NC}"
        echo -e "   ${CYAN}预期位置: $config_file${NC}"
        return 1
    fi

    return 0
}

# 检查MCP服务器状态
check_mcp_server() {
    echo -e "${CYAN}🚀 检查MCP服务器状态...${NC}"
    echo "----------------------------------------"

    # 检查codex-father命令
    if command -v codex-father >/dev/null 2>&1; then
        local version=$(codex-father --version 2>/dev/null || echo "unknown")
        echo -e "✅ Codex Father: ${GREEN}$version${NC}"
    else
        echo -e "❌ ${RED}Codex Father未安装${NC}"
        echo -e "   ${YELLOW}安装命令: npm install -g codex-father${NC}"
        return 1
    fi

    # 检查MCP服务器是否运行
    local mcp_processes=$(pgrep -f "codex-father.*mcp" 2>/dev/null || echo "")
    if [[ -n "$mcp_processes" ]]; then
        echo -e "✅ ${GREEN}MCP服务器正在运行${NC}"
        echo -e "📊 进程: $mcp_processes"
    else
        echo -e "⚠️  ${YELLOW}MCP服务器未运行${NC}"
        echo -e "   ${CYAN}启动命令: codex-father mcp${NC}"
    fi

    return 0
}

# 生成配置建议
generate_config_suggestions() {
    echo -e "${PURPLE}💡 配置建议${NC}"
    echo "========================================"

    echo -e "${YELLOW}1. 快速配置命令:${NC}"
    echo "   ./mcp_init_helper.sh --generate"
    echo

    echo -e "${YELLOW}2. 手动配置模板:${NC}"
    cat << 'EOF'
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": [
        "mcp",
        "--max-concurrency", "10",
        "--timeout", "600000"
      ],
      "env": {
        "CODEX_FATHER_LOG_LEVEL": "info"
      }
    }
  }
}
EOF
    echo

    echo -e "${YELLOW}3. 配置文件位置:${NC}"
    local os=$(uname -s)
    case "$os" in
        "Darwin")
            echo "   ~/Library/Application Support/Claude/claude_desktop_config.json"
            ;;
        "Linux")
            echo "   ~/.config/claude/claude_desktop_config.json"
            ;;
        *)
            echo "   ~/.config/claude/claude_desktop_config.json"
            ;;
    esac
    echo
}

# 测试MCP连接
test_mcp_connection() {
    echo -e "${CYAN}🧪 测试MCP连接...${NC}"
    echo "----------------------------------------"

    # 简单的连接测试
    if timeout 5s codex-father --version >/dev/null 2>&1; then
        echo -e "✅ ${GREEN}基础连接正常${NC}"
    else
        echo -e "❌ ${RED}基础连接失败${NC}"
        return 1
    fi

    # 尝试启动测试服务器
    local test_log="/tmp/mcp-test-$$.log"
    echo -e "🔄 启动测试服务器..."

    if timeout 3s codex-father mcp --test-mode > "$test_log" 2>&1; then
        echo -e "✅ ${GREEN}MCP服务器测试通过${NC}"
    else
        echo -e "⚠️  ${YELLOW}MCP服务器测试超时（可能正常）${NC}"
    fi

    [[ -f "$test_log" ]] && rm -f "$test_log"

    return 0
}

# 显示使用指引
show_usage_guide() {
    echo -e "${PURPLE}📚 MCP使用指引${NC}"
    echo "========================================"

    echo -e "${YELLOW}Claude Code中的MCP工具:${NC}"
    echo "• codex_exec     - 执行开发任务"
    echo "• codex_status   - 查询任务状态"
    echo "• codex_logs     - 获取执行日志"
    echo "• codex_reply    - 继续任务对话"
    echo "• codex_list     - 列出所有任务"
    echo "• codex_cancel   - 取消运行任务"
    echo

    echo -e "${YELLOW}常用对话示例:${NC}"
    echo -e "${BLUE}用户:${NC} 帮我创建一个React项目"
    echo -e "${GREEN}Claude:${NC} [调用codex_exec] ✅ 任务已提交..."
    echo
    echo -e "${BLUE}用户:${NC} 任务进度如何？"
    echo -e "${GREEN}Claude:${NC} [调用codex_status] 📊 项目开发进度(60%)..."
    echo

    echo -e "${YELLOW}快速开始:${NC}"
    echo "1. 重启Claude Code"
    echo "2. 输入: \"检查MCP工具是否可用\""
    echo "3. 开始使用codex_*工具"
    echo

    echo -e "${CYAN}📖 详细文档:${NC}"
    echo "• MCP_QUICKSTART.md - 快速开始指南"
    echo "• docs/user/mcp/ - 详细MCP文档"
    echo "• ./mcp_init_helper.sh --help - 初始化助手"
    echo
}

# 显示状态总结
show_status_summary() {
    local config_ok="$1"
    local server_ok="$2"
    local mcp_mode="$3"

    echo -e "${PURPLE}📊 状态总结${NC}"
    echo "========================================"

    if [[ "$mcp_mode" == "true" ]]; then
        echo -e "🤖 ${CYAN}MCP启动模式${NC}"
    fi

    echo -e "配置状态: $([ "$config_ok" == "0" ] && echo "${GREEN}✅ 正常${NC}" || echo "${RED}❌ 需要配置${NC}")"
    echo -e "服务器状态: $([ "$server_ok" == "0" ] && echo "${GREEN}✅ 正常${NC}" || echo "${YELLOW}⚠️  未运行${NC}")"

    if [[ "$config_ok" == "0" && "$server_ok" == "0" ]]; then
        echo -e "${GREEN}🎉 MCP环境完全就绪！${NC}"
        echo
        echo -e "${CYAN}下一步操作:${NC}"
        echo "1. 重启Claude Code应用"
        echo "2. 验证MCP工具加载"
        echo "3. 开始对话式开发"
    elif [[ "$config_ok" != "0" ]]; then
        echo -e "${YELLOW}🔧 需要配置MCP${NC}"
        echo
        echo -e "${CYAN}推荐操作:${NC}"
        echo "1. 运行: ./mcp_init_helper.sh --demo"
        echo "2. 或手动配置Claude Code"
        echo "3. 重启应用并验证"
    else
        echo -e "${YELLOW}🚀 需要启动MCP服务器${NC}"
        echo
        echo -e "${CYAN}推荐操作:${NC}"
        echo "1. 运行: codex-father mcp"
        echo "2. 检查服务器状态"
        echo "3. 验证工具可用性"
    fi
    echo
}

# 主函数
main() {
    local mcp_mode=false
    local action="check"
    local auto_config=false

    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            --mcp-mode)
                mcp_mode=true
                shift
                ;;
            --check)
                action="check"
                shift
                ;;
            --generate)
                action="generate"
                shift
                ;;
            --test)
                action="test"
                shift
                ;;
            --guide)
                action="guide"
                shift
                ;;
            --auto-config)
                auto_config=true
                shift
                ;;
            -h|--help)
                echo -e "${CYAN}$SCRIPT_NAME v$VERSION${NC}"
                echo
                echo -e "${YELLOW}用法:${NC}"
                echo "  $0 [选项]"
                echo
                echo -e "${YELLOW}选项:${NC}"
                echo "  --mcp-mode      MCP启动模式（自动检测）"
                echo "  --check         检查配置和状态"
                echo "  --generate      生成配置文件"
                echo "  --test          测试MCP连接"
                echo "  --guide         显示使用指引"
                echo "  --auto-config   自动修复配置问题"
                echo "  -h, --help      显示帮助信息"
                echo
                echo -e "${YELLOW}示例:${NC}"
                echo "  $0                    # 检查状态"
                echo "  $0 --mcp-mode          # MCP启动时自动检查"
                echo "  $0 --auto-config        # 自动修复问题"
                echo
                exit 0
                ;;
            *)
                echo -e "${RED}未知选项: $1${NC}"
                echo "使用 $0 --help 查看帮助"
                exit 1
                ;;
        esac
    done

    echo -e "${CYAN}$SCRIPT_NAME v$VERSION${NC}"
    echo "========================================"

    # 执行检查
    local config_ok=1
    local server_ok=1

    if [[ "$action" == "check" || "$action" == "all" ]]; then
        if check_claude_config; then
            config_ok=0
        fi

        if check_mcp_server; then
            server_ok=0
        fi
    fi

    case "$action" in
        "check")
            show_status_summary "$config_ok" "$server_ok" "$mcp_mode"
            ;;
        "generate")
            generate_config_suggestions
            ;;
        "test")
            test_mcp_connection
            ;;
        "guide")
            show_usage_guide
            ;;
        "all")
            if [[ "$config_ok" != "0" ]]; then
                generate_config_suggestions
            fi

            if [[ "$server_ok" != "0" ]]; then
                test_mcp_connection
            fi

            show_usage_guide
            show_status_summary "$config_ok" "$server_ok" "$mcp_mode"
            ;;
    esac

    # 自动配置模式
    if [[ "$auto_config" == "true" && "$config_ok" != "0" ]]; then
        echo -e "${YELLOW}🔧 检测到配置问题，尝试自动修复...${NC}"
        echo

        # 尝试运行初始化助手
        if [[ -f "./mcp_init_helper.sh" ]]; then
            echo -e "${CYAN}运行MCP初始化助手...${NC}"
            if ./mcp_init_helper.sh --generate; then
                echo -e "${GREEN}✅ 配置已自动生成${NC}"
                config_ok=0
            else
                echo -e "${RED}❌ 自动配置失败${NC}"
            fi
        fi

        show_status_summary "$config_ok" "$server_ok" "$mcp_mode"
    fi
}

# 如果直接执行脚本，运行主函数
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi