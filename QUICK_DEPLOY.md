# 快速部署参考卡

> 3 分钟完成 Codex Father v1.0.0 发布

---

## 🚀 一键发布（推荐）

```bash
# 运行自动化发布脚本
./scripts/release.sh
```

脚本会自动完成：

- ✅ 代码质量检查
- ✅ 项目构建
- ✅ 创建 Git 标签
- ✅ 发布到 NPM
- ✅ 创建 GitHub Release

---

## 📋 手动发布步骤

### 前置准备

```bash
# 1. 登录 NPM
npm login

# 2. 登录 GitHub CLI
gh auth login

# 3. 确认版本
cat package.json | grep version
```

### 发布到 NPM

```bash
# 1. 检查并构建
npm run check:all
npm run clean && npm run build

# 2. 试运行
npm pack --dry-run

# 3. 发布
npm publish
```

### 发布到 GitHub

```bash
# 1. 创建标签
git tag -a v1.0.0 -m "Release v1.0.0 - MVP1"
git push origin v1.0.0

# 2. 创建 Release
gh release create v1.0.0 \
  --title "Codex Father v1.0.0 - MVP1 正式版" \
  --notes-file RELEASE_NOTES.md

# 3. 验证
gh release view v1.0.0
```

---

## ✅ 验证发布

```bash
# NPM 验证
npm view codex-father
npm install -g codex-father
codex-father --version

# GitHub 验证
open https://github.com/yuanyuanyuan/codex-father/releases/tag/v1.0.0
```

---

## 🔧 常用命令

### 发布前检查

```bash
npm run check:all        # 完整检查
npm run typecheck        # 类型检查
npm run lint:check       # Lint 检查
npm run test:run         # 运行测试
npm run build            # 构建项目
```

### NPM 操作

```bash
npm whoami               # 检查登录状态
npm pack --dry-run       # 试运行打包
npm view codex-father    # 查看包信息
npm deprecate <ver> <msg> # 标记废弃
```

### Git 操作

```bash
git tag -l               # 列出所有标签
git tag -d v1.0.0        # 删除本地标签
git push origin :refs/tags/v1.0.0  # 删除远程标签
```

### GitHub CLI

```bash
gh auth status           # 检查认证状态
gh release list          # 列出所有 release
gh release view v1.0.0   # 查看指定 release
gh release delete v1.0.0 # 删除 release
```

---

## 🔙 回滚操作

### 回滚 NPM

```bash
# 方式 1: 撤销发布（72小时内）
npm unpublish codex-father@1.0.0 --force

# 方式 2: 标记废弃（推荐）
npm deprecate codex-father@1.0.0 "请使用新版本"

# 方式 3: 发布修复版本
npm version patch  # 1.0.0 → 1.0.1
npm publish
```

### 回滚 GitHub

```bash
# 删除 Release
gh release delete v1.0.0 --yes

# 删除标签
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0
```

---

## 📚 完整文档

- **[DEPLOY.md](DEPLOY.md)** - 完整部署指南
- **[RELEASE_NOTES.md](RELEASE_NOTES.md)** - 发布说明
- **[CHANGELOG.md](CHANGELOG.md)** - 变更日志

---

## ⚡ 紧急发布（跳过检查）

```bash
# 仅在紧急情况使用！
npm publish --ignore-scripts
```

---

## 📞 遇到问题？

1. **查看完整文档**: [DEPLOY.md](DEPLOY.md)
2. **提交 Issue**: https://github.com/yuanyuanyuan/codex-father/issues
3. **查看 NPM 文档**: https://docs.npmjs.com/
4. **查看 GitHub 文档**: https://docs.github.com/

---

**提示**: 首次发布建议使用自动化脚本 `./scripts/release.sh`
