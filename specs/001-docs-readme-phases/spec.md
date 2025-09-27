# Feature Specification: 基于分阶段实施方案的规范和技术架构更新

**Feature Branch**: `001-docs-readme-phases`
**Created**: 2025-09-27
**Status**: Draft
**Input**: User description: "基于docs/README.phases.md的内容，包括里面的链接的文档内容来更新相关规范和技术架构和目录架构"

## User Scenarios & Testing

### Primary User Story
作为 Codex Father 项目的开发者和用户，我需要根据三阶段实施方案来更新和规范化项目的技术架构、代码规范、目录结构和文档体系，确保项目按照既定的路线图有序推进，并为各个阶段的实施提供清晰的指导和标准。

### Acceptance Scenarios
1. **Given** 现有的三阶段文档（阶段一：非交互模式、阶段二：Git PR自动化、阶段三：容器集成）需按顺序实施且有严格依赖关系，**When** 基于这些文档更新技术规范，**Then** 项目规范应完整覆盖三个阶段的技术要求和实施标准，确保阶段依赖关系清晰
2. **Given** 当前项目的目录结构和代码组织，**When** 根据分阶段方案调整架构，**Then** 目录结构应支持各阶段功能的独立开发和集成
3. **Given** 各阶段的设计和需求文档，**When** 制定统一的开发规范，**Then** 规范应确保代码质量、测试标准和性能要求在各阶段得到一致执行
4. **Given** 现有的关键测试（tests/smoke_start_args_forwarding.sh、tests/mcp_ts_e2e.sh），**When** 实施架构更新，**Then** 所有现有测试必须继续通过且无功能回退
5. **Given** docs/README.phases.md 的更新，**When** 修改相关设计文档，**Then** docs/requirements-* 与 design-* 必须与实际实现保持一致

### Edge Cases
- 如何处理阶段间的依赖冲突和兼容性问题？
- 当容器环境不可用时，如何保证核心功能的可用性？（已澄清：提供本地环境替代方案，功能有限但核心可用）
- 如何确保在不同操作系统和环境下的一致性表现？
- **文件队列并发与原子性**：如何处理多任务并发访问时的文件锁（flock/FS O_EXCL）、原子写入（临时文件 + rename）和状态一致性？
- **跨平台兼容性**：如何处理不同 OS 的路径分隔符、文件权限、字符编码一致性？目录/路径不使用 emoji，脚本仅使用 POSIX/Bash5 可用工具
- **Git PR 自动化冲突策略**：在分叉仓库/权限不足时如何降级为本地分支与补丁文件？提供干跑模式与日志说明

## Clarifications

### Session 2025-09-27
- Q: 关于与 Codex CLI 的集成关系 → A: Codex Father 是 Codex CLI 的包装器/编排工具，提供额外的功能层
- Q: 关于三阶段实施的优先级和依赖关系 → A: 必须按顺序实施：阶段一 → 阶段二 → 阶段三，有严格依赖关系
- Q: 关于性能基准的测量环境和条件 → A: 暂时对性能要求不大
- Q: 关于测试覆盖率的具体要求 → A: 严格要求：核心功能 ≥80%，关键路径 100%
- Q: 关于容器环境不可用时的回退策略 → A: 提供本地环境替代方案，功能有限但核心可用
- Q: CLI 实现技术栈选择：Shell vs Python vs TypeScript → A: **长期目标**：逐步引入 TypeScript/Node.js 组件；**短期策略**：保留现有 Bash CLI（start.sh/job.sh），新增 TS 组件不破坏现有接口与产物，确保向后兼容
- Q: 数据存储和持久化方案选择 → A: 纯文件系统：JSON/YAML配置 + 文本日志，保持简洁性
- Q: 异步任务管理实现方式选择 → A: 队列系统：基于文件的任务队列，支持优先级和重试机制
- Q: 测试框架选择：Jest vs Vitest vs Mocha → A: Vitest：现代快速，与TypeScript集成好，轻量级

