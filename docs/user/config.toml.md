# Codex Father 全局配置（~/.codex/config.toml）

本文档说明如何通过 `~/.codex/config.toml` 控制 Codex Father 在本地与预览环境（preview）下的关键行为。配置优先级：

CLI flags > 显式环境变量 > ~/.codex/config.toml > 内置默认。

## 1. 段落与键

支持以下段名（任选其一）：`[codex_father]`、`[codex-father]`、`[codex_father.mcp]`。

可用键：

- `project_root`（字符串）
  - 指向包含 `start.sh` 与 `job.sh` 的仓库根目录。
  - 预览/多项目环境推荐固定到 Codex Father 仓库，避免被误识别到其他项目。

- `ignore_mcp_start_failures`（布尔）
  - 仅出现 “MCP client … failed to start: request timed out” 时，不视为致命网络错误（降噪）。
  - 建议在网络抖动的预览环境开启。

- `force_skip_base`（布尔，可选）
  - 全局强制跳过“默认基底指令”（补丁模式自动开启，不必设置）。
  - 当任务上下文偏大时可开启以进一步压缩上下文。

- `job_sh` / `start_sh`（字符串，可选）
  - 直接指定脚本绝对路径，一般不需要，`project_root` 足够。

示例：

```toml
[codex_father]
project_root = "/data/codex-father"
ignore_mcp_start_failures = true
# force_skip_base = false
# job_sh = "/data/codex-father/job.sh"
# start_sh = "/data/codex-father/start.sh"
```

## 2. 生效位置

- Bash CLI：在 `start.sh` 早期加载时读取并注入等效环境变量（不覆盖已显式设置的 env/CLI）。
- MCP Server：在进程启动读取后合入 `process.env`，用于运行时脚本定位与行为控制。

## 3. 典型问题与建议

- 预览环境 ENOENT（`/path/to/.codex-father/job.sh` 缺失）
  - 现象：MCP `start/stop` 报错，提示找不到 `job.sh`/`start.sh`。
  - 处理：设置 `project_root = "/data/codex-father"`，并升级到带有“多路径探测”的版本（确保会自动将运行时脚本安装至 `<project>/.codex-father/`）。

- 偶发 `network_error`（其实仅 MCP 客户端启动超时）
  - 处理：`ignore_mcp_start_failures = true`，且新版分类逻辑已默认不将该类提示视为致命网络错误。

## 4. 验证步骤

1) 最小补丁模式 dry-run：

```bash
./start.sh --task "demo" --patch-mode --dry-run --echo-instructions \
  --log-file .codex-father-sessions/exec-validate/job.log --flat-logs
```

预期：日志中出现 `Base: skipped due to patch-mode`，上下文显著变小。

2) MCP 自检（dist 构建后）：

```bash
node mcp/codex-mcp-server/dist/index.js --version
```

预期：能启动且不报缺少 `job.sh`/`start.sh`。

