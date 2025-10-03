import { describe, expect, it } from 'vitest';

import { MCP_ERROR_CODES } from '../../../specs/_archived/001-docs-readme-phases/contracts/mcp-service.js';

describe('MCP error codes and handling (T030)', () => {
  it('exposes all expected MCP error codes', () => {
    expect(MCP_ERROR_CODES.PARSE_ERROR).toBe(-32700);
    expect(MCP_ERROR_CODES.INVALID_REQUEST).toBe(-32600);
    expect(MCP_ERROR_CODES.METHOD_NOT_FOUND).toBe(-32601);
    expect(MCP_ERROR_CODES.INVALID_PARAMS).toBe(-32602);
    expect(MCP_ERROR_CODES.INTERNAL_ERROR).toBe(-32603);

    expect(MCP_ERROR_CODES.TOOL_NOT_FOUND).toBe(-32000);
    expect(MCP_ERROR_CODES.TOOL_EXECUTION_ERROR).toBe(-32001);
    expect(MCP_ERROR_CODES.RESOURCE_NOT_FOUND).toBe(-32002);
    expect(MCP_ERROR_CODES.RESOURCE_ACCESS_DENIED).toBe(-32003);
    expect(MCP_ERROR_CODES.PROMPT_NOT_FOUND).toBe(-32004);
    expect(MCP_ERROR_CODES.CAPABILITY_NOT_SUPPORTED).toBe(-32005);

    expect(MCP_ERROR_CODES.TASK_QUEUE_FULL).toBe(-33001);
    expect(MCP_ERROR_CODES.CONFIG_VALIDATION_FAILED).toBe(-33002);
    expect(MCP_ERROR_CODES.SANDBOX_VIOLATION).toBe(-33003);
    expect(MCP_ERROR_CODES.CONTAINER_ERROR).toBe(-33004);
    expect(MCP_ERROR_CODES.GIT_OPERATION_FAILED).toBe(-33005);
  });

  it('models common error flows with proper codes', () => {
    const toolNotFound = {
      code: MCP_ERROR_CODES.TOOL_NOT_FOUND,
      message: 'Tool not found',
      data: { name: 'x' },
    };
    expect(toolNotFound.code).toBe(-32000);

    const invalidParams = {
      code: MCP_ERROR_CODES.INVALID_PARAMS,
      message: 'Invalid params',
      data: { field: 'id' },
    };
    expect(invalidParams.code).toBe(-32602);

    const containerError = {
      code: MCP_ERROR_CODES.CONTAINER_ERROR,
      message: 'Failed to run container',
      data: { id: 'c1' },
    };
    expect(containerError.code).toBe(-33004);
  });
});