## Requirements

### Functional Requirements

- **FR-001**: 系统必须作为 Codex CLI 的包装器/编排工具，基于三阶段实施方案（非交互模式、Git PR自动化、容器集成）更新技术架构规范
- **FR-002**: 系统必须提供清晰的目录结构规范，支持 CLI、MCP、测试、文档的分离和组织
- **FR-003**: 系统必须制定统一的代码质量标准，TypeScript 使用 ESLint、Prettier 和严格模式规范，Bash 脚本遵循 Google Shell Style Guide，必须通过 `bash -n` 语法检查和 shellcheck 静态分析
- **FR-004**: 系统必须建立双重测试策略框架，TypeScript 使用 Vitest 进行单元/集成测试，Bash 脚本使用 bats 和smoke 测试，支持分层管理，核心功能测试覆盖率≥80%，关键路径测试覆盖率100%，现有测试（smoke_start_args_forwarding.sh、mcp_ts_e2e.sh）必须持续通过
- **FR-005**: 系统应定义基础性能基准作为参考（性能要求暂时不严格，可在后续阶段优化）
- **FR-006**: 系统必须规范化非交互模式的三种沙箱策略（只读、工作区可写、容器全权限）
- **FR-007**: 系统必须制定 Git 工作流规范，支持分支管理、PR 自动化和代码审查流程
- **FR-008**: 系统必须基于现有 job.sh 和 .codex-father/sessions/<job-id>/ 目录结构实现任务队列系统，复用并扩展现有会话管理语义，支持异步任务管理、优先级调度和重试机制，确保与现有产物路径和状态模型兼容
- **FR-009**: 系统必须提供容器化开发环境标准，包括 DevContainer 和 Docker 配置规范，同时提供本地环境回退方案以确保核心功能可用性
- **FR-010**: 系统必须建立文档体系架构，确保各阶段文档的一致性和可维护性
- **FR-011**: 系统必须制定安全标准，默认启用 start.sh 的 --redact 选项和 --sandbox workspace-write 策略，支持 --redact-pattern 自定义脱敏规则，审计日志写入 .codex-father/sessions/ 目录遵循现有命名规范（codex-*.log、*.meta.json）

### Key Entities

- **技术架构规范**: 包含系统设计原则、模块划分、接口标准和集成规范
- **目录架构标准**: 定义项目结构、文件组织、命名约定和分层策略
- **代码质量规范**: 涵盖编码标准、代码审查、静态分析和质量门禁
- **测试架构框架**: 包括测试分层、覆盖率要求、自动化策略和容器化测试
- **性能标准体系**: 定义性能基准、监控指标、优化策略和验收标准
- **安全合规框架**: 包含安全策略、权限管理、数据保护和审计要求
- **文档规范体系**: 涵盖文档结构、版本管理、维护策略和用户指南
- **Job/Session 状态模型**: 定义作业状态转换（queued/running/succeeded/failed/aborted）、会话元数据、日志命名规范（codex-*.log、*.meta.json）
- **Queue Item 模型**: 包含优先级调度、重试机制、任务依赖、原子操作（临时文件 + rename）、锁机制（flock/FS O_EXCL）
- **Redaction 规则模型**: 定义默认脱敏规则、--redact-pattern 自定义模式、敏感信息检测算法、日志脱敏输出

## Project Directory Architecture

### 设计原则
基于澄清的三阶段实施方案（按顺序：阶段一→阶段二→阶段三），作为 Codex CLI 包装器/编排工具的目录架构设计，支持本地环境回退方案和严格的测试覆盖率要求。

### 目录结构规范

