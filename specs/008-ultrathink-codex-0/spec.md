# Feature Specification: Codex 0.44 兼容性检查与修复

**Feature Branch**: `008-ultrathink-codex-0` **Created**: 2025-10-03 **Status**:
Draft **Input**: User description:
"ultrathink, 目前遇到了一些命令格式参数支持的问题,基于codex
0.44版本检查,codex-father的封装是否兼容,如果不兼容,就修复,如果有新功能,要支持. 官方资料refer-research/index.md
,refer-research/openai-codex"

## Execution Flow (main)

```
1. Parse user description from Input
   → ✅ Parsed: 兼容性检查与修复需求
2. Extract key concepts from description
   → ✅ Identified:
      - Actors: 开发者、系统集成者
      - Actions: 检查兼容性、修复不兼容、支持新功能
      - Data: 命令参数、API 响应
      - Constraints: 必须兼容 Codex 0.44 规范
3. For each unclear aspect:
   → ✅ CLARIFIED: 405 错误出现在 `codex exec` 执行时（Codex 调用 OpenAI API）
   → ✅ CLARIFIED (UPDATED): 需要支持 Codex 0.42 和 0.44 双版本降级兼容
4. Fill User Scenarios & Testing section
   → ✅ Defined primary user flow
5. Generate Functional Requirements
   → ✅ Generated testable requirements
6. Identify Key Entities
   → ✅ Identified: 命令参数、API 端点、配置项
7. Run Review Checklist
   → ✅ PASS - All requirements clear and testable
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ 问题背景

用户在使用 codex-father 包装 Codex 0.44 时遇到以下问题：

- **症状**: `stream error: unexpected status 405 Method Not Allowed`
- **场景**: 执行 `codex exec --sandbox workspace-write "实现 Phase 3.3..."`
- **错误来源**: ✅ **已确认** - 错误发生在 Codex 进程调用 OpenAI
  API 时（非 codex-father 与 Codex 之间的通信）
- **影响**: 导致任务执行失败，但进程返回码为 0

405 错误通常表示 HTTP 方法不被允许，在 `codex exec` 上下文中可能原因：

1. **Codex 配置问题**:
   - API 端点配置错误（`base_url` 或 `model_provider` 配置）
   - 使用了错误的 `wire_api` 值（应为 `"chat"` 或 `"responses"`）
2. **认证问题**: API Key 无效、过期或权限不足
3. **API 规范变化**: OpenAI API 端点或方法要求发生变化
4. **网络/代理问题**: 请求被重定向到不支持该方法的端点

**关键洞察**: 由于错误发生在 Codex 内部，codex-father 的主要职责是：

- 确保传递给 Codex 的配置参数正确且完整
- 提供清晰的错误诊断信息帮助用户定位问题
- 支持所有 Codex 0.44 的配置选项以避免配置错误

---

## Clarifications

### Session 2025-10-03

- Q: 当 `codex --version`
  命令执行失败（如 Codex 未安装或路径错误）时，codex-father 应该如何处理？ →
  A: 立即报错并退出，显示："无法检测 Codex 版本，请确认 Codex 已安装且在 PATH 中"，并提示用户应该使用什么版本（支持 0.42 或 0.44）
- Q: 当配置验证检测到潜在的 405 错误风险（如 `gpt-5-codex` 配置了
  `wire_api = "chat"`）时，系统应该采取什么行动？ →
  A: 询问用户是否自动修正（交互式确认）
- Q: 当用户确认自动修正配置后，修正后的配置应该如何保存？ →
  A: 使用 Codex 原生的 Profile 机制 - 在用户的 `~/.codex/config.toml`
  中创建/更新 `[profiles.codex-father-auto-fix]`
  段，将修正后的配置写入此 profile，codex-father 启动时使用
  `--profile codex-father-auto-fix` 激活
- Q: 当发现 codex-father 缺少 Codex 0.44 官方 MCP 方法定义时，应该如何处理？ →
  A: 全部实现（完整覆盖），确保 100% 协议兼容性，实现所有官方 MCP 方法
- Q: 在 0.42 环境下，当遇到 0.44 独有的配置选项时，系统应该如何处理？ →
  A: 显示警告提示用户切换配置 - 告知哪些配置不兼容，建议用户切换到兼容的配置或升级 Codex 版本，然后继续启动

---

## User Scenarios & Testing _(mandatory)_

### Primary User Story

作为 **codex-father 的使用者**，我希望能够无缝使用 **Codex 0.42 和 0.44**
的功能，包括：

- 执行非交互式命令（`codex exec`）
- 使用沙箱模式（`--sandbox`）
- 传递自定义参数（`--model`, `--approval-policy` 等）
- 通过 MCP 方法调用 Codex
- **在 0.42 环境下**：使用基础功能，0.44 独有功能被禁用并有清晰提示
- **在 0.44 环境下**：使用完整功能，包括推理配置、profiles 等新特性

以便我能够稳定地使用 codex-father 进行自动化任务，无论使用 0.42 还是 0.44 版本都不会遇到兼容性错误。

### Acceptance Scenarios

1. **Given** codex-father 已安装并配置正确，**When** 用户执行 `codex-father mcp`
   启动 MCP 服务器，**Then**
   服务器应该成功启动并能接收 MCP 请求，不出现 405 错误

2. **Given** MCP 服务器已启动，**When** 客户端调用 `newConversation`
   方法，**Then** 应该成功创建会话并返回 `conversationId`，不出现 HTTP 错误

3. **Given** 会话已创建，**When** 客户端调用 `sendUserMessage`
   发送消息，**Then** 应该成功发送并接收到 Codex 的响应事件流，不中断连接

4. **Given** Codex 0.44 支持新的命令参数（如 `--reasoning-effort`），**When**
   codex-father 传递这些参数给 Codex，**Then** 参数应该被正确识别和应用

5. **Given** Codex 0.44 引入了新的配置选项（如
   `model_reasoning_effort`），**When**
   用户在 codex-father 配置中使用这些选项，**Then** 配置应该被正确传递给 Codex

6. **Given** Codex 0.44 支持按提供方网络调优配置（`request_max_retries`,
   `stream_max_retries`），**When** 用户通过 codex-father 配置这些选项，**Then**
   配置应该被正确传递给 Codex（网络重试由 Codex 内部处理，非 codex-father 职责）

**版本兼容性场景**:

7. **Given** 用户安装了 Codex 0.42，**When**
   codex-father 启动并检测版本，**Then**
   应该识别为 0.42 版本并启用降级模式，0.44 独有功能被禁用

8. **Given** codex-father 运行在 0.42 降级模式，**When**
   用户尝试使用 0.44 独有功能（如 `--profile` 或
   `model_reasoning_effort`），**Then** 应该显示友好提示："该功能需要 Codex >=
   0.44，当前版本为 0.42.x，建议升级"

9. **Given** 用户的配置包含 0.44 独有选项且运行在 0.42 环境，**When**
   codex-father 启动，**Then**
   应该显示警告列出不兼容的配置项，建议用户切换配置或升级版本，然后自动过滤不兼容配置并继续启动

10. **Given** 用户安装了 Codex 0.44，**When**
    codex-father 启动并检测版本，**Then**
    应该识别为 0.44 版本并启用完整功能，所有 0.44 特性可用

11. **Given** 用户安装了 Codex 0.41 或更早版本，**When**
    codex-father 启动，**Then**
    应该显示错误："不支持的 Codex 版本 0.41.x，需要 >= 0.42"并拒绝启动

### Edge Cases

- **场景**: Codex
  API 返回 405 错误时，系统应该提供清晰的错误信息，说明是哪个 API 端点和方法导致的问题
- **场景**: 当用户使用了 Codex
  0.44 不支持的参数时，系统应该在启动前验证并给出警告
- **场景**: 当 Codex 版本低于 0.44 时，系统应该能够检测版本并给出兼容性提示
- **场景**: 当用户同时使用了冲突的参数组合时（如 `--approval-policy never` 和
  `--sandbox read-only`），系统应该给出合理的错误提示
- **场景（交互式修正）**: 当检测到 `gpt-5-codex` 配置了 `wire_api = "chat"`
  时，系统应询问：

  ```
  ⚠️ 配置验证警告：
  检测到可能导致 405 错误的配置：
    模型: gpt-5-codex
    当前 wire_api: "chat"
    建议 wire_api: "responses"（推理模型需要使用 responses API）

  是否自动修正配置？[Y/n]
  ```

  - 用户选择 Y/y/回车：自动修正并继续启动
  - 用户选择 N/n：保留原配置并继续启动（显示"保留原配置，如遇 405 错误请手动调整 wire_api"）

---

## Requirements _(mandatory)_

### Functional Requirements

#### FR-001: 命令参数完整性检查

系统 MUST 验证 codex-father 支持的所有命令参数与 Codex 0.44 官方文档一致，包括：

- 基础参数: `--model`, `--ask-for-approval`/`-a`, `--cd`/`-C`（现状需
  `--codex-config`/`--codex-arg` 间接传参）
- 沙箱参数: `--sandbox` (`read-only` | `workspace-write` |
  `danger-full-access`) 及互斥旗标
  `--full-auto`、`--dangerously-bypass-approvals-and-sandbox`
- I/O 与执行参数: `--image`, `--json`, `--include-plan-tool`,
  `--output-last-message`, `--skip-git-repo-check`, `--output-schema`, `--oss`,
  `--color` 等
- 配置参数: `-c`/`--config` (支持 `key=value` 格式)
- 会话恢复: `resume`, `resume --last`, `resume <SESSION_ID>` 及 `exec resume`
  系列
- MCP 相关: `mcp` 子命令

**验收标准**:

- 列出 Codex 0.44 支持的所有命令行参数并标注“直接支持/需 `--codex-arg`/需
  `--codex-config`/不支持”
- 对比 codex-father 当前实现，说明 0.42 降级策略及用户提示方案
- 生成差异报告（缺失、不兼容、需迁移、已废弃）并给出优先级

#### FR-002: 配置选项完整性检查

系统 MUST 验证 codex-father 支持的所有配置选项与 Codex 0.44 `config.toml`
规范一致，包括：

- 模型配置: `model`, `model_provider`, `model_providers` 以及推理相关键
- 审批策略: `approval_policy` (`untrusted` | `on-failure` | `on-request` |
  `never`)
- 配置档案: `profile`, `profiles.*`
- MCP 服务器: `mcp_servers` (TOML 格式) 与通知/历史 `notify`, `history`
- 网络调优: 顶级与 provider 级 `request_max_retries`, `stream_max_retries`,
  `stream_idle_timeout_ms`
- 推理与上下文: `model_reasoning_effort`, `model_reasoning_summary`,
  `model_supports_reasoning_summaries`, `model_verbosity`,
  `model_context_window`, `model_max_output_tokens`
- 其他: `sandbox_mode`, `shell_environment_policy.*`, `project_doc_max_bytes`,
  `[tui].notifications`, `disable_response_storage` 等

**验收标准**:

- 列出 Codex
  0.44 支持的所有配置选项，并标注“直接支持/需手工透传/0.42 忽略/0.42 报错”
- 对比 codex-father 当前实现，给出 0.42 降级策略（忽略、警告、禁止启动）
- 生成差异报告（缺失、类型不匹配、默认值不一致）并定义整改优先级

#### FR-003: MCP 方法完整性实现

系统 MUST 实现 Codex 0.44
MCP 协议规范中定义的所有方法，确保 100% 协议兼容性（基于用户澄清）。

**核心方法**（必须实现）:

- **会话管理**: `newConversation`, `resumeConversation`, `archiveConversation`,
  `listConversations`, `interruptConversation`
- **消息发送**: `sendUserMessage`, `sendUserTurn`
- **审批双向 RPC**: `applyPatchApproval`, `execCommandApproval`
- **认证相关**: `loginApiKey`, `loginChatGpt`, `getAuthStatus`, `userInfo`
- **配置管理**: `getUserSavedConfig`, `setDefaultModel`
- **工具方法**: `gitDiffToRemote`, `execOneOffCommand`, `getUserAgent`

**验收标准**（基于用户澄清 - 全部实现）:

- 对比 `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md`
  与 codex-father 实现
- 列出所有官方 MCP 方法（约 15+ 个方法）
- 实现所有缺失的方法，确保 100% 协议覆盖
- 验证所有 MCP 方法的请求/响应格式与官方文档一致
- 验证 `codex/event` 通知的格式和内容正确
- 添加完整的 MCP 协议兼容性测试套件

#### FR-004: Codex 配置正确性保障

系统 MUST 确保传递给 Codex 的所有配置参数正确，避免因配置错误导致 Codex 调用 OpenAI
API 失败（如 405 错误）。

**上下文**: ✅ 已确认 405 错误发生在 Codex 进程调用 OpenAI
API 时，因此重点是确保 codex-father 传递正确的配置。

**验收标准**（仅离线静态校验）:

- 验证 `model_provider` 配置的 `wire_api` 值存在且为有效值（`"chat"` 或
  `"responses"`）
- 检查 `base_url` 配置格式正确（有效的 URL 格式，https:// 或 http://）
- 静态校验 API Key 环境变量是否已设置且非空（不进行真实 API 请求验证）
- 检查配置文件的完整性（必需字段是否存在，类型是否正确）
- 验证模型与 `wire_api` 的兼容性（如 gpt-5-codex 应使用 `"responses"`）
- **交互式错误修正**（基于用户澄清）:
  - 当检测到可能导致 405 错误的配置组合时，询问用户是否自动修正
  - 显示具体的错误配置和建议的修正值
  - 等待用户确认（Y/n）后执行修正或继续使用原配置（用户自担风险）
  - 记录用户选择并在日志中说明配置决策来源（自动修正 vs 用户保留）
- **配置修正持久化机制**（基于用户澄清 - 使用 Codex 原生 Profile）:
  - 修正后的配置写入用户的 `~/.codex/config.toml`
    中的专用 profile：`[profiles.codex-father-auto-fix]`
  - codex-father 启动 Codex 时使用 `--profile codex-father-auto-fix`
    激活此 profile
  - 不影响用户的默认配置，其他项目使用 Codex 时不受影响
  - 用户可以在 `~/.codex/config.toml` 中直接查看、编辑或删除此 profile
  - Profile 中添加注释说明配置来源和修正原因（如
    `# Auto-fixed by codex-father on 2025-10-03: gpt-5-codex requires wire_api = "responses"`）
  - 提供清理路径允许用户删除此 profile（至少在文档中指引手动移除
    `[profiles.codex-father-auto-fix]` 段）
