import { describe, it, expect } from 'vitest';

import type {
  MCPToolDefinition,
  MCPToolResult,
  MCPToolContext,
  MCPLogger,
} from '../../../specs/001-docs-readme-phases/contracts/mcp-service.ts';

class NoopLogger implements MCPLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

const baseContext: MCPToolContext = {
  requestId: 'req-1',
  clientInfo: { name: 'test', version: '1.0.0', capabilities: {} },
  serverInfo: { name: 'fake', version: '0.1.0', capabilities: {} },
  logger: new NoopLogger(),
  workingDirectory: process.cwd(),
  permissions: {
    readFileSystem: true,
    writeFileSystem: true,
    executeCommands: false,
    networkAccess: true,
    containerAccess: false,
    gitAccess: false,
  },
};

describe('MCP Tool and handler (T021)', () => {
  it('registers tool, validates input schema, and returns result content', async () => {
    const upperTool: MCPToolDefinition = {
      name: 'string.upper',
      description: 'Uppercase input text',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', minLength: 1, description: 'Text to uppercase' } as any,
        },
        required: ['text'],
      },
      handler: async (args): Promise<MCPToolResult> => {
        if (!args || typeof args.text !== 'string' || args.text.length === 0) {
          return { content: [{ type: 'text', text: 'invalid input' }], isError: true };
        }
        return { content: [{ type: 'text', text: args.text.toUpperCase() }] };
      },
      category: 'string',
      version: '1.0.0',
      examples: [
        {
          name: 'hello',
          description: 'Uppercase hello',
          arguments: { text: 'hello' },
          expectedResult: 'HELLO',
        },
      ],
    };

    const ok = await upperTool.handler({ text: 'hello' }, baseContext);
    expect(ok.isError).toBeFalsy();
    expect(ok.content[0]).toEqual({ type: 'text', text: 'HELLO' });

    const bad = await upperTool.handler({}, baseContext);
    expect(bad.isError).toBe(true);
  });
});
