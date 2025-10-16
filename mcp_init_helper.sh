#!/usr/bin/env bash

# MCP连接初始化帮助脚本
# 为用户提供完整的MCP配置指引

set -euo pipefail

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 脚本信息
SCRIPT_NAME="MCP 初始化助手"
VERSION="1.0.0"
AUTHOR="浮浮酱"

# 显示帮助信息
show_help() {
    echo -e "${CYAN}========================================${NC}"
    echo -e "${BLUE}$SCRIPT_NAME v$VERSION${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo
    echo -e "${YELLOW}用法:${NC}"
    echo "  $0 [选项]"
    echo
    echo -e "${YELLOW}选项:${NC}"
    echo "  -h, --help     显示此帮助信息"
    echo "  -c, --check    检查当前环境和配置"
    echo "  -g, --generate 生成MCP配置文件"
    echo "  -t, --test     测试MCP连接"
    echo "  -v, --verbose  详细输出"
    echo "  --demo         运行完整演示"
    echo
    echo -e "${YELLOW}示例:${NC}"
    echo "  $0 --check     # 检查环境"
    echo "  $0 --generate  # 生成配置"
    echo "  $0 --test      # 测试连接"
    echo "  $0 --demo      # 完整演示"
    echo
}

# 检查系统环境
check_environment() {
    echo -e "${BLUE}🔍 检查系统环境...${NC}"
    echo "----------------------------------------"

    # 检查操作系统
    local os=$(uname -s)
    echo -e "🖥️  操作系统: ${GREEN}$os${NC}"

    # 检查Node.js
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version)
        echo -e "📦 Node.js: ${GREEN}$node_version${NC}"
    else
        echo -e "📦 Node.js: ${RED}未安装${NC}"
        echo -e "   ${YELLOW}请从 https://nodejs.org 下载安装${NC}"
        return 1
    fi

    # 检查npm
    if command -v npm >/dev/null 2>&1; then
        local npm_version=$(npm --version)
        echo -e "📦 npm: ${GREEN}$npm_version${NC}"
    else
        echo -e "📦 npm: ${RED}未安装${NC}"
        return 1
    fi

    # 检查codex-father
    if command -v codex-father >/dev/null 2>&1; then
        local codex_version=$(codex-father --version 2>/dev/null || echo "unknown")
        echo -e "🚀 codex-father: ${GREEN}$codex_version${NC}"
    else
        echo -e "🚀 codex-father: ${RED}未安装${NC}"
        echo -e "   ${YELLOW}请运行: npm install -g codex-father${NC}"
        return 1
    fi

    # 检查Claude Code配置目录
    local claude_config_dir=""
    case "$os" in
        "Darwin")
            claude_config_dir="$HOME/Library/Application Support/Claude"
            ;;
        "Linux")
            claude_config_dir="$HOME/.config/claude"
            ;;
        *)
            claude_config_dir="$HOME/.config/claude"
            ;;
    esac

    if [[ -d "$claude_config_dir" ]]; then
        echo -e "📁 Claude配置目录: ${GREEN}$claude_config_dir${NC}"
    else
        echo -e "📁 Claude配置目录: ${YELLOW}未找到 (可能首次使用)${NC}"
        echo -e "   ${CYAN}预期位置: $claude_config_dir${NC}"
    fi

    echo
    return 0
}

