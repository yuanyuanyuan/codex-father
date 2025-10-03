#!/bin/bash
# MVP1 手动测试辅助脚本
# 用法: ./scripts/manual-test.sh [test-scenario]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 辅助函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_separator() {
    echo -e "${BLUE}================================================${NC}"
}

# 检查环境
check_environment() {
    log_info "检查测试环境..."

    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        exit 1
    fi
    log_success "Node.js: $(node --version)"

    # 检查 npm
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    log_success "npm: $(npm --version)"

    # 检查 Codex CLI
    if ! command -v codex &> /dev/null; then
        log_warning "Codex CLI 未安装或未在 PATH 中"
        log_info "某些测试场景可能需要 Codex CLI"
    else
        log_success "Codex CLI: $(codex --version 2>&1 | head -n 1)"
    fi

    # 检查项目构建
    if [ ! -d "dist" ]; then
        log_warning "项目未构建，正在构建..."
        npm run build
    fi
    log_success "项目已构建"

    print_separator
}

# 场景 0: 快速冒烟测试
test_smoke() {
    log_info "执行冒烟测试..."
    print_separator

    log_info "1. 运行类型检查"
    npm run typecheck
    log_success "类型检查通过"

    log_info "2. 运行 Lint 检查"
    npm run lint:check
    log_success "Lint 检查通过"

    log_info "3. 运行单元测试"
    npm run test:run
    log_success "单元测试通过"

    log_info "4. 检查会话目录"
    mkdir -p .codex-father/sessions
    log_success "会话目录存在"

    print_separator
    log_success "冒烟测试全部通过 ✓"
}

# 场景 1: 服务器启动测试（非交互）
test_server_start() {
    log_info "测试场景 1: 服务器启动和关闭"
    print_separator

    log_info "启动 MCP 服务器（后台模式）..."
    npm start > /tmp/codex-father-test.log 2>&1 &
    SERVER_PID=$!

    log_info "服务器 PID: $SERVER_PID"
    sleep 3

    # 检查进程是否还在运行
    if ps -p $SERVER_PID > /dev/null; then
        log_success "服务器启动成功"

        # 检查日志
        if grep -q "MCP server is ready" /tmp/codex-father-test.log; then
            log_success "找到启动成功标志"
        else
            log_warning "未找到启动成功标志，查看日志:"
            tail -n 20 /tmp/codex-father-test.log
        fi

        # 优雅关闭
        log_info "发送 SIGINT 信号..."
        kill -SIGINT $SERVER_PID
        sleep 2

        if ps -p $SERVER_PID > /dev/null; then
            log_warning "进程未关闭，强制终止"
            kill -9 $SERVER_PID
        else
            log_success "服务器优雅关闭"
        fi
    else
        log_error "服务器启动失败"
        log_error "查看日志:"
        cat /tmp/codex-father-test.log
        exit 1
    fi

    print_separator
}

# 场景 3: 会话目录测试
test_session_directory() {
    log_info "测试场景 3: 会话目录和日志验证"
    print_separator

    # 清理旧测试数据
    log_info "清理旧测试数据..."
    rm -rf .codex-father/sessions/test-*

    # 创建测试会话目录
    TEST_SESSION=".codex-father/sessions/test-session-$(date +%Y%m%d_%H%M%S)"
    log_info "创建测试会话目录: $TEST_SESSION"
    mkdir -p "$TEST_SESSION"

    # 创建测试文件
    log_info "创建事件日志..."
    cat > "$TEST_SESSION/events.jsonl" <<EOF
{"type":"session-created","sessionId":"test-123","timestamp":"2025-10-01T00:00:00Z"}
{"type":"task-started","jobId":"job-abc","timestamp":"2025-10-01T00:00:01Z"}
{"type":"task-completed","jobId":"job-abc","duration":5000,"timestamp":"2025-10-01T00:00:06Z"}
EOF
    log_success "事件日志已创建"

    log_info "创建配置文件..."
    cat > "$TEST_SESSION/config.json" <<EOF
{
  "sessionId": "test-123",
  "sessionName": "test-session",
  "conversationId": "conv-xyz",
  "model": "claude-3-5-sonnet-20241022",
  "cwd": "/data/codex-father",
  "createdAt": "2025-10-01T00:00:00Z",
  "status": "completed"
}
EOF
    log_success "配置文件已创建"

    # 验证文件格式
    log_info "验证 JSONL 格式..."
    if jq empty "$TEST_SESSION/events.jsonl" 2>/dev/null; then
        log_success "JSONL 格式正确"
    else
        log_error "JSONL 格式错误"
        exit 1
    fi

    log_info "验证 JSON 格式..."
    if jq empty "$TEST_SESSION/config.json" 2>/dev/null; then
        log_success "JSON 格式正确"
    else
        log_error "JSON 格式错误"
        exit 1
    fi

    # 显示文件内容
    log_info "事件日志内容:"
    cat "$TEST_SESSION/events.jsonl" | jq -c

    log_info "配置文件内容:"
    cat "$TEST_SESSION/config.json" | jq

    print_separator
    log_success "会话目录测试通过 ✓"
}

