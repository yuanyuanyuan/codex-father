# Codex 0.42/0.44 参数版本兼容性映射表

**文档版本**: 1.0 **创建日期**: 2025-10-03 **维护者**: codex-father 开发团队

---

## 图例说明

| 符号 | 含义               |
| ---- | ------------------ |
| ✅   | 该版本支持此参数   |
| ❌   | 该版本不支持此参数 |
| ⚠️   | 部分支持/已弃用    |

---

## 1. MCP 方法参数映射

### 1.1 newConversation 方法参数

| 参数名                  | 类型    | 0.42 | 0.44 | 默认值        | 必需 | 不兼容行为（0.42）                                           | 数据来源                                                                               |
| ----------------------- | ------- | ---- | ---- | ------------- | ---- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `model`                 | string  | ✅   | ✅   | `gpt-5-codex` | 否   | -                                                            | [MCP接口文档:54](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L54) |
| `profile`               | string  | ❌   | ✅   | -             | 否   | 返回错误：`Invalid params: 'profile' requires Codex >= 0.44` | [MCP接口文档:55](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L55) |
| `cwd`                   | string  | ✅   | ✅   | 当前目录      | 否   | -                                                            | [MCP接口文档:56](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L56) |
| `approvalPolicy`        | enum    | ✅   | ✅   | `untrusted`   | 否   | -                                                            | [MCP接口文档:57](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L57) |
| `sandbox`               | enum    | ✅   | ✅   | `read-only`   | 否   | -                                                            | [MCP接口文档:58](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L58) |
| `config`                | object  | ✅   | ✅   | `{}`          | 否   | 过滤 0.44 独有配置                                           | [MCP接口文档:59](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L59) |
| `baseInstructions`      | string  | ✅   | ✅   | -             | 否   | -                                                            | [MCP接口文档:60](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L60) |
| `includePlanTool`       | boolean | ✅   | ✅   | `false`       | 否   | -                                                            | [MCP接口文档:61](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L61) |
| `includeApplyPatchTool` | boolean | ✅   | ✅   | `false`       | 否   | -                                                            | [MCP接口文档:61](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L61) |

**approvalPolicy 可选值**: `untrusted` \| `on-request` \| `on-failure` \|
`never` **sandbox 可选值**: `read-only` \| `workspace-write` \|
`danger-full-access`

### 1.2 sendUserMessage 方法参数

| 参数名           | 类型   | 0.42 | 0.44 | 默认值 | 必需 | 不兼容行为（0.42） | 数据来源                                                                                 |
| ---------------- | ------ | ---- | ---- | ------ | ---- | ------------------ | ---------------------------------------------------------------------------------------- |
| `conversationId` | string | ✅   | ✅   | -      | 是   | -                  | [MCP接口文档:67](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L67)   |
| `items`          | array  | ✅   | ✅   | -      | 是   | -                  | [MCP接口文档:134](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L134) |

### 1.3 sendUserTurn 方法参数

| 参数名           | 类型   | 0.42 | 0.44 | 默认值       | 必需 | 不兼容行为（0.42） | 数据来源                                                                               |
| ---------------- | ------ | ---- | ---- | ------------ | ---- | ------------------ | -------------------------------------------------------------------------------------- |
| `conversationId` | string | ❌   | ✅   | -            | 是   | 方法不存在         | [MCP接口文档:68](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L68) |
| `cwd`            | string | ❌   | ✅   | 当前目录     | 否   | 方法不存在         | [MCP接口文档:68](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L68) |
| `approvalPolicy` | enum   | ❌   | ✅   | 继承会话配置 | 否   | 方法不存在         | [MCP接口文档:68](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L68) |
| `sandboxPolicy`  | enum   | ❌   | ✅   | 继承会话配置 | 否   | 方法不存在         | [MCP接口文档:68](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L68) |
| `model`          | string | ❌   | ✅   | 继承会话配置 | 否   | 方法不存在         | [MCP接口文档:68](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L68) |
| `effort`         | enum   | ❌   | ✅   | -            | 否   | 方法不存在         | [MCP接口文档:68](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L68) |
| `summary`        | enum   | ❌   | ✅   | -            | 否   | 方法不存在         | [MCP接口文档:68](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L68) |