- 添加离线配置验证测试用例（无需真实 API 调用）

#### FR-005: Codex 0.44 确认新特性支持

系统 MUST 支持以下经过确认的 Codex 0.44 新特性（基于官方文档
`refer-research/openai-codex/docs/`）。

**📌 与 FR-007 的协同关系**:

- FR-005 定义 0.44 环境下的完整功能支持
- FR-007 定义 0.42 环境下的降级行为（禁用这些功能）
- 实现时需要版本检测逻辑，根据版本启用/禁用相应功能

**配置选项**（来源: `docs/config.md`）:

- `model_reasoning_effort`: low | medium | high（推理努力程度）
- `model_reasoning_summary`: auto | always | never（推理摘要策略）
- `model_supports_reasoning_summaries`: boolean（模型是否支持推理摘要）
- `model_verbosity`: enum（模型输出详细程度）
- `profiles`: 命名配置档案（允许 `--profile <name>` 切换配置集合）
- **网络调优移到 provider 级别**: `model_providers.<id>.request_max_retries`,
  `stream_max_retries`, `stream_idle_timeout_ms`（之前是顶级配置）

**命令行参数**（来源: `docs/getting-started.md`, `docs/advanced.md`）:

- `--full-auto`: 全自动模式标志
- `--profile <name>`: 指定配置档案
- `exec resume --last`: 恢复最近的非交互会话
- `exec resume <SESSION_ID>`: 恢复指定会话

