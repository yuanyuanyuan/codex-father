# Codex Father 2.0 - 完整开发指南

[中文](COMPREHENSIVE_GUIDE.md) | [English](COMPREHENSIVE_GUIDE.en.md)

> **从 5000+ 行重构为 550 行的轻量级任务执行引擎**，专注于 MCP 深度集成，支持高并发任务管理和实时监控。

[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![MCP](https://img.shields.io/badge/MCP-2024--11--05-purple)](https://modelcontextprotocol.io/)

---

## 📚 文档导航体系

### 🗂️ 完整知识地图

```
📖 完整开发指南 (本文档) - 总入口 📍
│
├── 🚀 [快速开始](#-快速开始) - 环境准备、基础使用
│   ├── 环境要求
│   ├── 安装配置
│   └── 第一个任务
│
├── 📖 [用户手册](#-用户手册) - 完整使用指南
│   ├── [核心功能](#核心功能) - MCP六件套、任务类型
│   ├── [接口文档](#-接口文档) - MCP、HTTP API、CLI
│   └── [使用场景](#-使用场景) - 开发、DevOps、团队协作
│
├── 🧪 [测试手册](#-测试手册) - 测试策略和质量保证
│   ├── [测试体系](#-测试体系) - 分类命令、内存优化
│   ├── [开发工作流](#-开发工作流) - 日常测试、CI/CD
│   └── [故障排除](#-故障排除) - 问题诊断、解决方案
│
├── 📦 [发布指南](#-发布指南) - 版本管理和发布流程
│   ├── [发布流程](#-发布流程) - 主项目、MCP子包
│   ├── [质量控制](#-质量控制) - 代码标准、检查清单
│   └── [版本管理](#-版本管理) - 版本规范、回滚策略
│
└── 🔧 [开发指南](#-开发指南) - 架构和开发规范
    ├── [项目结构](#-项目结构) - 代码组织、模块说明
    ├── [贡献指南](#-贡献指南) - 开发规范、提交流程
    └── [架构设计](#-架构设计) - 系统架构、技术选型
```

### 🎯 快速导航

| 需求场景 | 推荐章节 | 内容重点 |
|----------|----------|----------|
| **🚀 首次使用** | [快速开始](#-快速开始) | 环境搭建、基础配置 |
| **📖 日常使用** | [用户手册](#-用户手册) | 功能说明、操作指南 |
| **🧪 质量保证** | [测试手册](#-测试手册) | 测试策略、问题排查 |
| **📦 版本发布** | [发布指南](#-发布指南) | 发布流程、版本管理 |
| **🔧 开发贡献** | [开发指南](#-开发指南) | 架构理解、贡献规范 |

---

## 🎯 项目概览

### ✨ 核心特性

#### 🎯 极简设计

- **代码精简**: 从 5000+ 行重构为 550 行以内
- **启动快速**: < 50ms 启动时间
- **内存占用**: < 20MB 运行内存
- **零依赖**: 最小化外部依赖

#### ⚡ 高性能并发

- **并发执行**: 支持 50+ 并发任务
- **智能调度**: 优先级队列 + 公平调度
- **资源管理**: CPU + 内存使用率监控
- **动态调整**: 根据系统负载自动调整并发数

#### 🔌 多接口支持

- **MCP 协议**: 与 Claude Code 深度集成
- **REST API**: 标准 HTTP 接口
- **WebSocket**: 实时状态推送
- **CLI 工具**: 命令行操作界面

#### 🛡️ 安全可靠

- **沙箱执行**: 网络访问禁用，文件路径限制
- **超时保护**: 10分钟默认超时，可配置
- **错误处理**: 完整的错误分类和处理
- **状态持久化**: JSON 文件本地存储

### 📊 性能指标

| 指标             | 目标值  | 实际表现 |
| ---------------- | ------- | -------- |
| **启动时间**     | < 50ms  | ~35ms    |
| **内存占用**     | < 20MB  | ~15MB    |
| **并发任务**     | 50+     | 50+      |
| **MCP 响应时间** | < 100ms | ~80ms    |
| **API 响应时间** | < 50ms  | ~40ms    |
| **任务成功率**   | > 99%   | 99.2%    |
| **系统可用性**   | > 99.9% | 99.95%   |

---

## 🚀 快速开始

### 1. 环境要求

- **Node.js**: 18.0.0 或更高版本
- **npm**: 8.0.0 或更高版本
- **操作系统**: Linux, macOS, Windows

### 2. 安装

```bash
# 全局安装（推荐）
npm install -g codex-father

# 本地安装
npm install --save-dev codex-father

# 验证安装
codex-father --version
```

### 3. MCP 集成（推荐）

在 Claude Code 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": ["mcp", "--max-concurrency", "10"]
    }
  }
}
```

启动 Claude Code，即可开始对话式开发：

```
用户: 帮我创建一个用户登录组件
Claude: [调用 codex_exec 工具]
✅ 任务已提交: task-1704067200000-abc123
正在创建用户登录组件...

用户: 查看任务进度
Claude: [调用 codex_status 工具]
📊 任务完成: 登录组件已创建
```

### 4. HTTP API 使用

```bash
# 启动 HTTP 服务器
codex-father server --port 3000

# 提交任务
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "创建一个简单的 Express 服务器",
    "environment": "nodejs"
  }'

# 实时监控（WebSocket）
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onmessage = (event) => {
  console.log('任务更新:', JSON.parse(event.data));
};
```

### 5. CLI 命令行

```bash
# 启动 MCP 服务器
codex-father mcp

# 启动 HTTP 服务器
codex-father server --port 3000

# 执行任务配置文件
codex-father run tasks.json

# 查看系统状态
codex-father status

# 查看任务日志
codex-father logs task-id
```

---

## 📖 用户手册

### 核心功能

#### MCP 六件套工具

| 工具             | 功能         | 使用场景           |
| ---------------- | ------------ | ------------------ |
| **codex_exec**   | 执行开发任务 | 提交新的开发任务   |
| **codex_status** | 查询任务状态 | 检查任务执行进度   |
| **codex_logs**   | 获取执行日志 | 查看详细的执行信息 |
| **codex_reply**  | 继续任务对话 | 基于结果继续交互   |
| **codex_list**   | 列出所有任务 | 查看任务概览       |
| **codex_cancel** | 取消运行任务 | 停止不需要的任务   |

#### 任务类型支持

| 类型             | 描述                 | 示例                     |
| ---------------- | -------------------- | ------------------------ |
| **Shell 命令**   | 执行系统命令         | `npm test`, `git status` |
| **Node.js 脚本** | 运行 JavaScript 代码 | 数据处理、API 开发       |
| **Python 脚本**  | 运行 Python 代码     | 数据分析、机器学习       |
| **AI 提示**      | 自然语言任务         | "创建用户登录组件"       |

### 接口文档

#### MCP 集成

MCP (Model Context Protocol) 是与 Claude Code 深度集成的协议，提供对话式开发体验。

**配置方式：**

```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": ["mcp", "--max-concurrency", "10"]
    }
  }
}
```

**使用流程：**
1. Claude Code 调用 `codex_exec` 提交任务
2. 系统返回任务ID和初始状态
3. 后台异步执行任务
4. 通过 `codex_status` 查询进度
5. 使用 `codex_logs` 获取详细日志
6. 通过 `codex_reply` 继续交互

#### HTTP API

REST API 和 WebSocket 接口，支持标准 HTTP 调用和实时监控。

**API 端点：**

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/tasks` | 提交新任务 |
| GET | `/tasks/:id` | 查询任务状态 |
| GET | `/tasks` | 列出所有任务 |
| DELETE | `/tasks/:id` | 取消任务 |
| GET | `/tasks/:id/logs` | 获取任务日志 |
| WS | `/ws` | 实时状态推送 |

