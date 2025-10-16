#!/usr/bin/env bash

# 发布前综合检查脚本
# 包含 npx 功能测试

set -euo pipefail

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 测试计数器
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 测试函数
run_test() {
    local test_name="$1"
    local command="$2"
    local required="${3:-true}"

    echo -e "\n${BLUE}Test ${TESTS_TOTAL}: $test_name${NC}"
    echo "Command: $command"
    echo "---"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))

    if eval "$command"; then
        log_success "✅ Test passed"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        log_error "❌ Test failed"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        if [ "$required" = "true" ]; then
            log_error "This is a required test - release cannot proceed!"
        fi
        return 1
    fi
}

# 头部信息
echo "================================"
echo "🚀 Codex Father Release Pre-check"
echo "================================"
echo "Testing all functionality before release"
echo ""

# 1. 基础环境检查
echo -e "\n${YELLOW}=== Environment Checks ===${NC}"
run_test "Node.js version >= 18" "[[ \$(node -v | cut -d'v' -f2 | cut -d'.' -f1) -ge 18 ]"
run_test "npm version >= 8" "[[ \$(npm -v | cut -d'.' -f1) -ge 8 ]"
run_test "Git status clean" "[[ -z \$(git status --porcelain) ]]"
run_test "Git on main/master branch" "[[ \$(git branch --show-current) == 'main' || \$(git branch --show-current) == 'master' ]]"

# 2. 代码质量检查
echo -e "\n${YELLOW}=== Code Quality Checks ===${NC}"
run_test "TypeScript compilation" "npm run typecheck"
run_test "ESLint check" "npm run lint:check"
run_test "Unit tests" "npm run test:unit"
run_test "Build successful" "npm run build"

# 3. 包配置检查
echo -e "\n${YELLOW}=== Package Configuration Checks ===${NC}"
run_test "package.json has bin field" "node -e \"JSON.parse(require('fs').readFileSync('package.json')).bin && console.log('bin field exists')\""
run_test "package.json has files field" "node -e \"JSON.parse(require('fs').readFileSync('package.json')).files && console.log('files field exists')\""

# 4. npx 功能测试
echo -e "\n${YELLOW}=== npx Functionality Tests ===${NC}"
run_test "npx test script exists" "[[ -f test_npx_usage.sh ]]"
run_test "npx test script executable" "[[ -x test_npx_usage.sh ]]"

# 运行 npx 测试
if [[ -f test_npx_usage.sh ]]; then
    echo -e "\n${BLUE}Running comprehensive npx tests...${NC}"
    if ./test_npx_usage.sh; then
        log_success "All npx tests passed!"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        log_error "npx tests failed!"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
fi

# 5. 关键文件检查
echo -e "\n${YELLOW}=== Critical Files Check ===${NC}"
run_test "start.sh exists" "[[ -f start.sh ]]"
run_test "job.sh exists" "[[ -f job.sh ]]"
run_test "start.d directory exists" "[[ -d start.d ]]"
run_test "job.d directory exists" "[[ -d job.d ]]"
run_test "lib directory exists" "[[ -d lib ]]"

# 6. 文档检查
echo -e "\n${YELLOW}=== Documentation Checks ===${NC}"
run_test "NPX_RELEASE_GUIDE.md exists" "[[ -f NPX_RELEASE_GUIDE.md ]]"
run_test "MCP_QUICKSTART.md exists" "[[ -f MCP_QUICKSTART.md ]]"

# 7. 版本一致性检查
echo -e "\n${YELLOW}=== Version Consistency Checks ===${NC}"
run_test "package.json version format valid" "node -e \"const v=require('./package.json').version; if(!/^\\d+\\.\\d+\\.\\d+$/.test(v)) throw new Error('Invalid version format')\""

# 8. 脚本依赖检查
echo -e "\n${YELLOW}=== Script Dependency Checks ===${NC}"
run_test "start.sh can find start.d" "bash -c 'source start.sh 2>&1 | grep -v \"错误\" | head -5'"
run_test "job.sh can find job.d" "bash -c 'source job.sh 2>&1 | grep -v \"错误\" | head -5'"

# 测试结果汇总
echo -e "\n================================"
echo -e "${YELLOW}Test Results Summary:${NC}"
echo -e "Total tests: $TESTS_TOTAL"
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"

# 生成报告
REPORT_FILE="release-precheck-report-$(date +%Y%m%d_%H%M%S).md"
cat > "$REPORT_FILE" <<EOF
# Release Pre-check Report

**Date**: $(date)
**Commit**: $(git rev-parse HEAD)
**Branch**: $(git branch --show-current)

## Test Results
- **Total Tests**: $TESTS_TOTAL
- **Passed**: $TESTS_PASSED
- **Failed**: $TESTS_FAILED
- **Success Rate**: $(( TESTS_PASSED * 100 / TESTS_TOTAL ))%

## Status
EOF

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed! Ready for release.${NC}"
    echo "✅ Release status: READY" >> "$REPORT_FILE"
    exit 0
else
    echo -e "\n${RED}⚠️ Some tests failed. Please fix issues before releasing.${NC}"
    echo "❌ Release status: FAILED" >> "$REPORT_FILE"
    echo -e "\n${YELLOW}Report saved to: $REPORT_FILE${NC}"
    exit 1
fi