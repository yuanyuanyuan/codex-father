#!/usr/bin/env bash

set -euo pipefail

# Probe MCP servers listed in a VS Code-style mcp.json and test basic calls.
# - Supports transport: stdio (default)
# - Sends initialize and tools/list; reports OK/FAIL per server
#
# Usage:
#   mcp/probe-config.sh /path/to/mcp.json
#   cat /path/to/mcp.json | mcp/probe-config.sh -

usage() {
  echo "用法: $0 <mcp.json 路径或 ->" >&2
}

if [[ $# -lt 1 ]]; then usage; exit 1; fi

INPUT="$1"
if [[ "$INPUT" == "-" ]]; then
  JSON=$(cat)
else
  if [[ ! -f "$INPUT" ]]; then
    echo "错误: 找不到配置文件: $INPUT" >&2
    exit 1
  fi
  JSON=$(cat "$INPUT")
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "错误: 需要 jq 来解析 mcp.json" >&2
  exit 1
fi

# Extract servers as compact lines: name, command, args[], transport
mapfile -t SERVERS < <(
  printf '%s' "$JSON" |
  jq -c '(
            .mcpServers // .servers // .apps // {}
          )
          | to_entries[]
          | {name: .key,
             command: (.value.command // .value.node // .value.python // .value.cmd // null),
             args: (.value.args // []),
             url: (.value.url // null),
             transport: (
               .value.transport // .value.type //
               (if (.value.url // null) then "http" else "stdio" end)
             )
            }'
)

if (( ${#SERVERS[@]} == 0 )); then
  echo "提示: 配置中未找到任何 mcpServers 条目" >&2
  exit 2
fi

pass=0; fail=0
for entry in "${SERVERS[@]}"; do
  name=$(printf '%s' "$entry" | jq -r '.name')
  cmd=$(printf '%s' "$entry" | jq -r '.command // empty')
  transport=$(printf '%s' "$entry" | jq -r '.transport // "stdio"')
  url=$(printf '%s' "$entry" | jq -r '.url // empty')
  # Build args array
  mapfile -t arr < <(printf '%s' "$entry" | jq -r '.args[]?')

  if [[ "$transport" == "stdio" ]]; then
    if [[ -z "$cmd" ]]; then
      echo "[FAIL] $name: 缺少 command 字段（stdio 模式需要 command）"; ((fail++)); continue
    fi
    # Compose request stream: initialize + tools/list
    # Minimal MCP handshake (with required fields for stricter servers)
    req=$(printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-09-18","capabilities":{},"clientInfo":{"name":"codex-probe","version":"0.1.0"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n')
    set +e
    out=$(printf '%s' "$req" | timeout 25s "${cmd}" "${arr[@]}" 2>/dev/null)
    rc=$?
    set -e
    if (( rc != 0 )); then
      echo "[FAIL] $name: 进程退出码=$rc（可能未安装、下载失败或命令不可用）"
      ((fail++))
      continue
    fi
    has_init=$(printf '%s' "$out" | grep -c '"serverName"\|"protocolVersion"' || true)
    has_tools=$(printf '%s' "$out" | grep -c '"tools"' || true)
    if (( has_init > 0 && has_tools > 0 )); then
      echo "[ OK ] $name: initialize + tools/list 正常"
      ((pass++))
    else
      echo "[FAIL] $name: 未检测到有效响应（initialize/tools/list）"
      printf '%s\n' "$out" | sed -n '1,5p' | sed 's/^/  > /'
      ((fail++))
    fi
    continue
  fi

  if [[ "$transport" == "http" ]]; then
    if [[ -z "$url" ]]; then
      echo "[FAIL] $name: http 模式缺少 url 字段"; ((fail++)); continue
    fi
    if ! command -v curl >/dev/null 2>&1; then
      echo "[SKIP] $name: 缺少 curl，无法探测 http"; continue
    fi
    # Basic connectivity + content-type probe
    set +e
    hdr=$(curl -sS -D - -o /dev/null --max-time 6 -H 'Accept: text/event-stream' "$url")
    rc=$?
    set -e
    if (( rc != 0 )); then
      echo "[FAIL] $name: 无法连接（curl rc=$rc）"
      ((fail++))
      continue
    fi
    ct=$(printf '%s' "$hdr" | tr -d '\r' | awk -F': ' 'BEGIN{IGNORECASE=1}/^content-type:/{print $2; exit}')
    st=$(printf '%s' "$hdr" | head -n1 | awk '{print $2}')
    if [[ "$st" == "401" || "$st" == "403" ]]; then
      echo "[WARN] $name: 需要认证（HTTP $st），连通性 OK"
      ((pass++))
    elif grep -qi 'text/event-stream' <<<"$ct"; then
      echo "[ OK ] $name: HTTP ${st:-?}, Content-Type=$ct（SSE 探测通过）"
      ((pass++))
    else
      echo "[WARN] $name: HTTP ${st:-?}, Content-Type=${ct:-unknown}（仅连通性，未验证 tools/list）"
      ((pass++))
    fi
    continue
  fi

  echo "[SKIP] $name: 不支持的 transport=$transport"; continue
done

echo "---"
echo "结果: ${pass} 通过, ${fail} 失败"
exit 0
