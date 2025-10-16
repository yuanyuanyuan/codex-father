# Codex Father 2.0 用户手册

> **极简多任务并发管理工具** - 从 5000+ 行重构为 550 行的轻量级任务执行引擎

## 📖 手册目录

本手册涵盖 Codex Father 2.0 的所有功能使用方法：

### 🚀 快速开始
- [安装指南](./installation.md) - 各种安装方式和环境配置
- [快速入门](./quickstart.md) - 5分钟上手指南
- [第一个任务](./first-task.md) - 创建和执行你的第一个任务

### 🔧 MCP 集成（推荐）
- [MCP 工具集介绍](./mcp/overview.md) - 六件套工具完整说明
- [Claude Code 配置](./mcp/claude-code-setup.md) - 与 Claude Code 的深度集成
- [MCP 工具详解](./mcp/tools.md) - 每个工具的详细使用方法
- [会话管理](./mcp/sessions.md) - 会话上下文和状态管理

### 🌐 HTTP API
- [API 概览](./http/overview.md) - REST API 和 WebSocket 介绍
- [REST 端点](./http/rest-endpoints.md) - 所有 API 端点的详细说明
- [WebSocket 实时通信](./http/websocket.md) - 实时状态推送和监控
- [API 客户端示例](./http/client-examples.md) - 各种语言的集成示例

### 💻 CLI 命令行
- [CLI 概览](./cli/overview.md) - 命令行工具介绍
- [命令详解](./cli/commands.md) - 所有命令的详细用法
- [配置文件](./cli/configuration.md) - 配置文件管理和最佳实践
- [高级用法](./cli/advanced.md) - 批量操作和脚本集成

### 📊 任务管理
- [任务类型](./tasks/types.md) - 支持的各种任务类型
- [并发控制](./tasks/concurrency.md) - 并发执行和资源管理
- [依赖关系](./tasks/dependencies.md) - 任务依赖和优先级
- [错误处理](./tasks/error-handling.md) - 错误分类和处理策略

### 🛡️ 安全与配置
- [安全策略](./security/policy.md) - 默认安全策略和自定义配置
- [环境配置](./configuration/environment.md) - 环境变量和系统配置
- [性能调优](./configuration/performance.md) - 性能优化和资源管理

### 🔍 监控与故障排除
- [状态监控](./monitoring/status.md) - 系统状态和健康检查
- [日志管理](./monitoring/logs.md) - 日志查看和分析
- [故障排除](./troubleshooting/common-issues.md) - 常见问题和解决方案
- [调试模式](./troubleshooting/debugging.md) - 调试技巧和工具

### 📚 实用示例
- [开发工作流](./examples/workflows.md) - 常见开发工作流示例
- [CI/CD 集成](./examples/ci-cd.md) - 持续集成和部署示例
- [项目模板](./examples/templates.md) - 各种项目类型的配置模板

### 📖 参考文档
- [API 参考](./reference/api.md) - 完整的 API 参考
- [配置参考](./reference/configuration.md) - 所有配置选项说明
- [错误码参考](./reference/error-codes.md) - 错误码和错误信息
- [更新日志](./reference/changelog.md) - 版本更新记录

## 🎯 开始使用

### 新用户推荐路径

1. **安装和配置** → [安装指南](./installation.md)
2. **快速体验** → [快速入门](./quickstart.md)  
3. **选择使用方式**：
   - **MCP 集成**（推荐）：[Claude Code 配置](./mcp/claude-code-setup.md)
   - **HTTP API**：[API 概览](./http/overview.md)
   - **命令行**：[CLI 概览](./cli/overview.md)

### 不同角色的使用建议

| 角色 | 推荐使用方式 | 入门文档 |
|------|-------------|----------|
| **开发者** | MCP 集成 | [MCP 工具集介绍](./mcp/overview.md) |
| **DevOps 工程师** | HTTP API + CLI | [API 概览](./http/overview.md) |
| **系统管理员** | CLI 命令行 | [CLI 概览](./cli/overview.md) |
| **集成开发者** | HTTP API | [REST 端点](./http/rest-endpoints.md) |

## 🚀 核心特性

### 🎯 极简设计
- **代码精简**：从 5000+ 行重构为 550 行
- **启动快速**：< 50ms 启动时间
- **内存占用**：< 20MB 运行内存
- **零依赖**：最小化外部依赖

### ⚡ 高性能并发
- **并发执行**：支持 50+ 并发任务
- **智能调度**：优先级队列 + 公平调度
- **资源管理**：CPU + 内存使用率监控
- **动态调整**：根据系统负载自动调整

### 🔌 多接口支持
- **MCP 协议**：与 Claude Code 深度集成
- **REST API**：标准 HTTP 接口
- **WebSocket**：实时状态推送
- **CLI 工具**：命令行操作界面

### 🛡️ 安全可靠
- **沙箱执行**：网络访问禁用，文件路径限制
- **超时保护**：10分钟默认超时，可配置
- **错误处理**：完整的错误分类和处理
- **状态持久化**：JSON 文件本地存储

## 📋 系统要求

### 最低要求
- **Node.js**: 18.0.0 或更高版本
- **内存**: 128MB 可用内存
- **磁盘**: 50MB 可用空间
- **操作系统**: Linux, macOS, Windows

### 推荐配置
- **Node.js**: 20.0.0 LTS
- **内存**: 512MB 可用内存
- **CPU**: 2+ 核心处理器
- **网络**: 不需要（默认禁用网络访问）

## 🤝 获取帮助

### 文档资源
- **在线文档**: [GitHub Wiki](https://github.com/your-org/codex-father/wiki)
- **API 参考**: [API 文档](./reference/api.md)
- **示例代码**: [示例仓库](https://github.com/your-org/codex-father-examples)

### 社区支持
- **问题反馈**: [GitHub Issues](https://github.com/your-org/codex-father/issues)
- **讨论交流**: [GitHub Discussions](https://github.com/your-org/codex-father/discussions)
- **实时聊天**: [Discord 频道](https://discord.gg/codex-father)

### 技术支持
- **商业支持**: support@codex-father.com
- **企业咨询**: enterprise@codex-father.com
- **安全问题**: security@codex-father.com

---

**🎉 开始你的 Codex Father 2.0 之旅吧！**

*如果遇到任何问题，请查看 [故障排除指南](./troubleshooting/common-issues.md) 或在社区寻求帮助。*