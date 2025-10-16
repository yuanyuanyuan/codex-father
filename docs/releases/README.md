# 📋 Codex Father 发布指南

> **完整的手动版本管理和发布流程指南**

## 🎯 概述

Codex Father 项目采用**手动版本管理**系统，支持两个独立的发布流程：

1. **主项目发布** (`codex-father`) - 核心CLI工具
2. **MCP子包发布** (`@starkdev020/codex-father-mcp-server`) - MCP服务器

### 📁 文档结构

```
docs/releases/
├── README.md                    # 本文件 - 完整发布指南
├── VERSION_TEMPLATE.md          # 版本说明文档模板
├── CHANGELOG.md                 # 完整变更日志
└── versions/                    # 具体版本说明目录
    ├── VERSION_MCP_3.2.1.md    # MCP版本发布说明示例
    └── VERSION_MAIN_1.2.3.md   # 主项目版本发布说明示例
```

---

## 🚀 主项目发布流程 (codex-father)

### 发布方式

#### 1. 自动触发（推荐）
```bash
# 1. 更新版本号
npm version 1.2.3

# 2. 推送代码
git push origin main

# 3. 创建并推送标签（自动触发发布）
git tag v1.2.3
git push origin v1.2.3
```

#### 2. 手动触发
在GitHub Actions页面手动运行 "Main Project Release" 工作流，可以：
- 指定版本号
- 启用dry-run模式进行测试

### 发布流程

1. **输入验证** - 验证版本号格式和参数
2. **构建测试** - 安装依赖、运行测试、构建项目
3. **版本检查** - 确保 `package.json` 版本与标签匹配
4. **NPM发布** - 发布到NPM公共仓库
5. **GitHub Release** - 创建GitHub发布页面

### 输出产物

- NPM包：`codex-father@版本号`
- GitHub Release：包含发布说明和下载链接
- **npx 支持**：无需安装即可直接使用

### 本地脚本支持

```bash
# 本地测试构建
npm run build
npm pack

# 验证包信息
npm view codex-father

# 测试 npx 功能（新增）
./test_npx_usage.sh
```

---

## 📦 MCP子包发布流程 (@starkdev020/codex-father-mcp-server)

### 发布方式

只能通过**手动触发**，在GitHub Actions页面运行 "MCP Manual Release" 工作流。

#### 发布模式

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

### 本地脚本支持

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

### 发布流程

1. **输入验证** - 验证版本号格式(X.Y.Z)和发布模式
2. **预检查** - 质量门禁检查和构建验证
3. **构建测试** - 构建MCP子包并验证功能
4. **版本一致性检查** - 检查 `package.json` 版本号
5. **Git状态验证** - 检查分支和工作区状态
6. **创建Git标签** - 创建格式为 `mcp-vX.Y.Z` 的标签
7. **构建NPM包** - 在MCP子包目录构建
8. **发布到NPM** - 发布到NPM公共仓库（非tag-only模式）
9. **创建GitHub Release** - 创建GitHub发布页面（非dry-run模式）

### 输出产物

- Git标签：`mcp-vX.Y.Z`
- NPM包：`@starkdev020/codex-father-mcp-server@版本号`
- GitHub Release：包含发布说明


---

## 📋 发布前准备清单

### ⚠️ **严格遵循代码质量标准**
**绝对禁止跳过任何pre-commit hooks或push hooks！所有代码必须通过完整的质量检查才能发布。**

#### 1. **代码质量检查** (必须通过)
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

#### 2. **版本号管理**
```bash
# 手动更新主项目版本号 (遵循语义化版本)
npm version 5.0.0

# 手动更新MCP子包版本号
vim mcp/codex-mcp-server/package.json
# 将版本号更新为目标版本
```

**版本号格式要求**：
- ✅ 正确：`"5.0.0"`, `"3.2.1"`, `"2.5.3"`
- ❌ 错误：`"v5.0.0"`, `"5.0"`, `"5.0.0-beta"`