#### CLI 工具

命令行工具，支持脚本化和自动化操作。

**核心命令：**

```bash
codex-father mcp          # 启动 MCP 服务器
codex-father server       # 启动 HTTP 服务器
codex-father run <config> # 执行配置文件
codex-father status       # 查看系统状态
codex-father logs <id>    # 查看任务日志
codex-father --version    # 查看版本信息
```

### 使用场景

#### 开发者场景

- **AI 辅助开发**: 对话式编程，实时反馈
- **代码重构**: 智能重构建议和执行
- **测试自动化**: 自动生成和运行测试
- **文档生成**: 自动生成 API 文档

#### DevOps 场景

- **CI/CD 集成**: 自动化构建和部署
- **批量处理**: 大规模任务并行处理
- **系统监控**: 实时状态监控和告警
- **运维自动化**: 服务器管理自动化

#### 团队协作

- **代码审查**: 自动化代码质量检查
- **项目初始化**: 标准化项目搭建
- **知识共享**: 任务执行记录和复用
- **流程标准化**: 统一开发工作流

---

## 🧪 测试手册

### 测试体系

#### 核心测试命令

| 命令 | 功能描述 | 内存需求 | 使用场景 |
|------|----------|----------|----------|
| `npm run test` | 交互式测试模式 | 动态调整 | 开发调试 |
| `npm run test:run` | 运行所有测试（单次） | 依赖具体测试 | 完整验证 |
| `npm run test:unit` | 单元测试 | ~2GB | 核心功能验证 |
| `npm run test:integration` | 集成测试 | ~3GB | 模块协作验证 |
| `npm run test:e2e` | 端到端测试 | ~6GB | 完整流程验证 |
| `npm run test:coverage` | 覆盖率测试 | 依赖测试范围 | 代码质量分析 |

