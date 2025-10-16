# [MCP|Main] 版本 X.Y.Z 发布说明

> 使用说明：复制此模板到 `docs/releases/versions/VERSION_[MCP|MAIN]_X.Y.Z.md`，然后替换以下占位符：
> - `[MCP|Main]`: 选择 MCP 或 Main
> - `X.Y.Z`: 替换为实际版本号
> - `YYYY-MM-DD`: 替换为发布日期
> - 填写具体的变更内容

## 🎯 版本信息
- **版本号**: X.Y.Z
- **发布日期**: YYYY-MM-DD
- **包名**: @starkdev020/codex-father-mcp-server | codex-father
- **Git标签**: mcp-vX.Y.Z | vX.Y.Z

## ✨ 新功能
- 功能描述1（详细说明新功能）
- 功能描述2（包含使用场景和优势）

## 🐛 修复
- 修复问题1（描述问题现象和解决方案）
- 修复问题2（如有相关issue，请引用）

## 🔧 改进
- 性能优化：具体优化内容和效果
- 错误处理改进：增强的错误处理机制
- 文档更新：更新了哪些文档
- 代码质量提升：重构、测试覆盖等

## 🔄 兼容性
- **向后兼容性**: 兼容性说明
- **破坏性变更**: 如有，请详细说明
- **依赖项更新**: 主要依赖的版本变化

## 📦 安装升级

### 全新安装
```bash
# MCP版本
npm install -g @starkdev020/codex-father-mcp-server

# 主项目版本
npm install -g codex-father
```

### 升级现有安装
```bash
# MCP版本
npm update -g @starkdev020/codex-father-mcp-server

# 主项目版本
npm update -g codex-father
```

### 指定版本安装
```bash
# MCP版本
npm install -g @starkdev020/codex-father-mcp-server@X.Y.Z

# 主项目版本
npm install -g codex-father@X.Y.Z
```

## 🧪 测试和验证

### 基础功能测试
```bash
# MCP版本测试
codex-mcp-server --version
codex-mcp-server --help

# 主项目版本测试
codex-father --version
codex-father --help
```

### 配置验证
```bash
# 验证MCP服务器启动
node /path/to/codex-father/mcp/codex-mcp-server/dist/index.js --version

# 测试环境变量
LOG_LEVEL=debug node /path/to/codex-father/mcp/codex-mcp-server/dist/index.js
```

## 📋 变更详情

### 主要文件变更
- **新增**: 列出新增的重要文件
- **修改**: 列出修改的主要文件
- **删除**: 列出删除的文件（如有）

### 依赖更新
- **主要依赖**: 列出关键依赖的版本变化
- **开发依赖**: 如有必要，列出开发依赖变化

## 🔗 相关链接

- **GitHub Release**: https://github.com/yuanyuanyuan/codex-father/releases/tag/[mcp-vX.Y.Z|vX.Y.Z]
- **NPM 包页面**:
  - MCP: https://www.npmjs.com/package/@starkdev020/codex-father-mcp-server
  - Main: https://www.npmjs.com/package/codex-father
- **更新日志**: ../../CHANGELOG.md
- **使用文档**: ../user/README.md

## 📞 支持和反馈

### 问题报告
- **GitHub Issues**: https://github.com/yuanyuanyuan/codex-father/issues
- **讨论区**: https://github.com/yuanyuanyuan/codex-father/discussions

### 贡献指南
- **贡献指南**: ../../CONTRIBUTING.md
- **开发文档**: ../developer/README.md

## 📊 发布统计

- 📦 **下载量**: [发布后填写统计链接]
- ⭐ **GitHub Stars**: [项目star数量]
- 🐛 **问题解决**: [解决的issue数量]

---

**感谢所有贡献者和用户的支持！** 🎉

---

## 📝 使用模板的步骤

1. **复制模板**:
   ```bash
   cp docs/releases/VERSION_TEMPLATE.md docs/releases/versions/VERSION_MCP_X.Y.Z.md
   # 或
   cp docs/releases/VERSION_TEMPLATE.md docs/releases/versions/VERSION_MAIN_X.Y.Z.md
   ```

2. **编辑内容**:
   - 替换所有占位符 `[MCP|Main]`、`X.Y.Z`、`YYYY-MM-DD`
   - 填写具体的功能、修复、改进内容
   - 更新相关链接

3. **更新索引**:
   - 在 `docs/releases/README.md` 中添加版本链接
   - 更新版本列表

4. **提交文档**:
   ```bash
   git add docs/releases/versions/VERSION_MCP_X.Y.Z.md
   git commit -m "docs: add VERSION_MCP_X.Y.Z release notes"
   ```