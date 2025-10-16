import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createStdioServer } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TaskRunner } from '../../core/TaskRunner.js';
import { MCPToolHandlers } from './handlers.js';

export class MCPServer {
  private server: Server;
  private runner: TaskRunner;
  private handlers: MCPToolHandlers;

  constructor(runner: TaskRunner) {
    this.runner = runner;
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

    this.handlers = new MCPToolHandlers(runner);
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
