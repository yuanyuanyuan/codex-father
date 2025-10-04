# Research: Codex 0.44 兼容性检查与修复

**Feature**: 008-ultrathink-codex-0 **Date**: 2025-10-03 **Phase**: 0 -
Technical Research

---

## 概述

本文档记录实现 Codex
0.42 和 0.44 双版本兼容性支持的关键技术决策及其理由。所有决策均基于用户需求澄清、官方文档分析和项目宪章约束。

---

## 1. 版本检测机制

### Decision

使用 Codex 原生 `codex --version` 命令进行版本检测，并在首次检测后缓存结果。

### Rationale

- **KISS 原则**：使用 Codex 原生命令而非解析配置文件或探测 API
- **可靠性**：Codex 官方命令保证准确性，避免版本号格式变化导致的解析错误
- **性能优化**：缓存机制确保版本检测 < 1s 要求（首次执行 < 1s，后续调用 <
  100ms）
- **用户澄清**：检测失败时立即报错并提示用户确认 Codex 安装

### Alternatives Considered

1. **读取 Codex 包的 package.json**
   - ❌ 拒绝理由：依赖文件路径假设，跨平台兼容性差，违反 KISS 原则
2. **调用 Codex API 检测响应格式**
   - ❌ 拒绝理由：需要网络请求，违反"离线配置验证"约束，增加启动延迟
3. **手动配置版本号**
   - ❌ 拒绝理由：增加用户负担，容易配置错误，违反"用户体验一致性"宪章

### Implementation Details

- 使用 `child_process.execFile('codex', ['--version'])` 防止命令注入（安全原则）
- 解析输出格式：`Codex CLI v0.44.0` → 提取语义化版本号 `0.44.0`
- 缓存策略：内存单例对象 `{ version: string, detectedAt: number }` (< 1KB)
- 失败处理：显示错误 `"无法检测 Codex 版本，请确认 Codex 已安装且在 PATH 中"` +
  `"codex-father 支持 Codex 0.42 或 0.44 版本"`

---

## 2. 配置修正持久化机制

### Decision

使用 Codex 原生 Profile 机制（`~/.codex/config.toml` 中的
`[profiles.codex-father-auto-fix]` 段），而非自定义 overlay 文件。

### Rationale

- **KISS 原则**：利用 Codex 原生功能，无需实现自定义配置合并逻辑
- **用户体验一致性**：所有配置集中在用户熟悉的 `config.toml`
  文件中，符合 Codex 生态规范
- **用户澄清**：用户确认使用 Profile 机制，通过
  `--profile codex-father-auto-fix` 激活
- **可维护性**：用户可直接在 `config.toml` 中查看、编辑或删除 auto-fix profile

### Alternatives Considered

1. **创建独立的 `.codex-father-override.toml` 文件**
   - ❌ 拒绝理由：增加配置复杂度，需实现配置合并逻辑，违反 KISS 原则
   - ❌ 用户反馈：不需要自定义文件，使用 Codex 原生机制即可
2. **直接修改用户的默认配置**
   - ❌ 拒绝理由：侵入性强，影响用户其他项目使用 Codex，违反"安全与可靠性"宪章
3. **使用环境变量覆盖配置**
   - ❌ 拒绝理由：环境变量优先级不明确，难以持久化，用户难以查看和管理

### Implementation Details

- 配置文件路径：`~/.codex/config.toml`（跨平台路径解析：`os.homedir() + '/.codex/config.toml'`）
- Profile 段格式：
  ```toml
  [profiles.codex-father-auto-fix]
  # Auto-fixed by codex-father on 2025-10-03: gpt-5-codex requires wire_api = "responses"
  model = "gpt-5-codex"
  [profiles.codex-father-auto-fix.model_providers.openai]
  wire_api = "responses"
  ```
- 激活方式：codex-father 启动 Codex 时使用 `--profile codex-father-auto-fix`
  参数
