# MCP Contracts: Codex 0.44 兼容性检查与修复

**Feature**: 008-ultrathink-codex-0 **Date**: 2025-10-03 **Phase**: 1 - Design
(Contracts)

---

## 概述

本目录包含 Codex
MCP 协议的所有方法契约定义，确保 codex-father 实现 100% 协议兼容性。

每个契约包含：

1. **JSON Schema 定义**: 方法的请求/响应格式（`.schema.json` 文件）
2. **契约测试**: 验证实现符合 Schema（`.contract.test.ts` 文件）

---

## 契约列表

### 会话管理（7 个方法）

| 方法                    | Schema | 测试 | 版本  | 优先级 | 状态   |
| ----------------------- | ------ | ---- | ----- | ------ | ------ |
| `newConversation`       | ✅     | ✅   | 0.42+ | 核心   | 已定义 |
| `sendUserMessage`       | ✅     | ✅   | 0.42+ | 核心   | 已定义 |
| `sendUserTurn`          | ✅     | ✅   | 0.42+ | 高     | 已定义 |
| `interruptConversation` | 📋     | 📋   | 0.42+ | 中     | 待定义 |
| `listConversations`     | 📋     | 📋   | 0.42+ | 低     | 待定义 |
| `resumeConversation`    | 📋     | 📋   | 0.42+ | 中     | 待定义 |
| `archiveConversation`   | 📋     | 📋   | 0.42+ | 低     | 待定义 |

### 配置和信息（4 个方法）

| 方法                 | Schema | 测试 | 版本  | 优先级 | 状态   |
| -------------------- | ------ | ---- | ----- | ------ | ------ |
| `getUserSavedConfig` | 📋     | 📋   | 0.42+ | 低     | 待定义 |
| `setDefaultModel`    | 📋     | 📋   | 0.42+ | 低     | 待定义 |
| `getUserAgent`       | 📋     | 📋   | 0.42+ | 低     | 待定义 |
| `userInfo`           | 📋     | 📋   | 0.42+ | 低     | 待定义 |

### 认证（5 个方法）

| 方法                 | Schema | 测试 | 版本  | 优先级 | 状态   |
| -------------------- | ------ | ---- | ----- | ------ | ------ |
| `loginApiKey`        | 📋     | 📋   | 0.42+ | 中     | 待定义 |
| `loginChatGpt`       | 📋     | 📋   | 0.42+ | 中     | 待定义 |
| `cancelLoginChatGpt` | 📋     | 📋   | 0.42+ | 低     | 待定义 |
| `logoutChatGpt`      | 📋     | 📋   | 0.42+ | 低     | 待定义 |
| `getAuthStatus`      | 📋     | 📋   | 0.42+ | 中     | 待定义 |

### 工具（2 个方法）

| 方法                | Schema | 测试 | 版本  | 优先级 | 状态   |
| ------------------- | ------ | ---- | ----- | ------ | ------ |
| `gitDiffToRemote`   | 📋     | 📋   | 0.42+ | 低     | 待定义 |
| `execOneOffCommand` | 📋     | 📋   | 0.42+ | 低     | 待定义 |

### 审批（Server → Client 请求，2 个方法）

| 方法                  | Schema | 测试 | 版本  | 优先级 | 状态   |
| --------------------- | ------ | ---- | ----- | ------ | ------ |
| `applyPatchApproval`  | 📋     | 📋   | 0.42+ | 高     | 待定义 |
| `execCommandApproval` | 📋     | 📋   | 0.42+ | 高     | 待定义 |

### 通知（Server → Client，3 个类型）

| 通知                   | Schema | 测试 | 版本  | 优先级 | 状态   |
| ---------------------- | ------ | ---- | ----- | ------ | ------ |
| `loginChatGptComplete` | 📋     | 📋   | 0.42+ | 中     | 待定义 |
| `authStatusChange`     | 📋     | 📋   | 0.42+ | 中     | 待定义 |
| `codex/event`          | 📋     | 📋   | 0.42+ | 核心   | 待定义 |

**总计**: 23 个方法/通知，其中 3 个已定义完整契约，20 个待定义。

---

## 契约格式规范

### JSON Schema 文件命名

- 格式: `<method-name>.schema.json`
- 示例: `newConversation.schema.json`, `sendUserMessage.schema.json`

### Schema 结构

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "MethodName",
  "description": "方法描述",
  "request": {
    "type": "object",
    "properties": { ... },
    "required": [...]
  },
  "response": {
    "type": "object",
    "properties": { ... },
    "required": [...]
  },
  "minVersion": "0.42.0" // 可选，标注最低支持版本
}
```

### 契约测试文件命名

- 格式: `<method-name>.contract.test.ts`
- 示例: `newConversation.contract.test.ts`

### 测试结构

```typescript
import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from './newConversation.schema.json';

const ajv = new Ajv();

describe('MCP Contract: newConversation', () => {
  it('should validate valid request', () => {
    const request = { model: 'gpt-5', approvalPolicy: 'on-request' };
    const validate = ajv.compile(schema.request);
    expect(validate(request)).toBe(true);
  });

  it('should reject invalid request', () => {
    const request = { model: 123 }; // 错误类型
    const validate = ajv.compile(schema.request);
    expect(validate(request)).toBe(false);
  });

  it('should validate valid response', () => {
    const response = { conversationId: 'abc123', model: 'gpt-5' };
    const validate = ajv.compile(schema.response);
    expect(validate(response)).toBe(true);
  });
});
```

---

## 版本兼容性标注

每个 Schema 包含 `minVersion` 字段，标注最低支持的 Codex 版本：

```json
{
  "minVersion": "0.44.0", // 此方法需要 Codex >= 0.44
  "versionSpecificParams": {
    "profile": { "minVersion": "0.44.0" } // profile 参数需要 0.44
  }
}
```

**版本检查逻辑**:

- 在 0.42 环境下，`minVersion: "0.44.0"` 的参数会触发错误或警告
- 参数级别的 `versionSpecificParams` 允许细粒度控制

---

## 数据来源追溯

每个 Schema 包含 `dataSource` 字段，指向官方文档：

```json
{
  "dataSource": "refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md:52-63"
}
```

---

## 使用方法

### 1. 开发新契约

```bash
# 复制模板
cp contracts/newConversation.schema.json contracts/<method-name>.schema.json
cp contracts/newConversation.contract.test.ts contracts/<method-name>.contract.test.ts

# 编辑 Schema（根据官方文档）
# 编辑测试（添加有效/无效用例）
```

### 2. 运行契约测试

```bash
# 运行所有契约测试
npm run test -- contracts/

# 运行单个契约测试
npm run test -- contracts/newConversation.contract.test.ts
```

### 3. 验证实现

契约测试在实现前应该**失败**（TDD 原则）：

- ❌ 实现前：测试失败（预期行为）
- ✅ 实现后：测试通过（验证正确性）

---

## 下一步任务

**Phase 3.1** (实现前):

- [ ] 完成所有 23 个方法的 Schema 定义
- [ ] 完成所有 23 个方法的契约测试（测试应失败）

**Phase 3.3** (实现后):

- [ ] 实现缺失的 MCP 方法
- [ ] 确保所有契约测试通过
- [ ] 验证 100% 协议兼容性

---

_所有契约基于官方文档
`refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md`，确保与 Codex
0.44 官方 MCP 协议完全一致。_
