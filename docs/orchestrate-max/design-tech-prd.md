# Codex Father 技术设计文档

> **技术优先级**：MCP > HTTP > CLI
> 
> **设计原则**：极简架构、高并发性能、易于维护

## 🏗️ 整体架构设计

### 架构原则
1. **MCP 优先**：核心功能通过 MCP 暴露给 Claude Code
2. **分层解耦**：核心引擎与接口层分离
3. **插件化**：接口层可独立扩展
4. **最小依赖**：MCP 路径零外部依赖；HTTP/WS/CLI 为可选插件依赖
5. **第一性原理/最小可用**：仅保留跑通“开发多任务”的最小能力；非必要不引入基础设施（Docker、devcontainer 等暂不提供）

### 系统架构图
```
┌─────────────────────────────────────────────────────┐
│                  接口层（插件化）                      │
├─────────────┬─────────────┬─────────────────────────┤
│   MCP Server │   HTTP API  │      CLI Interface      │
│   (200 行)   │   (150 行)  │      (50 行)           │
└─────────────┴─────────────┴─────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────┐
│                  核心引擎层                           │
│              TaskRunner (100 行)                      │
├─────────────────────────────────────────────────────┤
│ • 并发控制    • 状态管理    • 任务调度                │
│ • 错误处理    • 资源监控    • 依赖管理                │
└─────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────┐
│                  执行层                               │
│              External Agents                         │
├─────────────────────────────────────────────────────┤
│ • Shell Commands  • HTTP Requests  • Functions     │
│ • File Operations • Docker       • Custom           │
└─────────────────────────────────────────────────────┘
```

## 🧭 与仓库规范对齐

- Stdout 契约：CLI orchestrate 的标准输出仅两行摘要（start、orchestration_completed|orchestration_failed）；详细事件写入 JSONL 审计文件。
- Gate 顺序：Manual Intervention → Understanding Check → Task Decomposer；失败路径需映射为统一错误事件与 MCP 错误码。
- 事件写入：统一由 `core/orchestrator/state-manager.ts` 写入 `.codex-father/sessions/<run-id>/events.jsonl`；MCP/HTTP/CLI 复用同一事件流。
- 术语与命名：统一对外使用 `taskId`；`session` 仅表示对话上下文；`job` 不对外暴露。
- 依赖与范围：MCP 为最小依赖闭环；HTTP/WS/CLI 为可选插件模块，默认关闭、按需启用。
 - 安全策略（进程内置默认）：禁用网络、固定工作目录为仓库根、默认超时、命令白名单；这些不通过协议字段暴露。

## 🪙 第一性原理与最小可用策略

- 当前不提供 Docker 与 devcontainer 配置；当且仅当“可复现环境”成为刚需时再引入（里程碑触发条件：跨团队协作、CI 隔离环境、沙箱需求明确）。
- 最小环境要求：Node.js 18+、npm；MCP 通过 stdio 连接即可运行；无数据库、无外部服务的硬依赖。
- 功能范围最小化：MCP 工具“六件套”闭环；HTTP/CLI/WS 作为可选插件，默认不开启。
- 文档与实现一一对应：示例以最小可用为准，扩展能力统一归档于“未来扩展”。

## 📦 目录结构

```
codex-father/
├── src/
│   ├── core/
│   │   ├── TaskRunner.ts      # 核心执行引擎（100 行）
│   │   ├── types.ts           # 类型定义（50 行）
│   │   └── utils.ts           # 工具函数（30 行）
│   ├── interfaces/
│   │   ├── mcp/
│   │   │   ├── server.ts      # MCP 服务器（200 行）
│   │   │   ├── tools.ts       # MCP 工具定义（50 行）
│   │   │   └── handlers.ts    # 请求处理器（50 行）
│   │   ├── http/
│   │   │   ├── server.ts      # HTTP 服务器（100 行）
│   │   │   ├── routes.ts      # 路由定义（30 行）
│   │   │   └── websocket.ts   # WebSocket 支持（20 行）
│   │   └── cli/
│   │       ├── index.ts       # CLI 入口（30 行）
│   │       └── commands.ts    # 命令实现（20 行）
│   └── index.ts               # 主入口（20 行）
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 核心组件设计

### 1. TaskRunner - 核心引擎

```typescript
// src/core/TaskRunner.ts
export interface RunnerStatus {
  running: number;
  maxConcurrency: number;
  pending: number;
  completed: number;
}

