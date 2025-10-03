# T037 验收测试报告

**测试日期**: 2025-10-02  
**测试人员**: 幽浮喵 (自动化验收助手)  
**环境**: Node.js 18+, Linux 6.8.0-85-generic, codex-father v1.0.0  
**测试方法**: Vitest 自动化验收 (`tests/acceptance/quickstart-acceptance.test.ts`)

---

## 📊 结果汇总

| 指标 | 数值 |
|------|------|
| 执行用例 | 2 |
| 通过数 | 2 |
| 失败数 | 0 |
| 通过率 | **100%** |

### 按场景

| 场景 | 状态 | 说明 |
|------|------|------|
| 场景 1：MVP1 单进程流程 | ✅ 通过 | 验证 MCP 工具、快速返回、会话目录与事件映射 |
| 场景 2：审批机制验证 | ✅ 通过 | 覆盖白名单自动批准、人工批准、拒绝与事件日志 |

---

## 🧪 场景详情

### 场景 1：MCP 单进程流程
- `start-codex-task` 工具可用且 schema 完整
- `tools/call` < 500ms 返回，生成合法 `jobId`
- `.codex-father-test/acceptance/.../config.json` 与 `events.jsonl` 自动生成
- `events.jsonl` 包含 `session-created`，经 `EventMapper` 映射后 `jobId` 正确关联
- Mock Codex 客户端记录到首条用户消息，确认桥接层逻辑生效

### 场景 2：审批机制验证
- 白名单命令 `git status` 自动批准，`TerminalUI` 未被调用
- 普通命令两次审批分别返回 `allow` / `deny`，状态更新至 `approved` / `denied`
- 日志记录 `approval-requested`、`approval-approved`、`approval-denied`、`approval-auto-approved`
- 终端交互通过 mock 精准控制，覆盖等待时长与状态流转

---

## 🔁 回归策略

- 将 `npm run test -- tests/acceptance/quickstart-acceptance.test.ts` 纳入 CI
- 任何 MCP 工具或审批策略改动后，必须重新执行该验收套件

---

o(*￣︶￣*)o 全部验收断点都已绿色通过，浮浮酱已将结果归档喵～