**验收标准**（仅在 0.44 环境下）:

- codex-father 的配置传递机制支持以上所有配置选项（通过 `--config` 或 MCP
  `config` 参数）
- MCP `newConversation` 方法接受 `profile` 参数
- 文档中说明这些新特性的使用方法
- 添加测试用例验证配置正确传递给 Codex（不验证 Codex 内部行为）
- **在 0.42 环境下**：这些功能按 FR-007 定义的策略被禁用

#### FR-006: 错误处理增强

系统 MUST 提供清晰、可操作的错误信息，特别是：

- 当遇到 HTTP 错误（如 405）时，显示具体的 API 端点、方法和完整响应
- 当参数不兼容时，说明哪个参数不被支持以及建议的替代方案
- 当版本不匹配时，显示当前 Codex 版本和要求的最低版本

**验收标准**:

- 所有 HTTP 错误必须包含端点 URL 和方法
- 所有参数错误必须包含参数名称和有效值范围
- 版本检查必须在启动时执行

#### FR-007: 双版本降级兼容支持 (0.42 & 0.44)

系统 MUST 支持 Codex 0.42 和 0.44 两个版本，并提供智能降级机制。

**上下文**: ✅ 已确认需要支持 0.42 和 0.44 双版本降级兼容

**📌 与 FR-005 的协同关系**:

- FR-007 定义 0.42 环境下的降级行为（禁用 0.44 独有功能）
- FR-005 定义 0.44 环境下的完整功能支持
- CLI 层保留所有参数解析，但在 0.42 环境下检测到 0.44 独有参数时报错并引导用户
- 配置文件层在 0.42 环境下自动过滤 0.44 独有配置，显示警告但继续启动
- MCP 调用层在 0.42 环境下返回明确的错误响应

**版本检测机制**:

- 在启动时检测 Codex 版本（通过 `codex --version` 或等效方法）
- **检测失败处理**: 如果 `codex --version`
  执行失败（未安装、路径错误等），立即报错并退出，显示：
  - "无法检测 Codex 版本，请确认 Codex 已安装且在 PATH 中"
  - "codex-father 支持 Codex 0.42 或 0.44 版本"
- 解析版本号（如 `0.42.0`, `0.44.0`）
- 根据版本启用/禁用相应功能

**降级策略** (当检测到 0.42 时):

- **禁用 0.44 独有功能** (基于用户澄清 - 报错提示引导用户):
  - `model_reasoning_effort`, `model_reasoning_summary`,
    `model_supports_reasoning_summaries`
  - `model_verbosity`
  - `profiles` 配置档案
  - `--full-auto` 标志
  - `exec resume` 命令
  - 按 provider 级别的网络调优配置（`model_providers.<id>.request_max_retries`
    等）