- 清理命令：提供
  `codex-father 删除 auto-fix profile (手动移除 `[profiles.codex-father-auto-fix]`)`
  删除 auto-fix profile（可选功能，非 MVP 阶段）

---

## 3. 三层降级策略

### Decision

实现 CLI、配置文件、MCP 三层降级策略，分别处理 0.42 环境下的不兼容参数/配置。

### Rationale

- **用户澄清**：明确了三层的不同行为（CLI 报错、配置警告、MCP 错误响应）
- **用户体验一致性**：不同层级提供不同粒度的反馈，符合用户操作习惯
- **DRY 原则**：使用参数-版本映射表统一管理兼容性规则，避免重复判断逻辑

### Alternatives Considered

1. **统一报错策略（所有层级都报错并退出）**
   - ❌ 拒绝理由：配置文件层过于严格，阻止用户在 0.42 环境下使用基础功能
2. **完全静默降级（自动过滤不兼容功能，不提示）**
   - ❌ 拒绝理由：用户无法感知功能被禁用，可能导致困惑和调试困难
3. **动态降级（运行时检测并适配）**
   - ❌ 拒绝理由：增加运行时复杂度，违反"启动时间 < 1s"性能要求

### Implementation Details

#### 3.1 CLI 层降级（报错并退出）

**触发条件**：用户通过命令行传递 0.44 独有参数（如 `--full-auto`,
`--profile`）且运行在 0.42 环境

**行为**：

```bash
❌ 错误：不支持的参数（Codex 0.42）
参数 '--full-auto' 需要 Codex >= 0.44
当前版本：0.42.5

建议：
  1. 升级到 Codex 0.44：npm install -g @openai/codex@latest
  2. 或移除 '--full-auto' 参数
```

**实现**：

- 参数解析时检查参数映射表中的 `minVersion` 字段
- 如果 `currentVersion < minVersion`，显示错误并 `process.exit(1)`

#### 3.2 配置文件层降级（警告但继续）

**触发条件**：用户配置包含 0.44 独有选项（如 `model_reasoning_effort`,
`profiles`）且运行在 0.42 环境

**行为**：

```bash
⚠️ 配置兼容性警告（Codex 0.42.5）:
检测到以下 0.44 独有配置将被忽略：
  - model_reasoning_effort: "medium"
  - model_providers.openai.request_max_retries: 4 (0.42 不支持 provider 级别配置)

建议：
  1. 升级到 Codex 0.44 以使用完整功能
  2. 或移除上述配置项以消除此警告

继续启动...
```

**实现**：

- 配置加载时检查配置映射表中的 `minVersion` 字段
- 自动过滤不兼容配置项（不传递给 Codex）
- 显示警告但不阻止启动

#### 3.3 MCP 层降级（JSON-RPC 错误响应）

**触发条件**：MCP 客户端调用包含 0.44 独有参数（如 `newConversation` 的
`profile` 参数）且运行在 0.42 环境