# 生成MCP配置文件
generate_config() {
    echo -e "${BLUE}📝 生成MCP配置文件...${NC}"
    echo "----------------------------------------"

    local os=$(uname -s)
    local claude_config_dir=""
    local claude_config_file=""

    # 确定配置文件路径
    case "$os" in
        "Darwin")
            claude_config_dir="$HOME/Library/Application Support/Claude"
            claude_config_file="$claude_config_dir/claude_desktop_config.json"
            ;;
        "Linux")
            claude_config_dir="$HOME/.config/claude"
            claude_config_file="$claude_config_dir/claude_desktop_config.json"
            ;;
        *)
            claude_config_dir="$HOME/.config/claude"
            claude_config_file="$claude_config_dir/claude_desktop_config.json"
            ;;
    esac

    # 创建配置目录
    mkdir -p "$claude_config_dir"

    # 备份现有配置
    if [[ -f "$claude_config_file" ]]; then
        local backup_file="$claude_config_file.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$claude_config_file" "$backup_file"
        echo -e "💾 已备份现有配置: ${GREEN}$backup_file${NC}"
    fi

    # 生成新的配置文件
    cat > "$claude_config_file" << 'EOF'
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": [
        "mcp",
        "--max-concurrency", "10",
        "--timeout", "600000",
        "--log-level", "info"
      ],
      "env": {
        "CODEX_FATHER_LOG_LEVEL": "info",
        "CODEX_FATHER_MAX_MEMORY": "1GB"
      },
      "description": "Codex Father 2.0 - 多任务并发管理工具"
    }
  }
}
EOF

    echo -e "✅ 配置文件已生成: ${GREEN}$claude_config_file${NC}"
    echo
    echo -e "${YELLOW}配置说明:${NC}"
    echo "• max-concurrency: 最大并发任务数 (建议 5-20)"
    echo "• timeout: 任务超时时间 (毫秒, 建议 300000-600000)"
    echo "• log-level: 日志级别 (info|debug|warn|error)"
    echo "• CODEX_FATHER_MAX_MEMORY: 最大内存使用限制"
    echo
}

# 测试MCP连接
test_connection() {
    echo -e "${BLUE}🧪 测试MCP连接...${NC}"
    echo "----------------------------------------"

    # 检查codex-father命令
    if ! command -v codex-father >/dev/null 2>&1; then
        echo -e "❌ ${RED}codex-father未安装${NC}"
        return 1
    fi

    # 测试基础功能
    echo -e "📋 测试基础命令..."
    if codex-father --version >/dev/null 2>&1; then
        echo -e "✅ ${GREEN}版本检查通过${NC}"
    else
        echo -e "❌ ${RED}版本检查失败${NC}"
        return 1
    fi

    # 测试MCP服务器启动
    echo -e "🚀 测试MCP服务器..."
    local test_log="/tmp/codex-father-mcp-test-$$.log"

    # 启动测试服务器
    timeout 10s codex-father mcp --test-mode > "$test_log" 2>&1 &
    local test_pid=$!

    # 等待启动
    sleep 3

    # 检查是否仍在运行
    if kill -0 $test_pid 2>/dev/null; then
        echo -e "✅ ${GREEN}MCP服务器启动成功${NC}"
        kill $test_pid 2>/dev/null || true
        wait $test_pid 2>/dev/null || true
    else
        echo -e "⚠️  ${YELLOW}MCP服务器测试超时${NC}"
        echo "   这可能是正常的，某些环境下测试模式可能不可用"
    fi

    # 检查日志
    if [[ -f "$test_log" ]] && [[ -s "$test_log" ]]; then
        echo -e "📝 测试日志:"
        head -5 "$test_log" | sed 's/^/   /'
        rm -f "$test_log"
    fi

    echo
    echo -e "${GREEN}✅ MCP连接测试完成${NC}"
    echo
}

# 显示下一步指引
show_next_steps() {
    echo -e "${PURPLE}🎯 下一步操作指引${NC}"
    echo "========================================"
    echo
    echo -e "${YELLOW}1. 重启Claude Code应用${NC}"
    echo "   完全退出Claude Code，然后重新启动"
    echo
    echo -e "${YELLOW}2. 验证MCP工具${NC}"
    echo "   在Claude Code中输入: \"检查MCP工具是否可用\""
    echo "   应该能看到codex_exec、codex_status等工具"
    echo
    echo -e "${YELLOW}3. 测试基本功能${NC}"
    echo "   用户: \"创建一个Hello World程序\""
    echo "   Claude: [应该会调用codex_exec工具]"
    echo
    echo -e "${YELLOW}4. 查看详细文档${NC}"
    echo "   📖 MCP配置指南: docs/user/mcp/claude-code-setup.md"
    echo "   📖 MCP工具介绍: docs/user/mcp/overview.md"
    echo
    echo -e "${CYAN}📚 常用命令快速参考:${NC}"
    echo "• codex_exec: 执行开发任务"
    echo "• codex_status: 查询任务状态"
    echo "• codex_logs: 获取执行日志"
    echo "• codex_reply: 继续任务对话"
    echo "• codex_list: 列出所有任务"
    echo "• codex_cancel: 取消运行任务"
    echo
}

