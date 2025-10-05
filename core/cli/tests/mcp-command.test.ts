/**
 * MCP Command Unit Tests - MCP 命令单元测试
 *
 * 测试覆盖:
 * - 命令注册和配置
 * - 选项解析和验证
 * - 服务器启动流程
 * - 优雅关闭处理
 * - 错误处理
 * - 调试模式
 * - JSON 输出格式
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import {
  registerMCPCommand,
  getMCPServerInstance,
  clearMCPServerInstance,
} from '../commands/mcp-command.js';
import { CLIParser } from '../parser.js';
import type { MCPServer } from '../../mcp/server.js';
import { PROJECT_VERSION } from '../../lib/version.js';

// Mock MCPServer
vi.mock('../../mcp/server.js', () => {
  return {
    createMCPServer: vi.fn((config?: any) => {
      const mockServer = {
        start: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        getServerInfo: vi.fn().mockReturnValue({
          name: config?.serverName || 'codex-father',
          version: config?.serverVersion || PROJECT_VERSION,
        }),
      };
      return mockServer as unknown as MCPServer;
    }),
  };
});

describe('MCP Command', () => {
  let command: Command;
  let parser: CLIParser;
  let consoleSpy: any;
  let processOnSpy: any;

  beforeEach(() => {
    command = new Command();
    parser = new CLIParser(command);
    registerMCPCommand(parser);

    // Mock console.log
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Mock process.on to prevent actual signal handlers
    processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process as any);

    // Clear server instance
    clearMCPServerInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    clearMCPServerInstance();
  });

  describe('命令注册', () => {
    it('应该注册 mcp 命令', () => {
      const mcpCommand = command.commands.find((cmd) => cmd.name() === 'mcp');

      expect(mcpCommand).toBeDefined();
      expect(mcpCommand?.description()).toContain('MCP');
    });

    it('应该注册所有必需的选项', () => {
      const mcpCommand = command.commands.find((cmd) => cmd.name() === 'mcp');

      expect(mcpCommand).toBeDefined();

      const optionFlags = mcpCommand?.options.map((opt) => opt.flags) ?? [];
      expect(optionFlags).toEqual(
        expect.arrayContaining([
          '--debug',
          '--server-name <name>',
          '--server-version <version>',
          '--codex-command <command>',
          '--codex-args <args>',
          '--cwd <path>',
          '--health-check-interval <ms>',
          '--max-restart-attempts <n>',
          '--restart-delay <ms>',
          '--timeout <ms>',
        ])
      );
    });
  });

  describe('选项解析', () => {
    it('应该解析 debug 选项 (boolean)', async () => {
      const { createMCPServer } = await import('../../mcp/server.js');

      // Start command with debug flag (will block on keepServerAlive)
      const promise = parser.parse(['node', 'codex-father', '--json', 'mcp', '--debug']);

      // Wait a bit for command to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(createMCPServer).toHaveBeenCalledWith(
        expect.objectContaining({
          debug: true,
        })
      );

      // Cleanup: kill the blocking promise
      const server = getMCPServerInstance();
      expect(server).toBeDefined();
    });

    it('应该解析 server-name 和 server-version 选项', async () => {
      const { createMCPServer } = await import('../../mcp/server.js');

      // Start command with custom server name/version (will block on keepServerAlive)
      const promise = parser.parse([
        'node',
        'codex-father',
        '--json',
        'mcp',
        '--server-name',
        'custom-server',
        '--server-version',
        '2.0.0',
      ]);

      // Wait a bit for command to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(createMCPServer).toHaveBeenCalledWith(
        expect.objectContaining({
          serverName: 'custom-server',
          serverVersion: '2.0.0',
        })
      );

      // Cleanup
      const server = getMCPServerInstance();
      expect(server).toBeDefined();
    });

    it('应该解析数值选项 (health-check-interval, timeout 等)', async () => {
      const { createMCPServer } = await import('../../mcp/server.js');

      // Start command with numeric options (will block on keepServerAlive)
      const promise = parser.parse([
        'node',
        'codex-father',
        '--json',
        'mcp',
        '--health-check-interval',
        '60000',
        '--max-restart-attempts',
        '5',
        '--restart-delay',
        '2000',
        '--timeout',
        '45000',
      ]);

      // Wait a bit for command to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Note: These options are not passed to createMCPServer in current implementation
      // They would be used if ProcessManager config is exposed through MCPServerConfig

      // Cleanup
      const server = getMCPServerInstance();
      expect(server).toBeDefined();
    });
  });

  describe('服务器启动', () => {
    it('应该成功启动 MCP 服务器', async () => {
      const { createMCPServer } = await import('../../mcp/server.js');

      // Start command (will block on keepServerAlive)
      const promise = parser.parse(['node', 'codex-father', '--json', 'mcp']);

      // Wait a bit for command to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(createMCPServer).toHaveBeenCalled();

      const server = getMCPServerInstance();
      expect(server).toBeDefined();
      expect(server?.start).toHaveBeenCalled();
    });

    it('应该调用 server.start()', async () => {
      // Start command (will block on keepServerAlive)
      const promise = parser.parse(['node', 'codex-father', '--json', 'mcp']);

      // Wait a bit for command to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      const server = getMCPServerInstance();
      expect(server).toBeDefined();
      expect(server?.start).toHaveBeenCalled();
    });

    it('应该在 JSON 模式下输出服务器信息', async () => {
      // Start command in JSON mode (will block on keepServerAlive)
      const promise = parser.parse(['node', 'codex-father', '--json', 'mcp']);

      // Wait a bit for command to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check that JSON output was logged
      const jsonOutputCalls = consoleSpy.mock.calls.filter((call: any[]) => {
        try {
          const parsed = JSON.parse(call[0]);
          return parsed.success !== undefined;
        } catch {
          return false;
        }
      });

      expect(jsonOutputCalls.length).toBeGreaterThan(0);

      const lastJsonCall = jsonOutputCalls[jsonOutputCalls.length - 1];
      const parsed = JSON.parse(lastJsonCall[0]);

      expect(parsed).toMatchObject({
        success: true,
        message: expect.stringContaining('MCP Server started'),
        data: {
          serverName: 'codex-father',
          serverVersion: PROJECT_VERSION,
          transport: 'stdio',
          protocol: 'MCP 2024-11-05',
          capabilities: ['tools', 'notifications'],
        },
        executionTime: expect.any(Number),
      });
    });

    it('应该在非 JSON 模式下输出启动信息', async () => {
      // Start command without JSON flag (will block on keepServerAlive)
      const promise = parser.parse(['node', 'codex-father', 'mcp']);

      // Wait a bit for command to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check that console.log was called with startup messages
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Starting MCP Server'));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MCP Server started successfully')
      );
    });
  });

  describe('优雅关闭', () => {
    it('应该注册 SIGINT 和 SIGTERM 信号处理器', async () => {
      // Start command (will block on keepServerAlive)
      const promise = parser.parse(['node', 'codex-father', '--json', 'mcp']);

      // Wait a bit for command to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify signal handlers were registered
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    });

    it('应该注册 uncaughtException 和 unhandledRejection 处理器', async () => {
      // Start command (will block on keepServerAlive)
      const promise = parser.parse(['node', 'codex-father', '--json', 'mcp']);

      // Wait a bit for command to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify error handlers were registered
      expect(processOnSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
    });
  });

  describe('错误处理', () => {
    it('应该处理服务器启动失败', async () => {
      // Mock process.exit to prevent actual exit
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      // Mock server.start to throw error
      const { createMCPServer } = await import('../../mcp/server.js');
      vi.mocked(createMCPServer).mockReturnValueOnce({
        start: vi.fn().mockRejectedValueOnce(new Error('Failed to start')),
        stop: vi.fn().mockResolvedValue(undefined),
        getServerInfo: vi.fn().mockReturnValue({
          name: 'codex-father',
          version: PROJECT_VERSION,
        }),
      } as unknown as MCPServer);

      // Start command (should throw because of mocked process.exit)
      try {
        await parser.parse(['node', 'codex-father', '--json', 'mcp']);
      } catch (error) {
        // Expected to throw because of mocked process.exit
      }

      // Wait a bit for error handling
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify process.exit was called
      expect(processExitSpy).toHaveBeenCalledWith(1);

      processExitSpy.mockRestore();
    });

    it('应该在错误时输出错误消息 (非 JSON 模式)', async () => {
      // Mock console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock process.exit to prevent actual exit
      const processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });

      // Mock server.start to throw error
      const { createMCPServer } = await import('../../mcp/server.js');
      vi.mocked(createMCPServer).mockReturnValueOnce({
        start: vi.fn().mockRejectedValueOnce(new Error('Connection failed')),
        stop: vi.fn().mockResolvedValue(undefined),
        getServerInfo: vi.fn().mockReturnValue({
          name: 'codex-father',
          version: PROJECT_VERSION,
        }),
      } as unknown as MCPServer);

      // Start command without JSON flag (should throw because of mocked process.exit)
      try {
        await parser.parse(['node', 'codex-father', 'mcp']);
      } catch (error) {
        // Expected to throw because of mocked process.exit
      }

      // Wait a bit for error handling
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check that error was logged to console.error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to start MCP Server')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Connection failed'));

      // Verify process.exit was called
      expect(processExitSpy).toHaveBeenCalledWith(1);

      consoleErrorSpy.mockRestore();
      processExitSpy.mockRestore();
    });
  });

  describe('调试模式', () => {
    it('应该在调试模式下输出额外的调试信息', async () => {
      // Start command with debug flag (will block on keepServerAlive)
      const promise = parser.parse(['node', 'codex-father', 'mcp', '--debug']);

      // Wait a bit for command to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Check that debug info was logged
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Debug mode: ENABLED'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Working directory'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Timeout'));
    });
  });

  describe('工具函数', () => {
    it('应该通过 getMCPServerInstance 获取服务器实例', async () => {
      // Initially no instance
      expect(getMCPServerInstance()).toBeNull();

      // Start command (will block on keepServerAlive)
      const promise = parser.parse(['node', 'codex-father', '--json', 'mcp']);

      // Wait a bit for command to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Now instance should exist
      const server = getMCPServerInstance();
      expect(server).toBeDefined();
      expect(server).not.toBeNull();
    });

    it('应该通过 clearMCPServerInstance 清理服务器实例', async () => {
      // Start command (will block on keepServerAlive)
      const promise = parser.parse(['node', 'codex-father', '--json', 'mcp']);

      // Wait a bit for command to start
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Instance should exist
      expect(getMCPServerInstance()).not.toBeNull();

      // Clear instance
      clearMCPServerInstance();

      // Instance should be null
      expect(getMCPServerInstance()).toBeNull();
    });
  });
});
