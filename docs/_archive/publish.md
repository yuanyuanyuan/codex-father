## 发布与分发（npmjs 与 GitHub Packages）

本仓库提供两条发版通道：

- npmjs.org（需要 `NPM_TOKEN`，语义化发版自动推送）
- GitHub Packages（npm.pkg.github.com，使用内置 `GITHUB_TOKEN` 即可）

包信息

- MCP 包：`mcp/codex-mcp-server`
- 包名（scoped）：`@starkdev020/codex-father-mcp-server`

语义化发版（semantic-release）

- 配置：根部 `.releaserc`
  - 分支：`main`
  - tag 格式：`mcp-v${version}`
  - 插件：commit‑analyzer、release‑notes‑generator、changelog、npm（`pkgRoot: mcp/codex-mcp-server`）、git、github
- 工作流：
  - npmjs：`.github/workflows/release.yml`（有 `NPM_TOKEN` 时才发布 npmjs）
  - GH Packages：`.github/workflows/release-ghpkgs.yml`（总是发布到
    `npm.pkg.github.com`）

准备与触发

- 约定式提交格式（Conventional Commits），例如：`feat(mcp): 初始发版`
- 首发版本策略：本仓库选择从 `1.0.0`
  起步（无起始 tag 时由 semrel 首次发布决定）。
- 触发方式：
  - 推送到 `main`（影响 `mcp/**` 或配置文件） → 自动发版
  - 或在 Actions 面板手动 `workflow_dispatch`

私有 Token 与权限

- npmjs：仓库 Secrets 配置
  `NPM_TOKEN`（具备发布权限；启用 2FA 的账号需开启 CI 发布模式）
- GitHub Packages：无需 PAT，使用 `GITHUB_TOKEN` 即可发布（工作流中已写入
  `~/.npmrc`）

消费者安装

- GitHub Packages（需要读取权限）：
  - `~/.npmrc`：
    - `@starkdev020:registry=https://npm.pkg.github.com`
    - `//npm.pkg.github.com/:_authToken=<YOUR_GITHUB_TOKEN>`（最小权限：read:packages）
  - 安装/运行：
    - `npm install -g @starkdev020/codex-father-mcp-server`
    - 或 `npx @starkdev020/codex-father-mcp-server`
- npmjs：若已配置 `NPM_TOKEN`，则与普通 npm 包一致：
  - `npx @starkdev020/codex-father-mcp-server`

本地测试发布（可选）

- 申请 GitHub PAT（fine‑grained 或 classic），至少 `write:packages` 权限
- `~/.npmrc`：
  - `@starkdev020:registry=https://npm.pkg.github.com`
  - `//npm.pkg.github.com/:_authToken=<YOUR_GITHUB_PAT>`
- 进入包目录：`cd mcp/codex-mcp-server && npm publish`

注意事项

- 同时发布到 npmjs 与 GH
  Packages 时，建议由 semantic‑release 统一计算版本，确保两边版本一致。
- 不在 package.json 固化 `publishConfig.registry`，以便通过 CI 的 `~/.npmrc`
  灵活切换。
