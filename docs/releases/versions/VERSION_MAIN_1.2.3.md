# Main 版本 1.2.3 发布说明

## 🎯 版本信息
- **版本号**: 1.2.3
- **发布日期**: 2025-10-17
- **包名**: codex-father
- **Git标签**: v1.2.3

## ✨ 新功能
- 集成了完整的手动版本管理系统
- 支持主项目和MCP子包的独立发布流程
- 新增了多种发布模式和验证机制
- 增强的GitHub Actions工作流集成

## 🐛 修复
- 修复了semantic-release相关的配置问题
- 解决了版本号不一致导致的发布失败
- 修复了Git标签创建和推送的异常情况
- 解决了NPM包发布认证问题

## 🔧 改进
- **性能优化**: 优化了构建流程，减少了构建时间
- **错误处理改进**: 增强了错误检测和用户友好的错误提示
- **文档更新**: 完整重写了发布文档和指南
- **代码质量提升**: 增加了更多的测试覆盖和类型检查

## 🔄 兼容性
- **向后兼容性**: 完全兼容现有配置和API
- **破坏性变更**: 无破坏性变更
- **依赖项更新**: 更新了构建工具和开发依赖

## 📦 安装升级

### 全新安装
```bash
npm install -g codex-father
```

### 升级现有安装
```bash
npm update -g codex-father
```

### 指定版本安装
```bash
npm install -g codex-father@1.2.3
```

## 🧪 测试和验证

### 基础功能测试
```bash
codex-father --version
codex-father --help
```

### 配置验证
```bash
# 验证CLI工具正常工作
codex-father --version

# 测试帮助信息
codex-father --help
```

## 📋 变更详情

### 主要文件变更
- **新增**:
  - `scripts/release-mcp-manual.sh` - MCP手动发布脚本
  - `.github/workflows/mcp-release.yml` - MCP发布工作流
  - `docs/releases/versions/` - 版本说明目录
- **修改**:
  - `package.json` - 更新了发布脚本
  - `.github/workflows/release.yml` - 重构为主项目发布
  - `docs/releases/README.md` - 完整的发布指南
- **删除**:
  - 旧的semantic-release相关配置

### 依赖更新
- **主要依赖**: 保持了核心依赖的稳定性
- **开发依赖**: 更新了构建和测试工具

## 🔗 相关链接

- **GitHub Release**: https://github.com/yuanyuanyuan/codex-father/releases/tag/v1.2.3
- **NPM 包页面**: https://www.npmjs.com/package/codex-father
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

- 📦 **下载量**: [发布后统计]
- ⭐ **GitHub Stars**: [统计链接]
- 🐛 **问题解决**: [解决数量]

---

**感谢所有贡献者和用户的支持！** 🎉