#### 内存优化测试（推荐使用）

**🌟 分批执行所有测试（16个智能批次，避免内存溢出）**

```bash
npm run test:batch
```

**🎯 按类型快速测试（按内存需求分类）**

```bash
npm run test:quick unit          # 单元测试 (~2GB内存)
npm run test:quick integration   # 集成测试 (~3GB内存)
npm run test:quick contract      # 契约测试 (~2GB内存)
npm run test:quick http          # HTTP测试 (~3GB内存)
npm run test:quick mcp           # MCP测试 (~4GB内存)
npm run test:quick e2e           # E2E测试 (~6GB内存)
```

#### 硬件环境选择指南

| 内存配置 | 推荐测试命令 | 预期效果 |
|----------|--------------|----------|
| < 8GB | `npm run test:quick unit` | 快速验证核心功能 |
| 8-16GB | `npm run test:batch` | 完整分批测试 |
| > 16GB | `NODE_OPTIONS="--max-old-space-size=8192" npm run test:batch` | 高性能完整测试 |

### 开发工作流

#### 1. 日常开发

```bash
# 1. 快速验证基础功能
npm run test:run tests/unit/schemas/status-example.test.ts --no-coverage

# 2. 构建检查
npm run build

# 3. 代码质量检查
npm run lint
npm run typecheck
```

#### 2. 功能开发完成

```bash
# 1. 运行相关批次测试
npm run test:quick unit    # 如果修改了核心功能
npm run test:quick http    # 如果修改了HTTP功能

# 2. 完整测试（如果时间允许）
npm run test:batch

# 3. 查看测试报告
npm run test:merge
```

#### 3. 提交前验证

```bash
# 1. 代码质量
npm run lint
npm run typecheck

# 2. 构建验证
npm run build

# 3. 快速测试
npm run test:quick unit
```

#### 4. CI/CD流水线

```bash
# 1. 清理环境
npm run test:clean

# 2. 完整分批测试
npm run test:batch

# 3. 合并结果
npm run test:merge

# 4. 检查成功率
cat test-results/merged-test-report.json | jq '.summary.successRate'
```

### 故障排除

#### 常见问题

**1. 内存溢出 (JavaScript heap out of memory)**

