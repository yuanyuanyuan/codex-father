import { beforeEach, describe, expect, it } from 'vitest';

import type {
  ContainerManagementTools,
  MCPToolDefinition,
  MCPToolContext,
  MCPToolResult,
  MCPLogger,
} from '../../../specs/001-docs-readme-phases/contracts/mcp-service.ts';

class NoopLogger implements MCPLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

describe('ContainerManagementTools (T026)', () => {
  let ctx: MCPToolContext;
  let containers: Map<string, { id: string; image: string; running: boolean; logs: string[] }>;
  let tools: ContainerManagementTools;

  beforeEach(() => {
    ctx = {
      requestId: 'req-ctr',
      clientInfo: { name: 'test', version: '1.0.0', capabilities: {} },
      serverInfo: { name: 'fake', version: '0.1.0', capabilities: {} },
      logger: new NoopLogger(),
      workingDirectory: process.cwd(),
      permissions: {
        readFileSystem: true,
        writeFileSystem: true,
        executeCommands: false,
        networkAccess: false,
        containerAccess: true,
        gitAccess: false,
      },
    };

    containers = new Map();

    const buildContainer: MCPToolDefinition = {
      name: 'ctr.build',
      description: 'Build an image',
      inputSchema: {
        type: 'object',
        properties: { context: { type: 'string' }, tag: { type: 'string' } },
        required: ['context', 'tag'],
      },
      handler: async (args) => {
        const image = `${args.tag}:latest`;
        return { content: [{ type: 'text', text: JSON.stringify({ image }) }] };
      },
      category: 'container',
      version: '1.0.0',
    };

    const runContainer: MCPToolDefinition = {
      name: 'ctr.run',
      description: 'Run a container',
      inputSchema: {
        type: 'object',
        properties: { image: { type: 'string' } },
        required: ['image'],
      },
      handler: async (args) => {
        const id = `c_${Math.random().toString(36).slice(2, 8)}`;
        containers.set(id, { id, image: args.image, running: true, logs: ['started'] });
        return { content: [{ type: 'text', text: id }] };
      },
      category: 'container',
      version: '1.0.0',
    };

    const stopContainer: MCPToolDefinition = {
      name: 'ctr.stop',
      description: 'Stop a container',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async (args) => {
        const c = containers.get(args.id);
        if (!c) return { content: [{ type: 'text', text: 'NOT_FOUND' }], isError: true };
        c.running = false;
        c.logs.push('stopped');
        return { content: [{ type: 'text', text: 'OK' }] };
      },
      category: 'container',
      version: '1.0.0',
    };

    const listContainers: MCPToolDefinition = {
      name: 'ctr.ps',
      description: 'List containers',
      inputSchema: { type: 'object' },
      handler: async () => {
        return {
          content: [{ type: 'text', text: JSON.stringify(Array.from(containers.values())) }],
        };
      },
      category: 'container',
      version: '1.0.0',
    };

    const containerLogs: MCPToolDefinition = {
      name: 'ctr.logs',
      description: 'Get container logs',
      inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      handler: async (args) => {
        const c = containers.get(args.id);
        if (!c) return { content: [{ type: 'text', text: 'NOT_FOUND' }], isError: true };
        return { content: [{ type: 'text', text: JSON.stringify(c.logs) }] };
      },
      category: 'container',
      version: '1.0.0',
    };

    const containerExec: MCPToolDefinition = {
      name: 'ctr.exec',
      description: 'Execute command in container',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' }, cmd: { type: 'string' } },
        required: ['id', 'cmd'],
      },
      handler: async (args) => {
        const c = containers.get(args.id);
        if (!c) return { content: [{ type: 'text', text: 'NOT_FOUND' }], isError: true };
        c.logs.push(`exec:${args.cmd}`);
        return { content: [{ type: 'text', text: JSON.stringify({ code: 0, stdout: 'ok' }) }] };
      },
      category: 'container',
      version: '1.0.0',
    };

    tools = {
      buildContainer,
      runContainer,
      stopContainer,
      listContainers,
      containerLogs,
      containerExec,
    };
  });

  it('builds, runs, lists, logs, execs and stops containers', async () => {
    const built = await tools.buildContainer.handler({ context: '.', tag: 'app' }, ctx);
    expect(JSON.parse(built.content[0].text ?? '{}').image).toBe('app:latest');

    const run = await tools.runContainer.handler({ image: 'app:latest' }, ctx);
    const id = run.content[0].text as string;

    const exec = await tools.containerExec.handler({ id, cmd: 'echo 1' }, ctx);
    expect(JSON.parse(exec.content[0].text ?? '{}').code).toBe(0);

    const logs = await tools.containerLogs.handler({ id }, ctx);
    const lines = JSON.parse(logs.content[0].text ?? '[]');
    expect(lines).toEqual(['started', 'exec:echo 1']);

    const ps = await tools.listContainers.handler({}, ctx);
    expect(JSON.parse(ps.content[0].text ?? '[]').length).toBe(1);

    const stop = await tools.stopContainer.handler({ id }, ctx);
    expect(stop.isError).toBeFalsy();
  });
});
