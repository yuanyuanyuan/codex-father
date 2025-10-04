# Quickstart: Codex 0.44 兼容性检查与修复

**Feature**: 008-ultrathink-codex-0 **Date**: 2025-10-03 **Phase**: 1 - Design
(User Acceptance Testing)

---

## 概述

本文档定义 Codex 0.42 和 0.44 双版本兼容性功能的用户验收测试步骤。所有场景基于
[spec.md](./spec.md) 的 User Scenarios & Testing 部分。

**测试目标**:

- ✅ 验证 MCP 服务器成功启动且支持 0.42 和 0.44 双版本
- ✅ 验证版本检测和降级机制正确工作
- ✅ 验证配置验证和自动修正功能
- ✅ 验证所有 MCP 方法的 100% 协议兼容性
- ✅ 验证错误处理提供清晰的操作指引

---

## 环境准备

### 前置条件

1. **安装 Codex**（测试双版本）:

   ```bash
   # 测试 0.44（推荐）
   npm install -g @openai/codex@0.44.0

   # 或测试 0.42（降级模式）
   npm install -g @openai/codex@0.42.5
   ```

2. **安装 codex-father**:

   ```bash
   cd /data/codex-father
   npm install
   npm run build
   ```

3. **配置环境变量**:

   ```bash
   export OPENAI_API_KEY="sk-..."
   ```

4. **配置 Codex** (`~/.codex/config.toml`):

   ```toml
   model = "gpt-5-codex"
   approval_policy = "on-request"

   [model_providers.openai]
   name = "OpenAI"
   base_url = "https://api.openai.com/v1"
   env_key = "OPENAI_API_KEY"
   wire_api = "responses"  # 正确配置，避免 405 错误
   ```

---

## 测试场景组 A: 基础功能（0.42 和 0.44 通用）

### A1. MCP 服务器启动

**目标**: 验证 MCP 服务器成功启动

**步骤**:

1. 启动 MCP 服务器:

   ```bash
   npm run mcp:start
   ```

2. 验证输出包含:
   ```
   ✓ Codex 版本检测：{version}
   ✓ codex-father MCP 服务器已启动
   ```

**验收标准**:

- [ ] 服务器成功启动，无错误
- [ ] 显示检测到的 Codex 版本号
- [ ] 如果版本为 0.42，显示"已启用 0.42 兼容模式"
- [ ] 如果版本为 0.44，显示"已启用完整功能"

---

### A2. 创建新会话（newConversation）

**目标**: 验证 `newConversation` MCP 方法

**步骤**:

1. 使用 MCP Inspector 连接服务器:

   ```bash
   npx @modelcontextprotocol/inspector -- npm run mcp:start
   ```

2. 调用 `newConversation`:

   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "newConversation",
     "params": {
       "model": "gpt-5",
       "approvalPolicy": "on-request",
       "sandbox": "workspace-write"
     }
   }
   ```

3. 验证响应:
   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "result": {
       "conversationId": "<uuid>",
       "model": "gpt-5",
       "rolloutPath": "/path/to/rollout.jsonl"
     }
   }
   ```

**验收标准**:

- [ ] 响应包含 `conversationId`（UUID 格式）
- [ ] 响应包含 `model`（与请求一致）
- [ ] 响应包含 `rolloutPath`（有效路径）
- [ ] 无 405 错误或其他 HTTP 错误

---

### A3. 发送用户消息（sendUserMessage）

**目标**: 验证 `sendUserMessage` MCP 方法

**步骤**:

1. 使用步骤 A2 创建的 `conversationId`

2. 调用 `sendUserMessage`:

   ```json
   {
     "jsonrpc": "2.0",
     "id": 2,
     "method": "sendUserMessage",
     "params": {
       "conversationId": "<conversationId>",
       "items": [
         {
           "type": "text",
           "text": "Hello Codex, please respond with 'Hello User'"
         }
       ]
     }
   }
   ```

3. 观察 `codex/event` 通知流

**验收标准**:

- [ ] 响应 `{ "accepted": true }`
- [ ] 收到 `codex/event` 通知流
- [ ] 事件流包含 Codex 的响应消息
- [ ] 无连接中断或超时