- **禁用行为详细说明**:
  - **CLI 参数层**：保留参数解析，但在检测到 0.44 独有参数时，显示错误并退出：

    ```
    ❌ 错误：不支持的参数（Codex 0.42）
    参数 '--full-auto' 需要 Codex >= 0.44
    当前版本：0.42.5

    建议：
      1. 升级到 Codex 0.44：npm install -g @openai/codex@latest
      2. 或移除 '--full-auto' 参数
    ```

  - **配置文件层**：检测到 0.44 独有配置时，显示警告但继续启动（过滤配置）：

    ```
    ⚠️ 配置兼容性警告（Codex 0.42.5）:
    检测到以下 0.44 独有配置将被忽略：
      - model_reasoning_effort: "medium"
      - model_providers.openai.request_max_retries: 4 (0.42 不支持 provider 级别配置)

    建议：
      1. 升级到 Codex 0.44 以使用完整功能
      2. 或移除上述配置项以消除此警告

    继续启动...
    ```

  - **MCP 调用层**：当 MCP 参数包含 0.44 独有配置时，返回错误响应：
    ```json
    {
      "error": {
        "code": -32602,
        "message": "Invalid params: 'profile' requires Codex >= 0.44 (current: 0.42.5)"
      }
    }
    ```

- **保留 0.42 功能**:
  - 基础 MCP 方法（`newConversation`, `sendUserMessage`）
  - 基础配置选项（`model`, `model_provider`, `approval_policy`, `sandbox`）
  - 基础命令行参数（`--model`, `--ask-for-approval`, `--sandbox`, `--cd`）
  - 顶级网络调优配置（0.42 仍支持，但已弃用，会显示迁移提示）

- **版本信息显示** (基于用户澄清 - 只打印 codex 版本):
  - 启动时显示检测到的 Codex 版本：
    ```
    ✓ Codex 版本检测：0.42.5
    ✓ codex-father 已启用 0.42 兼容模式
    ```
  - 不需要额外的日志策略，只打印版本信息即可

**验收标准**:

- 成功检测并区分 0.42 和 0.44 版本
- 在 0.42 环境下，0.44 独有功能被正确禁用且有清晰提示
- 在 0.44 环境下，所有功能正常可用
- 提供版本兼容性文档说明
- 添加版本检测和降级的单元测试
- 当检测到 Codex < 0.42 时，显示错误并拒绝启动

### Key Entities

- **命令参数 (Command
  Parameters)**: 用户通过 CLI 传递的参数，包括标志（flags）和值，需要验证完整性和正确性
- **配置项 (Configuration Options)**: `config.toml`
  中的配置选项，需要验证类型、默认值和有效性
- **Codex Profile (Auto-fix Profile)**: `~/.codex/config.toml` 中的
  `[profiles.codex-father-auto-fix]` 段，存储自动修正的配置项，通过 `--profile`
  参数激活，包含修正时间戳和原因注释
- **MCP 方法 (MCP Methods)**: MCP 方法及其参数/响应结构，需要验证协议兼容性
- **API 端点 (API Endpoints)**: HTTP 请求的目标 URL 和方法，需要修复 405 错误
- **事件流 (Event Stream)**: Codex 发出的实时事件通知，需要正确解析和处理
- **错误响应 (Error Responses)**:
  HTTP 和 JSON-RPC 错误的结构和内容，需要提供清晰的用户反馈

---

## Review & Acceptance Checklist

### Content Quality

- [x] No implementation details (languages, frameworks, APIs) -
      ✅ 聚焦于功能需求
- [x] Focused on user value and business needs -
      ✅ 明确用户痛点（405 错误、兼容性）
- [x] Written for non-technical stakeholders -
      ⚠️ 包含部分技术术语（MCP、HTTP），但有清晰解释
- [x] All mandatory sections completed - ✅ 所有必需章节已完成

### Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain - ✅ 所有问题已澄清
- [x] Requirements are testable and unambiguous - ✅ 每个需求都有明确的验收标准
- [x] Success criteria are measurable - ✅ 所有验收标准可量化验证
- [x] Scope is clearly bounded - ✅ 限定在 **Codex
      0.42 和 0.44 双版本兼容性**范围内
- [x] Dependencies and assumptions identified - ✅ 明确依赖官方文档和当前实现

**已澄清问题** (2025-10-03):

1. ✅ 405 错误发生在 Codex 调用 OpenAI API 时（非 codex-father 内部）
2. ✅ (UPDATED) 需要支持 Codex 0.42 和 0.44 双版本降级兼容

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked and clarified (2 处已解决)
- [x] User scenarios defined
- [x] Requirements generated (7 项功能需求)
- [x] Entities identified (6 个关键实体)
- [x] Review checklist passed (all requirements clear)
- [x] User clarifications received (2025-10-03)

**状态**: ✅ SUCCESS - 规范已完成并已澄清，可以进入规划阶段

---

## 附录：参数-版本兼容性映射表

### 说明

**📋 完整映射表文档**:
[parameter-version-mapping.md](./parameter-version-mapping.md)

本附录提供了完整的参数-版本兼容性映射表，包含：

- ✅ 所有 MCP 方法参数（34+ 参数）
- ✅ 所有 CLI 参数（9 个）
- ✅ 所有配置选项（16+ 个）
- ✅ **每个参数都有准确的数据来源**（文件路径:行号）
- ✅ 快速排查指南和使用场景

**主要用途**：

- 快速判断参数是否在当前 Codex 版本支持
- 排查版本兼容性问题
- 维护和更新参数列表
- 追溯参数定义的官方文档来源

**图例**:

- ✅ 支持
- ❌ 不支持
- ⚠️ 部分支持/已弃用

**关键特性**：

- 每个参数都标注了准确的数据来源（如
  `[MCP接口文档:54](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L54)`）
- 包含版本统计和不兼容行为分类
- 提供快速排查指南和维护步骤

**请查看完整映射表文档获取详细信息** →
[parameter-version-mapping.md](./parameter-version-mapping.md)

---

## 附录：已知差异摘要（基于初步分析）

### 0. Codex 版本差异对比 (0.42 vs 0.44)

**证据来源**: 官方文档 `refer-research/openai-codex/docs/` 和版本变更记录

#### 新增功能 (0.44 独有)

| 功能类别     | 功能名称                             | 0.42 | 0.44 | 描述                                          |
| ------------ | ------------------------------------ | ---- | ---- | --------------------------------------------- |
| **推理配置** | `model_reasoning_effort`             | ❌   | ✅   | 推理努力程度 (low/medium/high)                |
| **推理配置** | `model_reasoning_summary`            | ❌   | ✅   | 推理摘要策略 (auto/always/never)              |
| **推理配置** | `model_supports_reasoning_summaries` | ❌   | ✅   | 模型是否支持推理摘要                          |
| **输出配置** | `model_verbosity`                    | ❌   | ✅   | 模型输出详细程度                              |
| **配置管理** | `profiles`                           | ❌   | ✅   | 命名配置档案（允许 `--profile` 切换）         |
| **网络调优** | Provider 级别网络配置                | ❌   | ✅   | `model_providers.<id>.request_max_retries` 等 |
| **CLI 参数** | `--full-auto`                        | ❌   | ✅   | 全自动模式标志                                |
| **CLI 参数** | `--profile <name>`                   | ❌   | ✅   | 指定配置档案                                  |
| **CLI 命令** | `exec resume --last`                 | ❌   | ✅   | 恢复最近的非交互会话                          |
| **CLI 命令** | `exec resume <SESSION_ID>`           | ❌   | ✅   | 恢复指定会话                                  |

#### 配置变更 (0.44 重构)

| 配置项                   | 0.42 位置 | 0.44 位置                                     | 影响               |
| ------------------------ | --------- | --------------------------------------------- | ------------------ |
| `request_max_retries`    | 顶级配置  | `model_providers.<id>.request_max_retries`    | 移到 provider 级别 |
| `stream_max_retries`     | 顶级配置  | `model_providers.<id>.stream_max_retries`     | 移到 provider 级别 |
| `stream_idle_timeout_ms` | 顶级配置  | `model_providers.<id>.stream_idle_timeout_ms` | 移到 provider 级别 |

#### 共享功能 (0.42 & 0.44 都支持)