```bash
# 🥇 解决方案：使用分批测试（推荐）
npm run test:batch
# 🥈 备选方案：降低内存的快速测试
npm run test:quick unit
```

**2. 某个测试文件找不到**

```bash
# 检查文件是否存在
find tests -name "具体文件名"

# 使用绝对路径测试
npm run test:run /完整路径/文件名 --no-coverage
```

**3. TypeScript类型错误**

```bash
# 重新构建
npm run test:clean
npm run build

# 类型检查
npm run typecheck
```

**4. 依赖缺失**

```bash
# 重新安装依赖
npm install

# 检查特定依赖
npm list 包名
```

#### 调试技巧

**详细输出模式**

```bash
# 启用详细输出
DEBUG=vitest:* npm run test:batch

# 查看内存使用
node --trace-gc scripts/run-batch-tests.ts
```

**单独运行问题批次**

```bash
# 运行特定批次
NODE_OPTIONS="--max-old-space-size=2048" npx vitest run tests/unit/schemas/status-example.test.ts --verbose
```

---

## 📦 发布指南

### 发布流程

Codex Father 项目采用**手动版本管理**系统，支持两个独立的发布流程：

1. **主项目发布** (`codex-father`) - 核心CLI工具
2. **MCP子包发布** (`@starkdev020/codex-father-mcp-server`) - MCP服务器

#### 主项目发布流程 (codex-father)

**发布方式：**

**1. 自动触发（推荐）**
```bash
# 1. 更新版本号
npm version 1.2.3

# 2. 推送代码
git push origin main

# 3. 创建并推送标签（自动触发发布）
git tag v1.2.3
git push origin v1.2.3
```

**2. 手动触发**
在GitHub Actions页面手动运行 "Main Project Release" 工作流，可以：
- 指定版本号
- 启用dry-run模式进行测试

**发布流程：**
1. **输入验证** - 验证版本号格式和参数
2. **构建测试** - 安装依赖、运行测试、构建项目
3. **版本检查** - 确保 `package.json` 版本与标签匹配
4. **NPM发布** - 发布到NPM公共仓库
5. **GitHub Release** - 创建GitHub发布页面

#### MCP子包发布流程 (@starkdev020/codex-father-mcp-server)

**只能通过手动触发**，在GitHub Actions页面运行 "MCP Manual Release" 工作流。

**发布模式：**

1. **预检查模式** (`preflight`)
   - 仅执行质量检查和构建
   - 不执行任何发布操作
   - 用于开发阶段验证

2. **预演模式** (`dry-run`) - **推荐首次使用**
   - 模拟完整发布流程
   - 不执行实际操作
   - 显示所有步骤的假设结果

3. **本地发布模式** (`local`)
   - 执行完整发布流程
   - 发布到NPM和创建GitHub Release
   - 需要配置 `NPM_TOKEN` 和 `GITHUB_TOKEN`

4. **仅标签模式** (`tag-only`)
   - 仅创建Git标签
   - 不发布到NPM
   - 用于版本标记和里程碑记录

**本地脚本支持：**

```bash
# 预检查
npm run release:mcp:preflight

# 预演测试（推荐首次使用）
npm run release:mcp:dry-run 3.2.1

# 本地发布
npm run release:mcp:local 3.2.1

# 仅创建标签
npm run release:mcp:tag 3.2.1
```

### 质量控制

#### ⚠️ 严格遵循代码质量标准
**绝对禁止跳过任何pre-commit hooks或push hooks！所有代码必须通过完整的质量检查才能发布。**

#### 代码质量检查 (必须通过)

```bash
# 所有测试必须通过
npm run test:run

# 代码检查必须通过 (无错误，无警告)
npm run lint:check

# 类型检查必须通过
npm run typecheck

# 构建必须成功
npm run build

# 预检查必须通过 (发布脚本内置检查)
npm run release:mcp:preflight
```

#### 版本号管理

```bash
# 手动更新主项目版本号 (遵循语义化版本)
npm version 5.0.0

# 手动更新MCP子包版本号
vim mcp/codex-mcp-server/package.json
# 将版本号更新为目标版本
```