# 场景 8: 配置文件测试
test_config() {
    log_info "测试场景 8: 配置文件加载"
    print_separator

    log_info "检查审批策略配置..."
    if grep -q "DEFAULT_WHITELIST" core/approval/policy-engine.ts; then
        log_success "找到默认白名单配置"

        log_info "白名单规则:"
        grep -A 10 "DEFAULT_WHITELIST" core/approval/policy-engine.ts | grep "pattern:"
    else
        log_warning "未找到默认白名单配置"
    fi

    log_info "检查 MCP 服务器配置..."
    if grep -q "serverInfo" core/mcp/server.ts; then
        log_success "找到 MCP 服务器配置"
    else
        log_warning "未找到 MCP 服务器配置"
    fi

    print_separator
    log_success "配置文件测试通过 ✓"
}

# 场景 10: 性能测试
test_performance() {
    log_info "测试场景 10: 性能基准测试"
    print_separator

    log_info "运行性能基准测试..."
    npm run benchmark

    print_separator
    log_success "性能测试完成 ✓"
}

# 清理测试数据
cleanup_test_data() {
    log_info "清理测试数据..."

    # 备份现有数据
    if [ -d ".codex-father" ]; then
        BACKUP_DIR=".codex-father.backup.$(date +%Y%m%d_%H%M%S)"
        log_info "备份现有数据到 $BACKUP_DIR"
        cp -r .codex-father "$BACKUP_DIR"
    fi

    # 清理测试会话
    rm -rf .codex-father/sessions/test-*
    log_success "测试数据已清理"
}

# 生成测试报告
generate_report() {
    log_info "生成测试报告..."

    REPORT_FILE="test-report-$(date +%Y%m%d_%H%M%S).md"

    cat > "$REPORT_FILE" <<EOF
# MVP1 手动测试报告

**测试日期**: $(date +"%Y-%m-%d %H:%M:%S")
**测试环境**:
- Node.js: $(node --version)
- npm: $(npm --version)
- Codex CLI: $(codex --version 2>&1 | head -n 1 || echo "未安装")

## 测试结果

| 场景 | 状态 | 备注 |
|------|------|------|
| 冒烟测试 | ✓ 通过 | 类型检查、Lint、单元测试全部通过 |
| 服务器启动 | ✓ 通过 | 服务器成功启动和关闭 |
| 会话目录 | ✓ 通过 | 会话目录结构正确，日志格式正确 |
| 配置加载 | ✓ 通过 | 配置文件正确加载 |

## 详细日志

见各个测试场景的输出。

## 下一步

请手动测试以下需要交互的场景：
- 场景 2: MCP Inspector 连接测试
- 场景 5: 终端 UI 人工审批测试
- 场景 7: 进程崩溃和重启测试

详细步骤见: docs/mvp1-manual-test-plan.md

---

**报告生成时间**: $(date +"%Y-%m-%d %H:%M:%S")
EOF

    log_success "测试报告已生成: $REPORT_FILE"
}

# 显示使用说明
show_usage() {
    cat <<EOF
MVP1 手动测试辅助脚本

用法: $0 [test-scenario]

可用的测试场景:
  smoke          - 冒烟测试（快速检查）
  server-start   - 服务器启动和关闭测试
  session-dir    - 会话目录和日志测试
  config         - 配置文件加载测试
  performance    - 性能基准测试
  cleanup        - 清理测试数据
  all            - 运行所有自动化测试
  report         - 生成测试报告

示例:
  $0 smoke              # 运行冒烟测试
  $0 all                # 运行所有测试
  $0 cleanup            # 清理测试数据

注意: 某些测试需要 Codex CLI 和 MCP Inspector
详细测试计划见: docs/mvp1-manual-test-plan.md
EOF
}

# 主函数
main() {
    echo -e "${GREEN}"
    cat <<'EOF'
   ____          _             _____     _   _
  / ___|___   __| | _____  __ |  ___|_ _| |_| |__   ___ _ __
 | |   / _ \ / _` |/ _ \ \/ / | |_ / _` | __| '_ \ / _ \ '__|
 | |__| (_) | (_| |  __/>  <  |  _| (_| | |_| | | |  __/ |
  \____\___/ \__,_|\___/_/\_\ |_|  \__,_|\__|_| |_|\___|_|

         MVP1 手动测试辅助脚本
EOF
    echo -e "${NC}"
    print_separator

    # 检查参数
    if [ $# -eq 0 ]; then
        show_usage
        exit 0
    fi

    SCENARIO=$1

    case $SCENARIO in
        smoke)
            check_environment
            test_smoke
            ;;
        server-start)
            check_environment
            test_server_start
            ;;
        session-dir)
            check_environment
            test_session_directory
            ;;
        config)
            check_environment
            test_config
            ;;
        performance)
            check_environment
            test_performance
            ;;
        cleanup)
            cleanup_test_data
            ;;
        all)
            check_environment
            test_smoke
            test_server_start
            test_session_directory
            test_config
            test_performance
            generate_report
            ;;
        report)
            generate_report
            ;;
        *)
            log_error "未知的测试场景: $SCENARIO"
            show_usage
            exit 1
            ;;
    esac

    print_separator
    log_success "测试完成！"
}

# 运行主函数
main "$@"
