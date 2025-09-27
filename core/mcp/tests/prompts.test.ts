import { describe, expect, it } from 'vitest';

import type {
  MCPPromptDefinition,
  MCPPromptContext,
  MCPPromptResult,
  MCPLogger,
} from '../../../specs/001-docs-readme-phases/contracts/mcp-service.ts';

class NoopLogger implements MCPLogger {
  debug(): void {}
  info(): void {}
  warn(): void {}
  error(): void {}
}

describe('MCP Prompts (T028)', () => {
  const ctx: MCPPromptContext = {
    requestId: 'req-prompt',
    clientInfo: { name: 'test', version: '1.0.0', capabilities: {} },
    serverInfo: { name: 'fake', version: '0.1.0', capabilities: {} },
  };

  const helloPrompt: MCPPromptDefinition = {
    name: 'hello',
    description: 'Generate hello conversation',
    arguments: [{ name: 'name', required: true, description: 'User name' }],
    examples: [
      {
        name: 'basic',
        description: 'Basic greeting',
        arguments: { name: 'Codex' },
        expectedMessages: [
          { role: 'user', content: { type: 'text', text: 'Greet Codex' } },
          { role: 'assistant', content: { type: 'text', text: 'Hello, Codex!' } },
        ],
      },
    ],
    category: 'greeting',
    handler: async (_name: string, args: Record<string, any>, _ctx: MCPPromptContext): Promise<MCPPromptResult> => {
      if (!args.name) throw new Error('Missing name');
      return {
        description: 'Hello conversation',
        messages: [
          { role: 'user', content: { type: 'text', text: `Say hello to ${args.name}` } },
          { role: 'assistant', content: { type: 'text', text: `Hello, ${args.name}!` } },
        ],
      };
    },
  };

  it('generates prompt messages and enforces required args', async () => {
    const ok = await helloPrompt.handler('hello', { name: 'World' }, ctx);
    expect(ok.messages.length).toBe(2);
    expect(ok.messages[1].content.text).toBe('Hello, World!');

    await expect(helloPrompt.handler('hello', {}, ctx)).rejects.toThrow('Missing name');
  });
});

