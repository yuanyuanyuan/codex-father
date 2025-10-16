#!/usr/bin/env bash

# 兼容性函数库 - 为 start.sh 提供必要的函数

# 安全 UTF-8 截断函数
safe_truncate_utf8() {
  local input="$1"
  local max_length="${2:-80}"
  echo "$input" | cut -c1-"$max_length"
}

# 发布输出文件（简化版）
codex_publish_output() {
  local output_file="$1"
  local run_number="${2:-1}"

  # 如果输出文件存在且不为空
  if [[ -f "$output_file" && -s "$output_file" ]]; then
    # 创建 last message 文件
    local last_file="${output_file%.output.txt}.last.txt"
    cp "$output_file" "$last_file" 2>/dev/null || true

    # 确保文件有换行符结尾
    if [[ -f "$last_file" ]]; then
      # 检查文件是否以换行符结尾
      if [[ -n "$(tail -c1 "$last_file" 2>/dev/null)" ]]; then
        echo >> "$last_file"
      fi
    fi
  fi
}

# 确保 trailing newline
ensure_trailing_newline() {
  local file="$1"
  if [[ -f "$file" && -n "$(tail -c1 "$file" 2>/dev/null)" ]]; then
    echo >> "$file"
  fi
}

# 构建 JSONL 事件（如果需要）
append_jsonl_event() {
  local session_dir="$1"
  local event_type="$2"
  local data="$3"

  # 简化实现 - 只记录到 events.jsonl
  local events_file="${session_dir}/events.jsonl"
  local timestamp
  timestamp=$(date -u "+%Y-%m-%dT%H:%M:%SZ")

  # 确保目录存在
  mkdir -p "$session_dir" 2>/dev/null || true

  # 写入事件
  printf '{"event":"%s","timestamp":"%s","data":%s}\n' \
    "$event_type" "$timestamp" "$data" >> "$events_file" 2>/dev/null || true
}