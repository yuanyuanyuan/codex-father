#!/usr/bin/env bash

# npx 集成验证脚本
# 快速验证所有 npx 相关配置是否正确

set -euo pipefail

echo "🔍 验证 npx 集成配置"
echo "===================="
echo ""

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 检查项
echo ""
echo "检查 package.json 配置："
echo "------------------------"

# 检查 bin 字段
if node -e "JSON.parse(require('fs').readFileSync('package.json')).bin" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ package.json has bin field${NC}"
else
    echo -e "${RED}❌ package.json missing bin field${NC}"
fi

# 检查 files 字段
files=$(node -e "console.log(JSON.stringify(JSON.parse(require('fs').readFileSync('package.json')).files))" 2>/dev/null || echo "[]")
for item in start.sh start.d job.sh job.d lib; do
    if echo "$files" | grep -q "\"$item\""; then
        echo -e "${GREEN}✅ files includes $item${NC}"
    else
        echo -e "${RED}❌ files missing $item${NC}"
    fi
done

# 检查其他文件
echo ""
echo "检查必要文件："
echo "------------"
if [ -f test_npx_usage.sh ]; then
    echo -e "${GREEN}✅ test_npx_usage.sh exists${NC}"
else
    echo -e "${RED}❌ test_npx_usage.sh missing${NC}"
fi

if [ -f NPX_RELEASE_GUIDE.md ]; then
    echo -e "${GREEN}✅ NPX_RELEASE_GUIDE.md exists${NC}"
else
    echo -e "${RED}❌ NPX_RELEASE_GUIDE.md missing${NC}"
fi

if [ -f scripts/release-precheck.sh ]; then
    echo -e "${GREEN}✅ release-precheck.sh exists${NC}"
else
    echo -e "${RED}❌ release-precheck.sh missing${NC}"
fi


echo ""
echo "检查 CI 配置："
echo "-------------"
if grep -q "test_npx_usage.sh" .github/workflows/release.yml; then
    echo -e "${GREEN}✅ CI 中包含 npx 测试${NC}"
else
    echo -e "${RED}❌ CI 中缺少 npx 测试${NC}"
fi

echo ""
echo "检查文档更新："
echo "-------------"
if grep -q "npx 功能测试" docs/releases/README.md; then
    echo -e "${GREEN}✅ 发布文档包含 npx 测试说明${NC}"
else
    echo -e "${RED}❌ 发布文档缺少 npx 测试说明${NC}"
fi

if grep -q "npx codex-father" MCP_QUICKSTART.md; then
    echo -e "${GREEN}✅ MCP 快速开始指南包含 npx 说明${NC}"
else
    echo -e "${RED}❌ MCP 快速开始指南缺少 npx 说明${NC}"
fi

echo ""
echo "📝 验证完成！"