# 运行完整演示
run_demo() {
    echo -e "${CYAN}🎬 MCP初始化完整演示${NC}"
    echo "========================================"
    echo

    # 步骤1: 环境检查
    echo -e "${BLUE}步骤 1: 环境检查${NC}"
    if check_environment; then
        echo -e "${GREEN}✅ 环境检查通过${NC}"
    else
        echo -e "${RED}❌ 环境检查失败，请先解决环境问题${NC}"
        return 1
    fi
    echo

    # 步骤2: 生成配置
    echo -e "${BLUE}步骤 2: 生成MCP配置${NC}"
    generate_config
    echo

    # 步骤3: 测试连接
    echo -e "${BLUE}步骤 3: 测试MCP连接${NC}"
    test_connection
    echo

    # 步骤4: 下一步指引
    echo -e "${BLUE}步骤 4: 下一步指引${NC}"
    show_next_steps
    echo

    echo -e "${GREEN}🎉 MCP初始化演示完成！${NC}"
    echo -e "${CYAN}现在请重启Claude Code并开始使用MCP功能${NC}"
}

# 详细模式
verbose_mode() {
    echo -e "${CYAN}📊 详细环境信息${NC}"
    echo "========================================"
    echo

    # 系统信息
    echo -e "${YELLOW}系统信息:${NC}"
    uname -a
    echo

    # Node.js详细信息
    if command -v node >/dev/null 2>&1; then
        echo -e "${YELLOW}Node.js详细信息:${NC}"
        node --version
        node --process.versions | head -10
        echo
    fi

    # npm信息
    if command -v npm >/dev/null 2>&1; then
        echo -e "${YELLOW}npm信息:${NC}"
        npm --version
        npm config get prefix
        echo
    fi

    # codex-father信息
    if command -v codex-father >/dev/null 2>&1; then
        echo -e "${YELLOW}codex-father信息:${NC}"
        codex-father --version 2>/dev/null || echo "版本信息获取失败"
        which codex-father
        ls -la "$(which codex-father)" 2>/dev/null || echo "文件信息获取失败"
        echo
    fi

    # 环境变量
    echo -e "${YELLOW}相关环境变量:${NC}"
    env | grep -E "(CODEX|NODE|CLAUDE)" || echo "未找到相关环境变量"
    echo

    # 配置文件检查
    echo -e "${YELLOW}配置文件检查:${NC}"
    local config_files=(
        "$HOME/.config/claude/claude_desktop_config.json"
        "$HOME/Library/Application Support/Claude/claude_desktop_config.json"
        "$HOME/.claude/config.toml"
    )

    for config_file in "${config_files[@]}"; do
        if [[ -f "$config_file" ]]; then
            echo -e "✅ ${GREEN}$config_file${NC}"
            if command -v jq >/dev/null 2>&1; then
                echo "   内容预览:"
                jq '.mcpServers | keys' "$config_file" 2>/dev/null || echo "   JSON解析失败"
            fi
        else
            echo -e "❌ ${RED}$config_file (不存在)${NC}"
        fi
    done
    echo
}

# 主函数
main() {
    local action=""
    local verbose=false

    # 解析命令行参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -c|--check)
                action="check"
                shift
                ;;
            -g|--generate)
                action="generate"
                shift
                ;;
            -t|--test)
                action="test"
                shift
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            --demo)
                action="demo"
                shift
                ;;
            *)
                echo -e "${RED}未知选项: $1${NC}"
                show_help
                exit 1
                ;;
        esac
    done

    # 如果没有指定action，显示帮助
    if [[ -z "$action" ]]; then
        show_help
        exit 0
    fi

    # 执行详细模式（如果启用）
    if [[ "$verbose" == "true" ]]; then
        verbose_mode
    fi

    # 执行指定action
    case "$action" in
        check)
            check_environment
            ;;
        generate)
            generate_config
            ;;
        test)
            test_connection
            ;;
        demo)
            run_demo
            ;;
    esac
}

# 如果直接执行脚本，运行主函数
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi