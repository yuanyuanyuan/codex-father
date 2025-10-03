# Research: 架构调整 - MCP 模式优先实现

**Feature**: 005-docs-prd-draft **Date**: 2025-09-30 **Status**: Research
Complete

---

## 研究目标

为 MCP 协议优先架构的实现提供技术决策依据，解决以下关键问题：

1. **MCP 协议实现**：选择实现方式（自研 vs SDK）
2. **Codex JSON-RPC 通信**：如何与 Codex 自定义方法交互
3. **异步响应机制**：如何设计快速返回 + 事件通知的异步模式
4. **进程管理策略**：MVP1 单进程 vs MVP2 进程池的技术方案
5. **会话恢复机制**：如何基于 Codex 原生 rollout 文件实现恢复
6. **审批机制 UI**：终端界面设计和用户体验
7. **性能优化**：确保满足 constitution 的性能要求

---

## 决策 1: MCP 协议实现方式

### 选项分析

#### 选项 A: 使用官方 @modelcontextprotocol/sdk

**优点**：

- 官方维护，协议兼容性有保障
- 内置类型定义，减少手工编写协议代码
- 社区支持和文档完善

**缺点**：

- 引入额外依赖（但体积可控）
- 可能包含不需要的功能（如 SSE 传输）
- 需要学习 SDK API

#### 选项 B: 自研 MCP 协议实现

**优点**：

- 完全控制实现细节
- 可以针对 stdio 传输优化
- 减少依赖，降低供应链风险

**缺点**：

- 开发和维护成本高
- 协议变更需要手工跟进
- 可能出现兼容性问题

### 决策

**选择：选项 A - 使用 @modelcontextprotocol/sdk**

**理由**：

1. **KISS 原则**：不重新发明轮子，使用官方 SDK 可以快速实现协议支持
2. **可靠性**：官方 SDK 经过广泛测试，降低协议兼容性风险
3. **维护成本**：协议演进由官方跟进，节省维护精力
4. **开发效率**：TypeScript 类型定义开箱即用，加速开发

**备选方案**：如果 SDK 不满足需求（如性能瓶颈、体积过大），可在 MVP2 阶段考虑自研

**需要验证的问题**：

- SDK 是否支持 stdio 传输（MCP 标准传输方式）
- SDK 的内存占用是否在 200MB 限制内
- SDK 是否支持自定义通知（`codex-father/progress`）

---

## 决策 2: Codex JSON-RPC 通信方式

### 技术背景

Codex
MCP 接口使用自定义 JSON-RPC 方法（参考：`refer-research/openai-codex/codex-rs/docs/codex_mcp_interface.md`）：

- `newConversation`: 启动会话
- `sendUserTurn`: 发送用户输入
- `interruptConversation`: 中断会话
- 通过 stdio 通信（JSON-RPC 2.0 over line-delimited JSON）

### 选项分析

#### 选项 A: 直接使用 child_process.spawn 封装

**实现方式**：

```typescript
import { spawn } from 'child_process';

class CodexClient {
  private process: ChildProcess;

  async start() {
    this.process = spawn('codex', ['mcp']);
    this.setupStdioHandlers();
  }

  async newConversation(params) {
    const request = {
      jsonrpc: '2.0',
      id: uuid(),
      method: 'newConversation',
      params,
    };
    this.process.stdin.write(JSON.stringify(request) + '\n');
    return this.waitForResponse(request.id);
  }
}
```

**优点**：

- 直接控制，实现简单
- 无额外依赖
- 性能开销最小

**缺点**：

- 需要手工处理 line-delimited JSON 解析
- 需要自己管理请求/响应映射（request_id ↔ Promise）
- 错误处理需要手工实现

#### 选项 B: 使用通用 JSON-RPC 客户端库

**缺点**：

- 大部分库基于 HTTP，不支持 stdio
- 引入不必要的依赖

### 决策

**选择：选项 A - 直接使用 child_process.spawn 封装**

**理由**：

1. **KISS 原则**：child_process 是 Node.js 内置模块，无需额外依赖
2. **性能**：直接 stdio 通信，延迟最低
3. **灵活性**：完全控制进程生命周期和错误处理

**实现要点**：

- 使用 readline 模块处理 line-delimited JSON
- 使用 Map 维护 `request_id → Promise resolver` 映射
- 使用 EventEmitter 处理通知（notifications）
- 实现超时和错误恢复机制

---

## 决策 3: 异步响应机制设计

### 技术挑战

Codex 单会话限制：同一时刻只能运行一个 turn，如果 `tools/call`
阻塞等待执行完成，客户端将被长时间占用。

### 解决方案

**快速返回 + 事件通知模式**：

1. **`tools/call` 阶段**（< 500ms）：

   ```typescript
   async handleToolsCall(params) {
     const jobId = uuid();
     const conversationId = await this.startCodexConversation(params);

     // 快速返回
     return {
       status: 'accepted',
       jobId,
       conversationId,
       message: 'Task queued, progress will be sent via notifications'
     };
   }
   ```

2. **后台执行阶段**：
   - 监听 Codex 的 `codex/event` 通知
   - 转换为 MCP 通知：`codex-father/progress`
   - 使用 `jobId` 关联事件

3. **事件映射**：
   ```typescript
   // Codex event: { method: 'codex/event', params: { type: 'TaskStarted', ... } }
   // 转换为
   // MCP notification: { method: 'codex-father/progress', params: { jobId, eventType: 'TaskStarted', eventData: {...}, timestamp } }
   ```

**优点**：

- 客户端不阻塞，可以继续其他操作
- 符合异步任务管理最佳实践
- 满足 constitution 的性能要求（< 500ms）

**需要注意**：

- `jobId` 必须在 `tools/call` 响应中返回，客户端用于关联后续通知
- 通知必须包含完整的事件上下文（eventType, eventData, timestamp）
- 客户端需要实现通知处理逻辑

---

## 决策 4: 进程管理策略

### MVP1: 单进程管理

**技术方案**：

- 启动一个常驻 `codex mcp` 进程
- 维护 `request_id → conversationId` 映射
- 多个 `tools/call` 请求会排队执行（Codex 限制）

**实现要点**：

```typescript
class SingleProcessManager {
  private codexProcess: ChildProcess;
  private conversationMap = new Map<string, string>(); // request_id → conversationId

  async start() {
    this.codexProcess = spawn('codex', ['mcp']);
    this.setupHealthCheck();
  }

  async handleToolsCall(requestId, params) {
    const conversationId = await this.sendNewConversation(params);
    this.conversationMap.set(requestId, conversationId);
    return { jobId: requestId, conversationId };
  }

  private setupHealthCheck() {
    setInterval(() => {
      if (!this.isProcessAlive()) {
        this.restart(); // 自动重启
      }
    }, 5000);
  }
}
```

**已知限制**：

- 进程崩溃后会话状态丢失（MVP2 解决）
- 后端串行执行，无法真正并行

### MVP2: 进程池管理

**技术方案**：

- 维护多个 `codex exec --json` 子进程
- 每个任务分配到独立进程
- 进程数量可配置（默认：CPU 核数）

**实现要点**：

```typescript
class ProcessPoolManager {
  private pool: CodexExecProcess[] = [];
  private maxProcesses = os.cpus().length;

  async allocateProcess(taskId) {
    // 优先使用空闲进程
    let process = this.pool.find((p) => p.status === 'idle');

    // 否则创建新进程（如果未达上限）
    if (!process && this.pool.length < this.maxProcesses) {
      process = await this.spawnNewProcess();
      this.pool.push(process);
    }

    // 否则等待进程空闲
    if (!process) {
      process = await this.waitForIdleProcess();
    }

    process.assignTask(taskId);
    return process;
  }

  private async spawnNewProcess() {
    const proc = spawn('codex', ['exec', '--json', '--model', 'gpt-5']);
    return new CodexExecProcess(proc);
  }
}
```

**会话恢复**：

- 进程启动时记录 `rollout-ref.txt`（指向 `CODEX_HOME/sessions/<cid>.jsonl`）
- 崩溃时使用 `codex exec resume <session-id>` 恢复

---

## 决策 5: 会话恢复机制

### 技术约束

根据 `refer-research/openai-codex/codex-rs/exec/src/lib.rs:216`：

```rust
pub async fn resume_conversation_from_rollout(
    rollout_path: &Path, // 必须是 Codex 写入的 rollout 文件路径
    ...
) -> Result<...>
```

**关键发现**：

- 会话恢复**必须**使用 Codex 原生 rollout 文件（`CODEX_HOME/sessions/*.jsonl`）
- codex-father 的 `events.jsonl` 和 `config.json` **不能**用于恢复

### 解决方案

1. **记录 rollout 文件引用**：

   ```typescript
   // 在会话目录创建 rollout-ref.txt
   fs.writeFileSync(
     `${sessionDir}/rollout-ref.txt`,
     `${process.env.CODEX_HOME}/sessions/${conversationId}.jsonl`
   );
   ```

2. **崩溃恢复流程**：

   ```typescript
   async recoverSession(sessionDir) {
     const rolloutPath = fs.readFileSync(`${sessionDir}/rollout-ref.txt`, 'utf-8').trim();

     // 验证 rollout 文件存在
     if (!fs.existsSync(rolloutPath)) {
       throw new Error('Rollout file not found, cannot recover');
     }

     // 使用 codex exec resume 恢复
     const proc = spawn('codex', ['exec', 'resume', conversationId]);
     return new CodexExecProcess(proc);
   }
   ```

3. **防止 rollout 文件丢失**：
   - 定期备份到 codex-father 会话目录（可选）
   - 监控 `CODEX_HOME/sessions/` 目录，防止意外删除

**注意**：

- codex-father 的 `events.jsonl` 仅用于监控和审计，不参与恢复
- 如果 rollout 文件损坏或丢失，无法恢复（需要明确告知用户）

---

## 决策 6: 审批机制终端 UI

### 用户体验目标

根据 FR-022：

