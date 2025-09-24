#!/bin/bash

# Git Subtree 添加脚本
# 用法: ./add-subtree.sh <目标路径> <仓库URL> [分支名]

# 参数检查
if [ $# -lt 2 ]; then
    echo "用法: $0 <目标路径> <仓库URL> [分支名]"
    echo "示例: $0 参考资料/some-repo https://github.com/user/repo.git main"
    exit 1
fi

TARGET_PATH=$1
REPO_URL=$2
BRANCH=${3:-main}  # 默认使用 main 分支

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}准备添加 Git Subtree...${NC}"
echo "目标路径: $TARGET_PATH"
echo "仓库地址: $REPO_URL"
echo "分支名称: $BRANCH"

# 检查是否在 git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}错误: 当前目录不是 Git 仓库${NC}"
    echo "请先执行 git init"
    exit 1
fi

# 检查是否有提交
if ! git rev-parse HEAD > /dev/null 2>&1; then
    echo -e "${RED}错误: Git 仓库没有任何提交${NC}"
    echo "请先创建初始提交"
    exit 1
fi

# 检查目标目录是否存在
if [ -d "$TARGET_PATH" ]; then
    echo -e "${YELLOW}警告: 目标目录已存在${NC}"
    read -p "是否删除并继续？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$TARGET_PATH"
        echo -e "${GREEN}已删除旧目录${NC}"
    else
        echo -e "${RED}操作取消${NC}"
        exit 1
    fi
fi

# 执行 git subtree add
echo -e "${YELLOW}正在添加 subtree...${NC}"
if git subtree add --prefix="$TARGET_PATH" "$REPO_URL" "$BRANCH" --squash; then
    echo -e "${GREEN}✓ Subtree 添加成功！${NC}"
    echo
    echo "后续更新命令:"
    echo "git subtree pull --prefix=$TARGET_PATH $REPO_URL $BRANCH --squash"
else
    echo -e "${RED}✗ Subtree 添加失败${NC}"
    exit 1
fi