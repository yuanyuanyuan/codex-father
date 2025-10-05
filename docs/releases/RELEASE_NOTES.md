# Release Notes - Codex Father

> 最新亮点：MCP 子包 v1.6.0 发布（内置脚本自动同步，缺失即显式报错）

---

## 🎉 重大里程碑（节选）

这是 **Codex Father** 的发布汇总页。MCP 子包已完成以下关键版本：

- v1.6.0：移除系统 fallback，自动同步 `.codex-father` 内置脚本并提供显式缺失错误
- v1.4.0：可发现性与传输增强（默认 NDJSON；`--transport=content-length`；`codex.clean`/`codex.metrics`；`codex.logs`
  增强）
- v1.3.0：工具别名与命名策略（`CODEX_MCP_NAME_STYLE`/`CODEX_MCP_TOOL_PREFIX`/`CODEX_MCP_HIDE_ORIGINAL`；`codex.help`）
- v1.2.0：版本兼容门禁（Codex 版本检测、参数与配置键校验、明确错误码）

完整详细说明见 docs/releases 目录下对应版本页面。

---

## ✨ 核心特性

### 1. MCP 协议支持

- ✅ 完整实现 MCP 2024-11-05 协议规范
- ✅ 支持 stdio 传输方式
- ✅ 标准化的工具定义和调用
- ✅ 实时事件通知机制

### 2. Codex CLI 集成

- ✅ 单进程高效管理
- ✅ 异步非阻塞执行
- ✅ 自动进程健康检查和重启
- ✅ 进程生命周期完整管理

### 3. 审批机制

支持 4 种灵活的审批策略：

- **UNTRUSTED**: 仅白名单命令自动批准
- **ON_REQUEST**: Codex 请求时需审批
- **ON_FAILURE**: 命令失败时需审批
- **NEVER**: 所有命令自动批准

特性：

- ✅ 终端交互式 UI
- ✅ 白名单正则表达式匹配
- ✅ 审批超时控制
- ✅ 批量审批支持

### 4. 会话管理

- ✅ 自动会话创建和目录管理
- ✅ JSONL 格式事件日志 (流式写入)
- ✅ JSON 格式配置持久化
- ✅ Rollout 引用文件管理
- ✅ 会话状态追踪 (INITIALIZING → ACTIVE → IDLE → TERMINATED)

### 5. 事件系统

- ✅ 实时事件映射 (Codex → MCP)
- ✅ Job/Session/Process/Approval 事件支持
- ✅ 进度通知推送
- ✅ 错误和完成状态通知

---

## 🚀 MCP 工具

本版本提供以下 MCP 工具：

### 1. `codex-chat`

发送消息到 Codex 对话

- 支持自定义 session name 和 model
- 自动会话管理
- 实时进度通知

### 2. `codex-execute`

执行 Codex 任务

- 支持任意 Codex CLI 参数
- 异步执行，快速返回 (< 500ms)
- 命令审批控制

### 3. `codex-read-file`

读取工作区文件

- 支持相对/绝对路径
- 二进制文件检测
- 大文件安全处理

### 4. `codex-apply-patch`

应用文件补丁

- 文件创建/修改/删除
- 审批机制保护
- 原子操作支持

---

## 📊 性能指标

### 响应速度

```
✅ tools/call 响应时间: ~60ms (目标: < 500ms) - 超出预期 8.3x
✅ 事件映射延迟: ~0.008ms (目标: < 100ms) - 超出预期 12,500x
✅ 并发请求处理: ~65ms
```

### 资源占用

```
✅ 内存使用: ~100MB (目标: < 200MB) - 低于目标 50%
✅ 大量事件处理: ~125MB (仍低于目标)
```

### 端到端性能

```
✅ 完整请求-响应周期: ~49-60ms
✅ 高负载下性能: ~49ms (更优)
```

---

## ✅ 测试覆盖

### 测试统计

```
Test Files:  51 passed (51)
Tests:       506 passed | 6 skipped (512)
Duration:    91.19s
Pass Rate:   98.8%
```

### 测试类型

- ✅ **契约测试** (4个): 验证 MCP 和 Codex JSON-RPC 协议
- ✅ **单元测试** (400+): 覆盖所有核心模块
- ✅ **集成测试** (30+): 端到端场景验证
- ✅ **性能基准测试** (8个): 性能指标验证

### 测试覆盖模块

- ✅ 审批系统 (PolicyEngine, TerminalUI) - 62 tests
- ✅ MCP 协议层 (Server, BridgeLayer, EventMapper) - 105 tests
- ✅ 会话管理 (SessionManager, EventLogger, ConfigPersister) - 64 tests
- ✅ 进程管理 (SingleProcessManager) - 28 tests
- ✅ Codex 客户端 (CodexClient) - 13 tests
- ✅ CLI 命令 (mcp-command) - 13 tests

---

## 🏗️ 技术栈

### 核心依赖

- **TypeScript** 5.3+ - 类型安全
- **Node.js** 18+ - 运行时
- **@modelcontextprotocol/sdk** ^1.0.4 - MCP 官方 SDK
- **inquirer** ^9.3.7 - 终端交互 UI
- **zod** ^3.24.1 - 运行时类型验证
- **uuid** ^11.0.3 - 唯一 ID 生成

### 开发工具