export interface TaskConfig {
  id: string;
  execute: () => Promise<any>;
  timeout?: number;
  dependencies?: string[];
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>;
}

export interface TaskResult {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  logs?: string[];
  metadata?: Record<string, any>;
}

export class TaskRunner {
  private running: Set<string> = new Set();
  private results: Map<string, TaskResult> = new Map();
  private maxConcurrency: number;
  private taskQueue: TaskConfig[] = [];

  constructor(maxConcurrency: number = 10) {
    this.maxConcurrency = maxConcurrency;
  }

  /** 提交任务执行 */
  async run(task: TaskConfig): Promise<string> {
    this.validateTask(task);
    await this.checkDependencies(task);
    this.taskQueue.push(task);
    void this.processQueue();
    return task.id;
  }

  /** 并发执行任务 */
  private async processQueue(): Promise<void> {
    while (this.running.size < this.maxConcurrency && this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!;
      void this.executeTask(task);
    }
  }

  private async executeTask(task: TaskConfig): Promise<void> {
    this.running.add(task.id);
    const start = new Date();
    try {
      const result = await this.withTimeout(task.execute(), task.timeout ?? 300000);
      const end = new Date();
      this.results.set(task.id, {
        id: task.id,
        success: true,
        result,
        startTime: start,
        endTime: end,
        duration: end.getTime() - start.getTime(),
      });
    } catch (e: any) {
      const end = new Date();
      this.results.set(task.id, {
        id: task.id,
        success: false,
        error: e?.message ?? String(e),
        startTime: start,
        endTime: end,
        duration: end.getTime() - start.getTime(),
      });
    } finally {
      this.running.delete(task.id);
      void this.processQueue();
    }
  }

  /** 获取任务结果 */
  getResult(taskId: string): TaskResult | undefined {
    return this.results.get(taskId);
  }

  /** 获取执行状态 */
  getStatus(): RunnerStatus {
    return {
      running: this.running.size,
      maxConcurrency: this.maxConcurrency,
      pending: this.taskQueue.length,
      completed: this.results.size,
    };
  }

  private validateTask(task: TaskConfig): void {
    if (!task?.id || typeof task.execute !== 'function') {
      throw new Error('Invalid task: id and execute are required');
    }
  }

  private async checkDependencies(_task: TaskConfig): Promise<void> {
    // 占位：可在此检查依赖任务是否已成功完成
    return;
  }

  private async withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    if (!ms || ms <= 0) return p;
    return await Promise.race([
      p,
      new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Timeout')), ms)),
    ]);
  }
}
```

### 2. MCP Server - 第一优先级

```typescript
// src/interfaces/mcp/server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createStdioServer } from '@modelcontextprotocol/sdk/server/stdio.js';

export class MCPServer {
  private server: Server;
  private runner: TaskRunner;
  private sessions: Map<string, Session> = new Map();