#### 3. **文档完整性检查**
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

#### 4. **Git状态检查** (必须清洁)
```bash
# 检查工作区状态
git status

# 必须无未提交更改
git diff --check

# 必须在正确分支
git branch
```

#### 5. **环境配置验证**
```bash
# NPM认证必须配置
npm whoami

# GitHub CLI认证必须配置
gh auth status

# 检查项目依赖
npm audit --audit-level high
```

### 🚨 **Pre-commit Hooks 严格要求**

#### 代码质量门禁
- **ESLint**: 0 errors, 0 warnings (代码质量)
- **TypeScript**: 编译无错误 (类型安全)
- **Prettier**: 代码格式一致 (代码风格)
- **测试**: 100% 通过 (功能正确性)
- **构建**: 成功完成 (可运行性)

#### 提交信息规范
必须遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：
```bash
# 格式: <type>[optional scope]: <description>

# 类型说明:
# feat: 新功能
# fix: 修复bug
# docs: 文档更新
# style: 代码格式调整
# refactor: 代码重构
# test: 测试相关
# chore: 构建工具、依赖更新等

# 示例:
# feat(release): add manual version management system
# fix(mcp): resolve authentication issues
# docs(release): update release guidelines
```

### 🔒 **质量检查失败处理**

#### ESLint错误
```bash
# 查看具体错误
npm run lint:check

# 自动修复 (如可修复)
npm run lint:fix

# 手动修复后重新检查
npm run lint:check
```

#### TypeScript错误
```bash
# 查看类型错误
npm run typecheck

# 修复类型问题后重新检查
npm run typecheck
```

#### 测试失败
```bash
# 运行具体测试
npm test

# 查看失败详情
npm run test:run

# 修复测试问题
npm run test:run
```

#### 构建失败
```bash
# 清理构建缓存
npm run clean

# 重新构建
npm run build

# 查看构建日志解决依赖问题
npm run build
```

### 🔧 环境准备

#### 工具检查
```bash
# 基础工具
node --version    # >= 18.0.0 ✅
npm --version     # >= 8.0.0 ✅
git --version      # 检查版本 ✅

# GitHub CLI
gh auth status     # 检查认证状态 ✅

# NPM 认证（本地发布需要）
npm whoami         # 检查登录状态 ✅
```

#### 环境变量设置（本地发布）
```bash
# 设置NPM Token
export NPM_TOKEN="your_npm_token"

# 设置GitHub Token
export GITHUB_TOKEN="your_github_token"
```

#### GitHub仓库配置
在GitHub仓库设置中配置secrets：
- `NPM_TOKEN`: NPM包发布认证令牌
- `GITHUB_TOKEN`: GitHub Actions自动提供

---

## ✅ 发布后验证

### 1. 主项目验证
```bash
# 检查包版本
npm view codex-father versions

# 安装测试
npm install -g codex-father
codex-father --version

# npx 功能测试（新增）
npx codex-father --help
npx codex-father status
npx codex-father-start --help
```

### 2. MCP子包验证
```bash
# 检查包版本
npm view @starkdev020/codex-father-mcp-server versions

# 安装测试
npm install -g @starkdev020/codex-father-mcp-server
codex-mcp-server --version
```

### 3. Git标签验证
```bash
# 检查主项目标签
git tag -l | grep "^v"

# 检查MCP标签
git tag -l | grep "mcp-v"

# 查看标签详情
git show v1.2.3
git show mcp-v3.2.1
```

### 4. GitHub Release验证
```bash
# 打开Release页面
open https://github.com/yuanyuanyuan/codex-father/releases
```

### 5. 功能集成测试
```bash
# 测试MCP服务器启动
node /data/codex-father/mcp/codex-mcp-server/dist/index.js --version

# 测试基础功能
node /data/codex-father/mcp/codex-mcp-server/dist/index.js --help

# 验证环境变量
LOG_LEVEL=debug node /data/codex-father/mcp/codex-mcp-server/dist/index.js
```

