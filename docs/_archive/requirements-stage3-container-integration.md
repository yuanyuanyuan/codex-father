# 阶段三需求文档：DevContainer / Docker 集成与写盘类 E2E

## 背景与目标
- 背景：宿主机沙箱（Seatbelt/Landlock）与审批策略可能限制“真实写文件/推送”的 E2E 场景。需要在容器中完成这些用例，并与 MCP/CLI 集成，支撑 Claude Code 的本地与容器双模式。
- 目标：
  - 在 DevContainer 与 Docker 中可重复运行写盘类 E2E（含 YOLO、网络开关）。
  - 容器内能够构建并运行 MCP TS 服务器，并通过 MCP/CLI 发起任务。
  - 为 PR 自动化提供容器内可用的依赖（gh 或 REST），并完善文档。

## 范围（In‑Scope）
- DevContainer：`/.devcontainer/` 配置与 postCreate 构建 MCP；说明 gh/Token 的使用方式。
- Docker：`scripts/run_write_e2e_in_container.sh` 构建与运行；挂载宿主 codex（若存在）。
- 文档：容器内 YOLO 安全说明、网络开关、MCP/CLI 示例、PR 自动化凭据指引。
- 测试：在容器中运行写盘类 E2E 脚本；MCP E2E 在容器内通过。

## 非目标（Out‑of‑Scope）
- 容器镜像发布与仓库推送；
- 平台特定内核调优（除非影响到沙箱行为）。

## 需求细项
- DevContainer
  - 镜像：Ubuntu 基础 + Node 18 feature；postCreate 自动 `npm i && npm run build`（TS MCP）。
  - 环境：`CODEX_SESSIONS_ROOT` 指向工作区 `.codex-father/sessions`；
  - 文档：如何在容器内安装 `codex`，或挂载宿主二进制；如何安装 gh 或配置 `GH_TOKEN`。
- Docker 脚本
  - 构建镜像（基于 `.devcontainer/Dockerfile`）；
  - 运行：挂载工作区与可选的宿主 `codex`；默认执行写盘类 E2E（可覆盖命令）。
- 非交互与 YOLO
  - 容器内允许 `--dangerously-bypass-approvals-and-sandbox`；默认不在宿主机启用；
  - 文档强调风险与隔离边界；
  - 网络开关通过 `--codex-config sandbox_workspace_write.network_access=true` 实现。
- MCP 集成
  - 容器内 `./mcp/server.sh` 可直接工作；MCP E2E 脚本在容器内通过。

## 验收标准
- DevContainer：在容器中执行：
  - `bash tests/e2e_start_write_file_real_codex.sh` 与 `bash tests/e2e_job_write_file_real_codex.sh` 通过；
  - `bash tests/mcp_ts_e2e.sh` 通过；
  - 文档中提供 `codex.exec`/`codex.start` 的容器示例（含 YOLO 与 network 开关）。
- Docker：
  - `bash scripts/run_write_e2e_in_container.sh` 成功构建镜像并运行默认写盘类 E2E；
  - 支持自定义命令覆盖运行内容并通过；
  - 若宿主存在 `codex`，可只读挂载到容器 `/usr/local/bin/codex`。

## 影响范围（代码与文件）
- `.devcontainer/devcontainer.json`、`.devcontainer/Dockerfile`
- `scripts/run_write_e2e_in_container.sh`
- `docs/devcontainer.md`
- 相关 E2E 脚本：`tests/e2e_start_write_file_real_codex.sh`、`tests/e2e_job_write_file_real_codex.sh`、`tests/mcp_ts_e2e.sh`

## 里程碑
- D1：容器构建与 MCP 构建在容器内成功；
- D2：写盘类 E2E 通过（YOLO+network 可用）；
- D3：文档完善（凭据、风险、示例命令）。

## 风险与缓解
- 宿主与容器之间的用户/权限差异：镜像中创建非 root 用户并映射工作区；
- 缺失 codex 或 gh：文档提供安装/挂载路径；REST 兜底 PR 创建；
- 容器网络策略限制：文档与脚本显式开启 network 配置。

