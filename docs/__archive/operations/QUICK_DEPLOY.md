# 快速部署参考卡（GitHub Packages 版）

> 3 分钟完成 Codex Father（MCP 包）发布到 GitHub Packages

---

## 🚀 一键发布（推荐：GitHub Actions）

无需 npmjs 账号，无需 `npm login`。使用仓库内置工作流发布到 GitHub Packages。

- 工作流：`.github/workflows/release-ghpkgs.yml`
- 触发：
  - 推送到 `main`（匹配 `mcp/**`）
  - 或在 GitHub Actions 手动运行 “Release to GH Packages”

工作流将自动完成：

- ✅ 质量检查与构建（子包 `mcp/codex-mcp-server`）
- ✅ 配置 `~/.npmrc` 指向 GitHub Packages 并注入 `GITHUB_TOKEN`
- ✅ 语义化发布（生成版本、CHANGELOG、Git 标签与 Release）
- ✅ 发布包：`@starkdev020/codex-father-mcp-server`

---

## 📋 手动发布到 GitHub Packages（可选）

当不使用 Actions 时，可手动发布到 GitHub Packages（无需 `npm login`）。

### 前置准备

1. 生成 PAT（Personal Access Token）

- 权限：`write:packages`（建议同时勾选 `read:packages`）

2. 配置 npm 认证（任选其一）

- 写入 `~/.npmrc`：

  ```bash
  echo "@starkdev020:registry=https://npm.pkg.github.com" >> ~/.npmrc
  echo "//npm.pkg.github.com/:_authToken=<YOUR_GITHUB_PAT>" >> ~/.npmrc
  ```

- 或仅导出环境变量（临时会话）：

  ```bash
  export NODE_AUTH_TOKEN=<YOUR_GITHUB_PAT>
  ```

### 发布步骤（子包）

```bash
cd mcp/codex-mcp-server
npm ci
npm run build
# 可选：npm pack --dry-run 查看将要发布的文件
npm publish --registry https://npm.pkg.github.com
```

---

## ✅ 验证发布（GitHub Packages）

```bash
# 查看 GitHub Release（语义化发布会自动创建）
open https://github.com/yuanyuanyuan/codex-father/releases

# 通过 npm 安装（需要 PAT 或已配置 ~/.npmrc）
npm i -g @starkdev020/codex-father-mcp-server \
  --registry https://npm.pkg.github.com

# 运行可执行文件
codex-mcp-server --help
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

### GH Packages 常用操作

```bash
# 仅使用 GH Packages 时无需 npm login
# 如需切换注册表：
echo "@starkdev020:registry=https://npm.pkg.github.com" >> ~/.npmrc
echo "//npm.pkg.github.com/:_authToken=<YOUR_GITHUB_PAT>" >> ~/.npmrc

# 查看安装信息（需认证）
npm view @starkdev020/codex-father-mcp-server \
  --registry https://npm.pkg.github.com
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

### 回滚（GitHub Packages）

```text
GH Packages 不支持 npm 侧的 unpublish 流程。
请在 GitHub → Packages → 目标包 → Package settings → Delete package 进行删除，
或发布修复版本（推荐）。
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

- **[DEPLOY.md](DEPLOY.md)** - 完整部署指南（已更新支持 GH Packages）
- **[RELEASE_NOTES.md](../releases/RELEASE_NOTES.md)** - 发布说明
- **[CHANGELOG.md](../../CHANGELOG.md)** - 变更日志

---

## ⚡ 紧急发布（跳过 CI，仅 GH Packages）

```bash
# 仅在紧急情况使用！需要已配置认证（PAT）
cd mcp/codex-mcp-server
npm run build
npm publish --registry https://npm.pkg.github.com --ignore-scripts
```

---

## 📞 遇到问题？

1. **查看完整文档**: [DEPLOY.md](DEPLOY.md)
2. **提交 Issue**: https://github.com/yuanyuanyuan/codex-father/issues
3. **GitHub Packages 文档**:
   https://docs.github.com/packages/using-github-packages-with-your-projects-ecosystem
4. **npm 配置指南**: https://docs.npmjs.com/cli/v10/configuring-npm/npmrc

---

**提示**: 首次发布建议使用 GitHub Actions 工作流 “Release to GH Packages”