---

## 🆘 故障排除

### 常见错误和解决方案

#### 1. 版本号格式错误
```
错误: 版本号格式无效，请使用 X.Y.Z 格式
```
**解决方案**：
```bash
# 检查package.json中的版本格式
cat package.json | grep '"version"'
cat mcp/codex-mcp-server/package.json | grep '"version"'

# 确保版本号是语义化版本
"version": "3.2.1"  ✅ 正确
"version": "v3.2.1"  ❌ 错误：包含v前缀
"version": "3.2"     ❌ 错误：缺少补丁版本
```

#### 2. Git工作区不干净
```
错误: 检测到未提交的更改
```
**解决方案**：
```bash
# 查看状态
git status

# 选项1：提交更改（推荐）
git add .
git commit -m "chore: prepare for release"

# 选项2：暂存更改（临时）
git stash
```

#### 3. NPM认证失败
```
错误: 未登录NPM
```
**解决方案**：
```bash
# 方法1：交互式登录
npm login
# 按提示输入用户名、密码、邮箱

# 方法2：设置环境变量
export NPM_TOKEN="your_npm_token"
npm config set //registry.npmjs.org/:_authToken ${NPM_TOKEN}
```

#### 4. GitHub CLI认证失败
```
错误: GitHub CLI未认证
```
**解决方案**：
```bash
# 检查认证状态
gh auth status

# 重新认证
gh auth login
# 按提示完成认证流程
```

#### 5. 构建失败
```
错误: 构建检查失败
```
**解决方案**：
```bash
# 检查主项目构建
npm run build

# 检查MCP子包构建
cd mcp/codex-mcp-server
npm run build

# 清理重建
npm run clean
npm run build
```

#### 6. 标签冲突
```
警告: 标签 mcp-v3.2.1 已存在
```
**解决方案**：
```bash
# 选择删除并重新创建（推荐）
# 发布脚本会提示确认

# 或手动删除
git tag -d mcp-v3.2.1
git push origin :refs/tags/mcp-v3.2.1
```

### 版本回滚流程

#### 紧急版本回滚
```bash
# 1. 发布修复版本
npm run release:mcp:local 3.2.2

# 2. 仅创建标签（快速标记）
npm run release:mcp:tag 3.2.2
```

#### Git标签回滚
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

## 📝 版本说明文档模板

### 使用方法

```bash
# 1. 复制模板
cp docs/releases/VERSION_TEMPLATE.md docs/releases/versions/VERSION_MCP_X.Y.Z.md

# 2. 编辑内容
vim docs/releases/versions/VERSION_MCP_X.Y.Z.md

# 3. 更新索引
# 在本README.md中添加版本链接
```

### 内容结构

版本说明文档应包含以下部分：

- **版本信息**：版本号、发布日期、包名、Git标签
- **新功能**：新增的功能列表
- **修复**：修复的问题列表
- **改进**：性能优化、错误处理改进、文档更新
- **兼容性**：向后兼容性说明、破坏性变更、依赖项更新
- **安装升级**：全新安装、升级现有安装、指定版本安装
- **测试验证**：基础功能测试、配置验证
- **变更详情**：文件变更、依赖更新
- **相关链接**：GitHub Release、NPM包页面、更新日志
- **支持反馈**：问题报告、贡献指南

---

## 🛠️ 发布脚本详解

### 主项目发布脚本 (`scripts/release.sh`)

#### 发布模式对比

| 模式 | 说明 | 适用场景 | 命令 |
|------|------|----------|------|
| `--dry-run` | 预演模式，不执行实际发布 | 首次使用、测试流程 | `npm run release:dry-run` |
| `--local` | 本地发布，需要NPM_TOKEN | 紧急发布、本地测试 | `npm run release:local` |
| `--main` | 推送到main分支触发CI | 标准发布流程 | `npm run release:main` |