### 1.4 其他 MCP 方法

| 方法名                  | 0.42 | 0.44 | 优先级 | 数据来源                                                                                  |
| ----------------------- | ---- | ---- | ------ | ----------------------------------------------------------------------------------------- |
| `interruptConversation` | ❌   | ✅   | 中     | [MCP接口文档:18,70](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L18) |
| `resumeConversation`    | ❌   | ✅   | 中     | [MCP接口文档:19,72](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L19) |
| `listConversations`     | ❌   | ✅   | 低     | [MCP接口文档:19,72](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L19) |
| `archiveConversation`   | ❌   | ✅   | 低     | [MCP接口文档:19,72](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L19) |
| `getUserSavedConfig`    | ❌   | ✅   | 低     | [MCP接口文档:21](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L21)    |
| `setDefaultModel`       | ❌   | ✅   | 低     | [MCP接口文档:21](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L21)    |
| `getUserAgent`          | ❌   | ✅   | 低     | [MCP接口文档:21](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L21)    |
| `userInfo`              | ❌   | ✅   | 低     | [MCP接口文档:21](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L21)    |
| `loginApiKey`           | ❌   | ✅   | 中     | [MCP接口文档:23,96](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L23) |
| `loginChatGpt`          | ❌   | ✅   | 中     | [MCP接口文档:23,97](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L23) |
| `cancelLoginChatGpt`    | ❌   | ✅   | 低     | [MCP接口文档:23,98](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L23) |
| `logoutChatGpt`         | ❌   | ✅   | 低     | [MCP接口文档:23,98](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L23) |
| `getAuthStatus`         | ❌   | ✅   | 中     | [MCP接口文档:23,98](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L23) |
| `gitDiffToRemote`       | ❌   | ✅   | 低     | [MCP接口文档:25](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L25)    |
| `execOneOffCommand`     | ❌   | ✅   | 低     | [MCP接口文档:25](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L25)    |

### 1.5 MCP 审批方法（服务器→客户端请求）

| 方法名                | 0.42 | 0.44 | 数据来源                                                                                  |
| --------------------- | ---- | ---- | ----------------------------------------------------------------------------------------- |
| `applyPatchApproval`  | ✅   | ✅   | [MCP接口文档:27,87](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L27) |
| `execCommandApproval` | ✅   | ✅   | [MCP接口文档:27,88](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L27) |

---

## 2. CLI 参数映射