  constructor(runner: TaskRunner) {
    this.runner = runner;
    this.server = new Server(
      { name: 'codex-father', version: '2.0.0' },
      { capabilities: { tools: {} } }
    );
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // 工具列表
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'codex_exec',
          description: 'Execute a development task',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              prompt: { type: 'string' },
              command: { type: 'string' },
              files: { type: 'array', items: { type: 'string' } },
              priority: { type: 'string' },
              dependencies: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        { name: 'codex_status', description: 'Check task execution status' },
        { name: 'codex_logs', description: 'Tail or fetch task logs' },
        { name: 'codex_reply', description: 'Append context or files to a running task' },
        { name: 'codex_list', description: 'List tasks with filters' },
        { name: 'codex_cancel', description: 'Cancel a running task' },
      ],
    }));

    // 工具调用
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      switch (name) {
        case 'codex_exec':
          return await this.handleExec(args);
        case 'codex_status':
          return await this.handleStatus(args);
        case 'codex_reply':
          return await this.handleReply(args);
        case 'codex_logs':
          return await this.handleLogs(args);
        case 'codex_list':
          return await this.handleList(args);
        case 'codex_cancel':
          return await this.handleCancel(args);
        // ... 其他工具处理
      }
    });
  }

  private async handleExec(args: any): Promise<any> {
    const { prompt, command, files = [] } = args;
    const taskId = args?.taskId ?? `task-${Date.now()}`;
    
    // 创建会话
    this.sessions.set(taskId, {
      id: taskId,
      prompt,
      files,
      status: 'running',
      startTime: new Date(),
    });

    // 构建执行函数
    const executeFn = async () => {
      if (command) {
        return await this.executeCommand(command);
      } else {
        return await this.executePrompt(prompt, files);
      }
    };

    // 提交任务
    await this.runner.run({
      id: taskId,
      execute: executeFn,
    });

    return {
      content: [{ type: 'text', text: `✅ Task accepted: ${taskId}` }],
    };
  }

  async start(): Promise<void> {
    // 使用 stdio 传输（MCP 最小依赖）
    await this.server.connect(createStdioServer());
  }
}
```

### 3. HTTP API - 第二优先级

```typescript
// src/interfaces/http/server.ts
import express from 'express';
import cors from 'cors';
import expressWs from 'express-ws';

export class HTTPServer {
  private app: express.Application;
  private runner: TaskRunner;

  constructor(runner: TaskRunner) {
    this.runner = runner;
    this.app = express();
    // 注意：HTTP/WS 为可选插件依赖
    expressWs(this.app);
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(cors());
  }

  private setupRoutes(): void {
    // 提交任务
    this.app.post('/tasks', async (req, res) => {
      const taskId = await this.runner.run(req.body);
      res.json({ taskId, status: 'started' });
    });

    // 查询任务
    this.app.get('/tasks/:id', (req, res) => {
      const result = this.runner.getResult(req.params.id);
      res.json(result || { status: 'pending' });
    });

    // 列出所有任务
    this.app.get('/tasks', (req, res) => {
      res.json(this.runner.getStatus());
    });

    // WebSocket 端点
    this.app.ws('/ws', (ws) => {
      // 实时状态推送
      this.setupWebSocket(ws);
    });
  }

  async start(port: number = 3000): Promise<void> {
    this.app.listen(port, () => {
      console.log(`HTTP Server running on port ${port}`);
    });
  }
}
```

### 4. CLI Interface - 第三优先级

```typescript
// src/interfaces/cli/index.ts
#!/usr/bin/env node
import { Command } from 'commander';
import { TaskRunner } from '../../core/TaskRunner.js';
import { MCPServer } from '../mcp/server.js';
import { HTTPServer } from '../http/server.js';

const program = new Command();

program
  .name('codex-father')
  .description('A simple task runner for developers')
  .version('2.0.0');

// MCP 模式（默认）
program
  .command('mcp')
  .description('Start MCP server')
  .option('--max-concurrency <number>', 'Max concurrent tasks', '10')
  .action(async (options) => {
    const runner = new TaskRunner(parseInt(options.maxConcurrency));
    const server = new MCPServer(runner);
    await server.start();
  });

// HTTP 模式
program
  .command('server')
  .description('Start HTTP server')
  .option('--port <number>', 'Port to listen on', '3000')
  .option('--max-concurrency <number>', 'Max concurrent tasks', '10')
  .action(async (options) => {
    const runner = new TaskRunner(parseInt(options.maxConcurrency));
    const server = new HTTPServer(runner);
    await server.start(parseInt(options.port));
  });

