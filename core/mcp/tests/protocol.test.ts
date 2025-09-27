import { describe, it, expect } from 'vitest';

import type {
  MCPMessage,
  MCPError,
  MCPCapabilities,
  ToolsCapability,
  ResourcesCapability,
  PromptsCapability,
  LoggingCapability,
  LogLevel,
} from '../../../specs/001-docs-readme-phases/contracts/mcp-service.ts';

function isMCPMessage(msg: any): msg is MCPMessage {
  return (
    !!msg &&
    msg.jsonrpc === '2.0' &&
    (msg.id === undefined || typeof msg.id === 'string' || typeof msg.id === 'number') &&
    (msg.method === undefined || typeof msg.method === 'string') &&
    (msg.params === undefined || typeof msg.params === 'object') &&
    (msg.result === undefined || true) &&
    (msg.error === undefined || (typeof msg.error.code === 'number' && typeof msg.error.message === 'string'))
  );
}

describe('MCP Protocol basics (T019)', () => {
  it('conforms to JSON-RPC 2.0 compatibility', () => {
    const ok: MCPMessage = {
      jsonrpc: '2.0',
      id: '42',
      method: 'tools/list',
      params: { filter: 'codex' },
      result: { tools: [] },
    };

    const err: MCPMessage = {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      error: { code: -32601, message: 'Method not found' },
    } as MCPMessage;

    expect(isMCPMessage(ok)).toBe(true);
    expect(isMCPMessage(err)).toBe(true);

    // Invalid jsonrpc version should fail
    const bad = { jsonrpc: '1.0', id: 1 };
    expect(isMCPMessage(bad)).toBe(false);
  });

  it('validates MCPError structure', () => {
    const e: MCPError = { code: -32000, message: 'TOOL_NOT_FOUND', data: { name: 'missing.tool' } };
    expect(typeof e.code).toBe('number');
    expect(typeof e.message).toBe('string');
    expect(e.data).toEqual({ name: 'missing.tool' });
  });

  it('supports declared capabilities sets', () => {
    const toolsCap: ToolsCapability = { listChanged: true };
    const resCap: ResourcesCapability = { subscribe: true, listChanged: false };
    const promptsCap: PromptsCapability = { listChanged: true };
    const loggingCap: LoggingCapability = { levels: ['debug', 'info', 'error'] as LogLevel[] };

    const caps: MCPCapabilities = {
      tools: toolsCap,
      resources: resCap,
      prompts: promptsCap,
      logging: loggingCap,
    };

    expect(caps.tools?.listChanged).toBe(true);
    expect(caps.resources?.subscribe).toBe(true);
    expect(caps.prompts?.listChanged).toBe(true);
    expect(caps.logging?.levels).toEqual(['debug', 'info', 'error']);
  });
});