```
codex-father/
├── 🔧 core/                           # 核心功能模块
│   ├── cli/                           # CLI 包装器组件（TypeScript）
│   │   ├── start.ts                   # 主入口脚本
│   │   ├── task-queue.ts              # 异步任务队列管理
│   │   └── utils/                     # CLI 工具函数
│   ├── mcp/                           # MCP 服务器模块（TypeScript）
│   │   ├── server.ts                  # MCP 入口
│   │   ├── codex-mcp-server/          # TypeScript MCP 实现
│   │   └── protocols/                 # MCP 协议定义
│   └── lib/                           # 共享库（TypeScript）
│       ├── common.ts                  # 通用函数
│       ├── presets.ts                 # 预设配置
│       └── validation/                # 参数验证
│
├── 🎯 phases/                         # 三阶段实施模块
│   ├── phase1-non-interactive/        # 阶段一：非交互模式
│   │   ├── src/                       # 实现代码
│   │   ├── tests/                     # 阶段测试
│   │   └── docs/                      # 阶段文档
│   ├── phase2-git-pr-automation/      # 阶段二：Git PR自动化
│   │   ├── src/
│   │   ├── tests/
│   │   └── docs/
│   └── phase3-container-integration/  # 阶段三：容器集成
│       ├── src/
│       ├── tests/
│       └── docs/
│
├── 🧪 tests/                          # 测试架构（Vitest，覆盖率：核心功能≥80%，关键路径100%）
│   ├── unit/                          # 单元测试
│   │   ├── cli/                       # CLI 单元测试
│   │   ├── mcp/                       # MCP 单元测试
│   │   └── lib/                       # 库函数测试
│   ├── integration/                   # 集成测试
│   │   ├── phase1/                    # 阶段一集成测试
│   │   ├── phase2/                    # 阶段二集成测试
│   │   └── phase3/                    # 阶段三集成测试
│   ├── e2e/                          # 端到端测试
│   │   ├── local/                     # 本地环境 E2E
│   │   └── container/                 # 容器环境 E2E
│   ├── fixtures/                      # 测试固件
│   └── utils/                         # 测试工具
│
├── 🐳 environments/                   # 环境配置
│   ├── local/                         # 本地环境配置
│   │   ├── setup.sh                   # 本地环境设置
│   │   └── fallback/                  # 回退策略配置（容器不可用时）
│   ├── container/                     # 容器环境
│   │   ├── .devcontainer/             # VS Code Dev Container
│   │   ├── docker/                    # Docker 配置
│   │   └── scripts/                   # 容器脚本
│   └── ci/                           # CI/CD 配置
│       ├── github/                    # GitHub Actions
│       └── templates/                 # CI 模板
│
├── 📚 docs/                          # 文档体系
│   ├── architecture/                  # 架构文档
│   │   ├── overview.md               # 架构总览
│   │   ├── phases-design.md          # 三阶段设计
│   │   └── integration-patterns.md   # 集成模式
│   ├── development/                   # 开发指南
│   │   ├── coding-standards.md       # 编码标准（TypeScript: ESLint + Prettier + 严格模式）
│   │   ├── testing-guide.md          # 测试指南
│   │   └── contribution.md           # 贡献指南
│   ├── operations/                    # 运维文档
│   │   ├── deployment.md             # 部署指南
│   │   ├── monitoring.md             # 监控配置
│   │   └── troubleshooting.md        # 故障排除
│   ├── user-guides/                  # 用户指南
│   │   ├── quick-start.md            # 快速开始
│   │   ├── cli-reference.md          # CLI 参考
│   │   └── mcp-integration.md        # MCP 集成
│   └── legacy/                       # 历史文档
│       └── README.phases.md          # 原分阶段文档
│
├── 🔒 security/                      # 安全与合规
│   ├── policies/                      # 安全策略
│   │   ├── sandbox-rules.md          # 三种沙箱策略（只读、工作区可写、容器全权限）
│   │   └── data-protection.md        # 数据保护（脱敏、审计日志）
│   ├── audit/                        # 审计配置
│   │   ├── logging-config.yaml       # 日志配置
│   │   └── monitoring-rules.yaml     # 监控规则
│   └── compliance/                    # 合规检查
│       ├── security-checklist.md     # 安全检查表
│       └── review-templates/          # 审查模板
│
├── 🛠️ tools/                         # 开发工具
│   ├── setup/                        # 项目设置
│   │   ├── install-deps.sh           # 依赖安装
│   │   └── init-env.sh               # 环境初始化
│   ├── quality/                       # 质量工具
│   │   ├── lint-all.sh               # 代码检查
│   │   ├── format-code.sh            # 代码格式化
│   │   └── coverage-report.sh        # 覆盖率报告
│   └── build/                        # 构建工具
│       ├── package.sh                # 打包脚本
│       └── release.sh                # 发布脚本
│
├── 📊 config/                        # 配置管理
│   ├── defaults/                      # 默认配置
│   │   ├── cli-defaults.conf         # CLI 默认配置
│   │   └── mcp-defaults.json         # MCP 默认配置
│   ├── profiles/                      # 配置文件
│   │   ├── development.conf          # 开发环境
│   │   ├── testing.conf              # 测试环境
│   │   └── production.conf           # 生产环境
│   └── schemas/                       # 配置模式
│       ├── cli-schema.json           # CLI 配置模式
│       └── mcp-schema.json           # MCP 配置模式
│
├── 📝 .specify/                      # 规范管理（现有）
│   ├── memory/                        # 项目记忆
│   ├── templates/                     # 模板文件
│   └── scripts/                       # 规范脚本
│
├── 🗃️ artifacts/                     # 构建产物（gitignore）
│   ├── builds/                        # 构建输出
│   ├── reports/                       # 测试报告
│   └── coverage/                      # 覆盖率报告
│
└── 📋 项目根文件
    ├── README.md                      # 项目概述
    ├── CHANGELOG.md                   # 变更日志
    ├── LICENSE                        # 许可证
    ├── .gitignore                     # Git 忽略规则
    ├── .editorconfig                  # 编辑器配置
    ├── package.json                   # Node.js 依赖（MCP）
    └── Makefile                       # 构建命令
```