// CLI 模式
program
  .command('run')
  .description('Run tasks from config file')
  .argument('<config>', 'Task configuration file')
  .option('--max-concurrency <number>', 'Max concurrent tasks', '5')
  .action(async (configFile, options) => {
    const runner = new TaskRunner(parseInt(options.maxConcurrency));
    const tasks = await loadConfig(configFile);
    await Promise.all(tasks.map(task => runner.run(task)));
  });

program.parse();
```

## 🔄 任务执行流程

### 1. MCP 任务执行流程
```
Claude Code → MCP Server → TaskRunner → Execute → Result → Claude Code
     ↓              ↓             ↓           ↓         ↑
  对话触发    工具调用处理    并发控制    实际执行   结果返回
```

### 2. 任务生命周期
```
Submitted → Queued → Running → Completed/Failed
    ↓         ↓        ↓           ↓
  生成ID    检查依赖   分配资源    执行任务
```

## 📊 性能优化

### 1. 并发控制
```typescript
// 智能并发调整
class AdaptiveConcurrency {
  private baseConcurrency: number = 10;
  private currentConcurrency: number = 10;
  private metrics: PerformanceMetrics;

  adjustConcurrency(): void {
    const cpuUsage = this.metrics.getCPUUsage();
    const avgWaitTime = this.metrics.getAverageWaitTime();
    
    if (cpuUsage > 80 || avgWaitTime > 5000) {
      // 降低并发
      this.currentConcurrency = Math.max(1, this.currentConcurrency - 2);
    } else if (cpuUsage < 50 && avgWaitTime < 1000) {
      // 提高并发
      this.currentConcurrency = Math.min(50, this.currentConcurrency + 2);
    }
  }
}
```

### 2. 资源管理
```typescript
// 轻量级任务队列
class TaskQueue {
  private queue: TaskConfig[] = [];
  private processing = false;

  async add(task: TaskConfig): Promise<void> {
    this.queue.push(task);
    if (!this.processing) {
      this.process();
    }
  }

