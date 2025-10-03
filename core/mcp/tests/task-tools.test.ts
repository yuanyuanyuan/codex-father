import { beforeEach, describe, expect, it } from 'vitest';

import type {
  MCPToolDefinition,
  MCPToolContext,
  MCPToolResult,
  TaskManagementTools,
  MCPLogger,
} from '../../../specs/_archived/001-docs-readme-phases/contracts/mcp-service.js';

type Task = {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'canceled';
  payload: any;
  logs: string[];
};

class NoopLogger implements MCPLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

const baseCtx: MCPToolContext = {
  requestId: 'req-task',
  clientInfo: { name: 'test', version: '1.0.0', capabilities: {} },
  serverInfo: { name: 'fake', version: '0.1.0', capabilities: {} },
  logger: new NoopLogger(),
  workingDirectory: process.cwd(),
  permissions: {
    readFileSystem: true,
    writeFileSystem: true,
    executeCommands: false,
    networkAccess: false,
    containerAccess: false,
    gitAccess: false,
  },
};

describe('TaskManagementTools (T022)', () => {
  let tasks: Map<string, Task>;
  let tools: TaskManagementTools;

  beforeEach(() => {
    tasks = new Map<string, Task>();

    const createTask: MCPToolDefinition = {
      name: 'task.create',
      description: 'Create a new task',
      inputSchema: {
        type: 'object',
        properties: { type: { type: 'string' }, payload: { type: 'object' } },
        required: ['type'],
      },
      handler: async (args): Promise<MCPToolResult> => {
        if (!args.type) {
          return { content: [{ type: 'text', text: 'Missing type' }], isError: true };
        }
        const id = `t_${Math.random().toString(36).slice(2, 8)}`;
        const task: Task = {
          id,
          type: args.type,
          payload: args.payload ?? {},
          status: 'queued',
          logs: [],
        };
        tasks.set(id, task);
        return { content: [{ type: 'text', text: id }] };
      },
      category: 'task',
      version: '1.0.0',
    };

    const listTasks: MCPToolDefinition = {
      name: 'task.list',
      description: 'List tasks',
      inputSchema: { type: 'object', properties: { status: { type: 'string' } } },
      handler: async (args): Promise<MCPToolResult> => {
        const all = Array.from(tasks.values()).filter((t) =>
          args?.status ? t.status === args.status : true
        );
        return { content: [{ type: 'text', text: JSON.stringify(all) }] };
      },
      category: 'task',
      version: '1.0.0',
    };

    const getTaskStatus: MCPToolDefinition = {
      name: 'task.status',
      description: 'Get task status',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async (args): Promise<MCPToolResult> => {
        const t = tasks.get(args.id);
        if (!t) {
          return { content: [{ type: 'text', text: 'NOT_FOUND' }], isError: true };
        }
        return { content: [{ type: 'text', text: t.status }] };
      },
      category: 'task',
      version: '1.0.0',
    };

    const cancelTask: MCPToolDefinition = {
      name: 'task.cancel',
      description: 'Cancel a task',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async (args): Promise<MCPToolResult> => {
        const t = tasks.get(args.id);
        if (!t) {
          return { content: [{ type: 'text', text: 'NOT_FOUND' }], isError: true };
        }
        t.status = 'canceled';
        t.logs.push('Canceled');
        return { content: [{ type: 'text', text: 'OK' }] };
      },
      category: 'task',
      version: '1.0.0',
    };

    const retryTask: MCPToolDefinition = {
      name: 'task.retry',
      description: 'Retry a failed task',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async (args): Promise<MCPToolResult> => {
        const t = tasks.get(args.id);
        if (!t) {
          return { content: [{ type: 'text', text: 'NOT_FOUND' }], isError: true };
        }
        if (t.status !== 'failed' && t.status !== 'canceled') {
          return { content: [{ type: 'text', text: 'INVALID_STATE' }], isError: true };
        }
        t.status = 'queued';
        t.logs.push('Retried');
        return { content: [{ type: 'text', text: 'OK' }] };
      },
      category: 'task',
      version: '1.0.0',
    };

    const getTaskLogs: MCPToolDefinition = {
      name: 'task.logs',
      description: 'Get task logs',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async (args): Promise<MCPToolResult> => {
        const t = tasks.get(args.id);
        if (!t) {
          return { content: [{ type: 'text', text: 'NOT_FOUND' }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(t.logs) }] };
      },
      category: 'task',
      version: '1.0.0',
    };

    tools = { createTask, listTasks, getTaskStatus, cancelTask, retryTask, getTaskLogs };
  });

  it('covers create/list/status/cancel/retry/logs', async () => {
    const created = await tools.createTask.handler({ type: 'demo', payload: { x: 1 } }, baseCtx);
    expect(created.isError).toBeFalsy();
    const id = created.content[0].text as string;

    const listed = await tools.listTasks.handler({}, baseCtx);
    expect(listed.isError).toBeFalsy();
    expect(JSON.parse(listed.content[0].text ?? '[]').length).toBe(1);

    const status1 = await tools.getTaskStatus.handler({ id }, baseCtx);
    expect(status1.content[0].text).toBe('queued');

    // simulate failure then retry
    const t = Array.from((tasks as any).values())[0] as Task;
    t.status = 'failed';

    const retry = await tools.retryTask.handler({ id }, baseCtx);
    expect(retry.isError).toBeFalsy();

    const cancel = await tools.cancelTask.handler({ id }, baseCtx);
    expect(cancel.isError).toBeFalsy();

    const logs = await tools.getTaskLogs.handler({ id }, baseCtx);
    const lines = JSON.parse(logs.content[0].text ?? '[]');
    expect(lines).toEqual(['Retried', 'Canceled']);
  });
});