| 功能类别     | 功能名称                                             | 描述                           |
| ------------ | ---------------------------------------------------- | ------------------------------ |
| **基础配置** | `model`, `model_provider`, `model_providers`         | 模型和提供方配置               |
| **基础配置** | `approval_policy`, `sandbox_mode`                    | 审批策略和沙箱模式             |
| **基础配置** | `mcp_servers`                                        | MCP 服务器配置                 |
| **CLI 参数** | `--model`, `--ask-for-approval`, `--sandbox`, `--cd` | 基础命令行参数                 |
| **CLI 命令** | `codex`, `codex exec`, `codex resume`                | 基础命令（不含 `exec resume`） |
| **MCP 方法** | `newConversation`, `sendUserMessage`                 | 核心 MCP 方法                  |

#### 降级兼容策略

**在 0.42 环境下**:

- ✅ **可用**: 所有共享功能正常工作
- ❌ **禁用**: 0.44 新增功能，尝试使用时显示友好提示
- ⚠️ **配置转换**: 如果用户配置了 provider 级别网络调优，自动忽略（0.42 不支持）

**在 0.44 环境下**:

- ✅ **完整功能**: 所有功能可用
- ⚠️ **配置兼容**: 如果使用了旧的顶级网络调优配置，显示弃用警告并建议迁移

---

### 1. 命令参数差异

| 参数/命令                                                    | Codex 0.44                    | codex-father (0.42 兼容层)                                   | 状态                    |
| ------------------------------------------------------------ | ----------------------------- | ------------------------------------------------------------ | ----------------------- | ---------------- |
| `--model`, `-m`                                              | ✅ 原生解析（TUI/exec）       | ⚠️ 需通过 `--codex-config model=<name>` 或配置文件间接传参   | 需补全旗标透传/自动降级 |
| `--image`, `-i`                                              | ✅ 支持多图片输入             | ❌ 未封装；需用户手动 `--codex-arg`                          | 必须新增封装            |
| `--profile`                                                  | ✅ 支持 profile 切换          | ⚠️ 直接透传导致 Codex 0.42 返回 `unknown argument --profile` | 需版本检测与友好提示    |
| `--full-auto` / `--dangerously-bypass-approvals-and-sandbox` | ✅ 已实现互斥校验             | ⚠️ 传入 0.42 会报未知参数；wrapper 尚未劝退                  | 需降级策略              |
| `exec resume` 系列                                           | ✅ `codex exec resume [--last | <id>]`                                                       | ❌ 无相应封装           | 需要新增命令桥接 |

### 2. 配置选项差异

| 配置项                                             | Codex 0.44          | codex-father (0.42 兼容层)                 | 状态            |
| -------------------------------------------------- | ------------------- | ------------------------------------------ | --------------- |
| `model_reasoning_effort`                           | ✅ 新增推理强度     | ⚠️ 透传需 `--codex-config`; 0.42 会忽略    | 需版本检测/提示 |
| `model_reasoning_summary`                          | ✅ 新增推理摘要策略 | ⚠️ 同上                                    | 同上            |
| `model_supports_reasoning_summaries`               | ✅ 支持             | ⚠️ 0.42 忽略                               | 需提示          |
| `model_verbosity`                                  | ✅ 支持             | ⚠️ 0.42 忽略                               | 需提示          |
| `profiles.*`                                       | ✅ 支持 profile 集  | ⚠️ 透传但 0.42 报错                        | 需降级          |
| `model_providers.<id>.request_max_retries` 等      | ✅ provider 级调优  | ⚠️ 当前 wrapper 仍写入顶级键，需同时写警告 | 需迁移方案      |
| `shell_environment_policy.*`                       | ✅ 精细控制 env     | ⚠️ 未映射；需透传/验证                     | 待补            |
| `model_context_window` / `model_max_output_tokens` | ✅ 可控上下文       | ⚠️ 仅透传；0.42 未实现                     | 需兼容策略      |
| `project_doc_max_bytes`                            | ✅ 文档截断         | ⚠️ 未封装提醒                              | 待补            |
| `[tui].notifications`                              | ✅ 桌面通知控制     | ⚠️ 仅交互式；MCP/exec 未暴露               | 需文档说明      |

### 3. MCP 方法差异（基于官方文档对比）

**证据来源**: `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md`

**实施策略**（基于用户澄清）: **全部实现（完整覆盖）**，确保 100% 协议兼容性

