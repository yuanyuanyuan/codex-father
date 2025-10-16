# Implementation Plan: Codex Father 2.0 重构实现

**Branch**: `001-2-specification-data` | **Date**: 2025-10-15 | **Spec**: `/data/codex-father/specs/001-2-specification-data/spec.md`
**Input**: Feature specification from `/data/codex-father/specs/001-2-specification-data/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See
`.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Codex Father 2.0 是一个从 5000+ 行重构为 550 行的极简多任务并发管理工具，专注于 MCP 深度集成。核心功能包括：1) MCP 六件套工具集成 2) 高并发任务执行引擎（支持 50+ 并发） 3) HTTP API 和 WebSocket 支持 4) CLI 命令行工具。技术栈采用 Node.js + TypeScript，支持多种语言容器（Shell、Node.js、Python），使用本地 JSON 文件存储，基础安全策略（禁用网络、限制文件路径）。

## Technical Context

**Language/Version**: Node.js 18+ / TypeScript 5.0+  
**Primary Dependencies**: @modelcontextprotocol/sdk (MCP), commander (CLI), express (HTTP), express-ws (WebSocket)  
**Storage**: 本地 JSON 文件系统（轻量级持久化）  
**Testing**: Jest + TypeScript + MCP 集成测试  
**Target Platform**: 跨平台服务器/命令行环境（Linux, macOS, Windows）  
**Project Type**: 单项目（CLI 工具 + MCP 服务器 + HTTP API）  
**Performance Goals**: 启动 <50ms, 内存 <20MB, 50+ 并发任务, MCP 响应 <100ms  
**Constraints**: 基础安全（禁用网络访问、限制文件路径）, 默认超时 10 分钟, 无自动重试  
**Scale/Scope**: 代码 <550 行, 支持 Claude Code 用户、CI/CD 工程师、命令行开发者

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

[Gates determined based on constitution file]

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```
src/
├── core/
│   ├── TaskRunner.ts          # 核心执行引擎 (100 行)
│   ├── types.ts               # 类型定义 (50 行)
│   └── utils.ts               # 工具函数 (30 行)
├── interfaces/
│   ├── mcp/
│   │   ├── server.ts          # MCP 服务器 (200 行)
│   │   ├── tools.ts           # MCP 工具定义 (50 行)
│   │   └── handlers.ts        # 请求处理器 (50 行)
│   ├── http/
│   │   ├── server.ts          # HTTP 服务器 (100 行)
│   │   ├── routes.ts          # 路由定义 (30 行)
│   │   └── websocket.ts       # WebSocket 支持 (20 行)
│   └── cli/
│       ├── index.ts           # CLI 入口 (30 行)
│       └── commands.ts        # 命令实现 (20 行)
└── index.ts                   # 主入口 (20 行)

tests/
├── unit/
│   ├── TaskRunner.test.ts
│   ├── MCPServer.test.ts
│   └── HTTPServer.test.ts
├── integration/
│   ├── mcp-integration.test.ts
│   ├── http-integration.test.ts
│   └── end-to-end.test.ts
└── contract/
    ├── mcp-schema.test.ts
    └── api-contract.test.ts

dist/                          # TypeScript 编译输出
docs/                          # 文档目录
├── api/                       # API 文档
├── examples/                  # 示例代码
└── troubleshooting.md         # 故障排除指南

package.json
tsconfig.json
jest.config.js                # 测试配置
README.md
```

**Structure Decision**: 单项目架构，极简设计 - 总代码量控制在 550 行以内

## Complexity Tracking

_Fill ONLY if Constitution Check has violations that must be justified_

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| 无违反                     | 架构简洁符合宪法要求 | N/A |

## Progress Tracking

### Phase 0: Research ✅ COMPLETED
- [x] 生成研究文档 (research.md)
- [x] 技术可行性分析
- [x] 风险评估和缓解策略
- [x] 实施路径推荐

### Phase 1: Design ✅ COMPLETED  
- [x] 生成数据模型 (data-model.md)
- [x] MCP 协议契约 (contracts/mcp-schema.md)
- [x] HTTP API 契约 (contracts/http-api.md)
- [x] CLI 命令契约 (contracts/cli-commands.md)
- [x] 快速入门指南 (quickstart.md)

### Phase 2: Task Breakdown ✅ COMPLETED
- [x] 详细任务分解 (tasks.md)
- [x] 时间估算和优先级
- [x] 依赖关系和风险矩阵
- [x] 成功指标定义

### Overall Status: ✅ ALL PHASES COMPLETED
