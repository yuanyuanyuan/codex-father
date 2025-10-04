# 阶段三设计文档：DevContainer / Docker 集成与写盘类 E2E

## 概述

在容器环境中提供可重复、可审计的写盘类 E2E 执行路径，支持 MCP/CLI、YOLO（容器内）与网络开关，并为 PR 自动化准备依赖与配置指引。

## DevContainer 设计

- 基础镜像：`mcr.microsoft.com/devcontainers/base:ubuntu`（.devcontainer/Dockerfile）。
- 组件：bash/git/jq/build-essential + Node 18 feature（devcontainer.json）。
- 用户：创建非 root 用户 `vscode`，工作目录 `/workspaces/codex-father`。
- 构建：`postCreateCommand` 在容器内构建 TS MCP（`npm i && npm run build`）。
- 环境：`CODEX_SESSIONS_ROOT=/workspaces/codex-father/.codex-father/sessions`。
- 依赖：文档指导安装 `codex` 与 `gh`（或配置 `GH_TOKEN`）。

## Docker 脚本设计（scripts/run_write_e2e_in_container.sh）

- 构建镜像：沿用 `.devcontainer/Dockerfile`。
- 运行：
  - 挂载仓库到容器 `/workspaces/codex-father`。
  - 尝试将宿主 `codex` 以只读方式挂载到 `/usr/local/bin/codex`。
  - 默认命令：依次运行写盘类 E2E 用例（可通过参数覆盖）。
  - 环境变量：保留 `CODEX_SESSIONS_ROOT` 指向仓库内目录，便于审计与收集产物。

## 非交互、安全与网络

- YOLO：容器内允许
  `--dangerously-bypass-approvals-and-sandbox`；默认不在宿主机启用。
- 网络：`workspace-write` 默认禁网；容器内需要网络时通过
  `--codex-config 'sandbox_workspace_write.network_access=true'` 打开。
- 文档强调将 YOLO 限定在容器隔离环境中使用。

## MCP 集成

- 容器内直接执行 `./mcp/server.sh`（stdio）。
- MCP E2E：`tests/mcp_ts_e2e.sh`
  在容器内通过（initialize、tools/list、exec、start/status/logs）。

## PR 自动化（容器内）

- gh CLI：推荐在容器内安装并 `gh auth login`；
- REST 兜底：导出 `GH_TOKEN` 或 `GITHUB_TOKEN`，并在 CLI 调用 PR 接口时注入；
- 文档提供两种方式的选择与安全提示。

## 测试与验收

- 写盘类 E2E（容器内）：
  - `bash tests/e2e_start_write_file_real_codex.sh`
  - `bash tests/e2e_job_write_file_real_codex.sh`
- MCP E2E（容器内）：`bash tests/mcp_ts_e2e.sh`
- 自定义命令：通过 `scripts/run_write_e2e_in_container.sh "bash -lc '…'"`
  覆盖默认命令。

## 兼容性与限制

- 开发者无需容器也可运行非写盘用例；写盘类强烈建议容器执行。
- 宿主操作系统/内核差异不再影响容器内 YOLO 行为（隔离由容器提供）。

## 风险与应对

- 权限与所有权：容器内使用非 root 用户；必要时通过 `--user`
  与卷映射 UID/GID 解决。
- 网络策略：CI 平台的容器网络可能受限；需在流水线配置中显式允许。
