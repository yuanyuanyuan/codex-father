# Codex 非交互模式运行指南（CLI 与配置）

本文基于 refer-research/openai-codex 官方文档整理，给出在本机、CI、以及 Dev
Container/Docker 中让 Codex 以“非交互模式（无需审批）”运行的方式，并配套经过文档验证的命令行与配置片段。

## 核心结论（附官方出处）

- 非交互主入口：`codex exec`，即“automation mode”。
  - 参考：`refer-research/openai-codex/docs/getting-started.md:9`
- 禁用所有审批：`--ask-for-approval never`（可与任意 `--sandbox` 组合）。
  - 参考：`refer-research/openai-codex/docs/sandbox.md:24`
- 运行约束（沙箱）由 `--sandbox` 或配置 `sandbox_mode` 控制：
  - `read-only`：只读（适合 CI）
  - `workspace-write`：工作区及临时目录可写，网络默认禁用（可在配置里开启）
  - `danger-full-access`：关闭磁盘/网络限制（谨慎使用）
  - 参考：`refer-research/openai-codex/docs/sandbox.md:19`,
    `refer-research/openai-codex/docs/sandbox.md:36`,
    `refer-research/openai-codex/docs/config.md:320`
- 容器/Dev
  Container：如宿主/容器不支持 Landlock/seccomp，建议让容器提供隔离，并在容器内使用
  `danger-full-access`。
  - 参考：`refer-research/openai-codex/docs/sandbox.md:85`,
    `refer-research/openai-codex/docs/platform-sandboxing.md:8`

---

## 一、非交互“只读浏览”（CI 推荐）

- 目标：禁止写入与网络；以最小权限进行代码扫描、解释、问答。
- 命令（非交互 + 无审批）：

  ```bash
  codex exec --sandbox read-only --ask-for-approval never "解释这个仓库的结构"
  ```

  - 依据：非交互入口 `exec`（`docs/getting-started.md:9`）；禁用审批
    `--ask-for-approval never`（`docs/sandbox.md:24`）；只读模式（`docs/sandbox.md:31`）。

- 从标准输入提供任务（示例）：
  ```bash
  printf '%s' "列出存在安全风险的函数" | codex exec --sandbox read-only --ask-for-approval never
  ```
- 配置（可选）：

  ```toml
  # ~/.codex/config.toml 或容器内的 $CODEX_HOME/config.toml
  sandbox_mode = "read-only"  # docs/config.md（与 sandbox.md 对应）

  [profiles.readonly_quiet]
  approval_policy = "never"
  sandbox_mode    = "read-only"
  ```

  - 依据：配置项与 Profile（`refer-research/openai-codex/docs/sandbox.md:56`、`refer-research/openai-codex/docs/config.md:185`
    起）。

## 二、非交互“可写工作区”（默认禁网）

- 目标：允许在工作区内进行修改（写文件/运行命令），并关闭审批弹窗。
- 命令（非交互 + 无审批）：

```bash
codex exec --sandbox workspace-write --ask-for-approval never "在 README 增补使用说明"
```

- 依据：`workspace-write`
  模式（`refer-research/openai-codex/docs/sandbox.md:19`）；默认禁网（`docs/sandbox.md:36`）；无审批（`docs/sandbox.md:24`）。

> **提示**：项目自带的 `start.sh` 会在检测到 `--sandbox workspace-write`
> 且审批策略缺失或为 `never` 时，自动将其规范化为 `on-request`，以避免 Codex
> CLI 把会话降级成只读沙箱。如确实需要 `never` 与可写沙箱组合，可显式导出
> `ALLOW_NEVER_WITH_WRITABLE_SANDBOX=1` 覆盖该行为。

- 打开网络（可选，默认关闭）：

  ```toml
  # ~/.codex/config.toml
  sandbox_mode = "workspace-write"

  [sandbox_workspace_write]
  network_access = true   # 允许沙箱内命令访问网络
  # 其他常用设置
  # writable_roots = ["/extra/writable"]
  # exclude_tmpdir_env_var = false
  # exclude_slash_tmp = false
  ```

  - 依据：`[sandbox_workspace_write].network_access`（`refer-research/openai-codex/docs/config.md:313`）。

## 三、非交互“全权限”（容器内外部隔离已就绪时）

- 目标：在容器/外部环境已提供隔离的前提下，关闭 Codex 内置沙箱限制。
- 命令（非交互 + 无审批）：

  ```bash
  codex exec --sandbox danger-full-access --ask-for-approval never "执行构建并产出发布草案"

  # 等价旗标（更直接地关闭沙箱与审批）：
  codex exec --dangerously-bypass-approvals-and-sandbox "对接外部脚本进行产线操作"
  ```

- 配置（容器内）：
  ```toml
  # ~/.codex/config.toml
  sandbox_mode = "danger-full-access"
  ```
- 依据：容器场景下关于关闭内置沙箱的建议（`refer-research/openai-codex/docs/sandbox.md:85`、`refer-research/openai-codex/docs/platform-sandboxing.md:8`）；配置项（`refer-research/openai-codex/docs/config.md:320`）。

## 四、Dev Container / Docker 实操建议

