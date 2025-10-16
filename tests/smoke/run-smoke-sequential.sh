#!/usr/bin/env bash
# 逐个后台执行冒烟测试脚本

set -euo pipefail

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 获取脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# 配置
LOG_DIR="$PROJECT_ROOT/.smoke-test-logs"
mkdir -p "$LOG_DIR"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}逐个后台执行冒烟测试${NC}"
echo -e "${BLUE}=====================================${NC}"
echo -e "项目根目录: $PROJECT_ROOT"
echo -e "日志目录: $LOG_DIR"
echo -e "时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# 测试列表
declare -a tests=(
    "test-1-basic.sh:基本脚本执行"
    "test-2-complex.sh:复杂指令内容"
    "test-3-title-extraction.sh:标题提取功能"
    "test-4-large-content.sh:大量内容处理"
    "test-5-node-heredoc.sh:Node.js heredoc"
)

# 存储后台进程PID
declare -a pids=()
declare -a test_names=()
declare -a start_times=()

# 启动一个后台测试
start_test() {
    local test_script="$1"
    local test_name="$2"
    local test_num="$3"

    echo -e "${YELLOW}[$test_num] 启动测试: $test_name${NC}"
    echo -e "  脚本: $test_script"

    # 创建日志文件
    local log_file="$LOG_DIR/test-$test_num-$(date +%Y%m%d_%H%M%S).log"

    # 启动后台进程
    (
        echo "=== 测试开始: $(date '+%Y-%m-%d %H:%M:%S') ==="
        echo "测试名称: $test_name"
        echo "脚本路径: $test_script"
        echo ""

        # 运行测试
        if timeout 300 bash "$test_script"; then
            echo ""
            echo "=== 测试结果: 成功 ==="
        else
            echo ""
            echo "=== 测试结果: 失败 (退出码: $?) ==="
        fi

        echo "=== 测试结束: $(date '+%Y-%m-%d %H:%M:%S') ==="
    ) > "$log_file" 2>&1 &

    local pid=$!
    pids+=("$pid")
    test_names+=("$test_name")
    start_times+=("$(date +%s)")

    echo -e "  ${CYAN}PID: $pid${NC}"
    echo -e "  ${CYAN}日志: $log_file${NC}"
    echo ""
}

# 检查测试状态
check_test_status() {
    local index=$1
    local pid=${pids[$index]}
    local test_name=${test_names[$index]}
    local start_time=${start_times[$index]}
    local current_time=$(date +%s)
    local elapsed=$((current_time - start_time))

    if kill -0 "$pid" 2>/dev/null; then
        # 进程还在运行
        echo -e "${YELLOW}[运行中] $test_name (PID: $pid, 已运行: ${elapsed}秒)${NC}"
        return 0
    else
        # 进程已结束
        wait "$pid"
        local exit_code=$?
        if [ $exit_code -eq 0 ]; then
            echo -e "${GREEN}[完成] $test_name (PID: $pid, 耗时: ${elapsed}秒) ✓${NC}"
        else
            echo -e "${RED}[失败] $test_name (PID: $pid, 耗时: ${elapsed}秒) ✗ (退出码: $exit_code)${NC}"
        fi
        return 1
    fi
}

# 主执行逻辑
main() {
    local total_tests=${#tests[@]}
    local current_test=0

    # 逐个启动并等待测试完成
    for test_info in "${tests[@]}"; do
        current_test=$((current_test + 1))

        # 解析测试信息
        IFS=':' read -r script_name test_name <<< "$test_info"
        local test_script="$SCRIPT_DIR/$script_name"

        # 检查脚本是否存在
        if [ ! -f "$test_script" ]; then
            echo -e "${RED}✗ 测试脚本不存在: $test_script${NC}"
            continue
        fi

        # 如果有正在运行的测试，等待它完成
        if [ ${#pids[@]} -gt 0 ]; then
            echo -e "\n${CYAN}等待上一个测试完成...${NC}"
            while true; do
                local all_done=true
                for ((i=0; i<${#pids[@]}; i++)); do
                    if kill -0 "${pids[$i]}" 2>/dev/null; then
                        all_done=false
                        check_test_status "$i"
                        sleep 2
                        break
                    fi
                done
                if [ "$all_done" = true ]; then
                    break
                fi
            done
        fi

        # 启动新测试
        echo -e "\n${BLUE}启动测试 $current_test/$total_tests${NC}"
        start_test "$test_script" "$test_name" "$current_test"

        # 等待一小段时间确保测试已启动
        sleep 2
    done

    # 等待所有测试完成
    echo -e "\n${CYAN}等待所有测试完成...${NC}"
    while [ ${#pids[@]} -gt 0 ]; do
        local new_pids=()
        local new_test_names=()
        local new_start_times=()

        for ((i=0; i<${#pids[@]}; i++)); do
            if ! kill -0 "${pids[$i]}" 2>/dev/null; then
                # 进程已结束，检查结果
                wait "${pids[$i]}"
                local exit_code=$?
                if [ $exit_code -eq 0 ]; then
                    echo -e "${GREEN}✓ ${test_names[$i]} 测试通过${NC}"
                else
                    echo -e "${RED}✗ ${test_names[$i]} 测试失败 (退出码: $exit_code)${NC}"
                fi
            else
                # 进程还在运行，保留
                new_pids+=("${pids[$i]}")
                new_test_names+=("${test_names[$i]}")
                new_start_times+=("${start_times[$i]}")
            fi
        done

        pids=("${new_pids[@]}")
        test_names=("${new_test_names[@]}")
        start_times=("${new_start_times[@]}")

        if [ ${#pids[@]} -gt 0 ]; then
            sleep 3
        fi
    done

    echo -e "\n${BLUE}=====================================${NC}"
    echo -e "${BLUE}所有测试完成！${NC}"
    echo -e "${BLUE}=====================================${NC}"
    echo -e "查看详细日志: $LOG_DIR/"
}

# 显示帮助信息
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help     显示此帮助信息"
    echo "  --status       检查当前运行的测试状态"
    echo ""
    echo "说明:"
    echo "  此脚本会逐个启动冒烟测试，每个测试都在后台运行"
    echo "  下一个测试会在前一个测试完成后才开始"
}

# 检查运行状态
check_status() {
    if [ ${#pids[@]} -eq 0 ]; then
        echo "当前没有运行中的测试"
        return
    fi

    echo -e "\n${CYAN}当前测试状态:${NC}"
    for ((i=0; i<${#pids[@]}; i++)); do
        check_test_status "$i"
    done
}

# 处理命令行参数
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    --status)
        check_status
        exit 0
        ;;
    "")
        main
        ;;
    *)
        echo "未知选项: $1"
        show_help
        exit 1
        ;;
esac