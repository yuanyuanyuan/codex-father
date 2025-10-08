# 📚 Codex Father 完整文档

> **文档总入口** - 所有 Codex Father 相关文档的导航中心

## 🚀 新手必读（按顺序阅读）

1. **[📘 用户使用手册（零基础）](user/manual.md)** - 手把手安装/配置/使用/排错（含流程图）
2. **[⚡ 5分钟快速开始](user/quick-start.md)** - 最快的上手方式 ⭐ **强烈推荐**
2. **[📦 安装指南](user/installation.md)** - 详细的安装步骤和系统要求
3. **[⚙️ 配置指南](user/configuration.md)** - 配置 Claude Desktop/Code/Codex CLI
4. **[🚀 首次运行测试](user/first-run.md)** - 10 个测试验证所有功能

---

## 📖 文档分类导航

### 👤 用户文档

适合：所有用户，特别是第一次使用 Codex Father 的用户

- **[用户文档总览](user/README.md)**
- [快速开始](user/quick-start.md) - 5 分钟上手
- [Auto 命令](user/auto.md) - 路由 + 高质量模板（MVP12）
- [Orchestrate vs Auto](user/orchestrate-vs-auto.md) - 何时用谁？
- [安装指南](user/installation.md) - 完整安装步骤
- [配置指南](user/configuration.md) - 三种客户端配置
- [首次运行测试](user/first-run.md) - 功能验证
- [场景化使用](user/use-cases/README.md) - 15+ 实际应用场景
- [故障排除](user/troubleshooting.md) - 常见问题解决
- [环境变量参考](../docs/environment-variables-reference.md) - 全量环境变量（源码驱动）

### 🔧 开发文档

适合：想要参与 Codex Father 开发或深入了解实现的开发者

- **[开发文档总览](developer/README.md)**
- [开发指南](developer/DEVELOPMENT.md) - 开发环境、技术栈、规范
- [代理说明](../AGENTS.md) - Agent 系统说明
- [Gemini 相关](developer/GEMINI.md) - Gemini 集成说明
- [贡献指南](developer/contributing.md) - 如何贡献代码
- [环境变量（JSON/CSV 清单）](environment-variables-reference.md#机器可读导出)

### 🏗️ 架构文档

适合：技术负责人、架构师，想要了解系统设计的开发者

- **[架构文档总览](architecture/README.md)**
- [架构概览](architecture/overview.md) - 系统架构设计
- [MCP 集成](architecture/mcp-integration.md) - MCP 协议集成详解
- [Codex 兼容性](architecture/codex-0.44-compatibility.md) - Codex 0.44 兼容说明
- [监督模式](architecture/supervision-patterns.md) - 监督模式设计
- [API 文档](architecture/api/) - 完整的 API 参考

### 🚀 运维文档

适合：运维人员、DevOps 工程师

- **[运维文档总览](operations/README.md)**
- [部署指南](operations/DEPLOY.md) - 生产环境部署
- [快速部署](operations/QUICK_DEPLOY.md) - 快速部署步骤

### 📋 版本发布

适合：关注版本更新和新功能的所有用户

- **[版本文档总览](releases/README.md)**
- [发布说明](releases/RELEASE_NOTES.md) - 最新版本说明
- [版本 1.0.0](releases/VERSION_1.0.0.md) - MVP1 发布说明
- [版本 1.2.0 MCP](releases/VERSION_MCP_1.2.0.md) - MCP 集成版本
- [发布流程](releases/RELEASE_FLOW_MCP.md) - MCP 发布流程
- [变更日志](../CHANGELOG.md) - 所有版本变更记录

### 🎯 MVP 文档

适合：想要了解项目发展历程和未来规划的开发者

- **[MVP 文档总览](mvp/README.md)**（含“全局实施路线图”）
- [MVP4 文档](mvp/mvp4/) - PRD 草案
- [MVP5 文档](mvp/mvp5/) - Worktree 集成计划
- [MVP10 文档](mvp/mvp10/README.md) - 单窗自动化与编排增强（与 auto 汇合）
- [MVP11 文档](mvp/MVP11/PRD.md) - 四种模式（CLI/作业/MCP/内嵌）整合 PRD
- [MVP12 文档](mvp/mvp12/README.md) - 自动模型路由与高质量工作流（不改官方源）

---

## 🗺️ 按角色导航

### 我是第一次使用的用户

**推荐路径**：

1. [5分钟快速开始](user/quick-start.md) ⭐
2. [首次运行测试](user/first-run.md)
3. [场景化使用](user/use-cases/README.md)
4. 遇到问题？→ [故障排除](user/troubleshooting.md)

### 我是开发者

**推荐路径**：

1. [开发指南](developer/DEVELOPMENT.md)
2. [架构概览](architecture/overview.md)
3. [MCP 集成](architecture/mcp-integration.md)
4. [贡献指南](developer/contributing.md)

### 我是运维人员

**推荐路径**：

1. [部署指南](operations/DEPLOY.md)
2. [配置指南](user/configuration.md#高级配置)
3. [故障排除](user/troubleshooting.md)

### 我是技术负责人/架构师

**推荐路径**：

1. [架构概览](architecture/overview.md)
2. [MCP 集成](architecture/mcp-integration.md)
3. [监督模式](architecture/supervision-patterns.md)
4. [API 文档](architecture/api/)

---

## 🔍 快速查找

### 按关键词查找

| 关键词             | 相关文档                                                               |
| ------------------ | ---------------------------------------------------------------------- |
| **安装**           | [安装指南](user/installation.md)                                       |
| **配置**           | [配置指南](user/configuration.md)                                      |
| **环境变量**       | [环境变量参考](environment-variables-reference.md)                     |
| **Claude Desktop** | [配置指南 - Claude Desktop](user/configuration.md#配置-claude-desktop) |
| **Claude Code**    | [配置指南 - Claude Code](user/configuration.md#配置-claude-code)       |
| **Codex CLI**      | [配置指南 - Codex CLI](user/configuration.md#配置-codex-cli-rmcp)      |
| **错误**           | [故障排除](user/troubleshooting.md)                                    |
| **性能**           | [故障排除 - 性能问题](user/troubleshooting.md#性能问题)                |
| **审批**           | [配置指南 - 审批策略](user/configuration.md#审批策略配置)              |
| **API**            | [API 文档](architecture/api/)                                          |
| **部署**           | [部署指南](operations/DEPLOY.md)                                       |

---

## 📞 获取帮助

- **GitHub Issues**:
  [提交问题](https://github.com/yuanyuanyuan/codex-father/issues)
- **文档反馈**: [提交 PR](https://github.com/yuanyuanyuan/codex-father/pulls)
- **快速支持**: [故障排除指南](user/troubleshooting.md)

---

## 📌 文档更新日志

- **2025-10-04**: 完成文档结构重组，创建用户指南
- **2025-10-01**: 发布 MVP1 文档
- **2025-09-30**: 完成 MCP 集成文档

---

**🎉 开始探索 Codex
Father 文档吧！如果找不到需要的内容，请提交 Issue 告诉我们。**