**行为**：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Invalid params: 'profile' requires Codex >= 0.44 (current: 0.42.5)"
  }
}
```

**实现**：

- MCP 方法处理前验证参数兼容性
- 返回标准 JSON-RPC 错误响应（code: -32602 Invalid params）

---

## 4. MCP 协议 100% 覆盖率

### Decision

实现 Codex 0.44 官方 MCP 方法定义的所有 15+ 方法，确保 100% 协议兼容性。

### Rationale

- **用户澄清**：明确要求"全部实现（完整覆盖）"
- **宪章要求**：协议与架构决策 - "MCP 协议优先"
- **避免潜在问题**：部分实现可能导致 MCP 客户端调用失败或行为不一致

### Alternatives Considered

1. **仅实现常用方法（如 newConversation, sendUserMessage）**
   - ❌ 拒绝理由：用户明确要求 100% 覆盖
   - ❌ 风险：缺失方法可能导致客户端功能受限
2. **实现时返回 "Not Implemented" 错误**
   - ❌ 拒绝理由：违反协议兼容性要求，客户端无法正常工作

### Implementation Details

**必须实现的方法**（基于
`refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md`）：

**会话管理**：

- `newConversation` ✅ 已实现
- `sendUserMessage` ✅ 已实现
- `sendUserTurn` ❓ 待实现
- `interruptConversation` ❓ 待实现
- `resumeConversation` ❓ 待实现
- `archiveConversation` ❓ 待实现
- `listConversations` ❓ 待实现

**审批双向 RPC**：

- `applyPatchApproval` ❓ 待实现
- `execCommandApproval` ❓ 待实现

**认证相关**：

- `loginApiKey` ❓ 待实现
- `loginChatGpt` ❓ 待实现
- `getAuthStatus` ❓ 待实现
- `userInfo` ❓ 待实现

**配置管理**：

- `getUserSavedConfig` ❓ 待实现
- `setDefaultModel` ❓ 待实现

**工具方法**：

- `gitDiffToRemote` ❓ 待实现
- `execOneOffCommand` ❓ 待实现
- `getUserAgent` ❓ 待实现

**实现策略**：

- 对于会话管理方法：直接桥接到 Codex JSON-RPC 协议
- 对于审批方法：集成现有 `core/approval/` 模块
- 对于认证方法：读取 Codex 配置或调用 Codex CLI
- 对于配置方法：操作 `~/.codex/config.toml` 文件

---

## 5. 配置验证方式

### Decision

实现离线静态配置校验，不进行真实 API 请求。

### Rationale

- **用户澄清**：明确"离线配置验证（不进行真实 API 调用）"
- **性能要求**：配置验证 < 2s，网络请求会增加不确定性延迟
- **安全原则**：避免在验证阶段暴露 API Key 或发起未授权请求
- **YAGNI 原则**：静态校验已足够发现配置错误，无需真实 API 调用

### Alternatives Considered

1. **真实 API 调用验证（如 HEAD 请求）**
   - ❌ 拒绝理由：违反用户澄清的"离线验证"要求
   - ❌ 性能影响：网络延迟可能超过 2s 限制
   - ❌ 安全风险：可能泄露 API Key 或触发速率限制
2. **异步后台验证**
   - ❌ 拒绝理由：增加实现复杂度，违反 KISS 原则

### Implementation Details

**静态校验项**：

1. **wire_api 存在性**：检查 `model_providers.<id>.wire_api` 字段存在且为
   `"chat"` 或 `"responses"`
2. **base_url 格式**：使用 Zod Schema 验证 URL 格式（`https://...` 或
   `http://...`）
3. **API Key 环境变量**：检查 `env_key` 指定的环境变量是否设置且非空（如
   `process.env.OPENAI_API_KEY`）
4. **模型与 wire_api 兼容性**：使用映射表验证（如 `gpt-5-codex` →
   `"responses"`）
5. **必需字段完整性**：验证 `model`, `model_provider` 等必需字段存在

**验证流程**：

```typescript
// 示例伪代码
async function validateConfig(config: CodexConfig): Promise<ValidationResult> {
  const errors: string[] = [];

  // 1. Zod Schema 验证
  const result = CodexConfigSchema.safeParse(config);
  if (!result.success) {
    errors.push(...result.error.issues.map((i) => i.message));
  }

  // 2. 模型与 wire_api 兼容性
  const provider = config.model_providers?.[config.model_provider];
  if (config.model === 'gpt-5-codex' && provider?.wire_api !== 'responses') {
    errors.push('gpt-5-codex requires wire_api = "responses"');
  }

  // 3. API Key 存在性（不验证值）
  if (provider?.env_key && !process.env[provider.env_key]) {
    errors.push(`Environment variable ${provider.env_key} is not set`);
  }

  return { valid: errors.length === 0, errors };
}
```

**性能保证**：

- 所有校验均为内存操作，无 I/O
- Zod 解析 < 50ms
- 映射表查询 O(1)
- 总验证时间 < 200ms（远低于 2s 要求）

