# Codex 0.44 兼容与 MCP 集成指南

> 适用对象：`@starkdev020/codex-father-mcp-server` 关联版本：MCP v1.2.0（标签
> `mcp-v1.2.0`）

本指南说明 Codex Father 在 Codex
0.44 环境下的兼容与行为边界，包括版本检测、参数-版本映射、Profile 自动修复、错误码与 MCP 方法门禁。

---

## 1. 版本检测与缓存

- 启动后首次需要解析 `codex --version`，结果缓存于会话上下文。
- 若命令不存在或执行失败，将快速失败并输出修复建议（例如安装指引、PATH 检查）。
- 检测状态会记录在会话事件日志（`.jsonl`）与运行日志中，便于追溯。

---

## 2. 参数-版本映射与降级

在 Codex 0.42 ↔ 0.44 之间，部分参数名/行为存在差异。MCP 层在 `tools/call`
入口做以下处理：

- 将上层传入参数映射为当前 Codex 版本可接受的形式（保持调用方协议稳定）。
- 对缺失/不兼容参数按“最安全可行”的策略降级；无法满足 `minVersion`
  的参数，将拒绝并返回 `-32602`。

示例（概念性）：

- `wire_api` 在 0.44 及某些模型为必需项，缺失时通过 Profile 自动修复（见下文）。
- 审批/沙箱相关参数保持等价语义映射，不改变安全边界。

---

## 3. Codex Profile 自动修复

为提升“开箱即用”体验，MCP 可对关键 Profile 项进行自动修复（Auto-fix），例如：

- `wire_api = "responses"`（在 0.44 + 指定模型时要求）
- `model` 与能力对齐
- 默认超时/重试等安全值

当发生修复时，会在配置或日志中附注如：

```
# Auto-fixed by codex-father on 2025-10-03: gpt-5-codex requires wire_api = "responses"
```

失败时保守处理（不写入），并提示人工检查。

---

## 4. 校验与错误码

当版本不满足或参数非法时：

- 返回 JSON-RPC 错误码 `-32602`（Invalid
  params），同时给出明确的字段与期望值说明。
- 透传 Codex 侧典型 HTTP 语义：
  - `405` Method Not Allowed（wire_api 错误）
  - `401` Unauthorized（API Key/认证失败）
  - `429` Too Many Requests（速率限制）
  - `500` Internal Server Error（内部错误）

错误响应示例：

```json
{
  "code": -32602,
  "message": "Invalid params: param 'wire_api' requires minVersion 0.44",
  "data": { "currentVersion": "0.42", "required": ">=0.44" }
}
```

---

## 5. MCP 方法门禁

所有 `tools/call` 在执行前会进行：

- 版本门禁：`currentVersion` 与参数/能力的最小版本要求比对
- 参数门禁：必要字段校验与规范化

拒绝策略优先早失败、可诊断，尽量避免“执行中才失败”。

---

## 6. 观测与排错

- 会话目录：`.codex-father/sessions/<job-id>/`
  - 事件日志（JSONL）：`events.jsonl`
  - 运行日志：`codex-*.log`
- 常见现象：
  - 版本检测失败 → 检查 PATH 与 Codex 安装
  - `-32602` → 检查参数是否满足最小版本/能力
  - `405/401/429/500` → 对应网关/权限/配额/内部错误

---

## 7. 快速验证清单

1. 在 0.42 环境传入 0.44 才支持的参数 → 期望 `-32602`
2. 缺失 `wire_api` 但模型要求 → 期望自动修复或明确错误
3. 认证错误 → 期望 `401` 并提示修复建议
4. 速率限制 → 期望 `429` 并提示退避/重试

---

## 8. 参考与扩展阅读

- 版本说明：`docs/releases/VERSION_MCP_1.2.0.md`
- 规范材料：`specs/__archive/008-ultrathink-codex-0/*`
- 使用指南：`mcp/codex-mcp-server/README.md`
