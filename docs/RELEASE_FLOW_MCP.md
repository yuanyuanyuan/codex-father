# 发布流程（MCP 子包）

适用对象：`@starkdev020/codex-father-mcp-server`（目录：`mcp/codex-mcp-server`）

本流程以 CI +
semantic-release 为主，支持本地 dry-run 预览与一键触发。发布标签格式：`mcp-vX.Y.Z`。支持通过环境模板快速配置脚本路径：`config/templates/codex-father.env.example`（含
`CODEX_START_SH`/`CODEX_JOB_SH`/`CODEX_SESSIONS_ROOT`）。

---

## 1. 准备与范围

- 范围：008 UltraThink
  Codex‑0（版本检测、参数-版本映射、Profile 自动修复、MCP 方法兼容校验与错误码）
- 版本类型：MINOR（向下兼容增强）

---

## 2. 文档与说明

- 新增版本说明：`docs/VERSION_MCP_1.2.0.md`
- 更新使用文档：`README.md` 与 `docs/mcp-integration.md`（如涉及）
- 顶层变更：`CHANGELOG.md`/`RELEASE_NOTES.md` 增加链接或摘要（可选）

---

## 3. 预检（本地）

```bash
# 完整质量门禁
npm run check:all

# 子包构建
(cd mcp/codex-mcp-server && npm ci && npm run build)

# 可选：语义化发布预览（不写入、不发版）
npm run release:dry-run
```

---

## 4. 提交与合并（Conventional Commits）

示例提交信息：

- `feat(mcp): codex version detection + param mapping (spec 008)`
- `feat(mcp): profile auto-fix + validation errors (-32602)`
- `docs: update README and mcp integration for codex 0.44`

合并到 `main` 后，CI 将自动执行发布。

---

## 5. CI 发布（推荐）

- 工作流：`.github/workflows/release.yml`
- 配置：`.releaserc`（仅对子包写版本与 CHANGELOG，并以 `mcp-vX.Y.Z` 打标签）
- 前提：仓库 Secrets 配置 `NPM_TOKEN`（若缺失，将跳过 npmjs 发布，仅创建 GitHub
  Release）

触发方式：

- 合并到 `main`
- 或者手动触发：GitHub Actions → Release → Run workflow

---

## 6. 本地发布（可选）

要求：已配置 `GITHUB_TOKEN` 与 `NPM_TOKEN` 环境变量。

```bash
# 一键脚本（交互确认）：
scripts/release-mcp.sh --local

# 或仅预览（不发版）：
scripts/release-mcp.sh --dry-run

# 推送到 main 触发 CI（工作区必须干净）
scripts/release-mcp.sh --ci

# 仅提交文档与脚本后推送 main（避免提交 *.tgz 等产物）
scripts/release-mcp.sh --ci-commit-docs
```

---

## 7. 发布后验证

```bash
# GitHub Release（检查 mcp-vX.Y.Z 标签与 .tgz 资产）
open https://github.com/yuanyuanyuan/codex-father/releases || true

# npmjs 版本
npm view @starkdev020/codex-father-mcp-server versions

# 安装试用
npm i -g @starkdev020/codex-father-mcp-server
codex-mcp-server --help
```

---

## 8. 回滚与热修复

- GitHub：删除 Release 与 tag，参考 `DEPLOY.md`
- npmjs：不建议 unpublish，使用 `fix:` 提交触发 PATCH 版热修复

---

## 9. 速用命令（npm 脚本）

```bash
# 预检（质量门禁 + 子包构建）
npm run release:preflight

# 语义化 dry-run（不发版）
npm run release:dry-run

# 本地发版（需要 TOKEN）
npm run release:local

# 推送到 main 触发 CI（交互确认）
npm run release:ci

# 仅提交文档与脚本后推送 main（交互确认）
npm run release:ci-commit-docs
```

---

## 10. 提交规范与产物忽略

- 遵循 Conventional Commits，示例见第 4 节。
- 已在 `.gitignore` 忽略 `*.tgz`
  等打包产物，避免误提交；如需本地调试包，请自行清理工作区或置于临时目录。

---

## 11. 变更摘要（与兼容性相关）

- 新增环境模板：`config/templates/codex-father.env.example`
- `scripts/release-mcp.sh` 调整：
  - `--ci` 要求工作区干净，不再自动 `git add -A`
  - 新增 `--ci-commit-docs`，仅提交 README/docs/脚本等文档性改动
  - 所有高风险操作均有二次确认提示

```

```
