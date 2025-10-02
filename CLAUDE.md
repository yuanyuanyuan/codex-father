# codex-father Development Guidelines

Auto-generated from all feature plans. Last updated: 2025-09-30

## Active Technologies

### MVP1 TypeScript MCP Server (005-docs-prd-draft - COMPLETED)

- **TypeScript 5.3+** with Node.js 18+ (统一技术栈)
- **@modelcontextprotocol/sdk** ^1.0.4 - MCP 协议 SDK
- **inquirer** ^9.3.7 - 终端交互 UI（审批机制）
- **zod** ^3.24.1 - 运行时类型验证和 Schema
- **uuid** ^11.0.3 - 唯一 ID 生成
- **vitest** ^1.6.1 - 单元测试和集成测试框架
- 文件系统（JSONL 事件日志、JSON 配置、Codex 原生 rollout 文件引用）

### Legacy Shell Scripts (旧实现，保留兼容)

- TypeScript 5.x + Node.js 18+ (统一技术栈) (001-docs-readme-phases)
- 文件系统 - JSON/YAML配置文件 + 结构化文本日志 (001-docs-readme-phases)
- TypeScript 5.x + Node.js 18+ (统一技术栈，符合项目现有规范) + Markdown
  parser/renderer,
  Mermaid图表库, 文件系统操作, 权限管理框架 (002-docs-prd-draft)
- 文件系统 - JSON/YAML配置文件 + 结构化文本日志 +
  Markdown文档存储 (002-docs-prd-draft)

## Project Structure

```
codex-father/
├── core/                 # MVP1 核心实现
│   ├── approval/        # 审批系统 (PolicyEngine, TerminalUI)
│   ├── cli/             # CLI 命令 (mcp-command.ts)
│   ├── mcp/             # MCP 协议实现 (Server, BridgeLayer)
│   ├── process/         # 进程管理 (SingleProcessManager)
│   ├── session/         # 会话管理 (SessionManager, EventLogger)
│   └── lib/             # 共享类型和工具
├── tests/               # 测试
│   ├── contract/        # MCP 契约测试
│   ├── integration/     # 集成测试
│   └── benchmark/       # 性能基准测试
├── specs/               # 设计规范
│   └── 005-docs-prd-draft/
├── docs/                # 文档
│   └── mcp-integration.md
├── README.md            # MVP1 主文档 (NEW)
└── readme.md            # 旧 shell 脚本文档 (Legacy)
```

## Commands

### Development

```bash
npm run dev              # 开发模式（自动重载）
npm run build            # 构建 TypeScript
npm run build:watch      # 监听模式构建
npm run typecheck        # 类型检查
npm run lint             # Lint + 自动修复
npm run lint:check       # Lint 检查（不修复）
npm run format           # 格式化代码
npm run check:all        # 完整检查（typecheck + lint + format + test）
```

### Testing

```bash
npm test                 # 运行所有测试
npm run test:run         # 运行测试（无监听）
npm run test:coverage    # 生成覆盖率报告
npm run test:watch       # 监听模式
npm run benchmark        # 性能基准测试
```

### MCP Server

```bash
npm run mcp:start        # 启动 MCP 服务器
npm start                # 同 mcp:start
npx @modelcontextprotocol/inspector npm run mcp:start  # 使用 Inspector 调试
```

## Code Style

- **TypeScript**: 严格模式，完整类型注解
- **ESLint**: 遵循 TypeScript 推荐规则
- **Prettier**: 自动格式化
- **Conventional Commits**: 规范化提交信息
- **SOLID 原则**: 模块化设计，单一职责

## Recent Changes

### 2025-10-02 - MVP1 Polish & Release Prep

- ✅ 完成 T035 代码复用检查：重复代码率 3.2%（✅ 达标 < 5%）
- ✅ 完成 T036 文档更新：README.md, CLAUDE.md, VERSION_1.0.0.md
- ✅ 创建 T037 验收测试操作指引：`specs/005-docs-prd-draft/T037-ACCEPTANCE-TEST-GUIDE.md`
- ✅ 创建 T038 代码审查范围文档：`specs/005-docs-prd-draft/T038-CODE-REVIEW-SCOPE.md`
- ✅ 修复 tasks.md 重复条目（T018/T019/T020）
- ✅ 更新 tasks.md：标记 T001-T036 完成，T037-T038 待执行
- 🔄 准备发布 v1.0.0

### 2025-10-01 - MVP1 All Tests Complete

- ✅ 完成 MCP 服务器 MVP1 实现 (T001-T033)
- ✅ 完成所有单元测试和集成测试 (T021-T033)
- ✅ 完成性能基准测试 (T034)
- ✅ **506 个测试全部通过** (51 个测试文件, 6 个跳过)
- ✅ 性能指标达标: tools/call < 500ms, 事件延迟 < 100ms, 内存 < 200MB
- ✅ 更新文档 (README.md, CLAUDE.md, mcp-integration.md)

### 2025-09-30 - MVP1 Feature Complete

- ✅ 完成 MCP 服务器 MVP1 核心实现 (T001-T020)
- ✅ 更新文档

### 2025-09-27

- 005-docs-prd-draft: Added TypeScript 5.3+ with Node.js 18+

<!-- MANUAL ADDITIONS START -->

## Documentation Maintainer

- Project subagent lives at `.claude/agents/docs-maintainer.md`; invoke it for
  incremental doc sync.
- Hook automation uses `scripts/hooks/docs_maintainer_hook.sh` and is registered
  in `.claude/settings.local.json` for `SessionStart` and `PostToolUse`.
- Hook output artifacts (context, prompt, log) are stored under
  `.claude/hooks/docs-maintainer/` for traceability.
- Override the auto-run command by setting `DOCS_MAINTAINER_SUBAGENT_CMD`;
  defaults to `claude subagents run docs-maintenance-expert`.
- See Claude Code Hooks and Subagents guides for CLI syntax and security
expectations.
<!-- MANUAL ADDITIONS END -->