  private async process(): Promise<void> {
    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await this.executeTask(task);
    }
    this.processing = false;
  }
}
```

## 🧪 测试策略

### 1. 单元测试
```typescript
// tests/TaskRunner.test.ts
describe('TaskRunner', () => {
  test('should execute task successfully', async () => {
    const runner = new TaskRunner(1);
    const task = {
      id: 'test-1',
      execute: async () => 'success',
    };
    
    const taskId = await runner.run(task);
    expect(taskId).toBe('test-1');
    
    const result = runner.getResult(taskId);
    expect(result?.success).toBe(true);
    expect(result?.result).toBe('success');
  });
});
```

### 2. 集成测试
```typescript
// tests/mcp-integration.test.ts
describe('MCP Integration', () => {
  test('should handle codex_exec tool call', async () => {
    const runner = new TaskRunner();
    const server = new MCPServer(runner);
    // 直接调用内部处理函数进行单测（示例）
    const response = await (server as any).handleExec({
      prompt: 'Create a simple function'
    });
    expect(response.content[0].text).toContain('✅ Task accepted');
  });
});
```

## 📦 部署方案

### 1. NPM 包发布
```json
{
  "name": "codex-father",
  "version": "2.0.0",
  "main": "dist/index.js",
  "bin": {
    "codex-father": "dist/cli/index.js"
  },
  "files": [
    "dist",
    "README.md"
  ]
}
```

### 2. MCP 配置
```json
{
  "mcpServers": {
    "codex-father": {
      "command": "codex-father",
      "args": ["mcp", "--max-concurrency", "10"]
    }
  }
}
```

## 📝 API 文档与协议 Schema

### MCP 协议 Schema

#### 1. codex_exec - 提交开发任务（AI 或命令）
```json
{
  "name": "codex_exec",
  "description": "Submit a development task (AI prompt or command) for execution",
  "inputSchema": {
    "type": "object",
    "properties": {
      "taskId": { "type": "string", "pattern": "^[a-zA-Z0-9_-]+$", "description": "Custom task id; server generates if omitted" },
      "prompt": { "type": "string", "description": "Natural language prompt for AI execution" },
      "command": { "type": "string", "description": "Shell command to execute" },
      "files": { "type": "array", "items": { "type": "string" }, "description": "Files/paths to include in context" },
      "priority": { "type": "string", "enum": ["low", "normal", "high"], "default": "normal" },
      "dependencies": { "type": "array", "items": { "type": "string" } }
    },
    "anyOf": [
      { "required": ["prompt"] },
      { "required": ["command"] }
    ]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "content": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "type": { "type": "string", "enum": ["text"] },
            "text": { "type": "string" }
          },
          "required": ["type", "text"]
        }
      }
    }
  }
}
```

#### 2. codex_status - 查看任务状态
```json
{
  "name": "codex_status",
  "description": "Check task execution status",
  "inputSchema": {
    "type": "object",
    "properties": {
      "taskId": { "type": "string", "description": "Task ID to check" },
      "includeResult": { "type": "boolean", "description": "Include final result if completed", "default": false }
      }
    },
    "required": ["taskId"]
  }
}
```

#### 3. codex_reply - 继续执行（向任务追加上下文）
```json
{
  "name": "codex_reply",
  "description": "Reply to a running task with additional context",
  "inputSchema": {
    "type": "object",
    "properties": {
      "taskId": { "type": "string", "description": "Task ID to reply to" },
      "message": { "type": "string", "description": "Message to append to task context" },
      "files": { "type": "array", "items": { "type": "string" }, "description": "Additional files to include" }
    },
    "required": ["taskId", "message"]
  }
}
```

#### 4. codex_logs - 查看日志
```json
{
  "name": "codex_logs",
  "description": "Get task execution logs",
  "inputSchema": {
    "type": "object",
    "properties": {
      "taskId": { "type": "string", "description": "Task ID" },
      "tailLines": { "type": "integer", "description": "Number of lines to show from end", "default": 50, "minimum": 1, "maximum": 1000 },
      "cursor": { "type": "string", "description": "Pagination cursor for incremental log fetch" }
    },
    "required": ["taskId"]
  }
}
```

日志保留策略（重要）：
- 系统完整保留原始执行日志与事件日志，默认不丢弃、不截断。
- 通过 `cursor` 进行增量分页获取，可从头至尾完整回放；`tailLines` 仅控制本次返回的行数，不影响持久化与保留策略。


#### 5. codex_list - 列出任务
```json
{
  "name": "codex_list",
  "description": "List all tasks",
  "inputSchema": {
    "type": "object",
    "properties": {
      "status": { "type": "array", "items": { "type": "string", "enum": ["running", "completed", "failed", "pending", "cancelled"] } },
      "limit": { "type": "integer", "description": "Maximum number of tasks to return", "default": 20, "minimum": 1, "maximum": 100 },
      "cursor": { "type": "string", "description": "Pagination cursor" }
    }
  }
}
```

#### 6. codex_cancel - 取消任务
```json
{
  "name": "codex_cancel",
  "description": "Cancel a running task",
  "inputSchema": {
    "type": "object",
    "properties": {
      "taskId": { "type": "string", "description": "Task ID" }
    },
    "required": ["taskId"]
  }
}
```

### MCP 通讯格式示例

#### 工具调用请求
```json
{
  "jsonrpc": "2.0",
  "id": "call-123",
  "method": "tools/call",
  "params": {
    "name": "codex_exec",
    "arguments": {
      "prompt": "创建用户登录组件，包括表单验证和错误处理",
      "files": ["src/components/", "src/styles/"],
      "priority": "high"
    }
  }
}
```

#### 工具响应
```json
{
  "jsonrpc": "2.0",
  "id": "call-123",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "✅ Task accepted: task-1704067200000-abc123\n建议每 2 秒轮询 codex_status 或按需拉取 codex_logs。"
      }
    ]
  }
}
```

### HTTP API 协议 Schema

#### 1. POST /tasks - 提交任务
```typescript
// Request
interface SubmitTaskRequest {
  id?: string;
  prompt?: string;
  command?: string;
  files?: string[];
  labels?: string[];
  priority?: 'low' | 'normal' | 'high';
  dependencies?: string[];
  constraints?: { cpuSeconds?: number; memoryMB?: number; maxFilesWrite?: number; maxExecMs?: number };
  policy?: { allowShell?: boolean; allowNetwork?: boolean; allowedCommands?: string[]; workingDirectory?: string };
  timeout?: number; // 兼容旧字段
  workingDirectory?: string;
  environment?: Record<string, string>;
  idempotencyKey?: string;
}