- 凭据与配置路径
  - 在容器内设置 `CODEX_HOME` 到工作区挂载目录（确保可写）：

    ```bash
    export CODEX_HOME="/workspace/.codex"   # 例如 VS Code Dev Container 的挂载点
    mkdir -p "$CODEX_HOME"
    ```

    - 依据：配置文件与 `$CODEX_HOME`
      的定位（`refer-research/openai-codex/docs/config.md:15`）。

  - 无头认证：
    - 使用 API
      Key（无需浏览器）：`codex login --api-key "YOUR_API_KEY"`（`refer-research/openai-codex/docs/authentication.md:5`）
    - 或在本机完成登录后，复制 `~/.codex/auth.json` 到容器：

      ```bash
      CONTAINER_HOME=$(docker exec MY_CONTAINER printenv HOME)
      docker exec MY_CONTAINER mkdir -p "$CONTAINER_HOME/.codex"
      docker cp ~/.codex/auth.json MY_CONTAINER:"$CONTAINER_HOME/.codex/auth.json"
      ```

      - 依据：`refer-research/openai-codex/docs/authentication.md:27`,
        `refer-research/openai-codex/docs/authentication.md:33`,
        `refer-research/openai-codex/docs/authentication.md:35`。

- 内核/沙箱能力
  - 若容器/宿主不支持 Landlock/seccomp：让容器提供隔离，Codex 使用
    `danger-full-access` 或
    `--dangerously-bypass-approvals-and-sandbox`（`refer-research/openai-codex/docs/sandbox.md:85`、`refer-research/openai-codex/docs/platform-sandboxing.md:8`）。
  - 若支持：可正常使用 `--sandbox read-only` 或
    `workspace-write`（`refer-research/openai-codex/docs/sandbox.md:19`）。

## 五、（可选）非交互沙箱验证（不经模型）

> 用于在 CI/容器里快速验证“当前沙箱策略下是否能在工作区写入/在工作区外被拒绝”。该命令直接在沙箱内运行 shell，不触发模型推理。

- Linux（Landlock）：

  ```bash
  # 工作区内写入应成功（exit=0）
  codex debug landlock --full-auto -- bash -lc 'set -euo pipefail; t=.codex_write_check; echo ok > "$t"; ls -l "$t"; rm -f "$t"; echo WRITE_OK'

  # 工作区外写入应失败（exit!=0）
  codex debug landlock --full-auto -- bash -lc 'set -euo pipefail; echo no > /root_denied'
  ```

- macOS（Seatbelt）：

  ```bash
  codex debug seatbelt --full-auto -- bash -lc 'set -euo pipefail; t=.codex_write_check; echo ok > "$t"; ls -l "$t"; rm -f "$t"; echo WRITE_OK'
  ```

  - 依据：调试沙箱子命令（`refer-research/openai-codex/docs/sandbox.md:70`、`refer-research/openai-codex/docs/sandbox.md:75`）。

## 六、常见排错

- “failed to initialize rollout recorder: Permission denied”
  - 将 `CODEX_HOME` 指向容器/工作区内可写目录（如
    `./.codex-work`），并确保目录可写（`refer-research/openai-codex/docs/config.md:15`）。
- 模型/网络不可用
  - `workspace-write` 下默认禁网；需要网络时在配置中开启
    `sandbox_workspace_write.network_access = true`（`refer-research/openai-codex/docs/config.md:313`）。容器内也可切换为
    `danger-full-access`（`refer-research/openai-codex/docs/config.md:320`）。

## 七、速查清单（命令/配置对照）

- 非交互主命令：
  - CLI：`codex exec`（`refer-research/openai-codex/docs/getting-started.md:9`）
- 只读非交互（无审批）：
  - CLI：`codex exec --sandbox read-only --ask-for-approval never ...`（`refer-research/openai-codex/docs/sandbox.md:31`,
    `:24`）
  - TOML：`sandbox_mode = "read-only"`（`refer-research/openai-codex/docs/config.md`）
- 工作区可写非交互（默认禁网）：
  - CLI：`codex exec --sandbox workspace-write --ask-for-approval never ...`（`refer-research/openai-codex/docs/sandbox.md:19`,
    `:24`, `:36`）
  - TOML：`sandbox_mode = "workspace-write"`；可选
    `[sandbox_workspace_write].network_access = true`（`refer-research/openai-codex/docs/config.md:313`）
- 全权限（容器隔离）：
  - CLI：`codex exec --sandbox danger-full-access --ask-for-approval never ...`
    或
    `--dangerously-bypass-approvals-and-sandbox`（`refer-research/openai-codex/docs/config.md:320`,
    `refer-research/openai-codex/docs/sandbox.md:85`）
  - TOML：`sandbox_mode = "danger-full-access"`（`refer-research/openai-codex/docs/config.md:320`）
- Dev Container/Docker 关键环境：
  - `CODEX_HOME=/workspace/.codex`（`refer-research/openai-codex/docs/config.md:15`）

## 参考来源（仓库内）

- Rust 文档：
  - 非交互模式定义：`refer-research/openai-codex/docs/getting-started.md:9`
  - 审批/沙箱组合与建议：`refer-research/openai-codex/docs/sandbox.md:22`,
    `:26`, `:31`, `:36`, `:70`, `:75`, `:85`
  - 平台/容器沙箱说明：`refer-research/openai-codex/docs/platform-sandboxing.md:8`
  - 配置项详解与 `$CODEX_HOME`：`refer-research/openai-codex/docs/config.md:15`,
    `:313`, `:320`
  - 无头/容器认证：`refer-research/openai-codex/docs/authentication.md:5`,
    `:27`, `:33`, `:35`
- TypeScript CLI（legacy）参考：
  - 非交互 /
    CI 概览与示例：`refer-research/openai-codex/codex-cli/README.md:244`, `:253`
