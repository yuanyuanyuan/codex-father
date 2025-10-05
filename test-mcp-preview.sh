#!/usr/bin/env bash
# MCP Preview 服务器系统性测试脚本
# 测试所有工具和新的命名策略功能

set -euo pipefail

echo "========================================"
echo "Codex Father MCP Preview 测试套件"
echo "========================================"
echo ""

# 测试配置
MCP_SERVER="node ./mcp/codex-mcp-server/dist/index.js"
TEST_DIR="/data/codex-father"
RESULTS_FILE="/tmp/mcp-test-results-$(date +%Y%m%d-%H%M%S).md"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数器
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 测试结果记录
log_test() {
    local test_name="$1"
    local status="$2"
    local details="${3:-}"

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    if [ "$status" = "PASS" ]; then
        PASSED_TESTS=$((PASSED_TESTS + 1))
        echo -e "${GREEN}✓${NC} $test_name"
        echo "- [x] $test_name" >> "$RESULTS_FILE"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
        echo -e "${RED}✗${NC} $test_name"
        echo "  失败原因: $details"
        echo "- [ ] $test_name - **失败**: $details" >> "$RESULTS_FILE"
    fi
}

# 初始化结果文件
cat > "$RESULTS_FILE" <<EOF
# Codex Father MCP Preview 测试报告
测试时间: $(date '+%Y-%m-%d %H:%M:%S')

## 测试概要
EOF

echo "开始测试..."
echo ""

# ============================================
# 第一部分：基础工具测试
# ============================================

echo "第一部分：基础 MCP 工具测试"
echo "============================================"
echo "" >> "$RESULTS_FILE"
echo "## 第一部分：基础 MCP 工具测试" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# 测试 1: codex.help (无参数)
echo "测试 1: codex.help (无参数)"
if timeout 10s node -e "
const { spawn } = require('child_process');
const proc = spawn('node', ['./mcp/codex-mcp-server/dist/index.js']);
proc.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
}) + '\n');
setTimeout(() => {
  proc.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'codex.help', arguments: { format: 'markdown' } }
  }) + '\n');
}, 500);
let output = '';
proc.stdout.on('data', (d) => { output += d.toString(); });
setTimeout(() => {
  proc.kill();
  if (output.includes('Codex Father')) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}, 2000);
" 2>/dev/null; then
    log_test "codex.help (markdown格式)" "PASS"
else
    log_test "codex.help (markdown格式)" "FAIL" "工具调用失败或超时"
fi

# 测试 2: codex.help (JSON格式)
echo "测试 2: codex.help (JSON格式)"
if timeout 10s node -e "
const { spawn } = require('child_process');
const proc = spawn('node', ['./mcp/codex-mcp-server/dist/index.js']);
proc.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
}) + '\n');
setTimeout(() => {
  proc.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'codex.help', arguments: { format: 'json' } }
  }) + '\n');
}, 500);
let output = '';
proc.stdout.on('data', (d) => { output += d.toString(); });
setTimeout(() => {
  proc.kill();
  if (output.includes('tools') && output.includes('clientHints')) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}, 2000);
" 2>/dev/null; then
    log_test "codex.help (JSON格式)" "PASS"
else
    log_test "codex.help (JSON格式)" "FAIL" "JSON格式输出不正确"
fi

# 测试 3: codex_help (下划线别名)
echo "测试 3: codex_help (下划线别名)"
if timeout 10s node -e "
const { spawn } = require('child_process');
const proc = spawn('node', ['./mcp/codex-mcp-server/dist/index.js']);
proc.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
}) + '\n');
setTimeout(() => {
  proc.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'codex_help', arguments: {} }
  }) + '\n');
}, 500);
let output = '';
proc.stdout.on('data', (d) => { output += d.toString(); });
setTimeout(() => {
  proc.kill();
  if (output.includes('Codex Father')) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}, 2000);
" 2>/dev/null; then
    log_test "codex_help (下划线别名)" "PASS"
else
    log_test "codex_help (下划线别名)" "FAIL" "下划线别名不工作"
fi

# 测试 4: tools/list
echo "测试 4: tools/list (列出所有工具)"
if timeout 10s node -e "
const { spawn } = require('child_process');
const proc = spawn('node', ['./mcp/codex-mcp-server/dist/index.js']);
proc.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
}) + '\n');
setTimeout(() => {
  proc.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  }) + '\n');
}, 500);
let output = '';
proc.stdout.on('data', (d) => { output += d.toString(); });
setTimeout(() => {
  proc.kill();
  const hasHelp = output.includes('codex.help') || output.includes('codex_help');
  const hasExec = output.includes('codex.exec') || output.includes('codex_exec');
  const hasStart = output.includes('codex.start') || output.includes('codex_start');
  if (hasHelp && hasExec && hasStart) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}, 2000);
" 2>/dev/null; then
    log_test "tools/list 包含所有基础工具" "PASS"
else
    log_test "tools/list 包含所有基础工具" "FAIL" "缺少必要的工具"
fi

echo ""
echo "基础工具测试完成"
echo ""

# ============================================
# 第二部分：命名策略测试
# ============================================

echo "第二部分：命名策略功能测试"
echo "============================================"
echo "" >> "$RESULTS_FILE"
echo "## 第二部分:命名策略功能测试" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"