// Response
interface SubmitTaskResponse {
  success: boolean;
  taskId: string;
  status: 'started' | 'queued';
  message?: string;
}

// Example
POST /tasks
Content-Type: application/json

{
  "prompt": "实现用户认证 API",
  "files": ["src/api/", "src/models/"],
  "timeout": 300000
}

// Response
{
  "success": true,
  "taskId": "task-1704067200000-xyz789",
  "status": "started",
  "message": "Task submitted successfully"
}
```

#### 2. GET /tasks/:id - 查询任务
```typescript
// Response
interface TaskStatusResponse {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  startTime?: string;
  endTime?: string;
  duration?: number;
  result?: any;
  error?: string;
  logs?: string[];
  phase?: string;
}

// Example
GET /tasks/task-1704067200000-xyz789

{
  "taskId": "task-1704067200000-xyz789",
  "status": "completed",
  "progress": 100,
  "startTime": "2024-01-01T12:00:00.000Z",
  "endTime": "2024-01-01T12:02:30.000Z",
  "duration": 150000,
  "result": {
    "filesCreated": [
      "src/api/auth.js",
      "src/models/User.js",
      "src/middleware/auth.js"
    ],
    "summary": "User authentication API implemented successfully"
  }
}
```

#### 3. GET /tasks - 列出所有任务
```typescript
// Query Parameters
interface ListTasksQuery {
  status?: ('running' | 'completed' | 'failed' | 'pending' | 'cancelled')[];
  labels?: string[];
  limit?: number;
  cursor?: string;
  orderBy?: 'createdAt' | 'duration' | 'status' | 'priority';
  order?: 'asc' | 'desc';
}

// Response
interface ListTasksResponse {
  tasks: TaskStatusResponse[];
  total: number;
  hasMore: boolean;
}

// Example
GET /tasks?status=running&limit=10&orderBy=createdAt&order=desc

{
  "tasks": [
    {
      "taskId": "task-1704067200000-abc123",
      "status": "running",
      "progress": 45,
      "startTime": "2024-01-01T12:00:00.000Z"
    }
  ],
  "total": 1,
  "hasMore": false
}
```

#### 4. WebSocket /ws - 实时更新
```typescript
// WebSocket Message Types
interface WebSocketMessage {
  type: 'task_started' | 'task_progress' | 'task_completed' | 'task_failed' | 'task_cancelled' | 'status_update';
  data: any;
  timestamp: string;
}