---

## 6. 模型与 wire_api 映射

### Decision

维护模型到 `wire_api` 类型的映射表，用于配置验证和自动修正。

### Rationale

- **405 错误根因**：spec.md 分析确认 `gpt-5-codex` 等推理模型使用 `"chat"`
  API 会导致 405 错误，必须使用 `"responses"` API
- **DRY 原则**：集中管理映射规则，避免在验证、修正、文档中重复硬编码
- **可维护性**：新增模型时只需更新映射表，无需修改业务逻辑

### Alternatives Considered

1. **硬编码判断逻辑（如 `if (model.includes('codex'))`）**
   - ❌ 拒绝理由：脆弱，难以维护，违反 DRY 原则
2. **通过 API 调用探测正确的 wire_api**
   - ❌ 拒绝理由：违反"离线验证"约束，增加启动延迟

### Implementation Details

**映射表结构**（TypeScript）：

```typescript
// src/lib/model-wire-api-mapping.ts
export const MODEL_WIRE_API_MAP: Record<string, 'chat' | 'responses'> = {
  // OpenAI 推理模型
  'gpt-5-codex': 'responses',
  'gpt-5-codex-mini': 'responses',

  // OpenAI 聊天模型
  'gpt-4': 'chat',
  'gpt-4-turbo': 'chat',
  'gpt-3.5-turbo': 'chat',

  // 其他提供方（示例）
  'claude-3-opus': 'chat',
  'gemini-pro': 'chat',
};

export function getRecommendedWireApi(
  model: string
): 'chat' | 'responses' | null {
  return MODEL_WIRE_API_MAP[model] || null;
}
```

**使用场景**：

1. **配置验证**：检查用户配置的 `wire_api` 是否与模型匹配
2. **交互式修正**：显示建议的 `wire_api` 值
3. **文档生成**：自动生成模型配置示例

---

## 7. 性能优化策略

### Decision

实现版本检测缓存、配置静态验证和 MCP 快速响应机制。

### Rationale

- **宪章要求**：CLI 启动 < 1s，MCP 响应 < 500ms
- **用户体验**：避免重复执行耗时操作（如版本检测）

### Implementation Details

#### 7.1 版本检测缓存

- **策略**：内存单例，进程生命周期内有效
- **数据结构**：`{ version: string, detectedAt: number }`
- **失效条件**：进程重启（无需主动失效，Codex 版本变化需重启 codex-father）
- **性能**：首次检测 < 1s，后续调用 < 100ms（纯内存读取）

#### 7.2 配置静态验证

- **策略**：无 I/O，纯内存计算
- **优化点**：
  - Zod Schema 预编译（避免重复解析）
  - 映射表使用 `Record<string, T>` 而非 `Map`（O(1) 查询）
- **性能**：< 200ms（远低于 2s 要求）

#### 7.3 MCP 快速响应

- **策略**：立即返回 JSON-RPC 响应，长时间操作通过 `codex/event` 通知推送进度
- **适用场景**：
  - `newConversation`：立即返回 `conversationId`，Codex 启动完成后发送 `ready`
    事件
  - `sendUserMessage`：立即返回确认，Codex 响应通过 `message` 事件流式推送
- **性能保证**：所有 MCP 方法响应 < 500ms

---

## 8. 错误处理增强

### Decision

实现结构化错误消息，包含完整上下文、具体建议和操作指引。

### Rationale

- **用户体验一致性**：宪章要求"清晰的错误消息"
- **调试效率**：丰富的错误信息减少用户排查时间
- **可操作性**：每个错误都附带具体的解决方案

### Implementation Details

**错误消息结构**（基于 spec.md FR-006）：

1. **HTTP 错误**：包含端点 URL、方法、完整响应

   ```
   ❌ Codex API 错误 (405 Method Not Allowed)
   端点: https://api.openai.com/v1/chat/completions
   方法: POST
   模型: gpt-5-codex
   wire_api: chat (当前配置)

   建议: gpt-5-codex 需要使用 wire_api = "responses"
   修复: 手动编辑 `~/.codex/config.toml`，将 `model_providers.openai.wire_api` 调整为 `responses`
   ```