# 测试 5: NAME_STYLE=underscore-only
echo "测试 5: NAME_STYLE=underscore-only (只导出下划线)"
if timeout 10s node -e "
const { spawn } = require('child_process');
const proc = spawn('node', ['./mcp/codex-mcp-server/dist/index.js'], {
  env: { ...process.env, CODEX_MCP_NAME_STYLE: 'underscore-only' }
});
proc.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
}) + '\n');
setTimeout(() => {
  proc.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  }) + '\n');
}, 500);
let output = '';
proc.stdout.on('data', (d) => { output += d.toString(); });
setTimeout(() => {
  proc.kill();
  const hasUnderscore = output.includes('codex_help');
  const hasDot = output.includes('codex.help');
  if (hasUnderscore && !hasDot) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}, 2000);
" 2>/dev/null; then
    log_test "NAME_STYLE=underscore-only" "PASS"
else
    log_test "NAME_STYLE=underscore-only" "FAIL" "仍然包含点号命名或缺少下划线命名"
fi

# 测试 6: TOOL_PREFIX=cf
echo "测试 6: TOOL_PREFIX=cf (自定义前缀)"
if timeout 10s node -e "
const { spawn } = require('child_process');
const proc = spawn('node', ['./mcp/codex-mcp-server/dist/index.js'], {
  env: { ...process.env, CODEX_MCP_TOOL_PREFIX: 'cf' }
});
proc.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
}) + '\n');
setTimeout(() => {
  proc.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  }) + '\n');
}, 500);
let output = '';
proc.stdout.on('data', (d) => { output += d.toString(); });
setTimeout(() => {
  proc.kill();
  const hasCfPrefix = output.includes('cf_help') || output.includes('cf.help');
  const hasOriginal = output.includes('codex_help') || output.includes('codex.help');
  if (hasCfPrefix && hasOriginal) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}, 2000);
" 2>/dev/null; then
    log_test "TOOL_PREFIX=cf 添加前缀别名" "PASS"
else
    log_test "TOOL_PREFIX=cf 添加前缀别名" "FAIL" "未找到 cf_ 前缀工具"
fi

# 测试 7: TOOL_PREFIX=cf + HIDE_ORIGINAL=1
echo "测试 7: TOOL_PREFIX=cf + HIDE_ORIGINAL=1 (只保留前缀)"
if timeout 10s node -e "
const { spawn } = require('child_process');
const proc = spawn('node', ['./mcp/codex-mcp-server/dist/index.js'], {
  env: {
    ...process.env,
    CODEX_MCP_TOOL_PREFIX: 'cf',
    CODEX_MCP_HIDE_ORIGINAL: '1'
  }
});
proc.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
}) + '\n');
setTimeout(() => {
  proc.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  }) + '\n');
}, 500);
let output = '';
proc.stdout.on('data', (d) => { output += d.toString(); });
setTimeout(() => {
  proc.kill();
  const hasCfPrefix = output.includes('cf_help') || output.includes('cf.help');
  const hasOriginal = output.includes('codex_help') || output.includes('codex.help');
  if (hasCfPrefix && !hasOriginal) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}, 2000);
" 2>/dev/null; then
    log_test "HIDE_ORIGINAL=1 隐藏原始名称" "PASS"
else
    log_test "HIDE_ORIGINAL=1 隐藏原始名称" "FAIL" "仍然包含 codex_ 原始名称"
fi

# 测试 8: 推荐配置 (underscore-only + cf + hide)
echo "测试 8: 推荐配置 (NAME_STYLE=underscore-only + TOOL_PREFIX=cf + HIDE_ORIGINAL=1)"
if timeout 10s node -e "
const { spawn } = require('child_process');
const proc = spawn('node', ['./mcp/codex-mcp-server/dist/index.js'], {
  env: {
    ...process.env,
    CODEX_MCP_NAME_STYLE: 'underscore-only',
    CODEX_MCP_TOOL_PREFIX: 'cf',
    CODEX_MCP_HIDE_ORIGINAL: '1'
  }
});
proc.stdin.write(JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
}) + '\n');
setTimeout(() => {
  proc.stdin.write(JSON.stringify({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list'
  }) + '\n');
}, 500);
let output = '';
proc.stdout.on('data', (d) => { output += d.toString(); });
setTimeout(() => {
  proc.kill();
  const hasCfUnderscore = output.includes('cf_help');
  const hasCfDot = output.includes('cf.help');
  const hasCodex = output.includes('codex');
  if (hasCfUnderscore && !hasCfDot && !hasCodex) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}, 2000);
" 2>/dev/null; then
    log_test "Codex 0.44 推荐配置" "PASS"
else
    log_test "Codex 0.44 推荐配置" "FAIL" "配置组合未生效"
fi

echo ""
echo "命名策略测试完成"
echo ""

# ============================================
# 测试总结
# ============================================

echo "" >> "$RESULTS_FILE"
echo "## 测试总结" >> "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
echo "- 总测试数: $TOTAL_TESTS" >> "$RESULTS_FILE"
echo "- 通过: $PASSED_TESTS" >> "$RESULTS_FILE"
echo "- 失败: $FAILED_TESTS" >> "$RESULTS_FILE"
echo "- 成功率: $(awk "BEGIN {printf \"%.1f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")%" >> "$RESULTS_FILE"

echo ""
echo "========================================"
echo "测试完成!"
echo "========================================"
echo "总测试数: $TOTAL_TESTS"
echo -e "通过: ${GREEN}$PASSED_TESTS${NC}"
echo -e "失败: ${RED}$FAILED_TESTS${NC}"
echo "成功率: $(awk "BEGIN {printf \"%.1f\", ($PASSED_TESTS/$TOTAL_TESTS)*100}")%"
echo ""
echo "详细报告: $RESULTS_FILE"

# 返回状态码
if [ $FAILED_TESTS -eq 0 ]; then
    exit 0
else
    exit 1
fi