- 显示审批请求详情
- 显示等待时长计时器
- 提供清晰的操作提示（批准/拒绝/跳过）
- 支持快捷键
- 支持白名单自动批准

### 技术方案

**使用 inquirer 库**（已被广泛使用的交互式 CLI 工具）：

```typescript
import inquirer from 'inquirer';

async function promptApproval(request: ApprovalRequest) {
  console.log('\n⚠️  Approval Required');
  console.log(`Command: ${request.command}`);
  console.log(`CWD: ${request.cwd}`);
  console.log(`Reason: ${request.reason}`);

  const startTime = Date.now();
  const timer = setInterval(() => {
    process.stdout.write(
      `\rWaiting: ${Math.floor((Date.now() - startTime) / 1000)}s`
    );
  }, 1000);

  const { decision } = await inquirer.prompt([
    {
      type: 'list',
      name: 'decision',
      message: 'Your decision:',
      choices: [
        { name: '✅ Approve', value: 'allow' },
        { name: '❌ Deny', value: 'deny' },
        { name: '⏭️  Skip (add to whitelist)', value: 'whitelist' },
      ],
    },
  ]);

  clearInterval(timer);
  return decision;
}
```

**白名单支持**：

```typescript
// config/approval-whitelist.yaml
whitelist:
  - pattern: "^npm install"
    reason: "Safe dependency installation"
  - pattern: "^git status"
    reason: "Read-only git command"
```

---

## 决策 7: 性能优化策略

### 性能目标（来自 constitution）

- MCP 工具响应 < 500ms
- 事件通知延迟 < 100ms
- 内存占用 < 200MB

### 优化方案

#### 1. 快速返回（< 500ms）

- `tools/call` 只做请求验证和任务分配，不等待执行完成
- 使用异步响应 + 事件通知模式

#### 2. 事件通知优化（< 100ms）

- 直接转发 Codex 的 `codex/event`，不做复杂处理
- 使用流式解析 JSON（避免缓冲整个事件）
- 事件映射逻辑在内存中完成（不写磁盘）

#### 3. 内存占用控制（< 200MB）

- 日志使用流式写入，不缓存在内存
- 进程池大小限制（默认：CPU 核数）
- 定期清理已完成会话的内存映射

#### 4. 基准测试

Phase 1 将创建性能测试：

```typescript
// tests/benchmark/mcp-response-time.bench.ts
describe('MCP tools/call response time', () => {
  bench('tools/call should return < 500ms', async () => {
    const start = Date.now();
    await mcpServer.handleToolsCall({ ... });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });
});
```

---

## 技术栈总结

### 核心依赖

| 依赖                      | 版本   | 用途         | 理由                          |
| ------------------------- | ------ | ------------ | ----------------------------- |
| @modelcontextprotocol/sdk | latest | MCP 协议实现 | 官方 SDK，协议兼容性保障      |
| inquirer                  | ^9.x   | 终端交互 UI  | 成熟的 CLI 交互库             |
| winston                   | ^3.x   | 日志记录     | 已有依赖，结构化日志支持      |
| zod                       | ^3.x   | 数据验证     | 已有依赖，TypeScript 类型安全 |

### Node.js 内置模块

- `child_process`: 进程管理
- `readline`: line-delimited JSON 解析
- `fs/promises`: 异步文件操作
- `events`: EventEmitter（事件驱动）

---

## 风险与缓解

### 风险 1: MCP SDK 不支持 stdio

**可能性**：低（MCP 标准传输方式就是 stdio）
**缓解**：验证 SDK 文档，如果不支持则回退到自研实现

### 风险 2: Codex rollout 文件格式变更

**可能性**：中（Codex 仍在演进） **缓解**：

- 记录当前 Codex 版本（`codex --version`）
- 版本不兼容时提示用户升级或降级
- 定期跟进 Codex 发布日志

### 风险 3: 进程池管理复杂度

**可能性**：高（并发、崩溃、恢复的组合复杂度） **缓解**：

- MVP1 先实现单进程，验证核心流程
- MVP2 再扩展进程池，逐步增加复杂度
- 充分的集成测试覆盖

### 风险 4: 性能不达标

**可能性**：低（设计已考虑性能优化） **缓解**：

- Phase 1 创建性能基准测试
- 使用 clinic.js 等工具分析瓶颈
- 必要时使用 native addon（如 N-API）优化热路径

---

## 研究结论

所有关键技术决策已完成，无未解决的 NEEDS CLARIFICATION：

1. ✅ MCP 协议实现：使用 @modelcontextprotocol/sdk
2. ✅ Codex 通信：child_process.spawn + line-delimited JSON
3. ✅ 异步响应：快速返回 + 事件通知（`jobId` 关联）
4. ✅ 进程管理：MVP1 单进程，MVP2 进程池
5. ✅ 会话恢复：基于 Codex 原生 rollout 文件
6. ✅ 审批 UI：inquirer + 白名单配置
7. ✅ 性能优化：流式处理 + 异步响应 + 基准测试

**准备就绪，可以进入 Phase 1: Design & Contracts** ✓