- **vitest** ^1.6.1 - 测试框架
- **ESLint** - 代码质量检查
- **Prettier** - 代码格式化
- **TypeScript Compiler** - 类型检查

---

## 📁 项目结构

```
codex-father/
├── core/                 # MVP1 核心实现
│   ├── approval/        # 审批系统
│   │   ├── policy-engine.ts      # 策略引擎
│   │   └── terminal-ui.ts        # 终端 UI
│   ├── cli/             # CLI 命令
│   │   └── commands/
│   │       └── mcp-command.ts    # MCP 服务器命令
│   ├── mcp/             # MCP 协议实现
│   │   ├── server.ts             # MCP 服务器
│   │   ├── bridge-layer.ts       # 桥接层
│   │   ├── event-mapper.ts       # 事件映射器
│   │   ├── codex-client.ts       # Codex 客户端
│   │   └── protocol/types.ts     # 协议类型
│   ├── process/         # 进程管理
│   │   └── manager.ts            # 单进程管理器
│   ├── session/         # 会话管理
│   │   ├── session-manager.ts    # 会话管理器
│   │   ├── event-logger.ts       # 事件日志
│   │   └── config-persister.ts   # 配置持久化
│   └── lib/             # 共享库
│       └── types.ts              # 类型定义
├── tests/               # 测试
│   ├── contract/        # 契约测试
│   ├── integration/     # 集成测试
│   └── benchmark/       # 性能测试
├── docs/                # 文档
│   ├── mcp-integration.md       # MCP 集成指南
│   ├── mvp1-manual-test-plan.md # 手动测试计划
│   └── mvp1-quick-test-guide.md # 快速测试指南
├── README.md            # 项目说明
└── CLAUDE.md            # 开发指南
```

---

## 🎯 代码质量

### Lint 检查

```
✅ Errors: 0
⚠️  Warnings: 237 (仅代码风格，不影响功能)
```

### 类型安全

```
✅ TypeScript strict mode
✅ 完整类型注解
✅ Zod 运行时验证
```

### 代码重复率

```
✅ 0.67% (目标: < 5%) - 远低于目标
```

### 架构评分

```
⭐⭐⭐⭐⭐ SOLID 原则遵循
⭐⭐⭐⭐⭐ 模块化设计
⭐⭐⭐⭐⭐ 职责分离
⭐⭐⭐⭐⭐ 可维护性
⭐⭐⭐⭐⭐ 可测试性
```

---

## 🚀 快速开始

### 安装

```bash
# 克隆仓库
git clone <repository-url>
cd codex-father

# 安装依赖
npm install

# 构建项目
npm run build
```

### 启动 MCP 服务器

```bash
# 直接启动
npm start

# 或使用 MCP Inspector 调试
npx @modelcontextprotocol/inspector npm start
```

### 配置为 Claude Desktop MCP 服务器

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "node",
      "args": ["/path/to/codex-father/dist/core/cli/start.js"],
      "env": {
        "CODEX_FATHER_APPROVAL_POLICY": "untrusted"
      }
    }
  }
}
```

---

## 📚 文档

- **README.md** - 项目概述和使用指南
- **CLAUDE.md** - 开发指南和技术栈说明
- **docs/mcp-integration.md** - MCP 集成详细文档
- **docs/mvp1-manual-test-plan.md** - 完整测试计划
- **specs/005-docs-prd-draft/** - 设计规范和任务清单

---

## 🔄 升级指南

这是首个正式版本，无需升级步骤。

---

## ⚠️ 已知限制

### MVP1 范围限制

1. **单进程管理**: 当前仅支持单个 Codex 进程（串行执行任务）
   - 多任务会排队执行
   - 未来 MVP2 将支持多进程池

2. **审批 UI**: 终端交互式 UI
   - 需要终端访问
   - 未来计划支持 Web UI

3. **日志查询**: 基础的 JSONL 格式
   - 需要手动解析
   - 未来计划提供查询工具

### 非阻塞问题

- **Lint 警告**: 237 个代码风格警告（不影响功能）
  - 主要是 `any` 类型和缺少返回类型注解
  - 已列入后续改进计划

---

## 🗺️ 未来计划 (MVP2)

### 性能增强

- [ ] 多进程池管理
- [ ] 智能任务调度
- [ ] 并发控制优化

### 功能扩展

- [ ] Web UI 审批界面
- [ ] 日志查询和分析工具
- [ ] 更多 MCP 工具

### 监控和运维

- [ ] 性能监控面板
- [ ] 健康检查 API
- [ ] 日志聚合和分析

---

## 🤝 贡献

我们欢迎社区贡献！请查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详情。

### 报告问题

- GitHub Issues:
  [github.com/your-org/codex-father/issues](https://github.com/your-org/codex-father/issues)

### 代码规范

- TypeScript strict mode
- ESLint + Prettier
- 完整单元测试覆盖

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

感谢所有为本项目做出贡献的开发者和测试人员！

特别感谢：

- **Model Context Protocol** 团队提供的优秀协议和 SDK
- **Codex CLI** 团队提供的强大工具
- 所有社区反馈和建议

---

## 📞 联系方式

- **项目主页**: [GitHub Repository](https://github.com/your-org/codex-father)
- **文档**: [Documentation](https://docs.example.com/codex-father)
- **问题反馈**: [GitHub Issues](https://github.com/your-org/codex-father/issues)

---

**🎉 Codex Father v1.0.0 - 让 Codex 更强大！**