### 架构特点

#### 三阶段支持
- **phases/** 目录支持严格依赖的顺序实施
- 每阶段独立的开发、测试、文档空间
- 清晰的阶段集成和依赖管理

#### 测试分层架构
- **单元测试**: tests/unit/ - 核心功能覆盖率 ≥80%
- **集成测试**: tests/integration/ - 按阶段组织
- **E2E测试**: tests/e2e/ - 关键路径覆盖率 100%
- 分离本地和容器测试环境

#### 环境管理
- **本地环境**: environments/local/ - 回退策略支持
- **容器环境**: environments/container/ - DevContainer + Docker
- **CI/CD**: environments/ci/ - 自动化流水线

#### 模块化设计
- **core/** - 核心功能（CLI、MCP、共享库）
- 清晰的模块边界和接口定义
- 支持独立开发和测试

#### 安全与合规
- **security/** - 三种沙箱策略管理
- 默认安全策略和审计日志
- 敏感信息脱敏配置

### 迁移策略
- **阶段零**: 保留现有结构，新增 phases/ 目录
- **阶段一**: 迁移非交互模式，建立测试架构
- **阶段二&三**: 按架构逐步迁移和扩展

## Review & Acceptance Checklist

### Content Quality
- [x] 聚焦于用户价值和业务需求
- [x] 为非技术利益相关者编写
- [x] 完成所有必需部分
- [x] 产品/架构层规范明确，技术细节归属合理

### Requirement Completeness
- [x] 需求可测试且明确
- [x] 成功标准可衡量
- [x] 范围边界清晰
- [x] 识别了依赖关系和假设
- [x] 无 [NEEDS CLARIFICATION] 标记

## Execution Status

- [x] 用户描述已解析
- [x] 关键概念已提取
- [x] 模糊性已标记
- [x] 用户场景已定义
- [x] 需求已生成
- [x] 实体已识别
- [ ] 审查清单待通过（待实施验证）