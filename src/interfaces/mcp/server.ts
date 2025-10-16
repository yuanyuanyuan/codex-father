import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createStdioServer } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TaskRunner } from '../../core/TaskRunner.js';
import { SessionManager } from './session-manager.js';
import { SecurityManager } from './security-manager.js';
import { MCPToolHandlers } from './handlers.js';

export class MCPServer {
  private server: Server;
  private runner: TaskRunner;
  private sessionManager: SessionManager;
  private securityManager: SecurityManager;
  private handlers: MCPToolHandlers;

  constructor(runner: TaskRunner = new TaskRunner()) {
    this.runner = runner;
    this.sessionManager = new SessionManager();
    this.securityManager = new SecurityManager();
    this.server = new Server(
      {
        name: 'codex-father',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.handlers = new MCPToolHandlers(this.runner);
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'codex_exec',
          description: 'Execute a development task (AI prompt or command)',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: {
                type: 'string',
                pattern: '^[a-zA-Z0-9_-]+$',
                description: 'Custom task id; server generates if omitted',
              },
              prompt: {
                type: 'string',
                description: 'Natural language prompt for AI execution',
              },
              command: {
                type: 'string',
                description: 'Shell command to execute',
              },
              files: {
                type: 'array',
                items: { type: 'string' },
                description: 'Files/paths to include in context',
              },
              priority: {
                type: 'string',
                enum: ['low', 'normal', 'high'],
                default: 'normal',
              },
              dependencies: {
                type: 'array',
                items: { type: 'string' },
              },
              environment: {
                type: 'string',
                enum: ['shell', 'nodejs', 'python'],
                default: 'shell',
              },
              timeout: {
                type: 'number',
                description: 'Timeout in milliseconds (default: 600000)',
              },
            },
            anyOf: [{ required: ['prompt'] }, { required: ['command'] }],
          },
        },
        {
          name: 'codex_status',
          description: 'Check task execution status',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: { type: 'string', description: 'Task ID to check' },
              includeResult: {
                type: 'boolean',
                description: 'Include final result if completed',
                default: false,
              },
            },
            required: ['taskId'],
          },
        },
        {
          name: 'codex_logs',
          description: 'Get task execution logs',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: { type: 'string', description: 'Task ID' },
              tailLines: {
                type: 'integer',
                description: 'Number of lines to show from end',
                default: 50,
                minimum: 1,
                maximum: 1000,
              },
              cursor: {
                type: 'string',
                description: 'Pagination cursor for incremental log fetch',
              },
            },
            required: ['taskId'],
          },
        },
        {
          name: 'codex_reply',
          description: 'Reply to a running task with additional context',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: { type: 'string', description: 'Task ID to reply to' },
              message: { type: 'string', description: 'Message to append to task context' },
              files: {
                type: 'array',
                items: { type: 'string' },
                description: 'Additional files to include',
              },
            },
            required: ['taskId', 'message'],
          },
        },
        {
          name: 'codex_list',
          description: 'List all tasks',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['running', 'completed', 'failed', 'pending', 'cancelled'],
                },
              },
              limit: {
                type: 'integer',
                description: 'Maximum number of tasks to return',
                default: 20,
                minimum: 1,
                maximum: 100,
              },
              cursor: { type: 'string', description: 'Pagination cursor' },
            },
          },
        },
        {
          name: 'codex_cancel',
          description: 'Cancel a running task',
          inputSchema: {
            type: 'object',
            properties: {
              taskId: { type: 'string', description: 'Task ID to cancel' },
            },
            required: ['taskId'],
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'codex_exec':
            return await this.handlers.handleExec(args);
          case 'codex_status':
            return await this.handlers.handleStatus(args);
          case 'codex_logs':
            return await this.handlers.handleLogs(args);
          case 'codex_reply':
            return await this.handlers.handleReply(args);
          case 'codex_list':
            return await this.handlers.handleList(args);
          case 'codex_cancel':
            return await this.handlers.handleCancel(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async start(): Promise<void> {
    await this.server.connect(createStdioServer());
  }

  // 添加 handleToolCall 方法供测试使用
  async handleToolCall(request: any, writeStream?: any): Promise<any> {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'codex_exec':
          return await this.handleExec(args);
        case 'codex_status':
          return await this.handleStatus(args);
        case 'codex_logs':
          return await this.handleLogs(args);
        case 'codex_reply':
          return await this.handleReply(args);
        case 'codex_list':
          return await this.handleList(args);
        case 'codex_cancel':
          return await this.handleCancel(args);
        default:
          return this.createMCPError(-32601, `Unknown tool: ${name}`);
      }
    } catch (error: any) {
      return this.createMCPError(-32603, `Internal error: ${error.message}`);
    }
  }

  // 工具处理方法
  private async handleExec(args: any): Promise<any> {
    try {
      // 验证必需参数
      if (!args.prompt && !args.command) {
        return this.createMCPError(-32602, 'prompt or command is required');
      }

      // 验证环境类型
      if (args.environment && !['shell', 'nodejs', 'python'].includes(args.environment)) {
        return this.createMCPError(-32602, 'Invalid environment type');
      }

      // 安全验证
      if (args.command && !this.securityManager.validateCommand(args.command)) {
        return this.createMCPError(-32005, 'Security violation: Dangerous command detected');
      }

      // 文件路径验证
      if (args.files) {
        for (const file of args.files) {
          if (!this.securityManager.validateFilePath(file)) {
            return this.createMCPError(-32005, 'Security violation: Invalid file path');
          }
        }
      }

      // 执行任务
      const taskId = args.taskId || this.generateTaskId();
      const task = {
        id: taskId,
        prompt: args.prompt,
        command: args.command,
        files: args.files || [],
        environment: args.environment || 'shell',
        priority: args.priority || 'normal',
        dependencies: args.dependencies || [],
        timeout: args.timeout || 600000,
      };

      const result = await this.runner.run(task);

      // 创建会话
      this.sessionManager.createSession(result);

      return {
        content: [
          {
            type: 'text',
            text: `✅ Task accepted: ${result}`,
          },
        ],
      };
    } catch (error: any) {
      return this.createMCPError(-32002, `Task execution failed: ${error.message}`);
    }
  }

  private async handleStatus(args: any): Promise<any> {
    try {
      if (!args.taskId) {
        return this.createMCPError(-32602, 'taskId is required');
      }

      const result = this.runner.getResult(args.taskId);

      if (!result) {
        return this.createMCPError(-32001, 'Task not found');
      }

      const response: any = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              taskId: result.taskId,
              status: result.status,
              progress: result.progress || 0,
              startTime: result.startTime,
              ...(args.includeResult && result.result && { result: result.result }),
              ...(result.endTime && { endTime: result.endTime }),
              ...(result.duration && { duration: result.duration })
            }, null, 2),
          },
        ],
      };

      return response;
    } catch (error: any) {
      return this.createMCPError(-32603, `Status check failed: ${error.message}`);
    }
  }

  private async handleLogs(args: any): Promise<any> {
    try {
      if (!args.taskId) {
        return this.createMCPError(-32602, 'taskId is required');
      }

      const options: any = {};
      if (args.tailLines) options.tailLines = args.tailLines;
      if (args.cursor) options.cursor = args.cursor;

      const logs = await this.getTaskLogs(args.taskId, options);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(logs, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return this.createMCPError(-32603, `Logs retrieval failed: ${error.message}`);
    }
  }

  private async handleReply(args: any): Promise<any> {
    try {
      if (!args.taskId) {
        return this.createMCPError(-32602, 'taskId is required');
      }
      if (!args.message) {
        return this.createMCPError(-32602, 'message is required');
      }

      // 文件路径验证
      if (args.files) {
        for (const file of args.files) {
          if (!this.securityManager.validateFilePath(file)) {
            return this.createMCPError(-32005, 'Security violation: Invalid file path');
          }
        }
      }

      const success = await this.appendToTask(args.taskId, {
        message: args.message,
        files: args.files || [],
      });

      if (!success) {
        return this.createMCPError(-32001, 'Task not found');
      }

      return {
        content: [
          {
            type: 'text',
            text: '✅ Context added to task',
          },
        ],
      };
    } catch (error: any) {
      return this.createMCPError(-32603, `Reply failed: ${error.message}`);
    }
  }

  private async handleList(args: any): Promise<any> {
    try {
      // 验证限制参数
      if (args.limit && (args.limit < 1 || args.limit > 100)) {
        return this.createMCPError(-32602, 'limit must be between 1 and 100');
      }

      const filters: any = {};
      if (args.status) filters.status = args.status;
      if (args.limit) filters.limit = args.limit;
      if (args.cursor) filters.cursor = args.cursor;

      const result = await this.listTasks(filters);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error: any) {
      return this.createMCPError(-32603, `List tasks failed: ${error.message}`);
    }
  }

  private async handleCancel(args: any): Promise<any> {
    try {
      if (!args.taskId) {
        return this.createMCPError(-32602, 'taskId is required');
      }

      const success = await this.runner.cancel(args.taskId);

      if (!success) {
        return this.createMCPError(-32001, 'Task not found or cannot cancel');
      }

      return {
        content: [
          {
            type: 'text',
            text: '✅ Task cancelled successfully',
          },
        ],
      };
    } catch (error: any) {
      return this.createMCPError(-32003, `Cancel failed: ${error.message}`);
    }
  }

  // 辅助方法
  private getTaskLogs(taskId: string, options: any): Promise<any> {
    // 委托给SessionManager
    return this.sessionManager.getTaskLogs(taskId, options);
  }

  private async appendToTask(taskId: string, data: any): Promise<boolean> {
    // 委托给SessionManager
    return this.sessionManager.appendToTask(taskId, data);
  }

  private async listTasks(filters: any): Promise<any> {
    // 委托给TaskRunner
    return this.runner.listTasks(filters);
  }

  private generateTaskId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `task-${timestamp}-${random}`;
  }

  private createMCPError(code: number, message: string, data?: any): any {
    return {
      error: {
        code,
        message,
        data: data || {
          errorType: this.getErrorType(code),
          retryable: code >= -32004
        }
      }
    };
  }

  private getErrorType(code: number): string {
    switch (code) {
      case -32602: return 'InvalidParams';
      case -32603: return 'InternalError';
      case -32001: return 'TaskNotFound';
      case -32002: return 'TaskExecutionFailed';
      case -32003: return 'Timeout';
      case -32004: return 'ResourceInsufficient';
      case -32005: return 'SecurityViolation';
      default: return 'UnknownError';
    }
  }

  // Getter方法供测试使用
  get runner() {
    return this.runner;
  }

  get sessionManager() {
    return this.sessionManager;
  }

  get securityManager() {
    return this.securityManager;
  }

  // 获取工具列表
  getTools(): any[] {
    return [
      {
        name: 'codex_exec',
        description: 'Execute a development task (AI prompt or command)',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: {
              type: 'string',
              pattern: '^[a-zA-Z0-9_-]+$',
              description: 'Custom task id; server generates if omitted',
            },
            prompt: {
              type: 'string',
              description: 'Natural language prompt for AI execution',
            },
            command: {
              type: 'string',
              description: 'Shell command to execute',
            },
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Files/paths to include in context',
            },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high'],
              default: 'normal',
            },
            dependencies: {
              type: 'array',
              items: { type: 'string' },
              description: 'Task IDs that must complete first',
            },
            environment: {
              type: 'string',
              enum: ['shell', 'nodejs', 'python'],
              default: 'shell',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds (default: 600000)',
            },
          },
          anyOf: [{ required: ['prompt'] }, { required: ['command'] }],
        },
      },
      {
        name: 'codex_status',
        description: 'Check task execution status',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID to check' },
            includeResult: {
              type: 'boolean',
              description: 'Include final result if completed',
              default: false,
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'codex_logs',
        description: 'Get task execution logs',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID' },
            tailLines: {
              type: 'integer',
              description: 'Number of lines to show from end',
              default: 50,
              minimum: 1,
              maximum: 1000,
            },
            cursor: {
              type: 'string',
              description: 'Pagination cursor for incremental log fetch',
            },
          },
          required: ['taskId'],
        },
      },
      {
        name: 'codex_reply',
        description: 'Reply to a running task with additional context',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID to reply to' },
            message: { type: 'string', description: 'Message to append to task context' },
            files: {
              type: 'array',
              items: { type: 'string' },
              description: 'Additional files to include',
            },
          },
          required: ['taskId', 'message'],
        },
      },
      {
        name: 'codex_list',
        description: 'List all tasks',
        inputSchema: {
          type: 'object',
          properties: {
            status: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['running', 'completed', 'failed', 'pending', 'cancelled'],
              },
            },
            limit: {
              type: 'integer',
              description: 'Maximum number of tasks to return',
              default: 20,
              minimum: 1,
              maximum: 100,
            },
            cursor: { type: 'string', description: 'Pagination cursor' },
          },
        },
      },
      {
        name: 'codex_cancel',
        description: 'Cancel a running task',
        inputSchema: {
          type: 'object',
          properties: {
            taskId: { type: 'string', description: 'Task ID to cancel' },
          },
          required: ['taskId'],
        },
      },
    ];
  }
}
