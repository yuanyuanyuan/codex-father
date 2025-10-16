/**
 * MCP 可执行文件冒烟测试
 * 确认外部 codex-mcp-server 二进制可用
 */

import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';

const MCP_SERVER_ENTRY = '/data/codex-father/mcp/codex-mcp-server/dist/index.js';

function runMcpCommand(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [MCP_SERVER_ENTRY, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NODE_ENV: 'test', LOG_LEVEL: 'error' },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => reject(error));
    child.on('close', (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

describe('MCP Server Binary', () => {
  it('应该输出帮助信息', async () => {
    const result = await runMcpCommand(['--help']);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('Codex Father MCP Server');
    expect(result.stdout).toContain('--transport');
  });

  it('应该输出版本号', async () => {
    const result = await runMcpCommand(['--version']);
    expect(result.code).toBe(0);
    expect(result.stdout.trim()).toMatch(/\d+\.\d+\.\d+/);
  });
});