| 方法                    | Codex 0.44 MCP 方法 | codex-father 当前实现 | 实施要求     | 优先级 |
| ----------------------- | ------------------- | --------------------- | ------------ | ------ |
| `newConversation`       | ✅ 已记录           | ✅ 已实现             | 已完成       | 核心   |
| `sendUserMessage`       | ✅ 已记录           | ✅ 已实现             | 已完成       | 核心   |
| `sendUserTurn`          | ✅ 已记录           | ❓ 待验证             | **必须实现** | 高     |
| `interruptConversation` | ✅ 已记录           | ❓ 待验证             | **必须实现** | 中     |
| `resumeConversation`    | ✅ 已记录           | ❓ 待验证             | **必须实现** | 中     |
| `archiveConversation`   | ✅ 已记录           | ❓ 待验证             | **必须实现** | 低     |
| `listConversations`     | ✅ 已记录           | ❓ 待验证             | **必须实现** | 低     |
| `getUserSavedConfig`    | ✅ 已记录           | ❓ 待验证             | **必须实现** | 低     |
| `setDefaultModel`       | ✅ 已记录           | ❓ 待验证             | **必须实现** | 低     |
| `getUserAgent`          | ✅ 已记录           | ❓ 待验证             | **必须实现** | 低     |
| `userInfo`              | ✅ 已记录           | ❓ 待验证             | **必须实现** | 低     |
| `gitDiffToRemote`       | ✅ 已记录           | ❓ 待验证             | **必须实现** | 低     |
| `execOneOffCommand`     | ✅ 已记录           | ❓ 待验证             | **必须实现** | 低     |
| Auth 相关方法           | ✅ 已记录           | ❓ 待验证             | **必须实现** | 中     |

**说明**:

- "已完成"：已验证实现（`newConversation`, `sendUserMessage`）
- "待验证"：需检查 `core/mcp/codex-client.ts` 确定当前状态
- "必须实现"：根据用户澄清，所有缺失方法都必须实现，确保 100% 协议兼容性
- **下一步**:
  1. 执行代码审查，确认哪些方法已实现
  2. 实现所有缺失的方法
  3. 添加完整的 MCP 协议兼容性测试

### 4. 405 错误诊断与修复策略

**错误上下文**: ✅ 已确认错误发生在 `codex exec` 执行时，Codex 进程调用 OpenAI
API 的过程中

**可能原因**（按优先级排序）:

1. **模型提供方配置错误** (最可能):
   - `wire_api` 值不正确（应为 `"chat"` 或 `"responses"`，取决于模型）
   - `base_url` 指向了错误的端点（如使用了旧的 API 地址）
   - **典型案例**: `gpt-5-codex` 等推理模型需要使用
     `wire_api = "responses"`，而不是 `"chat"`

2. **认证问题**:
   - API Key 未配置、无效或过期
   - API Key 对应的账户权限不足（如未订阅 ChatGPT Plus）
   - 环境变量 `OPENAI_API_KEY` 或 `AZURE_OPENAI_API_KEY` 未正确设置

3. **网络/代理问题**:
   - 企业代理重定向请求到内部服务器
   - DNS 解析错误导致请求到达错误的 IP
   - 防火墙或 CDN 拦截特定 HTTP 方法

**修复策略**:

1. **配置验证** (codex-father 职责):
   - 在启动前验证 `model_provider` 配置的完整性
   - 检查 `wire_api` 值与所选模型的兼容性
   - 提供配置模板和示例（如 Azure、Ollama、Mistral）

2. **错误诊断增强** (codex-father 职责):
   - 捕获 Codex 输出中的 HTTP 错误并重新格式化
   - 显示完整的错误上下文（请求的模型、provider、base_url）
   - 提供诊断建议（如"检查 wire_api 配置"）

3. **用户指导**:
   - 在文档中说明常见的 405 错误原因和解决方法
   - 提供不同模型提供方的配置示例
   - 添加故障排除指南

**下一步行动**: 实现 FR-004（配置正确性保障）和 FR-006（错误处理增强）以预防和诊断 405 错误。

### 5. 推荐配置（基于用户澄清）

**模型选择**: 使用 `gpt-5-codex`（不使用 o3） **推理努力程度**: `medium` 或
`high`（根据任务复杂度选择） **Wire API**: `responses`（推理模型的正确 API）

**示例配置** (`~/.codex/config.toml`):

```toml
model = "gpt-5-codex"
model_reasoning_effort = "medium"  # 或 "high"

[model_providers.openai]
name = "OpenAI"
base_url = "https://api.openai.com/v1"
env_key = "OPENAI_API_KEY"
wire_api = "responses"  # 关键：gpt-5-codex 需要 responses API
request_max_retries = 4
stream_max_retries = 5
stream_idle_timeout_ms = 300000
```

**codex-father 传递配置示例**:

```bash
# MCP 调用
newConversation({
  "model": "gpt-5-codex",
  "config": {
    "model_reasoning_effort": "medium",
    "model_provider": "openai"
  }
})
```

---