**版本号格式要求：**
- ✅ 正确：`"5.0.0"`, `"3.2.1"`, `"2.5.3"`
- ❌ 错误：`"v5.0.0"`, `"5.0"`, `"5.0.0-beta"`

#### 文档完整性检查

```bash
# 复制版本说明模板
cp docs/releases/VERSION_TEMPLATE.md docs/releases/versions/VERSION_MAIN_5.0.0.md

# 编辑版本说明，确保包含所有必要部分
vim docs/releases/versions/VERSION_MAIN_5.0.0.md

# 更新CHANGELOG
vim CHANGELOG.md

# 更新发布指南中的版本列表
vim docs/releases/README.md
```

#### Git状态检查 (必须清洁)

```bash
# 检查工作区状态
git status

# 必须无未提交更改
git diff --check

# 必须在正确分支
git branch
```

#### 环境配置验证

```bash
# NPM认证必须配置
npm whoami

# GitHub CLI认证必须配置
gh auth status

# 检查项目依赖
npm audit --audit-level high
```

### 版本管理

#### 发布前检查清单

##### ✅ 代码质量检查
- [ ] 所有测试通过：`npm run test:run`
- [ ] 代码检查通过：`npm run lint:check`
- [ ] 类型检查通过：`npm run typecheck`
- [ ] 构建成功：`npm run build`
- [ ] **npx 功能测试通过**：`./test_npx_usage.sh`

##### ✅ 版本管理检查
- [ ] 主项目package.json版本号已更新
- [ ] MCP子包package.json版本号已更新
- [ ] CHANGELOG.md已更新
- [ ] 版本说明文档已创建

##### ✅ Git状态检查
- [ ] 当前在main/master分支（推荐）
- [ ] 工作区干净，无未提交更改
- [ ] 重要更改已提交并推送

##### ✅ 环境配置检查
- [ ] NPM认证已配置：`npm whoami`
- [ ] GitHub CLI认证：`gh auth status`
- [ ] 环境变量已设置（本地发布）
- [ ] GitHub仓库secrets已配置（CI发布）

#### 版本回滚流程

**紧急版本回滚**
```bash
# 1. 发布修复版本
npm run release:mcp:local 3.2.2

# 2. 仅创建标签（快速标记）
npm run release:mcp:tag 3.2.2
```

**Git标签回滚**
```bash
# 删除本地标签
git tag -d mcp-v3.2.1

# 删除远程标签
git push origin :refs/tags/mcp-v3.2.1

# 重新创建标签
git tag -a mcp-v3.2.1 -m "Fixed version: 修复关键问题"
git push origin mcp-v3.2.1
```

---

## 🔧 开发指南

### 项目结构

```
codex-father/
├── src/
│   ├── core/                 # 核心功能
│   │   ├── TaskRunner.ts     # 任务执行器
│   │   ├── concurrency.ts    # 并发控制
│   │   ├── queue.ts          # 任务队列
│   │   └── storage.ts        # 存储管理
│   ├── interfaces/           # 接口层
│   │   ├── mcp/             # MCP 协议
│   │   ├── http/            # HTTP API
│   │   └── cli/             # 命令行
│   └── index.ts              # 主入口
├── tests/                    # 测试用例
├── docs/                     # 文档
└── specs/                    # 规格文档
```

### 核心脚本命令

```bash
npm run dev          # 开发模式
npm run build        # 构建项目
npm run test:unit    # 单元测试
npm run test:batch   # 分批测试
npm run test:quick   # 快速测试
npm run lint         # 代码检查
npm run format       # 代码格式化
npm run typecheck    # 类型检查
```

### 贡献指南

欢迎贡献！请遵循以下步骤：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

#### 贡献指南

