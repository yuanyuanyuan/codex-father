import { beforeEach, describe, expect, it } from 'vitest';

import type {
  MCPServer,
  MCPServerConfig,
  MCPServerStatus,
  MCPToolDefinition,
  MCPToolResult,
  MCPToolContext,
  MCPLogger,
  MCPClientInfo,
  MCPServerInfo,
  LogLevel,
} from '../../../specs/_archived/001-docs-readme-phases/contracts/mcp-service.js';

class InMemoryLogger implements MCPLogger {
  logs: Array<{ level: string; message: string; data?: any }> = [];
  debug(message: string, data?: any): void {
    this.logs.push({ level: 'debug', message, data });
  }
  info(message: string, data?: any): void {
    this.logs.push({ level: 'info', message, data });
  }
  warn(message: string, data?: any): void {
    this.logs.push({ level: 'warn', message, data });
  }
  error(message: string, _error?: Error, data?: any): void {
    this.logs.push({ level: 'error', message, data });
  }
}

class FakeMCPServer implements MCPServer {
  private status: MCPServerStatus = {
    running: false,
    uptime: 0,
    connections: 0,
    metrics: {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      memoryUsage: 0,
      activeTasks: 0,
    },
  };

  private config?: MCPServerConfig;
  private startedAt = 0;
  private tools: Map<string, MCPToolDefinition> = new Map();

  async start(config: MCPServerConfig): Promise<void> {
    this.config = config;
    this.tools = new Map(config.tools.map((t) => [t.name, t]));
    this.startedAt = Date.now();
    this.status.running = true;
    this.status.pid = process.pid;
    this.status.port = config.port ?? 7007;
    this.status.uptime = 0;
    this.status.connections = 1;
  }

  async stop(): Promise<void> {
    this.status.running = false;
    this.status.connections = 0;
    this.status.uptime = Date.now() - this.startedAt;
  }

  getStatus(): MCPServerStatus {
    const uptime = this.status.running ? Date.now() - this.startedAt : this.status.uptime;
    return { ...this.status, uptime };
  }

  async listTools() {
    return Array.from(this.tools.values());
  }

  async callTool(name: string, args?: Record<string, any>): Promise<MCPToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Tool not found: ${name}` }],
        isError: true,
      };
    }

    const ctx: MCPToolContext = {
      requestId: `req_${Date.now()}`,
      clientInfo: { name: 'test-client', version: '1.0.0', capabilities: {} },
      serverInfo: {
        name: this.config?.name ?? 'fake',
        version: this.config?.version ?? '0',
        capabilities: this.config?.capabilities ?? {},
      },
      logger: new InMemoryLogger(),
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

    const result = await tool.handler(args ?? {}, ctx);
    // update metrics
    this.status.metrics.totalRequests += 1;
    if (result.isError) this.status.metrics.failedRequests += 1;
    else this.status.metrics.successfulRequests += 1;
    return result;
  }

  async listResources() {
    return [];
  }
  async readResource(_uri: string) {
    throw new Error('not implemented in fake');
  }
  async listPrompts() {
    return [];
  }
  async getPrompt(_name: string) {
    throw new Error('not implemented in fake');
  }
}

describe('MCP Server interface (T020)', () => {
  let server: FakeMCPServer;
  let config: MCPServerConfig;

  beforeEach(() => {
    const echoTool: MCPToolDefinition = {
      name: 'echo',
      description: 'Echo back arguments',
      inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      handler: async (args) => ({ content: [{ type: 'text', text: String(args.text) }] }),
      category: 'utility',
      version: '1.0.0',
    };

    config = {
      name: 'cf-mcp',
      version: '0.1.0',
      port: 7123,
      logLevel: 'info',
      capabilities: { tools: { listChanged: true } },
      tools: [echoTool],
      resources: [],
      prompts: [],
    };
    server = new FakeMCPServer();
  });

  it('starts, reports status, lists and calls tools, then stops', async () => {
    await server.start(config);
    const status1 = server.getStatus();
    expect(status1.running).toBe(true);
    expect(status1.port).toBe(7123);
    expect(status1.pid).toBeDefined();

    const tools = await server.listTools();
    expect(tools.map((t) => t.name)).toContain('echo');

    const ok = await server.callTool('echo', { text: 'hello' });
    expect(ok.isError).toBeFalsy();
    expect(ok.content[0].text).toBe('hello');

    const notFound = await server.callTool('missing', {});
    expect(notFound.isError).toBe(true);

    await server.stop();
    const status2 = server.getStatus();
    expect(status2.running).toBe(false);
    expect(status2.uptime).toBeGreaterThanOrEqual(0);
  });
});
