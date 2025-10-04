# MCP Contracts Checklist

**Feature**: 008-ultrathink-codex-0 **Date**: 2025-10-03 **Status**:
3/23 完成（13%）

---

## 完成状态

- ✅ **已完成**: Schema + 契约测试都已创建
- 📋 **待创建**: 需要基于 `_template.schema.json` 创建
- ⏭️ **Phase 3.1**: 在实现前创建（TDD 原则）

---

## 核心方法（优先级：核心）

| 方法                         | Schema | 测试 | 数据来源                     | 状态      |
| ---------------------------- | ------ | ---- | ---------------------------- | --------- |
| `newConversation`            | ✅     | ✅   | codex_mcp_interface.md:52-63 | ✅ 已完成 |
| `sendUserMessage`            | ✅     | ❌   | codex_mcp_interface.md:66-68 | 📋 待测试 |
| `sendUserTurn`               | ✅     | ❌   | codex_mcp_interface.md:68    | 📋 待测试 |
| `codex/event` (notification) | ❌     | ❌   | codex_mcp_interface.md:76-79 | 📋 待创建 |

---

## 会话管理（优先级：中-低）

| 方法                    | Schema | 测试 | 数据来源                  | 状态      |
| ----------------------- | ------ | ---- | ------------------------- | --------- |
| `interruptConversation` | ❌     | ❌   | codex_mcp_interface.md:70 | 📋 待创建 |
| `listConversations`     | ❌     | ❌   | codex_mcp_interface.md:72 | 📋 待创建 |
| `resumeConversation`    | ❌     | ❌   | codex_mcp_interface.md:72 | 📋 待创建 |
| `archiveConversation`   | ❌     | ❌   | codex_mcp_interface.md:72 | 📋 待创建 |

---

## 审批（Server → Client 请求，优先级：高）

| 方法                  | Schema | 测试 | 数据来源                  | 状态      |
| --------------------- | ------ | ---- | ------------------------- | --------- |
| `applyPatchApproval`  | ❌     | ❌   | codex_mcp_interface.md:87 | 📋 待创建 |
| `execCommandApproval` | ❌     | ❌   | codex_mcp_interface.md:88 | 📋 待创建 |

---

## 认证（优先级：中）

| 方法                                  | Schema | 测试 | 数据来源                  | 状态      |
| ------------------------------------- | ------ | ---- | ------------------------- | --------- |
| `loginApiKey`                         | ❌     | ❌   | codex_mcp_interface.md:96 | 📋 待创建 |
| `loginChatGpt`                        | ❌     | ❌   | codex_mcp_interface.md:97 | 📋 待创建 |
| `cancelLoginChatGpt`                  | ❌     | ❌   | codex_mcp_interface.md:98 | 📋 待创建 |
| `logoutChatGpt`                       | ❌     | ❌   | codex_mcp_interface.md:98 | 📋 待创建 |
| `getAuthStatus`                       | ❌     | ❌   | codex_mcp_interface.md:98 | 📋 待创建 |
| `loginChatGptComplete` (notification) | ❌     | ❌   | codex_mcp_interface.md:79 | 📋 待创建 |
| `authStatusChange` (notification)     | ❌     | ❌   | codex_mcp_interface.md:79 | 📋 待创建 |

---

## 配置和信息（优先级：低）

| 方法                 | Schema | 测试 | 数据来源                  | 状态      |
| -------------------- | ------ | ---- | ------------------------- | --------- |
| `getUserSavedConfig` | ❌     | ❌   | codex_mcp_interface.md:21 | 📋 待创建 |
| `setDefaultModel`    | ❌     | ❌   | codex_mcp_interface.md:21 | 📋 待创建 |
| `getUserAgent`       | ❌     | ❌   | codex_mcp_interface.md:21 | 📋 待创建 |
| `userInfo`           | ❌     | ❌   | codex_mcp_interface.md:21 | 📋 待创建 |

---

## 工具（优先级：低）

| 方法                | Schema | 测试 | 数据来源                  | 状态      |
| ------------------- | ------ | ---- | ------------------------- | --------- |
| `gitDiffToRemote`   | ❌     | ❌   | codex_mcp_interface.md:25 | 📋 待创建 |
| `execOneOffCommand` | ❌     | ❌   | codex_mcp_interface.md:25 | 📋 待创建 |

---

## 创建步骤

### 1. 复制模板

```bash
cd specs/008-ultrathink-codex-0/contracts
cp _template.schema.json <method-name>.schema.json
```

### 2. 填写 Schema

参考官方文档 `refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md`
和 `_template.schema.json`：

- 更新 `title`, `description`, `dataSource`
- 定义 `request.properties`（所有参数）
- 定义 `response.properties`（响应字段）
- 标注 0.44 独有参数的 `minVersion`
- 添加 `versionSpecificParams`（如有）

### 3. 创建契约测试

```bash
cp newConversation.contract.test.ts <method-name>.contract.test.ts
```

修改测试用例：

- 有效请求/响应测试
- 无效类型/值测试
- 版本兼容性测试（如有 0.44 独有参数）

### 4. 运行测试

```bash
npm run test -- contracts/<method-name>.contract.test.ts
```

**预期结果**（TDD）:

- ❌ 实现前：测试失败（Schema 验证通过，但方法未实现）
- ✅ 实现后：测试通过

---

## Phase 3.1 任务（实现前）

**目标**: 在开始实现前，完成所有 20 个待创建方法的契约

**估算工作量**:

- 每个 Schema: 15-30 分钟（参考模板 + 官方文档）
- 每个测试: 10-20 分钟（参考 newConversation.contract.test.ts）
- **总计**: 约 8-16 小时（可并行）

**优先级顺序**:

1. **核心方法** (1 个): `codex/event` 通知
2. **审批方法** (2 个): `applyPatchApproval`, `execCommandApproval`
3. **会话管理** (4 个): `interruptConversation`, `resumeConversation`,
   `listConversations`, `archiveConversation`
4. **认证方法** (7 个): 所有认证相关方法
5. **配置和工具** (6 个): 所有配置和工具方法

---

## 验收标准

- [ ] 所有 23 个方法都有完整的 JSON Schema 定义
- [ ] 所有 23 个方法都有契约测试（至少 3 个用例：有效、无效、版本）
- [ ] 所有 Schema 的 `dataSource` 字段指向官方文档具体行号
- [ ] 所有 0.44 独有参数都标注了 `minVersion: "0.44.0"`
- [ ] 所有契约测试在实现前失败（验证 Schema 正确性）

---

_创建契约是 TDD 流程的第一步，确保实现符合 Codex 官方 MCP 协议规范。_
