#!/usr/bin/env bash
set -euo pipefail

echo "测试 SIGPIPE 修复..."

# 测试1: 基本的 awk 管道
echo "测试1: awk 管道"
content="第一行内容
第二行内容"
result=$(printf '%s' "$content" | awk 'NF {print; exit}' | cut -c1-80)
echo "结果: $result"

# 测试2: 文件 awk 操作
echo -e "\n测试2: 文件 awk 操作"
temp_file="/tmp/test-file-$$"
echo "文件第一行" > "$temp_file"
echo "文件第二行" >> "$temp_file"
result2=$(cat "$temp_file" 2>/dev/null | awk 'NF {print; exit}')
echo "结果: $result2"
rm -f "$temp_file"

# 测试3: 复杂管道操作
echo -e "\n测试3: 复杂管道操作"
complex_content="这是第一行内容
这是第二行内容
这是第三行内容"
result3=$(printf '%s' "$complex_content" | awk 'NF {print; exit}' | tr '[:upper:]' '[:lower:]' | cut -c1-50)
echo "结果: $result3"

echo -e "\n✓ 所有测试通过！SIGPIPE 错误已修复。"