2. **参数错误**：包含参数名称、有效值范围、当前值

   ```
   ❌ 无效参数: --sandbox
   当前值: "workspace-writable"
   有效值: "read-only" | "workspace-write" | "danger-full-access"

   建议: 使用 --sandbox workspace-write
   ```

3. **版本错误**：包含当前版本、要求版本、升级命令

   ```
   ❌ 不支持的 Codex 版本
   当前版本: 0.41.2
   要求版本: >= 0.42

   升级: npm install -g @openai/codex@latest
   ```

**实现策略**：

- 使用 TypeScript 类型系统定义错误结构（Zod Schema）
- 统一错误格式化函数：`formatError(error: ErrorContext): string`
- 日志分级：ERROR（用户可见）、DEBUG（开发调试）

---

## 9. 参数-版本映射表维护

### Decision

维护独立的参数-版本兼容性映射表文档（`parameter-version-mapping.md`），包含数据来源追溯。

### Rationale

- **用户澄清**：明确要求"要维护起来方便管理和排查"
- **可维护性**：集中管理所有参数的版本信息，便于更新和扩展
- **可追溯性**：每个参数标注数据来源（文件路径:行号），便于验证准确性

### Implementation Details

**映射表格式**（已创建 `parameter-version-mapping.md`）：

```markdown
| 参数名    | 类型   | 0.42 | 0.44 | 默认值 | 必需 | 不兼容行为（0.42）                                           | 数据来源                                                                               |
| --------- | ------ | ---- | ---- | ------ | ---- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `profile` | string | ❌   | ✅   | -      | 否   | 返回错误：`Invalid params: 'profile' requires Codex >= 0.44` | [MCP接口文档:55](refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md#L55) |
```

**维护策略**：

- 新增参数：在映射表添加条目，更新数据来源链接
- 版本更新：修改对应行的版本支持列（0.42/0.44）
- 定期同步：与官方文档对比，确保准确性

**代码集成**：

- 映射表数据导出为 TypeScript 常量（自动化脚本生成）
- 业务代码导入映射表进行版本检查

---

## 10. 技术栈确认

### Decision

TypeScript 5.x + Node.js >= 18 + 现有依赖（@modelcontextprotocol/sdk, inquirer,
zod, uuid, vitest）。

### Rationale

- **项目一致性**：与 codex-father MVP1 技术栈保持一致（见 CLAUDE.md）
- **依赖最小化**：所有功能可用现有依赖实现，无需新增第三方库
- **宪章遵循**：YAGNI 原则 - 仅使用当前明确需要的依赖

### Implementation Details

**依赖使用**：

- **@modelcontextprotocol/sdk**: MCP 服务器和客户端实现
- **inquirer**: 交互式配置修正确认（FR-004）
- **zod**: 配置文件和参数的运行时验证
- **uuid**: 会话 ID 生成
- **vitest**: 单元测试、集成测试、契约测试

**无需新增依赖**：

- 版本检测：使用 Node.js 内置 `child_process`
- 配置解析：使用 Node.js 内置 `fs` + `toml` 库（已有）
- HTTP 错误处理：基于现有错误处理框架

---

## 下一步行动

Phase 0 研究完成，进入 Phase 1 设计阶段：

1. **生成 data-model.md**: 定义实体模型（版本信息、配置项、MCP 方法）
2. **生成 contracts/**: 定义 MCP 方法的契约测试
3. **生成 quickstart.md**: 定义用户场景的验收测试
4. **更新 CLAUDE.md**: 添加 Codex 0.44 兼容性相关技术栈

---

_所有决策均符合 Codex
Father 项目宪章 v1.1.0 的六项原则：代码质量、TDD、用户体验、性能、安全、协议架构。_
