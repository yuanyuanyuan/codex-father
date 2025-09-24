#!/bin/bash

# Git Subtree 更新脚本
# 用法: ./update-subtree.sh <目标路径> <仓库URL> [分支名]

# 参数检查
if [ $# -lt 2 ]; then
    echo "用法: $0 <目标路径> <仓库URL> [分支名]"
    echo "示例: $0 参考资料/some-repo https://github.com/user/repo.git main"
    exit 1
fi

TARGET_PATH=$1
REPO_URL=$2
BRANCH=${3:-main}

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}准备更新 Git Subtree...${NC}"
echo "目标路径: $TARGET_PATH"
echo "仓库地址: $REPO_URL"
echo "分支名称: $BRANCH"

# 检查目标目录是否存在
if [ ! -d "$TARGET_PATH" ]; then
    echo -e "${RED}错误: 目标目录不存在${NC}"
    echo "请先使用 add-subtree.sh 添加"
    exit 1
fi

# 执行 git subtree pull
echo -e "${YELLOW}正在拉取更新...${NC}"
if git subtree pull --prefix="$TARGET_PATH" "$REPO_URL" "$BRANCH" --squash; then
    echo -e "${GREEN}✓ Subtree 更新成功！${NC}"
else
    echo -e "${RED}✗ Subtree 更新失败${NC}"
    exit 1
fi