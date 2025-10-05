import { beforeEach, describe, expect, it } from 'vitest';

import type {
  ConfigManagementTools,
  MCPToolDefinition,
  MCPToolContext,
  MCPToolResult,
  MCPLogger,
} from '../../../specs/__archive/001-docs-readme-phases/contracts/mcp-service.js';

class NoopLogger implements MCPLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

const ctx: MCPToolContext = {
  requestId: 'req-config',
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

describe('ConfigManagementTools (T023)', () => {
  let store: Record<string, any>;
  let version = 1;
  let tools: ConfigManagementTools;

  beforeEach(() => {
    store = { logLevel: 'info', retries: 3 };
    version = 1;

    const getConfig: MCPToolDefinition = {
      name: 'config.get',
      description: 'Get config by key',
      inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
      handler: async (args): Promise<MCPToolResult> => {
        return { content: [{ type: 'text', text: JSON.stringify(store[args.key]) }] };
      },
      category: 'config',
      version: '1.0.0',
    };

    const setConfig: MCPToolDefinition = {
      name: 'config.set',
      description: 'Set config key/value',
      inputSchema: {
        type: 'object',
        properties: { key: { type: 'string' }, value: { type: 'string' } },
        required: ['key', 'value'],
      },
      handler: async (args): Promise<MCPToolResult> => {
        store[args.key] = args.value;
        return { content: [{ type: 'text', text: 'OK' }] };
      },
      category: 'config',
      version: '1.0.0',
    };

    const listConfigs: MCPToolDefinition = {
      name: 'config.list',
      description: 'List all configs',
      inputSchema: { type: 'object' },
      handler: async (): Promise<MCPToolResult> => {
        return { content: [{ type: 'text', text: JSON.stringify(Object.keys(store)) }] };
      },
      category: 'config',
      version: '1.0.0',
    };

    const validateConfig: MCPToolDefinition = {
      name: 'config.validate',
      description: 'Validate config value',
      inputSchema: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] },
      handler: async (args): Promise<MCPToolResult> => {
        const valid = store[args.key] !== undefined;
        return { content: [{ type: 'text', text: valid ? 'VALID' : 'INVALID' }] };
      },
      category: 'config',
      version: '1.0.0',
    };

    const reloadConfig: MCPToolDefinition = {
      name: 'config.reload',
      description: 'Reload config from source',
      inputSchema: { type: 'object' },
      handler: async (): Promise<MCPToolResult> => {
        version += 1;
        return { content: [{ type: 'text', text: `reloaded@${version}` }] };
      },
      category: 'config',
      version: '1.0.0',
    };

    tools = { getConfig, setConfig, listConfigs, validateConfig, reloadConfig };
  });

  it('gets, sets, lists, validates and reloads config', async () => {
    const get1 = await tools.getConfig.handler({ key: 'logLevel' }, ctx);
    expect(get1.content[0].text).toBe(JSON.stringify('info'));

    const set = await tools.setConfig.handler({ key: 'logLevel', value: 'debug' }, ctx);
    expect(set.isError).toBeFalsy();

    const get2 = await tools.getConfig.handler({ key: 'logLevel' }, ctx);
    expect(get2.content[0].text).toBe(JSON.stringify('debug'));

    const list = await tools.listConfigs.handler({}, ctx);
    expect(JSON.parse(list.content[0].text ?? '[]')).toEqual(
      expect.arrayContaining(['logLevel', 'retries'])
    );

    const valid = await tools.validateConfig.handler({ key: 'logLevel' }, ctx);
    expect(valid.content[0].text).toBe('VALID');
    const invalid = await tools.validateConfig.handler({ key: 'missing' }, ctx);
    expect(invalid.content[0].text).toBe('INVALID');

    const reload = await tools.reloadConfig.handler({}, ctx);
    expect(reload.content[0].text?.startsWith('reloaded@')).toBe(true);
  });
});
