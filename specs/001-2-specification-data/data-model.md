# Phase 1: Data Model

**Feature**: Codex Father 2.0 重构实现  
**Date**: 2025-10-15  
**Status**: Completed  

## Core Entities

### 1. TaskConfig - 任务配置
```typescript
interface TaskConfig {
  id: string;                    // 任务唯一标识
  execute: () => Promise<any>;   // 执行函数
  timeout?: number;              // 超时时间（毫秒，默认10分钟）
  dependencies?: string[];       // 依赖任务ID列表
  priority?: 'low' | 'normal' | 'high'; // 优先级
  metadata?: Record<string, any>; // 元数据
  environment?: 'shell' | 'nodejs' | 'python'; // 执行环境
  workingDirectory?: string;     // 工作目录
}
```

### 2. TaskResult - 任务结果
```typescript
interface TaskResult {
  id: string;                    // 任务ID
  success: boolean;              // 执行成功状态
  result?: any;                  // 执行结果
  error?: string;                // 错误信息
  startTime: Date;               // 开始时间
  endTime: Date;                 // 结束时间
  duration: number;              // 执行时长（毫秒）
  logs?: string[];               // 执行日志
  metadata?: Record<string, any>; // 元数据
}
```

### 3. RunnerStatus - 运行状态
```typescript
interface RunnerStatus {
  running: number;               // 正在运行的任务数
  maxConcurrency: number;        // 最大并发数
  pending: number;               // 等待中的任务数
  completed: number;             // 已完成的任务数
  systemLoad?: {                 // 系统负载
    cpuUsage: number;            // CPU使用率
    memoryUsage: number;         // 内存使用率
  };
}
```

### 4. Session - 会话上下文
```typescript
interface Session {
  id: string;                    // 会话ID
  taskId: string;                // 关联任务ID
  status: 'running' | 'completed' | 'failed'; // 会话状态
  startTime: Date;               // 开始时间
  endTime?: Date;                // 结束时间
  messages: Message[];           // 消息历史
  metadata?: Record<string, any>; // 元数据
}
```

### 5. Message - 消息
```typescript
interface Message {
  role: 'user' | 'system' | 'assistant'; // 消息角色
  content: string;               // 消息内容
  timestamp: Date;               // 时间戳
  metadata?: Record<string, any>; // 元数据
}
```

## State Management

### TaskRunner 状态
```typescript
class TaskRunner {
  private running: Set<string> = new Set();           // 运行中任务
  private results: Map<string, TaskResult> = new Map(); // 任务结果
  private taskQueue: TaskConfig[] = [];               // 任务队列
  private maxConcurrency: number = 10;                // 最大并发
  private sessions: Map<string, Session> = new Map(); // 会话管理
}
```

### 状态转换图
```
Submitted → Queued → Running → Completed/Failed
    ↓         ↓        ↓           ↓
  生成ID    检查依赖   分配资源    执行任务
```

## Data Storage Schema

### JSON 文件结构
```json
{
  "tasks": {
    "running": ["task-1", "task-2"],
    "completed": ["task-3"],
    "results": {
      "task-1": { "id": "task-1", "success": true, ... },
      "task-2": { "id": "task-2", "success": false, ... }
    }
  },
  "sessions": {
    "session-1": { "id": "session-1", "taskId": "task-1", ... }
  },
  "config": {
    "maxConcurrency": 10,
    "defaultTimeout": 600000,
    "security": {
      "networkDisabled": true,
      "allowedPaths": ["/workspace"]
    }
  }
}
```

## MCP Protocol Schema

### 工具定义
```typescript
interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}
```

### 响应格式
```typescript
interface MCPResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}
```

## HTTP API Schema

### REST 端点
```
POST   /tasks              # 提交任务
GET    /tasks/{id}         # 查询任务状态
GET    /tasks              # 列出任务
POST   /tasks/{id}/reply   # 继续任务
DELETE /tasks/{id}         # 取消任务
GET    /healthz            # 健康检查
```

### WebSocket 消息
```typescript
interface WebSocketMessage {
  type: 'task_started' | 'task_progress' | 'task_completed' | 'task_failed';
  data: any;
  timestamp: string;
}
```

## Security Model

### 执行环境隔离
```typescript
interface SecurityPolicy {
  networkDisabled: boolean;     // 禁用网络访问
  allowedPaths: string[];       // 允许的文件路径
  maxExecutionTime: number;     // 最大执行时间
  maxMemoryUsage: number;       // 最大内存使用
  allowedCommands: string[];    // 允许的命令白名单
}
```

### 文件访问控制
```typescript
interface FileAccessControl {
  workingDirectory: string;     // 工作目录限制
  readonlyPaths: string[];      // 只读路径
  writablePaths: string[];      // 可写路径
  forbiddenPatterns: string[];  // 禁止的路径模式
}
```

## Performance Considerations

### 并发控制策略
- **队列管理**: 优先级队列 + 公平调度
- **资源监控**: CPU + 内存使用率监控
- **动态调整**: 根据系统负载自动调整并发数

### 内存管理
- **日志流式处理**: 避免大日志驻留内存
- **结果缓存**: LRU 缓存机制
- **垃圾回收**: 及时清理完成的任务数据

## Error Handling

### 错误分类
```typescript
enum ErrorType {
  TIMEOUT = 'TIMEOUT',
  DEPENDENCY_FAILED = 'DEPENDENCY_FAILED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR'
}
```

### 错误响应格式
```typescript
interface ErrorResponse {
  code: string;
  message: string;
  type: ErrorType;
  retryable: boolean;
  hint?: string;
  details?: any;
}
```

---

*Phase 1 Data Model Completed - Ready for Phase 2 Task Breakdown*