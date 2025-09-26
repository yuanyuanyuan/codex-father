# Dev Container / Docker 方案（用于写盘类 E2E）

本地环境可能受到沙箱（Seatbelt/Landlock）或审批策略的限制，导致“真实写文件”类 E2E 用例无法通过。推荐在容器环境中运行写盘类 E2E，通过外部隔离保证安全，并在容器内使用 Codex 的 YOLO 模式。

## 选项 A：VS Code Dev Container（推荐交互式开发）

- 配置：`.devcontainer/`（基于 Ubuntu，预装 bash/git/jq 与 Node 18 feature）
- 打开方式：
  1) 打开仓库根目录
  2) 使用 VS Code + Dev Containers 扩展：Reopen in Container
  3) 容器内将自动构建并安装 MCP TS 服务器依赖（postCreateCommand）

在容器内运行写盘类 E2E（确保容器内可执行 `codex`）：

```
bash tests/e2e_start_write_file_real_codex.sh
bash tests/e2e_job_write_file_real_codex.sh
```

注意：容器内的 Codex CLI 需要可用，可通过以下方式之一获得：
- 按供应商指引在容器内安装 `codex`
- 将宿主机 `codex` 挂载到容器（参见下方“选项 B”脚本的实现方式）

## 选项 B：命令行 Docker 运行（快速执行）

仓库提供脚本：`scripts/run_write_e2e_in_container.sh`，用于构建并运行轻量容器，默认执行“写文件” E2E。

前置：宿主机已安装 Docker；如希望复用宿主 `codex`，请确保 `which codex` 可用。

执行：

```
bash scripts/run_write_e2e_in_container.sh
```

脚本行为：
- 构建镜像 `codex-father-dev:latest`（基于 `.devcontainer/Dockerfile`）
- 将当前仓库挂载到容器的 `/workspaces/codex-father`
- 若宿主存在 `codex`，将其以只读方式挂载到容器 `/usr/local/bin/codex`
- 在容器内执行：
  - `bash tests/e2e_start_write_file_real_codex.sh`
  - `bash tests/e2e_job_write_file_real_codex.sh`

自定义命令：

```
bash scripts/run_write_e2e_in_container.sh "bash -lc 'bash tests/e2e_start_real_codex.sh'"
```

## YOLO 模式与安全说明

- 写盘类 E2E 使用了 `--dangerously-bypass-approvals-and-sandbox`（YOLO）以规避容器内的 Landlock/Seatbelt 限制，便于自动化验证。
- 该模式不受沙箱保护，请仅在隔离容器中运行，不要在宿主机直接启用。

## 网络访问

- `workspace-write` 下默认禁网，若在容器中需要启用网络：
  - CLI：`--codex-config 'sandbox_workspace_write.network_access=true'`
  - 配置文件：`[sandbox_workspace_write] network_access = true`

## 常见问题

- 容器内找不到 `codex`：
  - 在容器内安装 Codex CLI，或使用脚本自动挂载宿主 `codex`。
- 容器内仍失败，提示只读或审批：
  - 确认命令中已启用 YOLO：`--dangerously-bypass-approvals-and-sandbox`（并避免与 `--ask-for-approval` / `--full-auto` 同时出现）。