---

## 测试场景组 B: 版本检测与降级（0.42 环境）

### B1. 版本检测（0.42）

**前置条件**: 安装 Codex 0.42.5

**步骤**:

1. 启动 MCP 服务器:

   ```bash
   npm run mcp:start
   ```

2. 验证输出:
   ```
   ✓ Codex 版本检测：0.42.5
   ✓ codex-father 已启用 0.42 兼容模式
   ```

**验收标准**:

- [ ] 正确识别 0.42 版本
- [ ] 显示"已启用 0.42 兼容模式"
- [ ] 服务器成功启动（未因版本低而报错）

---

### B2. 0.44 独有参数报错（MCP 层）

**前置条件**: 运行在 0.42 环境

**步骤**:

1. 调用 `newConversation` with `profile` 参数（0.44 独有）:

   ```json
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "newConversation",
     "params": {
       "model": "gpt-5",
       "profile": "codex-father-auto-fix"
     }
   }
   ```

2. 验证错误响应:
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

**验收标准**:

- [ ] 返回 JSON-RPC 错误（code: -32602）
- [ ] 错误消息包含参数名称（`profile`）
- [ ] 错误消息包含当前版本（`0.42.5`）
- [ ] 错误消息包含要求版本（`>= 0.44`）

---

### B3. 配置兼容性警告（配置层）

**前置条件**: 运行在 0.42 环境，配置包含 0.44 独有选项

**步骤**:

1. 编辑 `~/.codex/config.toml`，添加 0.44 独有配置:

   ```toml
   model = "gpt-5-codex"
   model_reasoning_effort = "medium"  # 0.44 only

   [profiles.my-profile]  # 0.44 only
   model = "gpt-5"
   ```

2. 启动 MCP 服务器:

   ```bash
   npm run mcp:start
   ```

3. 验证警告输出:

   ```
   ⚠️ 配置兼容性警告（Codex 0.42.5）:
   检测到以下 0.44 独有配置将被忽略：
     - model_reasoning_effort: "medium"
     - profiles.my-profile

   建议：
     1. 升级到 Codex 0.44 以使用完整功能
     2. 或移除上述配置项以消除此警告

   继续启动...
   ```

**验收标准**:

- [ ] 显示警告列出所有 0.44 独有配置
- [ ] 提供明确的升级建议
- [ ] 服务器继续启动（不阻止）
- [ ] 不兼容配置被自动过滤（不传递给 Codex）

---

## 测试场景组 C: 配置验证与修正（0.44 环境）

### C1. 检测 405 错误风险配置

**前置条件**: 运行在 0.44 环境

**步骤**:

1. 编辑 `~/.codex/config.toml`，设置错误的 `wire_api`:

   ```toml
   model = "gpt-5-codex"

   [model_providers.openai]
   wire_api = "chat"  # 错误！gpt-5-codex 需要 "responses"
   ```

2. 启动 MCP 服务器:

   ```bash
   npm run mcp:start
   ```

3. 验证交互式提示:

   ```
   ⚠️ 配置验证警告：
   检测到可能导致 405 错误的配置：
     模型: gpt-5-codex
     当前 wire_api: "chat"
     建议 wire_api: "responses"（推理模型需要使用 responses API）

   是否自动修正配置？[Y/n]
   ```

**验收标准**:

- [ ] 检测到不兼容的 `model` 与 `wire_api` 组合
- [ ] 显示清晰的错误说明
- [ ] 显示建议的修正值
- [ ] 提供交互式确认（Y/n）

---

### C2. 自动修正配置（用户确认 Y）

**前置条件**: 步骤 C1 显示交互式提示

**步骤**:

1. 输入 `Y` 确认自动修正

2. 验证输出:

   ```
   ✓ 配置已修正并保存到 Profile: codex-father-auto-fix
   ✓ 启动 Codex 时将使用 --profile codex-father-auto-fix
   ✓ MCP 服务器已启动
   ```

