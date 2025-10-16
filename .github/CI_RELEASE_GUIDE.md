# CI/CD 发布指南

本文档说明项目的CI/CD发布流程，包括主项目和MCP子包的发布机制。

## 📋 概述

项目现在使用**手动版本管理**，替换了之前的semantic-release自动化版本管理。提供了两个独立的发布流程：

1. **主项目发布** (`release.yml`) - 发布 `codex-father` 主包
2. **MCP子包发布** (`mcp-release.yml`) - 发布 `@starkdev020/codex-father-mcp-server` 子包

## 🚀 主项目发布流程

### 触发方式

#### 1. 自动触发（推荐）
创建Git标签并推送：
```bash
# 创建标签
git tag v1.2.3

# 推送标签（自动触发发布）
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

## 📦 MCP子包发布流程

### 触发方式

只能通过**手动触发**，在GitHub Actions页面运行 "MCP Manual Release" 工作流。

#### 发布模式

1. **预检查模式** (`preflight`)
   - 仅执行质量检查和构建
   - 不执行任何发布操作
   - 用于开发阶段验证

2. **预演模式** (`dry-run`)
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

## 🔧 环境变量配置

### 必需的Secrets

在GitHub仓库设置中配置以下secrets：

#### NPM_TOKEN
- **用途**：NPM包发布认证
- **获取方式**：在[NPM官网](https://www.npmjs.com/)创建Access Token
- **权限**：需要发布权限

#### GITHUB_TOKEN
- **用途**：GitHub Release创建和Git操作
- **配置**：GitHub Actions自动提供，无需手动配置
- **权限**：需要 `contents: write` 权限

### 配置步骤

1. 进入GitHub仓库设置页面
2. 点击 "Secrets and variables" > "Actions"
3. 点击 "New repository secret"
4. 添加 `NPM_TOKEN` secret

## 📝 使用示例

### 主项目发布示例

```bash
# 1. 更新版本号
npm version 1.2.3

# 2. 推送代码
git push origin main

# 3. 创建并推送标签（自动触发发布）
git tag v1.2.3
git push origin v1.2.3
```

### MCP子包发布示例

#### 预检查模式
```bash
# 本地运行预检查
npm run release:mcp:preflight
```

#### 预演模式（推荐首次使用）
在GitHub Actions页面：
1. 选择 "MCP Manual Release" 工作流
2. 填写参数：
   - `version`: `3.2.1`
   - `mode`: `dry-run`
3. 点击 "Run workflow"

#### 本地发布模式
在GitHub Actions页面：
1. 选择 "MCP Manual Release" 工作流
2. 填写参数：
   - `version`: `3.2.1`
   - `mode`: `local`
3. 点击 "Run workflow"

#### 仅创建标签
在GitHub Actions页面：
1. 选择 "MCP Manual Release" 工作流
2. 填写参数：
   - `version`: `3.2.1`
   - `mode`: `tag-only`
3. 点击 "Run workflow"

## 🛠️ 本地发布脚本

项目提供了本地发布的npm脚本：

```bash
# 预检查
npm run release:mcp:preflight

# 预演测试
npm run release:mcp:dry-run 3.2.1

# 本地发布
npm run release:mcp:local 3.2.1

# 仅创建标签
npm run release:mcp:tag 3.2.1
```

这些脚本调用 `scripts/release-mcp-manual.sh` 执行实际的发布逻辑。

## 🔍 故障排除

### 常见问题

#### 1. NPM认证失败
```
错误: 未登录NPM
```
**解决方案**：
- 检查 `NPM_TOKEN` secret是否正确配置
- 确认token具有发布权限

#### 2. 版本号格式错误
```
错误: 版本号格式无效，请使用 X.Y.Z 格式
```
**解决方案**：
- 确保版本号遵循语义化版本格式
- 例如：`1.2.3`、`3.2.1`

#### 3. Git标签已存在
```
警告: 标签 mcp-v3.2.1 已存在
```
**解决方案**：
- 删除现有标签：`git tag -d mcp-v3.2.1`
- 删除远程标签：`git push origin :refs/tags/mcp-v3.2.1`
- 使用新版本号

#### 4. 构建失败
```
错误: 构建检查失败
```
**解决方案**：
- 检查代码是否有语法错误
- 确保依赖项正确安装
- 查看构建日志定位具体问题

### 调试技巧

#### 1. 使用预检查模式
在发布前运行预检查，及早发现问题：
```bash
npm run release:mcp:preflight
```

#### 2. 使用预演模式
在实际发布前运行预演，验证流程：
```bash
npm run release:mcp:dry-run 3.2.1
```

#### 3. 查看工作流日志
在GitHub Actions页面查看详细的执行日志，定位问题根源。

#### 4. 本地测试
在本地环境执行发布脚本进行测试：
```bash
scripts/release-mcp-manual.sh --version 3.2.1 --dry-run
```

## 📊 发布验证

### 主项目验证
```bash
# 检查NPM包
npm view codex-father

# 安装测试
npm install -g codex-father
codex-father --version
```

### MCP子包验证
```bash
# 检查NPM包
npm view @starkdev020/codex-father-mcp-server

# 安装测试
npm install -g @starkdev020/codex-father-mcp-server
codex-mcp-server --version

# 验证Git标签
git tag -l | grep mcp-v
```

## 🔄 回滚流程

### 主项目回滚
```bash
# 1. 删除标签
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3

# 2. 发布修复版本
npm version 1.2.4
git push origin main
git tag v1.2.4
git push origin v1.2.4
```

### MCP子包回滚
```bash
# 1. 删除标签
git tag -d mcp-v3.2.1
git push origin :refs/tags/mcp-v3.2.1

# 2. 发布修复版本（通过GitHub Actions）
# 在MCP Manual Release工作流中发布新版本
```

## 📚 相关文档

- [MCP手动发布流程](../docs/releases/RELEASE_FLOW_MCP.md)
- [版本说明索引](../docs/releases/README.md)
- [项目README](../README.md)
- [变更日志](../CHANGELOG.md)

## 💡 最佳实践

1. **发布前验证**：始终先运行预检查和预演模式
2. **版本管理**：遵循语义化版本规范
3. **文档更新**：及时更新版本说明文档
4. **测试验证**：发布后立即验证包的可安装性和基础功能
5. **备份策略**：重要版本发布前做好代码和文档备份