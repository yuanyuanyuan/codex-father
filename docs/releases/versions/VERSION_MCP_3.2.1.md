# MCP 版本 3.2.1 发布说明

## 🎯 版本信息
- **版本号**: 3.2.1
- **发布日期**: 2025-10-17
- **包名**: @starkdev020/codex-father-mcp-server
- **Git标签**: mcp-v3.2.1

## ✨ 新功能
- 完整的手动版本管理系统
- 多种发布模式支持（preflight、dry-run、local、tag-only）
- 增强的参数验证和自动修复机制
- 完善的错误处理和用户确认流程
- 集成的GitHub Actions工作流支持

## 🐛 修复
- 修复了semantic-release相关的配置冲突
- 解决了版本号格式不一致的问题
- 修复了Git标签创建和推送的异常情况
- 解决了NPM发布认证失败的问题

## 🔧 改进
- 性能优化描述
- 错误处理改进
- 文档更新
- 代码质量提升

## 🔄 兼容性
- 向后兼容性说明
- 破坏性变更（如有）
- 依赖项更新

## 📦 安装升级

### 全新安装
```bash
npm install -g @starkdev020/codex-father-mcp-server
```

### 升级现有安装
```bash
npm update -g @starkdev020/codex-father-mcp-server
```

### 指定版本安装
```bash
npm install -g @starkdev020/codex-father-mcp-server@3.2.1
```

## 🧪 测试和验证

### 基础功能测试
```bash
# 验证服务器启动
codex-mcp-server --help

# 检查工具列表
# 在Claude Code中验证MCP工具是否正常加载
```

### 配置验证
```bash
# 验证配置文件
node /path/to/codex-father/mcp/codex-mcp-server/dist/index.js --version

# 测试环境变量
LOG_LEVEL=debug node /path/to/codex-father/mcp/codex-mcp-server/dist/index.js
```

## 📋 变更详情

### 文件变更
- 修改的文件列表
- 新增的文件列表
- 删除的文件列表（如有）

### 依赖更新
- 更新的依赖包
- 版本变更说明

## 🔗 相关链接

- [GitHub Release](https://github.com/yuanyuanyuan/codex-father/releases/tag/mcp-v3.2.1)
- [NPM 包页面](https://www.npmjs.com/package/@starkdev020/codex-father-mcp-server/v/3.2.1)
- [更新日志](../../CHANGELOG.md)
- [使用文档](../user/mcp/README.md)

## 📞 支持和反馈

### 问题报告
如遇到问题，请通过以下方式报告：
- [GitHub Issues](https://github.com/yuanyuanyuan/codex-father/issues)
- [讨论区](https://github.com/yuanyuanyuan/codex-father/discussions)

### 贡献指南
欢迎贡献代码和文档，请参考：
- [贡献指南](../../CONTRIBUTING.md)
- [开发文档](../developer/README.md)

## 📊 发布统计

- 📦 下载量：[发布后统计]
- ⭐ GitHub Stars：[统计链接]
- 🐛 问题解决：[解决数量]

---

**感谢所有贡献者和用户的支持！** 🎉