// Task Started
{
  "type": "task_started",
  "data": {
    "taskId": "task-1704067200000-abc123",
    "prompt": "创建用户登录组件"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}

// Task Progress
{
  "type": "task_progress",
  "data": {
    "taskId": "task-1704067200000-abc123",
    "progress": 60,
    "message": "正在实现表单验证..."
  },
  "timestamp": "2024-01-01T12:01:00.000Z"
}

// Task Completed
{
  "type": "task_completed",
  "data": {
    "taskId": "task-1704067200000-abc123",
    "result": {
      "filesCreated": 3,
      "summary": "登录组件创建完成"
    },
    "duration": 120000
  },
  "timestamp": "2024-01-01T12:02:00.000Z"
}
```

### 内部数据结构

#### TaskConfig
```typescript
interface TaskConfig {
  id: string;
  execute: () => Promise<any>;
  timeout?: number;
  dependencies?: string[];
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>;
}
```

#### TaskResult
```typescript
interface TaskResult {
  id: string;
  success: boolean;
  result?: any;
  error?: string;
  duration: number;
  startTime: Date;
  endTime: Date;
  logs?: string[];
  metadata?: Record<string, any>;
}
```

#### Session
```typescript
interface Session {
  id: string;
  prompt?: string;
  command?: string;
  files: string[];
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  messages: Message[];
}

interface Message {
  role: 'user' | 'system' | 'assistant';
  content: string;
  timestamp: Date;
}
```

### 错误处理格式

#### MCP 错误响应
```json
{
  "jsonrpc": "2.0",
  "id": "call-123",
  "error": {
    "code": -32000,
    "message": "Task execution failed: Command timeout",
    "data": {
      "taskId": "task-1704067200000-abc123",
      "errorType": "TIMEOUT",
      "retryable": true,
      "hint": "请缩短命令执行时间或调整默认超时配置，或拆分任务"
    }
  }
}
```

#### HTTP 错误响应
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    hint?: string;
    details?: any;
    requestId: string;
    timestamp: string;
  }
}

// Example
{
  "success": false,
  "error": {
    "code": "TASK_TIMEOUT",
    "message": "Task execution timeout",
    "hint": "考虑拆分任务或增大 timeout",
    "details": {
      "taskId": "task-1704067200000-abc123",
      "timeout": 300000,
      "actualDuration": 300000
    },
    "requestId": "req-xyz789",
    "timestamp": "2024-01-01T12:05:00.000Z"
  }
}
```

### 术语表与 ID 策略
- `taskId`：任务唯一标识，对外统一使用（推荐 `uuidv7` 或 `task-<timestamp>-<rand>` 形式）。
- `session`：会话上下文，承载与 MCP/CLI 的交互消息；不等同于任务。
- `priority`：`low|normal|high`，影响队列调度顺序，不保证抢占。

### stdout 契约与事件映射（与仓库一致）
- Stdout 仅两行：`start` 与 `orchestration_completed|orchestration_failed`。
- 事件（示例）：`task_scheduled`、`task_started`、`tool_use`、`patch_applied`、`task_failed`、`task_completed`、`orchestration_completed`。
- MCP 响应保持轻量（文本确认），长日志经 `codex_logs` 增量拉取；状态通过 `codex_status` 轮询或订阅。

### 状态码定义

#### HTTP 状态码
- `200` - 成功
- `201` - 任务创建成功
- `400` - 请求参数错误
- `404` - 任务不存在
- `409` - 任务状态冲突
- `429` - 并发任务数超限
- `500` - 服务器内部错误
- `503` - 服务暂时不可用

#### MCP 错误码
- `-32602` - 无效参数
- `-32603` - 内部错误
- `-32001` - 任务不存在
- `-32002` - 任务执行失败
- `-32003` - 超时
- `-32004` - 资源不足

## 🔒 安全考虑

### 1. MCP 安全
- 命令注入防护
- 文件路径验证
- 超时保护
- 资源限制

### 2. HTTP 安全
- CORS 配置
- 请求大小限制
- 认证中间件（可选）
- HTTPS 支持

## 📈 监控指标

### 性能指标
- 任务执行时间
- 并发任务数
- 成功率
- 资源使用率

### 业务指标
- MCP 调用次数
- HTTP 请求数
- 平均响应时间
- 错误率

---

**总结**：通过极简的架构设计和明确的优先级，Codex Father 2.0 将成为一个高效、可靠的并发任务管理工具，特别优化了与 Claude Code 的集成体验。