#### 使用示例

```bash
# 预演模式（推荐首次使用）
npm run release:dry-run

# 本地发布
npm run release:local

# 推送到main分支触发CI
npm run release:main
```

### MCP子包发布脚本 (`scripts/release-mcp-manual.sh`)

#### 发布模式对比

| 模式 | 说明 | 适用场景 | 命令 |
|------|------|----------|------|
| `--preflight` | 仅执行质量检查和构建 | 开发阶段验证 | `npm run release:mcp:preflight` |
| `--dry-run` | 预演模式，不执行实际发布 | 首次使用、测试流程 | `npm run release:mcp:dry-run X.Y.Z` |
| `--local` | 本地发布，完整流程 | 紧急发布、本地测试 | `npm run release:mcp:local X.Y.Z` |
| `--tag-only` | 仅创建Git标签 | 版本标记、里程碑记录 | `npm run release:mcp:tag X.Y.Z` |

#### 使用示例

```bash
# 预检查
npm run release:mcp:preflight

# 预演模式（推荐首次使用）
npm run release:mcp:dry-run 3.2.1

# 本地发布
npm run release:mcp:local 3.2.1

# 仅创建标签
npm run release:mcp:tag 3.2.1
```

## 📝 发布前检查清单

### ✅ 代码质量检查
- [ ] 所有测试通过：`npm run test:run`
- [ ] 代码检查通过：`npm run lint:check`
- [ ] 类型检查通过：`npm run typecheck`
- [ ] 构建成功：`npm run build`
- [ ] **npx 功能测试通过**：`./test_npx_usage.sh`（新增）

### ✅ 版本管理检查
- [ ] 主项目package.json版本号已更新
- [ ] MCP子包package.json版本号已更新
- [ ] CHANGELOG.md已更新
- [ ] 版本说明文档已创建

### ✅ Git状态检查
- [ ] 当前在main/master分支（推荐）
- [ ] 工作区干净，无未提交更改
- [ ] 重要更改已提交并推送

### ✅ 环境配置检查
- [ ] NPM认证已配置：`npm whoami`
- [ ] GitHub CLI认证：`gh auth status`
- [ ] 环境变量已设置（本地发布）
- [ ] GitHub仓库secrets已配置（CI发布）

## 🔧 环境配置详解

### 必需工具版本要求

```bash
# 基础工具
node --version    # >= 18.0.0 ✅
npm --version     # >= 8.0.0 ✅
git --version      # 检查版本 ✅

# GitHub CLI（用于GitHub Release）
gh auth status     # 检查认证状态 ✅

# NPM 认证（本地发布需要）
npm whoami         # 检查登录状态 ✅
```

### 认证设置详细步骤

#### 1. NPM认证
```bash
# 方法1：交互式登录
npm login
# 按提示输入用户名、密码、邮箱

# 方法2：设置环境变量
export NPM_TOKEN="your_npm_token"
npm config set //registry.npmjs.org/:_authToken ${NPM_TOKEN}

# 方法3：使用.npmrc文件
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc
```

#### 2. GitHub CLI认证
```bash
# 检查认证状态
gh auth status

# 重新认证
gh auth login
# 选择：GitHub.com (web) 或 GitHub CLI
# 按提示完成认证流程

# 或使用环境变量
export GITHUB_TOKEN="your_github_token"
```

#### 3. GitHub仓库secrets配置
在GitHub仓库设置中配置secrets：
- `NPM_TOKEN`: NPM包发布认证令牌
- `GITHUB_TOKEN`: GitHub Actions自动提供

### Git分支要求

- **推荐**：在 `main` 或 `master` 分支发布
- **可选**：其他分支也可以发布（会有警告提示）
- **工作区状态**：
  - `local模式`：允许有未提交更改（会提示确认）
  - `tag-only模式`：推荐工作区干净

## 🎉 发布后步骤