3. 检查 `~/.codex/config.toml`:

   ```toml
   [profiles.codex-father-auto-fix]
   # Auto-fixed by codex-father on 2025-10-03: gpt-5-codex requires wire_api = "responses"
   model = "gpt-5-codex"

   [profiles.codex-father-auto-fix.model_providers.openai]
   wire_api = "responses"
   ```

**验收标准**:

- [ ] Profile `codex-father-auto-fix` 被创建/更新
- [ ] Profile 包含修正后的配置（`wire_api = "responses"`）
- [ ] Profile 包含注释说明修正原因和时间
- [ ] codex-father 启动 Codex 时使用 `--profile codex-father-auto-fix`

---

### C3. 保留原配置（用户确认 N）

**前置条件**: 步骤 C1 显示交互式提示

**步骤**:

1. 输入 `N` 拒绝自动修正

2. 验证输出:
   ```
   ⚠️ 保留原配置，如遇 405 错误请手动调整 wire_api
   ✓ MCP 服务器已启动
   ```

**验收标准**:

- [ ] 显示警告提示用户手动调整
- [ ] 服务器继续启动（不创建 Profile）
- [ ] 使用用户原配置（可能导致 405 错误）

---

## 测试场景组 D: 新特性支持（0.44 环境）

### D1. 使用 Profile 参数

**前置条件**: 运行在 0.44 环境

**步骤**:

1. 创建 Profile 配置（`~/.codex/config.toml`）:

   ```toml
   [profiles.test-profile]
   model = "gpt-5"
   approval_policy = "on-failure"
   sandbox_mode = "workspace-write"
   ```

2. 调用 `newConversation` with `profile`:
   ```json
   {
     "method": "newConversation",
     "params": { "profile": "test-profile" }
   }
   ```

**验收标准**:

- [ ] 响应成功（无 JSON-RPC 错误）
- [ ] Codex 使用 Profile 中的配置
- [ ] 响应的 `model` 为 `gpt-5`（来自 Profile）

---

### D2. 使用推理配置（sendUserTurn）

**前置条件**: 运行在 0.44 环境

**步骤**:

1. 调用 `sendUserTurn` with `effort` 和 `summary`:
   ```json
   {
     "method": "sendUserTurn",
     "params": {
       "conversationId": "<id>",
       "items": [{ "type": "text", "text": "Complex reasoning task" }],
       "effort": "high",
       "summary": "always"
     }
   }
   ```

**验收标准**:

- [ ] 响应成功（`{ "accepted": true }`）
- [ ] Codex 使用高推理努力程度（`effort: "high"`）
- [ ] Codex 始终生成推理摘要（`summary: "always"`）
- [ ] 无参数不兼容错误

---

## 测试场景组 E: 错误处理增强

### E1. HTTP 405 错误诊断

**前置条件**: 故意配置错误的 `wire_api`（如 C1 步骤但不修正）

**步骤**:

1. 使用错误配置启动 MCP 服务器（用户选择 N）

2. 调用 `newConversation` 并发送消息

3. 如果 Codex 返回 405 错误，验证 codex-father 的错误格式化:

   ```
   ❌ Codex API 错误 (405 Method Not Allowed)
   端点: https://api.openai.com/v1/chat/completions
   方法: POST
   模型: gpt-5-codex
   wire_api: chat (当前配置)

   建议: gpt-5-codex 需要使用 wire_api = "responses"
   修复: 手动编辑 `~/.codex/config.toml`，将 `model_providers.openai.wire_api` 调整为 `responses`
   ```

**验收标准**:

- [ ] 错误消息包含完整的 HTTP 上下文（端点、方法）
- [ ] 显示当前配置值（`wire_api: chat`）
- [ ] 显示建议的修正值（`"responses"`）
- [ ] 提供明确的修复步骤

---

### E2. 版本检测失败处理

**前置条件**: Codex 未安装或不在 PATH 中

**步骤**:

1. 移除 Codex 或修改 PATH:

   ```bash
   export PATH="/tmp:$PATH"  # Codex 不在 PATH 中
   ```

2. 启动 MCP 服务器:

   ```bash
   npm run mcp:start
   ```

