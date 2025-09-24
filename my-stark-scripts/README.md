# 脚本工具集

## Git Subtree 管理脚本

### add-subtree.sh
添加外部 Git 仓库作为 subtree 到当前项目。

**用法：**
```bash
./scripts/add-subtree.sh <目标路径> <仓库URL> [分支名]
```

**示例：**
```bash
# 添加 MCP servers 仓库
./scripts/add-subtree.sh 参考资料/mcp/mcp-servers-demo https://github.com/modelcontextprotocol/servers.git main

# 添加其他仓库（默认使用 main 分支）
./scripts/add-subtree.sh 参考资料/awesome-project https://github.com/user/awesome-project.git
```

**特性：**
- 自动检查 Git 仓库状态
- 目标目录冲突检测和处理
- 彩色输出提示
- 自动生成更新命令提示

### update-subtree.sh
更新已存在的 subtree 到最新版本。

**用法：**
```bash
./scripts/update-subtree.sh <目标路径> <仓库URL> [分支名]
```

**示例：**
```bash
# 更新 MCP servers 仓库
./scripts/update-subtree.sh 参考资料/mcp/mcp-servers-demo https://github.com/modelcontextprotocol/servers.git main
```

**特性：**
- 验证目标目录存在性
- 保持提交历史整洁（使用 --squash）
- 错误处理和状态反馈

## 使用建议

1. **首次使用**：确保当前项目已初始化 Git 并至少有一个提交
2. **定期更新**：建议创建定期任务更新参考资料
3. **批量操作**：可以创建包装脚本批量管理多个 subtree

## 批量管理示例

创建 `subtrees.txt` 配置文件：
```
参考资料/mcp/mcp-servers-demo https://github.com/modelcontextprotocol/servers.git main
参考资料/other-repo https://github.com/user/other-repo.git main
```

批量更新脚本：
```bash
#!/bin/bash
while IFS=' ' read -r path url branch; do
    ./scripts/update-subtree.sh "$path" "$url" "$branch"
done < subtrees.txt
```