### 1. 立即验证安装
```bash
# 主项目验证
npm install -g codex-father
codex-father --version

# MCP子包验证
npm install -g @starkdev020/codex-father-mcp-server
codex-mcp-server --version
```

### 2. 更新相关文档
- 更新项目README中的安装说明
- 更新版本相关文档
- 更新API文档中的版本信息

### 3. 发布公告
- 技术博客文章
- 社交媒体通知
- 社区公告
- GitHub Discussions讨论

### 4. 监控和反馈
- GitHub Issues监控
- NPM下载统计跟踪
- 用户反馈收集
- 社区讨论参与

## 🔗 相关文档和资源

### 📖 项目文档
- [项目README](../../README.md) - 项目总体说明
- [CHANGELOG](../../CHANGELOG.md) - 完整变更记录
- [CI/CD发布指南](../.github/CI_RELEASE_GUIDE.md) - CI/CD详细指南
- [用户文档](../user/README.md) - 用户使用指南
- [开发者文档](../developer/README.md) - 开发者指南

### 🛠️ 工具和脚本
- [主项目发布脚本](../../scripts/release.sh) - 主项目发布脚本
- [MCP发布脚本](../../scripts/release-mcp-manual.sh) - MCP手动发布脚本
- [参数验证工具](../../lib/param_validator.sh) - 参数验证工具
- **[npx 测试脚本](../../test_npx_usage.sh) - npx 功能测试脚本**（新增）

### 🔗 外部链接
- **GitHub Repository**: https://github.com/yuanyuanyuan/codex-father
- **NPM Package - Main**: https://www.npmjs.com/package/codex-father
- **NPM Package - MCP**: https://www.npmjs.com/package/@starkdev020/codex-father-mcp-server
- **[npx 使用指南](../../NPX_RELEASE_GUIDE.md) - 完整的 npx 使用指南**（新增）

### 📚 参考资料
- [语义化版本规范](https://semver.org/)
- [NPM发布文档](https://docs.npmjs.com/cli/v8/commands/npm-publish)
- [GitHub Actions文档](https://docs.github.com/en/actions)
- [GitHub Release文档](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository)

---

## 💡 最佳实践建议

### 发布前准备
1. **先运行预演模式**：确保所有检查都通过
2. **备份重要数据**：避免意外丢失关键文件
3. **测试环境验证**：在测试环境充分验证新版本
4. **文档完整性**：确保版本说明文档完整准确

### 发布过程
1. **仔细确认版本号**：避免版本号错误导致混乱
2. **关注所有提示信息**：脚本会显示详细的操作提示和确认
3. **验证每个步骤**：确保发布流程正常完成，无错误跳过
4. **记录发布信息**：保存发布过程中的重要信息

### 发布后跟进
1. **立即验证**：确保包可以正常安装和基础使用
2. **更新相关文档**：及时更新所有相关文档和说明
3. **通知用户**：通过适当渠道通知用户新版本发布
4. **监控反馈**：关注用户反馈和问题报告

### 版本管理策略
1. **语义化版本**：严格遵循 `X.Y.Z` 格式
2. **发布节奏**：建立合理的发布节奏，避免过于频繁或过于稀疏
3. **变更记录**：详细记录每个版本的重要变更
4. **兼容性**：确保向后兼容性，重大变更提前通知

---

## 🎊 总结

手动版本管理为Codex Father项目提供了完全的控制权和灵活性。通过使用本指南和配套的发布脚本，开发者可以：

- ✅ **精确控制发布时机**：自主决定何时发布新版本
- ✅ **完全掌握版本号**：手动管理版本号，避免自动版本管理的不确定性
- ✅ **安全可靠的发布流程**：通过预演模式和多重检查确保发布质量
- ✅ **灵活的发布模式**：支持多种发布场景，适应不同需求
- ✅ **完整的验证体系**：从构建到发布的全流程验证

通过遵循本指南的步骤和最佳实践，可以安全、高效地完成主项目和MCP子包的发布工作。