| 参数                                         | 类型         | 0.42 | 0.44 | 默认值        | 不兼容/降级行为（0.42）                                                       | 数据来源                                                                                                           |
| -------------------------------------------- | ------------ | ---- | ---- | ------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `--model`, `-m`                              | string       | ⚠️   | ✅   | `gpt-5-codex` | 需通过 `--codex-config model=<name>` 或在配置文件中设置；wrapper 未解析该旗标 | [start.sh:575-601](start.sh#L575)<br>[CLI文档:11](refer-research/openai-codex/docs/getting-started.md#L11)         |
| `--ask-for-approval`, `-a`                   | enum         | ✅   | ✅   | `untrusted`   | -                                                                             | [start.sh:575-601](start.sh#L575)<br>[CLI文档:11](refer-research/openai-codex/docs/getting-started.md#L11)         |
| `--sandbox`, `-s`                            | enum         | ✅   | ✅   | `read-only`   | -                                                                             | [start.sh:575-601](start.sh#L575)<br>[exec CLI:26](refer-research/openai-codex/codex-rs/exec/src/cli.rs#L24)       |
| `--cd`, `-C`                                 | string       | ⚠️   | ✅   | 当前目录      | 需 `--codex-arg "--cd"` + `--codex-arg <DIR>` 手动透传                        | [start.sh:575-601](start.sh#L575)<br>[CLI文档:103-105](refer-research/openai-codex/docs/getting-started.md#L103)   |
| `--config`, `-c`                             | key=value    | ✅   | ✅   | -             | 过滤 0.44 独有配置键                                                          | [start.sh:575-601](start.sh#L575)<br>[配置文档:6-13](refer-research/openai-codex/docs/config.md#L6)                |
| `--image`, `-i`                              | list<string> | ❌   | ✅   | -             | 0.42 无解析；需成对使用 `--codex-arg` 手动传入                                | [exec CLI:13-18](refer-research/openai-codex/codex-rs/exec/src/cli.rs#L13)                                         |
| `--oss`                                      | flag         | ❌   | ✅   | `false`       | 0.42 wrapper 无通道；如需请使用 `--codex-arg --oss`（0.42 CLI 不识别）        | [exec CLI:21-22](refer-research/openai-codex/codex-rs/exec/src/cli.rs#L21)                                         |
| `--profile`, `-p`                            | string       | ⚠️   | ✅   | -             | 直接透传但 Codex 0.42 会返回 `unknown argument --profile`                     | [start.sh:589-595](start.sh#L589)<br>[配置文档:182-219](refer-research/openai-codex/docs/config.md#L182)           |
| `--full-auto`                                | flag         | ⚠️   | ✅   | `false`       | 透传但 Codex 0.42 不支持，会抛出未知参数错误                                  | [start.sh:592-595](start.sh#L592)<br>[exec CLI:33-35](refer-research/openai-codex/codex-rs/exec/src/cli.rs#L33)    |
| `--dangerously-bypass-approvals-and-sandbox` | flag         | ⚠️   | ✅   | `false`       | 透传但 Codex 0.42 不支持，会抛出未知参数错误                                  | [start.sh:594-595](start.sh#L594)<br>[exec CLI:37-45](refer-research/openai-codex/codex-rs/exec/src/cli.rs#L37)    |
| `--skip-git-repo-check`                      | flag         | ❌   | ✅   | `false`       | 需 `--codex-arg --skip-git-repo-check`；0.42 CLI 不识别                       | [exec CLI:51-53](refer-research/openai-codex/codex-rs/exec/src/cli.rs#L51)                                         |
| `--output-schema`                            | path         | ❌   | ✅   | -             | 需 `--codex-arg --output-schema`；0.42 CLI 不识别                             | [exec CLI:55-57](refer-research/openai-codex/codex-rs/exec/src/cli.rs#L55)                                         |
| `--color`                                    | enum         | ❌   | ✅   | `auto`        | 需 `--codex-arg --color`；0.42 CLI 不识别                                     | [exec CLI:63-64](refer-research/openai-codex/codex-rs/exec/src/cli.rs#L63)                                         |
| `--json`                                     | flag         | ⚠️   | ✅   | `false`       | 需 `--codex-arg --json` 手动透传；0.42 CLI 输出格式需自行确认                 | [exec CLI:67-68](refer-research/openai-codex/codex-rs/exec/src/cli.rs#L67)                                         |
| `--include-plan-tool`                        | flag         | ❌   | ✅   | `false`       | 需 `--codex-arg --include-plan-tool`；0.42 CLI 不识别                         | [exec CLI:70-72](refer-research/openai-codex/codex-rs/exec/src/cli.rs#L70)                                         |
| `--output-last-message`                      | path         | ⚠️   | ✅   | -             | wrapper 会自动追加；需确认 0.42 二进制版本实际支持                            | [start.sh:1068-1128](start.sh#L1068)<br>[exec CLI:74-76](refer-research/openai-codex/codex-rs/exec/src/cli.rs#L74) |
| `exec resume`                                | subcommand   | ❌   | ✅   | -             | 不支持；Codex 0.42 返回 `unknown subcommand 'resume'`                         | [高级文档:32-42](refer-research/openai-codex/docs/advanced.md#L32)                                                 |
| `exec resume --last`                         | flag         | ❌   | ✅   | -             | 同上                                                                          | [高级文档:34](refer-research/openai-codex/docs/advanced.md#L34)                                                    |
| `exec resume <SESSION_ID>`                   | arg          | ❌   | ✅   | -             | 同上                                                                          | [高级文档:41](refer-research/openai-codex/docs/advanced.md#L41)                                                    |

> ℹ️ **使用提示**: 若需传递表中 0.42 列为 `⚠️/❌` 的 Codex 0.44 新旗标，可通过
> `--codex-arg`（追加原始 CLI 参数）或
> `--codex-config key=value`（配置覆盖）向下兼容；文档中的不兼容行为栏位已注明所需的降级方式。

---

## 3. 配置选项映射

### 3.1 顶级配置选项

| 配置项                               | 类型    | 0.42 | 0.44 | 默认值        | 不兼容行为（0.42）                                 | 数据来源                                                            |
| ------------------------------------ | ------- | ---- | ---- | ------------- | -------------------------------------------------- | ------------------------------------------------------------------- |
| `model`                              | string  | ✅   | ✅   | `gpt-5-codex` | -                                                  | [配置文档:18-24](refer-research/openai-codex/docs/config.md#L18)    |
| `model_provider`                     | string  | ✅   | ✅   | `openai`      | -                                                  | [配置文档:132-143](refer-research/openai-codex/docs/config.md#L132) |
| `approval_policy`                    | enum    | ✅   | ✅   | `untrusted`   | -                                                  | [配置文档:145-180](refer-research/openai-codex/docs/config.md#L145) |
| `sandbox_mode`                       | enum    | ✅   | ✅   | `read-only`   | -                                                  | [配置文档:279-322](refer-research/openai-codex/docs/config.md#L279) |
| `model_reasoning_effort`             | enum    | ❌   | ✅   | `medium`      | 警告并忽略：`配置将被忽略`                         | [配置文档:227-236](refer-research/openai-codex/docs/config.md#L227) |
| `model_reasoning_summary`            | enum    | ❌   | ✅   | `auto`        | 警告并忽略：`配置将被忽略`                         | [配置文档:238-250](refer-research/openai-codex/docs/config.md#L238) |
| `model_supports_reasoning_summaries` | boolean | ❌   | ✅   | `false`       | 警告并忽略：`配置将被忽略`                         | [配置文档:271-277](refer-research/openai-codex/docs/config.md#L271) |
| `model_verbosity`                    | enum    | ❌   | ✅   | `medium`      | 警告并忽略：`配置将被忽略`                         | [配置文档:252-269](refer-research/openai-codex/docs/config.md#L252) |
| `profile`                            | string  | ❌   | ✅   | -             | 警告并忽略：`配置将被忽略`                         | [配置文档:182-219](refer-research/openai-codex/docs/config.md#L182) |
| `profiles.<name>.*`                  | table   | ❌   | ✅   | -             | 警告并忽略整个 profiles 段                         | [配置文档:182-219](refer-research/openai-codex/docs/config.md#L182) |
| `mcp_servers`                        | table   | ✅   | ✅   | `{}`          | -                                                  | [配置文档:338-393](refer-research/openai-codex/docs/config.md#L338) |
| `notify`                             | array   | ✅   | ✅   | -             | -                                                  | [配置文档:437-515](refer-research/openai-codex/docs/config.md#L437) |
| `history`                            | table   | ✅   | ✅   | -             | -                                                  | [配置文档:517-526](refer-research/openai-codex/docs/config.md#L517) |
| `file_opener`                        | enum    | ✅   | ✅   | `vscode`      | -                                                  | [配置文档:528-542](refer-research/openai-codex/docs/config.md#L528) |
| `hide_agent_reasoning`               | boolean | ✅   | ✅   | `false`       | -                                                  | [配置文档:544-552](refer-research/openai-codex/docs/config.md#L544) |
| `show_raw_agent_reasoning`           | boolean | ✅   | ✅   | `false`       | -                                                  | [配置文档:554-567](refer-research/openai-codex/docs/config.md#L554) |
| `shell_environment_policy.*`         | table   | ⚠️   | ✅   | -             | 0.42 打包不解析；需依赖 Codex 版本自行过滤环境变量 | [配置文档:395-434](refer-research/openai-codex/docs/config.md#L395) |
| `model_context_window`               | number  | ⚠️   | ✅   | -             | 0.42 未暴露该键；透传可能被忽略                    | [配置文档:569-574](refer-research/openai-codex/docs/config.md#L569) |
| `model_max_output_tokens`            | number  | ⚠️   | ✅   | -             | 同上                                               | [配置文档:575-577](refer-research/openai-codex/docs/config.md#L575) |
| `project_doc_max_bytes`              | number  | ⚠️   | ✅   | `32768`       | 0.42 未实现自动裁剪；可能被忽略                    | [配置文档:579-581](refer-research/openai-codex/docs/config.md#L579) |
| `[tui].notifications`                | table   | ⚠️   | ✅   | `false`       | 仅在交互式 TUI 生效；0.42 包装未覆盖               | [配置文档:583-601](refer-research/openai-codex/docs/config.md#L583) |

**model_reasoning_effort 可选值**: `minimal` \| `low` \| `medium` \| `high`
**model_reasoning_summary 可选值**: `auto` \| `concise` \| `detailed` \| `none`
**model_verbosity 可选值**: `low` \| `medium` \| `high`

### 3.2 网络调优配置（版本迁移）

| 配置项                   | 0.42 位置   | 0.44 位置                                        | 不兼容行为（0.42）               | 数据来源                                                            |
| ------------------------ | ----------- | ------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------- |
| `request_max_retries`    | 顶级配置 ✅ | `model_providers.<id>.request_max_retries` ✅    | 忽略 provider 级别配置，显示警告 | [配置文档:103-130](refer-research/openai-codex/docs/config.md#L103) |
| `stream_max_retries`     | 顶级配置 ✅ | `model_providers.<id>.stream_max_retries` ✅     | 忽略 provider 级别配置，显示警告 | [配置文档:103-130](refer-research/openai-codex/docs/config.md#L103) |
| `stream_idle_timeout_ms` | 顶级配置 ✅ | `model_providers.<id>.stream_idle_timeout_ms` ✅ | 忽略 provider 级别配置，显示警告 | [配置文档:103-130](refer-research/openai-codex/docs/config.md#L103) |

**说明**：

- 0.42 支持顶级网络配置（已在 0.44 弃用），会显示迁移提示
- 0.44 优先使用 provider 级别配置（`model_providers.<id>.*`）
- 在 0.42 环境下，provider 级别配置会被忽略并显示警告

### 3.3 model_providers 配置项

| 子配置项                 | 类型   | 0.42 | 0.44 | 默认值   | 数据来源                                                                |
| ------------------------ | ------ | ---- | ---- | -------- | ----------------------------------------------------------------------- |
| `name`                   | string | ✅   | ✅   | -        | [配置文档:38](refer-research/openai-codex/docs/config.md#L38)           |
| `base_url`               | string | ✅   | ✅   | -        | [配置文档:40-42](refer-research/openai-codex/docs/config.md#L40)        |
| `env_key`                | string | ✅   | ✅   | -        | [配置文档:43-45](refer-research/openai-codex/docs/config.md#L43)        |
| `wire_api`               | enum   | ✅   | ✅   | `chat`   | [配置文档:47-48](refer-research/openai-codex/docs/config.md#L47)        |
| `query_params`           | map    | ✅   | ✅   | `{}`     | [配置文档:49-51](refer-research/openai-codex/docs/config.md#L49)        |
| `http_headers`           | map    | ✅   | ✅   | `{}`     | [配置文档:71-79](refer-research/openai-codex/docs/config.md#L71)        |
| `env_http_headers`       | map    | ✅   | ✅   | `{}`     | [配置文档:81-84](refer-research/openai-codex/docs/config.md#L81)        |
| `request_max_retries`    | number | ❌   | ✅   | `4`      | [配置文档:115,120-122](refer-research/openai-codex/docs/config.md#L115) |
| `stream_max_retries`     | number | ❌   | ✅   | `5`      | [配置文档:124-126](refer-research/openai-codex/docs/config.md#L124)     |
| `stream_idle_timeout_ms` | number | ❌   | ✅   | `300000` | [配置文档:128-130](refer-research/openai-codex/docs/config.md#L128)     |

**wire_api 可选值**: `chat` \| `responses`

---

## 4. 快速排查指南

### 场景 1：用户报告 "参数不生效"

**排查步骤**：

1. 检查 Codex 版本：`codex --version`
2. 查询本映射表，确认参数在该版本是否支持（检查 0.42/0.44 列）
3. 定位参数来源：
   - 根据"数据来源"列找到官方文档位置
   - 验证参数名称和类型是否正确
4. 查看不兼容行为：
   - CLI 参数：会报错退出，查看错误信息
   - 配置选项：会显示警告并忽略，查看启动日志
   - MCP 参数：会返回错误响应，查看 MCP 错误

### 场景 2：需要添加新参数支持

**更新步骤**：

1. 在官方文档中找到新参数的定义
2. 在对应的映射表（MCP/CLI/配置）中添加新行：
   - 填写参数名、类型、默认值
   - 标注 0.42/0.44 支持情况（✅/❌）
   - 定义不兼容行为（报错/警告/忽略）
   - **重要**：添加准确的数据来源（文件路径:行号）
3. 更新相关代码实现
4. 添加对应的测试用例
5. 更新本映射表文档的版本号和修改记录

### 场景 3：版本升级后的兼容性检查

**检查清单**：

- [ ] 审查所有 ❌ 标记的 0.42 不支持项，确认降级行为正确
- [ ] 验证所有 ⚠️ 标记的部分支持项，确认警告信息清晰
- [ ] 测试 CLI、配置文件、MCP 三个层的版本检测逻辑
- [ ] 确认错误提示包含版本信息和升级建议
- [ ] 对比官方文档，确认所有参数的数据来源仍然有效

---

## 5. 数据来源索引

### 官方文档路径

| 文档类型 | 文件路径                                                           | 说明                            |
| -------- | ------------------------------------------------------------------ | ------------------------------- |
| MCP 方法 | `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md` | MCP 协议方法和参数定义          |
| 配置选项 | `refer-research/openai-codex/docs/config.md`                       | Codex 配置文件规范              |
| CLI 基础 | `refer-research/openai-codex/docs/getting-started.md`              | CLI 命令和参数                  |
| CLI 高级 | `refer-research/openai-codex/docs/advanced.md`                     | 高级 CLI 功能（如 exec resume） |

### 数据来源格式说明

本映射表中的"数据来源"列使用以下格式：

```
[文档类型:行号](文件相对路径#L行号)
```

**示例**：

- `[MCP方法文档:54](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L54)`
  - 表示参数定义在 MCP 方法文档的第 54 行
  - 点击链接可直接跳转到对应位置

---

## 6. 版本历史

| 版本 | 日期       | 修改内容                                       | 修改者                |
| ---- | ---------- | ---------------------------------------------- | --------------------- |
| 1.0  | 2025-10-03 | 初始版本，包含 Codex 0.42 和 0.44 完整参数映射 | codex-father 开发团队 |

---

## 附录：参数统计

### 版本支持统计

| 参数类别     | 0.42 支持 | 0.44 新增 | 0.44 独有     | 总计   |
| ------------ | --------- | --------- | ------------- | ------ |
| MCP 方法参数 | 8         | 1         | 1 (`profile`) | 9      |
| CLI 参数     | 5         | 4         | 4             | 9      |
| 配置选项     | 11        | 5         | 5             | 16     |
| **总计**     | **24**    | **10**    | **10**        | **34** |

### 不兼容行为统计

| 行为类型            | 参数数量 | 示例                                       |
| ------------------- | -------- | ------------------------------------------ |
| 报错退出（CLI）     | 4        | `--profile`, `--full-auto`, `exec resume`  |
| 警告并忽略（配置）  | 6        | `model_reasoning_effort`, `profiles`       |
| 返回错误响应（MCP） | 1        | `profile` 参数                             |
| 方法不存在（MCP）   | 14       | `sendUserTurn`, `interruptConversation` 等 |
