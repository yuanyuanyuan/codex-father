#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "用法: $0 <session-dir>" >&2
  exit 2
fi

dir="$1"
[[ -d "$dir" ]] || { echo "目录不存在: $dir" >&2; exit 2; }

ok=1

if [[ ! -f "$dir/state.json" ]]; then
  echo "缺少 state.json" >&2
  ok=0
else
  st=$(jq -r '.state' "$dir/state.json" 2>/dev/null || echo "")
  if [[ -z "$st" || "$st" == "running" ]]; then
    echo "state.json 未闭合（state=$st）" >&2
    ok=0
  fi
fi

if [[ ! -f "$dir/events.jsonl" ]]; then
  echo "缺少 events.jsonl" >&2
  ok=0
else
  # 至少包含 start 与 orchestration_completed 两类事件
  have_start=$(grep -c '"event":"start"' "$dir/events.jsonl" || true)
  have_end=$(grep -c '"event":"orchestration_completed"' "$dir/events.jsonl" || true)
  if [[ "$have_start" -lt 1 || "$have_end" -lt 1 ]]; then
    echo "events.jsonl 事件不完整（start=$have_start, completed=$have_end）" >&2
    ok=0
  fi
fi

if (( ok == 1 )); then
  echo "OK: $dir"
  exit 0
else
  exit 1
fi