3. 验证错误输出:

   ```
   ❌ 错误：无法检测 Codex 版本
   原因：codex 命令未找到或执行失败

   请确认：
     1. Codex 已安装：npm install -g @openai/codex
     2. Codex 在 PATH 中：which codex
     3. Codex 版本为 0.42 或 0.44：codex --version

   codex-father 需要 Codex >= 0.42 才能运行。
   ```

**验收标准**:

- [ ] 立即报错并退出（不启动 MCP 服务器）
- [ ] 错误消息包含具体原因
- [ ] 提供明确的解决步骤
- [ ] 说明支持的版本范围

---

## 测试场景组 F: MCP 协议 100% 兼容性

### F1. 所有 MCP 方法可用

**目标**: 验证所有 23 个 MCP 方法都已实现

**步骤**:

1. 查看 [contracts/contracts-checklist.md](./contracts/contracts-checklist.md)

2. 对每个方法执行契约测试:
   ```bash
   npm run test -- contracts/
   ```

**验收标准**:

- [ ] 所有 23 个方法的契约测试通过
- [ ] 每个方法的请求/响应格式符合 JSON Schema
- [ ] 版本兼容性检查正确（0.44 独有参数在 0.42 环境下报错）

---

### F2. 审批流程（applyPatchApproval）

**目标**: 验证 Server → Client 审批请求

**步骤**:

1. 创建会话并发送需要审批的消息（如修改文件）

2. 验证收到 `applyPatchApproval` 请求:

   ```json
   {
     "jsonrpc": "2.0",
     "id": "<server-request-id>",
     "method": "applyPatchApproval",
     "params": {
       "conversationId": "<id>",
       "callId": "<call-id>",
       "fileChanges": [...],
       "reason": "Apply changes to fix bug"
     }
   }
   ```

3. 响应审批:
   ```json
   {
     "jsonrpc": "2.0",
     "id": "<server-request-id>",
     "result": { "decision": "allow" }
   }
   ```

**验收标准**:

- [ ] Server 发送 JSON-RPC 请求到 Client
- [ ] 请求包含完整的审批上下文（fileChanges, reason）
- [ ] Client 响应被正确处理（allow/deny）

---

## 验收清单

### Phase 3.3 完成后检查

**基础功能**（0.42 和 0.44 通用）:

- [ ] A1. MCP 服务器启动
- [ ] A2. 创建新会话
- [ ] A3. 发送用户消息

**版本检测与降级**（0.42 环境）:

- [ ] B1. 版本检测（0.42）
- [ ] B2. 0.44 独有参数报错
- [ ] B3. 配置兼容性警告

**配置验证与修正**（0.44 环境）:

- [ ] C1. 检测 405 错误风险配置
- [ ] C2. 自动修正配置（用户确认 Y）
- [ ] C3. 保留原配置（用户确认 N）

**新特性支持**（0.44 环境）:

- [ ] D1. 使用 Profile 参数
- [ ] D2. 使用推理配置

**错误处理增强**:

- [ ] E1. HTTP 405 错误诊断
- [ ] E2. 版本检测失败处理

**MCP 协议兼容性**:

- [ ] F1. 所有 MCP 方法可用
- [ ] F2. 审批流程

---

## 性能验收

**性能要求**（from [plan.md](./plan.md)）:

- [ ] 版本检测 < 1s（首次执行）
- [ ] 版本检测 < 100ms（缓存后）
- [ ] 配置验证 < 2s
- [ ] MCP 方法响应 < 500ms

**测试方法**:

```bash
# 测试版本检测性能
time codex --version  # 应 < 1s

# 测试 MCP 响应性能
# 使用 MCP Inspector 的时间戳验证响应时间 < 500ms
```

---

## 回归测试

**在每次代码变更后**:

1. 运行所有契约测试: `npm run test -- contracts/`
2. 运行单元测试: `npm run test -- unit/`
3. 运行集成测试: `npm run test -- integration/`
4. 手动执行关键场景（A1-A3, C1-C2, E1）

---

_所有测试场景基于用户故事（spec.md），确保实现满足用户需求并符合项目宪章的 TDD 原则。_
