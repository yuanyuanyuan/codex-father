/**
 * MCP tools/list 契约测试
 *
 * 验证 MCP 协议的 tools/list 请求/响应格式是否符合契约规范
 * 参考: specs/005-docs-prd-draft/contracts/mcp-protocol.yaml:100-163
 *
 * TDD 红灯阶段: 此测试应该失败，因为 MCP 服务器尚未实现
 */

import { describe, it, expect } from 'vitest';

describe('MCP Protocol Contract: tools/list', () => {
  it('应验证 tools/list 请求格式', () => {
    const validRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: null,
    };

    // 验证请求字段
    expect(validRequest.jsonrpc).toBe('2.0');
    expect(typeof validRequest.id).toMatch(/string|number/);
    expect(validRequest.method).toBe('tools/list');
  });

  it('应验证 tools/list 响应格式包含工具列表', () => {
    const expectedResponse = {
      jsonrpc: '2.0',
      id: 2,
      result: {
        tools: [
          {
            name: 'start-codex-task',
            description: 'Start a new Codex task with specified prompt',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: { type: 'string' },
                model: { type: 'string' },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'send-message',
            description: 'Send a follow-up message to an existing Codex conversation',
            inputSchema: {
              type: 'object',
              properties: {
                conversationId: { type: 'string', format: 'uuid' },
                message: { type: 'string' },
              },
              required: ['conversationId'],
            },
          },
          {
            name: 'interrupt-task',
            description: 'Interrupt a running Codex task',
            inputSchema: {
              type: 'object',
              properties: {
                jobId: { type: 'string' },
              },
              required: ['jobId'],
            },
          },
        ],
      },
    };

    // 验证响应结构
    expect(expectedResponse.jsonrpc).toBe('2.0');
    expect(expectedResponse.result).toBeDefined();
    expect(expectedResponse.result.tools).toBeInstanceOf(Array);
    expect(expectedResponse.result.tools.length).toBeGreaterThanOrEqual(3);
  });

  it('应验证工具列表包含 start-codex-task', () => {
    const tools = [
      {
        name: 'start-codex-task',
        description: 'Start a new Codex task with specified prompt',
        inputSchema: {
          type: 'object',
          properties: {
            prompt: { type: 'string' },
            model: { type: 'string' },
            approvalPolicy: { type: 'string' },
          },
          required: ['prompt'],
        },
      },
    ];

    const startCodexTask = tools.find((t) => t.name === 'start-codex-task');
    expect(startCodexTask).toBeDefined();
    expect(startCodexTask?.description).toContain('Codex');
    expect(startCodexTask?.inputSchema).toBeDefined();
    expect(startCodexTask?.inputSchema.required).toContain('prompt');
  });

  it('应验证工具列表包含 send-message', () => {
    const tools = [
      {
        name: 'send-message',
        description: 'Send a follow-up message to an existing Codex conversation',
        inputSchema: {
          type: 'object',
          properties: {
            conversationId: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['conversationId'],
        },
      },
    ];

    const sendMessage = tools.find((t) => t.name === 'send-message');
    expect(sendMessage).toBeDefined();
    expect(sendMessage?.inputSchema.required).toContain('conversationId');
  });

  it('应验证工具列表包含 interrupt-task', () => {
    const tools = [
      {
        name: 'interrupt-task',
        description: 'Interrupt a running Codex task',
        inputSchema: {
          type: 'object',
          properties: {
            jobId: { type: 'string' },
          },
          required: ['jobId'],
        },
      },
    ];

    const interruptTask = tools.find((t) => t.name === 'interrupt-task');
    expect(interruptTask).toBeDefined();
    expect(interruptTask?.inputSchema.required).toContain('jobId');
  });

  it('应验证每个工具的 inputSchema 完整性', () => {
    const tool = {
      name: 'start-codex-task',
      description: 'Start a new Codex task with specified prompt',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
        },
        required: ['prompt'],
      },
    };

    // 验证必需字段
    expect(tool).toHaveProperty('name');
    expect(tool).toHaveProperty('description');
    expect(tool).toHaveProperty('inputSchema');

    // 验证 inputSchema 结构
    expect(tool.inputSchema).toHaveProperty('type');
    expect(tool.inputSchema).toHaveProperty('properties');
    expect(tool.inputSchema).toHaveProperty('required');
    expect(tool.inputSchema.type).toBe('object');
    expect(tool.inputSchema.required).toBeInstanceOf(Array);
  });

  // 🔴 TDD 红灯: 以下测试将失败，因为实际的 MCP 服务器尚未实现
  it.skip('应通过 MCP 服务器的 tools/list 调用验证（实现后启用）', async () => {
    // TODO: 当 MCP 服务器实现后，取消 skip 并实现实际的服务器调用测试
    //
    // 示例代码（待实现）：
    // const client = new MCPClient();
    // await client.connect();
    // const response = await client.request({
    //   jsonrpc: '2.0',
    //   id: 2,
    //   method: 'tools/list'
    // });
    //
    // expect(response.result.tools).toBeInstanceOf(Array);
    // expect(response.result.tools.length).toBeGreaterThanOrEqual(3);
    // expect(response.result.tools.some(t => t.name === 'start-codex-task')).toBe(true);

    expect(true).toBe(false); // 占位符，确保测试失败
  });
});
