#!/usr/bin/env bash
# 检查冒烟测试状态

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/.smoke-test-logs"

echo "冒烟测试状态检查"
echo "=================="
echo "日志目录: $LOG_DIR"
echo ""

# 检查日志文件
if [ -d "$LOG_DIR" ]; then
    echo "测试日志文件:"
    ls -la "$LOG_DIR"/*.log 2>/dev/null | while read -r line; do
        log_file=$(echo "$line" | awk '{print $9}')
        test_name=$(basename "$log_file" .log)
        
        echo ""
        echo "测试: $test_name"
        echo "文件: $log_file"
        
        # 检查测试状态
        if grep -q "测试结果: 成功" "$log_file" 2>/dev/null; then
            echo "状态: ✓ 通过"
        elif grep -q "测试结果: 失败" "$log_file" 2>/dev/null; then
            echo "状态: ✗ 失败"
        elif grep -q "测试开始:" "$log_file" && ! grep -q "测试结束:" "$log_file"; then
            echo "状态: ⟳ 运行中"
        else
            echo "状态: ? 未知"
        fi
        
        # 显示最后几行
        echo "最新输出:"
        tail -3 "$log_file" | sed 's/^/  /'
    done
else
    echo "没有找到测试日志目录"
fi

# 检查是否有进程在运行
echo ""
echo "检查相关进程:"
ps aux | grep -E "test-[0-9]+\.sh|run-smoke" | grep -v grep || echo "没有相关进程"