- 遵循 [Conventional Commits](https://www.conventionalcommits.org/)
- 确保所有测试通过 (`npm run check:all`)
- 更新相关文档
- 保持代码简洁和可维护

### 架构设计

#### 系统架构

```
┌─────────────────────────────────────────────────────┐
│                   用户接口层                          │
├─────────────────┬─────────────────┬─────────────────┤
│   MCP 协议       │   HTTP API       │   CLI 工具       │
│   (Claude Code)  │   (REST/WS)     │   (命令行)       │
└─────────────────┴─────────────────┴─────────────────┘
                            │
┌─────────────────────────────────────────────────────┐
│                  任务执行引擎                         │
├─────────────────────────────────────────────────────┤
│  TaskRunner  │  ConcurrencyManager  │  TaskQueue    │
│  任务执行器    │  并发控制器           │  任务队列      │
└─────────────────────────────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────┐
│                   存储和监控层                        │
├─────────────────────────────────────────────────────┤
│  JsonStorage  │  SecurityManager  │  Monitoring    │
│  JSON 存储     │  安全管理器          │  监控系统       │
└─────────────────────────────────────────────────────┘
```

### 依赖包统计

- **总依赖数**: 32个（清理前200+个）
- **生产依赖**: 14个核心包
- **开发依赖**: 18个工具包
- **精简程度**: 减少85%依赖数量

---

## 📖 相关资源

### 📚 项目文档

- [项目README](README.md) - 项目总体说明
- [CHANGELOG](CHANGELOG.md) - 完整变更记录
- [CI/CD发布指南](.github/CI_RELEASE_GUIDE.md) - CI/CD详细指南
- [用户文档](docs/user/README.md) - 用户使用指南
- [开发者文档](docs/developer/README.md) - 开发者指南

### 🛠️ 工具和脚本

- [主项目发布脚本](scripts/release.sh) - 主项目发布脚本
- [MCP发布脚本](scripts/release-mcp-manual.sh) - MCP手动发布脚本
- [参数验证工具](lib/param_validator.sh) - 参数验证工具
- [npx 测试脚本](test_npx_usage.sh) - npx 功能测试脚本

### 🔗 外部链接

- **GitHub Repository**: https://github.com/yuanyuanyuan/codex-father
- **NPM Package - Main**: https://www.npmjs.com/package/codex-father
- **NPM Package - MCP**: https://www.npmjs.com/package/@starkdev020/codex-father-mcp-server
- **npx 使用指南**(NPX_RELEASE_GUIDE.md) - 完整的 npx 使用指南

### 📚 参考资料

- [语义化版本规范](https://semver.org/)
- [NPM发布文档](https://docs.npmjs.com/cli/v8/commands/npm-publish)
- [GitHub Actions文档](https://docs.github.com/en/actions)
- [GitHub Release文档](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- [Model Context Protocol](https://modelcontextprotocol.io/) - MCP 协议规范
- [Claude Code](https://claude.ai/code) - AI 编程助手
- [TypeScript](https://www.typescriptlang.org/) - 类型安全的 JavaScript
- [Express.js](https://expressjs.com/) - Web 应用框架

## 📮 联系方式

- **Issues**: [GitHub Issues](https://github.com/yuanyuanyuan/codex-father/issues)
- **讨论**: [GitHub Discussions](https://github.com/yuanyuanyuan/codex-father/discussions)
- **文档**: [用户手册](docs/user/README.md)

---

## 🗺️ 发展路线

### v2.1 (计划中)

- [ ] 图形化管理界面
- [ ] 更多编程语言支持
- [ ] 分布式任务执行
- [ ] 高级监控和告警

### v2.2 (规划中)

- [ ] 机器学习任务优化
- [ ] 云原生部署支持
- [ ] 企业级安全功能
- [ ] 插件生态系统

---

**🚀 开始你的高效开发之旅吧！**

_Built with ❤️ by the Codex Father Team_

---

## 📚 文档版本信息

**文档版本**: v1.7.0  
**创建时间**: 2025-01-16  
**最后更新**: 2025-01-16  
**维护团队**: 文档团队  
**文档状态**: ✅ 已完成整合 - 三个核心文档完整整合
