# 部署指南 - Codex Father v1.0.0

> 本文档提供 Codex Father 发布到 NPM 和 GitHub Release 的完整指引

---

## 📋 目录

- [部署前检查](#部署前检查)
- [方式一：发布到 NPM](#方式一发布到-npm)
- [方式二：发布到 GitHub Release](#方式二发布到-github-release)
- [方式三：同时发布到 NPM 和 GitHub](#方式三同时发布到-npm-和-github)
- [发布后验证](#发布后验证)
- [回滚步骤](#回滚步骤)
- [常见问题](#常见问题)

---

## 🔍 部署前检查

### 1. 代码质量检查

```bash
# 运行完整检查（类型检查 + Lint + 格式化 + 测试）
npm run check:all

# 预期输出：
# ✓ TypeScript 编译通过
# ✓ ESLint 检查通过 (0 errors, 237 warnings)
# ✓ Prettier 格式检查通过
# ✓ 所有测试通过 (506/512)
```

### 2. 构建产物验证

```bash
# 清理并重新构建
npm run clean
npm run build

# 检查构建产物
ls -lh dist/

# 预期输出：
# dist/
# └── core/
#     ├── approval/
#     ├── cli/
#     ├── mcp/
#     ├── process/
#     ├── session/
#     └── lib/
```

### 3. 版本信息确认

```bash
# 检查 package.json 版本
cat package.json | grep '"version"'

# 当前版本: 1.0.0 ✓
```

### 4. 文档完整性检查

```bash
# 确认所有发布文档存在
ls -lh RELEASE_NOTES.md CHANGELOG.md README.md

# 预期输出：
# -rw-rw-r-- CHANGELOG.md        (5.1K)
# -rw-rw-r-- README.md            (12K)
# -rw-rw-r-- RELEASE_NOTES.md    (8.8K)
```

### 5. Git 状态检查

```bash
# 确保没有未提交的更改
git status

# 预期输出：
# On branch main
# nothing to commit, working tree clean
```

---

## 📦 方式一：发布到 NPM

### 步骤 1: NPM 账号准备

#### 1.1 检查 NPM 登录状态

```bash
npm whoami

# 如果未登录，会提示错误
# 如果已登录，显示用户名
```

#### 1.2 登录 NPM（如需要）

```bash
npm login

# 输入：
# Username: <your-npm-username>
# Password: <your-npm-password>
# Email: <your-email>
# OTP (if enabled): <2fa-code>
```

#### 1.3 验证 NPM 账号权限

```bash
# 检查是否有发布权限
npm access ls-packages

# 或检查当前包的权限（如果已存在）
npm access ls-collaborators codex-father
```

### 步骤 2: 配置 package.json（已完成 ✓）

当前 `package.json` 配置检查：

```json
✓ "name": "codex-father"                    # NPM 包名
✓ "version": "1.0.0"                        # 版本号
✓ "description": "..."                      # 描述
✓ "license": "MIT"                          # 许可证
✓ "repository": { ... }                     # 仓库地址
✓ "keywords": [...]                         # 关键词
✓ "files": ["dist", "config"]              # 发布文件
✓ "engines": { "node": ">=18.0.0" }        # 运行环境
✓ "prepublishOnly": "npm run check:all && npm run build"  # 发布前检查
```

**需要添加的配置**（可选优化）：

```json
{
  "main": "dist/core/cli/start.js",
  "types": "dist/core/cli/start.d.ts",
  "bin": {
    "codex-father": "dist/core/cli/start.js"
  },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

### 步骤 3: 创建 .npmignore（推荐）

```bash
# 创建 .npmignore 文件
cat > .npmignore << 'EOF'
# 源代码
core/
tests/
specs/

# 配置文件
.github/
.vscode/
.husky/
.claude/

# 测试和构建
coverage/
*.test.ts
*.spec.ts
*.bench.ts
.tsbuildinfo*

# 文档（仅保留必要的）
docs/*.md
!docs/architecture/mcp-integration.md

# 临时文件
*.log
.DS_Store
.env*
node_modules/

# 开发文件
tsconfig*.json
.eslintrc*
.prettierrc*
vitest.config.ts
TEST-COMMANDS.md
test-report-*.md
EOF
```

### 步骤 4: 试运行发布（推荐）

```bash
# 模拟发布，查看将要发布的文件
npm pack --dry-run

# 查看详细的文件列表
npm publish --dry-run

# 预期输出：
# npm notice
# npm notice 📦  codex-father@1.0.0
# npm notice === Tarball Contents ===
# npm notice dist/...
# npm notice README.md
# npm notice package.json
# npm notice ...
# npm notice === Tarball Details ===
# npm notice name:          codex-father
# npm notice version:       1.0.0
# npm notice filename:      codex-father-1.0.0.tgz
# npm notice package size:  XXX KB
# npm notice unpacked size: XXX KB
# npm notice total files:   XXX
```

### 步骤 5: 正式发布到 NPM

```bash
# 方式 1: 标准发布
npm publish

# 方式 2: 带标签发布（如果是预发布版本）
npm publish --tag next

# 方式 3: 公开发布（如果是 scoped package）
npm publish --access public
```

#### 发布成功示例输出：

```
+ codex-father@1.0.0
```

### 步骤 6: 验证 NPM 发布

```bash
# 1. 检查 NPM 上的包信息
npm view codex-father

# 2. 查看版本列表
npm view codex-father versions

# 3. 在新目录测试安装
mkdir test-install && cd test-install
npm init -y
npm install codex-father
node -e "console.log(require('codex-father'))"
cd .. && rm -rf test-install
```

### 步骤 7: 更新 NPM 包页面（可选）

访问 https://www.npmjs.com/package/codex-father 检查：

- ✓ README 正确显示
- ✓ 版本信息正确
- ✓ 依赖列表正确
- ✓ 关键词标签正确

---

## 🚀 方式二：发布到 GitHub Release

### 步骤 1: 创建 Git 标签

```bash
# 1. 创建带注解的标签
git tag -a v1.0.0 -m "Release v1.0.0 - MVP1 正式版"

# 2. 查看标签信息
git show v1.0.0

# 3. 推送标签到远程仓库
git push origin v1.0.0

# 4. 推送所有标签（可选）
git push origin --tags
```

### 步骤 2: 准备发布资产（可选）

```bash
# 1. 创建构建包
npm pack

# 生成文件: codex-father-1.0.0.tgz

# 2. 创建源码压缩包（GitHub 会自动生成，可跳过）
git archive -o codex-father-v1.0.0.tar.gz v1.0.0
git archive -o codex-father-v1.0.0.zip v1.0.0
```

### 步骤 3: 在 GitHub 创建 Release

#### 方式 A: 使用 GitHub Web UI

1. **访问 Releases 页面**

   ```
   https://github.com/yuanyuanyuan/codex-father/releases/new
   ```

2. **填写 Release 信息**
   - **Tag version**: `v1.0.0`（选择已创建的标签）
   - **Release title**: `Codex Father v1.0.0 - MVP1 正式版`
   - **Description**: 复制 `RELEASE_NOTES.md` 的内容

3. **上传资产**（可选）
   - 点击 "Attach binaries by dropping them here"
   - 上传 `codex-father-1.0.0.tgz`

4. **发布选项**
   - ☐ This is a pre-release (不勾选，这是正式版)
   - ☑ Set as the latest release (勾选)
   - ☑ Create a discussion for this release (可选)

5. **点击 "Publish release"**

#### 方式 B: 使用 GitHub CLI

```bash
# 1. 安装 GitHub CLI（如果未安装）
brew install gh  # macOS
# 或
sudo apt install gh  # Ubuntu/Debian

# 2. 登录 GitHub
gh auth login

# 3. 创建 Release
gh release create v1.0.0 \
  --title "Codex Father v1.0.0 - MVP1 正式版" \
  --notes-file RELEASE_NOTES.md \
  codex-father-1.0.0.tgz

# 4. 查看创建的 Release
gh release view v1.0.0
```

#### 方式 C: 使用 Hub CLI

```bash
# 1. 安装 Hub（如果未安装）
brew install hub  # macOS

# 2. 创建 Release
hub release create \
  -a codex-father-1.0.0.tgz \
  -F RELEASE_NOTES.md \
  v1.0.0
```

### 步骤 4: 美化 Release 描述（推荐）

在 Release 描述中添加以下内容：

````markdown
## 🎉 Codex Father v1.0.0 - MVP1 正式版

> **首个正式版本发布！** 功能完整、性能卓越、测试充分的 MCP 服务器

### ⚡ 快速开始

\```bash

# NPM 安装

npm install -g codex-father

# 或从源码安装

git clone https://github.com/yuanyuanyuan/codex-father.git cd codex-father npm
install && npm run build npm start \```

### 📊 核心指标

- ✅ **506/512 测试通过** (98.8% 通过率)
- ✅ **响应速度 60ms** (目标 500ms，超出 8.3x)
- ✅ **内存占用 100MB** (目标 200MB，仅用 50%)
- ✅ **代码重复率 0.67%** (目标 < 5%)

### 📚 文档

- [完整发布说明](https://github.com/yuanyuanyuan/codex-father/blob/main/docs/releases/RELEASE_NOTES.md)
- [变更日志](https://github.com/yuanyuanyuan/codex-father/blob/main/CHANGELOG.md)
- [使用指南](https://github.com/yuanyuanyuan/codex-father/blob/main/README.md)
- [MCP 集成文档](https://github.com/yuanyuanyuan/codex-father/blob/main/docs/architecture/mcp-integration.md)

---

**完整的发布说明见下方 ↓**
````

### 步骤 5: 验证 GitHub Release

```bash
# 1. 查看 Release 页面
open https://github.com/yuanyuanyuan/codex-father/releases/tag/v1.0.0

# 2. 使用 GitHub CLI 查看
gh release view v1.0.0 --web

# 3. 检查资产下载
gh release download v1.0.0
```

---

## 🔄 方式三：同时发布到 NPM 和 GitHub

### 自动化脚本（推荐）

创建 `scripts/release.sh`:

```bash
#!/bin/bash
set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Codex Father 发布脚本${NC}"
echo "================================"

# 1. 版本检查
VERSION=$(node -p "require('./package.json').version")
echo -e "${YELLOW}📋 当前版本: v${VERSION}${NC}"

# 2. 确认发布
read -p "确认发布 v${VERSION} 吗? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ 发布已取消${NC}"
    exit 1
fi

# 3. 代码质量检查
echo -e "${YELLOW}🔍 运行代码质量检查...${NC}"
npm run check:all || {
    echo -e "${RED}❌ 代码质量检查失败${NC}"
    exit 1
}
echo -e "${GREEN}✓ 代码质量检查通过${NC}"

# 4. 构建
echo -e "${YELLOW}🔨 构建项目...${NC}"
npm run clean
npm run build || {
    echo -e "${RED}❌ 构建失败${NC}"
    exit 1
}
echo -e "${GREEN}✓ 构建完成${NC}"

# 5. 创建 Git 标签
echo -e "${YELLOW}🏷️  创建 Git 标签...${NC}"
git tag -a "v${VERSION}" -m "Release v${VERSION}" || {
    echo -e "${RED}❌ 标签创建失败（可能已存在）${NC}"
    exit 1
}
git push origin "v${VERSION}"
echo -e "${GREEN}✓ Git 标签已创建并推送${NC}"

# 6. 发布到 NPM
echo -e "${YELLOW}📦 发布到 NPM...${NC}"
npm publish || {
    echo -e "${RED}❌ NPM 发布失败${NC}"
    # 回滚标签
    git tag -d "v${VERSION}"
    git push origin ":refs/tags/v${VERSION}"
    exit 1
}
echo -e "${GREEN}✓ NPM 发布成功${NC}"

# 7. 创建 GitHub Release
echo -e "${YELLOW}🚀 创建 GitHub Release...${NC}"
gh release create "v${VERSION}" \
  --title "Codex Father v${VERSION} - MVP1 正式版" \
  --notes-file RELEASE_NOTES.md \
  "codex-father-${VERSION}.tgz" || {
    echo -e "${RED}❌ GitHub Release 创建失败${NC}"
    echo -e "${YELLOW}⚠️  注意: NPM 包已发布，请手动创建 GitHub Release${NC}"
    exit 1
}
echo -e "${GREEN}✓ GitHub Release 已创建${NC}"

# 8. 完成
echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}🎉 发布完成！${NC}"
echo ""
echo -e "📦 NPM: https://www.npmjs.com/package/codex-father"
echo -e "🚀 GitHub: https://github.com/yuanyuanyuan/codex-father/releases/tag/v${VERSION}"
echo ""
```

### 使用自动化脚本

```bash
# 1. 添加执行权限
chmod +x scripts/release.sh

# 2. 运行发布脚本
./scripts/release.sh

# 脚本会自动执行：
# ✓ 代码质量检查
# ✓ 项目构建
# ✓ 创建 Git 标签
# ✓ 发布到 NPM
# ✓ 创建 GitHub Release
```

---

## ✅ 发布后验证

### 1. NPM 验证清单

```bash
# ✓ 检查包信息
npm view codex-father

# ✓ 检查版本
npm view codex-father version  # 应显示 1.0.0

# ✓ 检查文件列表
npm view codex-father files

# ✓ 测试安装
npm install -g codex-father
codex-father --version

# ✓ 检查依赖
npm view codex-father dependencies
```

### 2. GitHub Release 验证清单

```bash
# ✓ 访问 Release 页面
open https://github.com/yuanyuanyuan/codex-father/releases/tag/v1.0.0

# ✓ 检查标签
git ls-remote --tags origin | grep v1.0.0

# ✓ 下载并测试资产
gh release download v1.0.0
tar -tzf codex-father-1.0.0.tgz
```

### 3. 功能验证

```bash
# ✓ 从 NPM 安装并测试
mkdir test-release && cd test-release
npm init -y
npm install codex-father
npx codex-father --version
npx codex-father --help
cd .. && rm -rf test-release
```

---

## 🔙 回滚步骤

### 回滚 NPM 发布

```bash
# 1. 撤销 NPM 包（仅在发布后 72 小时内）
npm unpublish codex-father@1.0.0 --force

# 2. 或标记为废弃（推荐）
npm deprecate codex-father@1.0.0 "此版本存在问题，请使用新版本"

# 注意：NPM 不建议撤销已发布的包
# 更好的做法是发布一个修复版本 (1.0.1)
```

### 回滚 GitHub Release

```bash
# 1. 删除 Release
gh release delete v1.0.0 --yes

# 2. 删除标签
git tag -d v1.0.0                      # 删除本地标签
git push origin :refs/tags/v1.0.0     # 删除远程标签
```

### 发布修复版本

```bash
# 1. 修复问题后更新版本号
npm version patch  # 1.0.0 → 1.0.1

# 2. 重新发布
./scripts/release.sh
```

---

## ❓ 常见问题

### Q1: NPM 发布时提示 "You do not have permission to publish"

**解决方案**:

```bash
# 1. 检查登录状态
npm whoami

# 2. 重新登录
npm logout
npm login

# 3. 如果包名已被占用，修改 package.json 中的 name
# 建议使用 scoped package: @your-org/codex-father
```

### Q2: Git 标签已存在

**解决方案**:

```bash
# 1. 删除本地标签
git tag -d v1.0.0

# 2. 删除远程标签
git push origin :refs/tags/v1.0.0

# 3. 重新创建标签
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

### Q3: 发布到 NPM 后文件缺失

**解决方案**:

```bash
# 1. 检查 .npmignore 和 package.json 的 files 字段
cat .npmignore
cat package.json | grep -A 5 '"files"'

# 2. 使用 npm pack --dry-run 预览
npm pack --dry-run

# 3. 更新 .npmignore 或 files 字段后重新发布
npm version patch
npm publish
```

### Q4: GitHub Release 创建失败

**解决方案**:

```bash
# 1. 检查 GitHub CLI 认证
gh auth status

# 2. 重新登录
gh auth login

# 3. 检查标签是否存在
git ls-remote --tags origin | grep v1.0.0

# 4. 手动在 GitHub Web UI 创建 Release
open https://github.com/yuanyuanyuan/codex-father/releases/new
```

### Q5: prepublishOnly 脚本失败

**解决方案**:

```bash
# 1. 手动运行检查找出问题
npm run check:all

# 2. 修复问题后重新发布

# 3. 或临时跳过检查（不推荐）
npm publish --ignore-scripts
```

---

## 📞 获取帮助

- **NPM 文档**: https://docs.npmjs.com/
- **GitHub Release 文档**:
  https://docs.github.com/en/repositories/releasing-projects-on-github
- **项目 Issues**: https://github.com/yuanyuanyuan/codex-father/issues

---

## ✨ 发布检查清单

最终发布前，请确认以下所有项目：

### 代码准备

- [ ] 所有测试通过 (506/512)
- [ ] Lint 检查通过 (0 errors)
- [ ] 类型检查通过
- [ ] 代码已提交并推送

### 文档准备

- [ ] RELEASE_NOTES.md 已创建
- [ ] CHANGELOG.md 已创建
- [ ] README.md 已更新
- [ ] package.json 版本正确

### NPM 准备

- [ ] NPM 账号已登录
- [ ] package.json 配置完整
- [ ] .npmignore 已配置
- [ ] npm pack --dry-run 验证通过

### GitHub 准备

- [ ] Git 标签已创建
- [ ] Release 资产已准备
- [ ] GitHub CLI 已认证（如使用）

### 发布执行

- [ ] NPM 发布成功
- [ ] GitHub Release 创建成功
- [ ] NPM 安装测试通过
- [ ] GitHub 资产下载测试通过

---

**祝发布顺利！🎉**
