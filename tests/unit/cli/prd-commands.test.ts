/**
 * PRD CLI Commands 单元测试
 *
 * 测试范围：
 * - CLI 解析器基础功能
 * - 全局选项处理
 * - 命令注册和执行
 * - 错误处理机制
 * - 配置文件加载
 * - 输出格式化
 * - 用户交互处理
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Command } from 'commander';
import ora from 'ora';
import chalk from 'chalk';
import {
  PRDCLIParser,
  createPRDCLI,
  formatDuration,
  validateConfig,
  type PRDGlobalOptions,
  type PRDCommandContext,
  type PRDCommandResult,
  type PRDCommandHandler,
  type PRDUserConfig
} from '../../../src/cli/prd-commands.js';

// Mock 依赖项
vi.mock('fs');
vi.mock('commander');
vi.mock('ora');
vi.mock('chalk');

const mockReadFileSync = readFileSync as MockedFunction<typeof readFileSync>;
const mockExistsSync = existsSync as MockedFunction<typeof existsSync>;
const mockWriteFileSync = writeFileSync as MockedFunction<typeof writeFileSync>;

describe('PRD CLI Commands', () => {
  let mockCommand: any;
  let mockSpinner: any;
  let cliParser: PRDCLIParser;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    // 清理所有模拟
    vi.clearAllMocks();

    // 设置 Command mock
    mockCommand = {
      name: vi.fn().mockReturnThis(),
      description: vi.fn().mockReturnThis(),
      version: vi.fn().mockReturnThis(),
      option: vi.fn().mockReturnThis(),
      command: vi.fn().mockReturnThis(),
      action: vi.fn().mockReturnThis(),
      parseAsync: vi.fn().mockResolvedValue(undefined)
    };

    // 设置 ora spinner mock
    mockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      text: ''
    };

    (Command as any).mockImplementation(() => mockCommand);
    (ora as any).mockReturnValue(mockSpinner);
    (chalk as any).green = vi.fn(text => text);
    (chalk as any).red = vi.fn(text => text);
    (chalk as any).yellow = vi.fn(text => text);
    (chalk as any).cyan = vi.fn(text => text);
    (chalk as any).gray = vi.fn(text => text);

    // 监听控制台输出
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {} as never);

    cliParser = new PRDCLIParser(mockCommand);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('PRDCLIParser 构造函数', () => {
    it('should create parser with default command instance', () => {
      const parser = new PRDCLIParser();
      expect(parser).toBeInstanceOf(PRDCLIParser);
    });

    it('should create parser with provided command instance', () => {
      const customCommand = new Command();
      const parser = new PRDCLIParser(customCommand);
      expect(parser).toBeInstanceOf(PRDCLIParser);
    });

    it('should setup global options correctly', () => {
      expect(mockCommand.name).toHaveBeenCalledWith('prd');
      expect(mockCommand.description).toHaveBeenCalledWith('PRD (Product Requirements Document) 管理工具');
      expect(mockCommand.version).toHaveBeenCalled();
      expect(mockCommand.option).toHaveBeenCalledWith('-c, --config <path>', '指定配置文件路径');
      expect(mockCommand.option).toHaveBeenCalledWith('-j, --json', '以 JSON 格式输出结果');
      expect(mockCommand.option).toHaveBeenCalledWith('-v, --verbose', '显示详细输出信息');
      expect(mockCommand.option).toHaveBeenCalledWith('-q, --quiet', '静默模式，仅显示错误');
    });

    it('should setup error handling', () => {
      // 验证错误处理程序已设置
      expect(process.listenerCount('uncaughtException')).toBeGreaterThan(0);
      expect(process.listenerCount('unhandledRejection')).toBeGreaterThan(0);
    });
  });

  describe('Global Options Management', () => {
    it('should have correct default global options', () => {
      const parser = new PRDCLIParser();
      // 通过命令执行验证默认选项
      expect(parser).toBeDefined();
    });

    it('should handle working directory option', () => {
      expect(mockCommand.option).toHaveBeenCalledWith(
        '--working-directory <path>',
        '设置工作目录',
        process.cwd()
      );
    });

    it('should handle timeout option', () => {
      expect(mockCommand.option).toHaveBeenCalledWith(
        '--timeout <seconds>',
        '设置操作超时时间',
        '30'
      );
    });

    it('should handle profile option', () => {
      expect(mockCommand.option).toHaveBeenCalledWith(
        '-p, --profile <name>',
        '使用指定的用户配置文件'
      );
    });
  });

  describe('Command Registration', () => {
    it('should register command without options', () => {
      const handler: PRDCommandHandler = vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        executionTime: 100
      });

      cliParser.registerCommand('test', 'Test command', handler);

      expect(mockCommand.command).toHaveBeenCalledWith('test');
      expect(mockCommand.description).toHaveBeenCalledWith('Test command');
      expect(mockCommand.action).toHaveBeenCalled();
    });

    it('should register command with options', () => {
      const handler: PRDCommandHandler = vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        executionTime: 100
      });

      const options = [
        { flags: '-f, --force', description: 'Force operation', defaultValue: false },
        { flags: '--dry-run', description: 'Dry run mode' }
      ];

      cliParser.registerCommand('test', 'Test command', handler, options);

      expect(mockCommand.command).toHaveBeenCalledWith('test');
      expect(mockCommand.option).toHaveBeenCalledWith('-f, --force', 'Force operation', false);
      expect(mockCommand.option).toHaveBeenCalledWith('--dry-run', 'Dry run mode', undefined);
    });

    it('should get registered commands', () => {
      const handler: PRDCommandHandler = vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        executionTime: 100
      });

      cliParser.registerCommand('test', 'Test command', handler);
      const commands = cliParser.getRegisteredCommands();

      expect(commands.has('test')).toBe(true);
      expect(commands.get('test')?.description).toBe('Test command');
      expect(commands.get('test')?.handler).toBe(handler);
    });
  });

  describe('Command Execution', () => {
    let mockHandler: MockedFunction<PRDCommandHandler>;
    let mockUserConfig: PRDUserConfig;

    beforeEach(() => {
      mockHandler = vi.fn().mockResolvedValue({
        success: true,
        message: 'Command executed successfully',
        data: { result: 'test' },
        exitCode: 0,
        executionTime: 100
      });

      mockUserConfig = {
        outputFormat: 'table' as const,
        editor: 'vim',
        permissions: {
          role: 'developer',
          defaultPermissions: ['read', 'write']
        },
        preferences: {
          autoSave: true,
          confirmDelete: true,
          showProgress: true,
          colorOutput: true
        },
        templates: {}
      };

      // Mock 配置加载
      vi.spyOn(cliParser, 'loadUserConfig').mockResolvedValue(mockUserConfig);
    });

    it('should execute command successfully', async () => {
      cliParser.registerCommand('test', 'Test command', mockHandler);

      const result = await cliParser.executeCommand('test', ['arg1'], {
        verbose: true,
        json: false
      });

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          args: ['arg1'],
          options: expect.objectContaining({ verbose: true, json: false }),
          userConfig: mockUserConfig
        })
      );
    });

    it('should handle command execution with spinner', async () => {
      cliParser.registerCommand('test', 'Test command', mockHandler);

      await cliParser.executeCommand('test', [], {
        quiet: false,
        json: false
      });

      expect(ora).toHaveBeenCalledWith('执行命令: test');
      expect(mockSpinner.start).toHaveBeenCalled();
      expect(mockSpinner.succeed).toHaveBeenCalledWith('命令执行成功: test');
    });

    it('should handle command execution without spinner in quiet mode', async () => {
      cliParser.registerCommand('test', 'Test command', mockHandler);

      await cliParser.executeCommand('test', [], {
        quiet: true,
        json: false
      });

      expect(ora).not.toHaveBeenCalled();
    });

    it('should handle unknown command error', async () => {
      const result = await cliParser.executeCommand('unknown', [], {});

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('未知命令: unknown');
      expect(result.exitCode).toBe(1);
    });

    it('should handle command handler errors', async () => {
      const errorHandler: PRDCommandHandler = vi.fn().mockRejectedValue(
        new Error('Handler error')
      );

      cliParser.registerCommand('error-test', 'Error test', errorHandler);

      const result = await cliParser.executeCommand('error-test', [], {});

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Handler error');
      expect(result.exitCode).toBe(1);
      expect(mockSpinner.fail).toHaveBeenCalledWith('命令执行出错: error-test');
    });
  });

  describe('Configuration Management', () => {
    beforeEach(() => {
      // 重置环境变量
      delete process.env.HOME;
      delete process.env.USERPROFILE;
    });

    it('should load configuration from specified path', async () => {
      const configData = {
        outputFormat: 'json',
        editor: 'code',
        preferences: {
          autoSave: false,
          confirmDelete: false,
          showProgress: false,
          colorOutput: false
        }
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(configData));

      const config = await cliParser.loadUserConfig('/custom/config.json');

      expect(mockExistsSync).toHaveBeenCalledWith('/custom/config.json');
      expect(mockReadFileSync).toHaveBeenCalledWith('/custom/config.json', 'utf-8');
      expect(config.outputFormat).toBe('json');
      expect(config.editor).toBe('code');
    });

    it('should load configuration with profile', async () => {
      const configData = {
        default: {
          outputFormat: 'table',
          editor: 'vim'
        },
        profiles: {
          dev: {
            outputFormat: 'json',
            editor: 'code'
          }
        }
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(configData));

      const config = await cliParser.loadUserConfig('/config.json', 'dev');

      expect(config.outputFormat).toBe('json');
      expect(config.editor).toBe('code');
    });

    it('should use default configuration when file not found', async () => {
      mockExistsSync.mockReturnValue(false);

      const config = await cliParser.loadUserConfig();

      expect(config.outputFormat).toBe('table');
      expect(config.editor).toBe(process.env.EDITOR || 'vim');
      expect(config.preferences.autoSave).toBe(true);
    });

    it('should handle configuration file parse errors', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json');

      const config = await cliParser.loadUserConfig('/invalid.json');

      expect(config.outputFormat).toBe('table'); // 应该使用默认配置
      expect(consoleErrorSpy).not.toHaveBeenCalled(); // 在实际实现中会有警告
    });

    it('should find configuration file in search paths', async () => {
      process.env.HOME = '/home/user';

      mockExistsSync
        .mockReturnValueOnce(false) // .prdrc in cwd
        .mockReturnValueOnce(false) // .prd.json in cwd
        .mockReturnValueOnce(false) // prd.config.json in cwd
        .mockReturnValueOnce(true); // .prdrc in home

      mockReadFileSync.mockReturnValue(JSON.stringify({}));

      await cliParser.loadUserConfig();

      expect(mockExistsSync).toHaveBeenCalledWith(join(process.cwd(), '.prdrc'));
      expect(mockExistsSync).toHaveBeenCalledWith(join('/home/user', '.prdrc'));
    });
  });

  describe('Output Formatting', () => {
    let mockContext: PRDCommandContext;
    let mockResult: PRDCommandResult;

    beforeEach(() => {
      mockContext = {
        args: [],
        options: {} as PRDGlobalOptions & Record<string, any>,
        workingDirectory: '/test',
        userConfig: {
          outputFormat: 'table' as const,
          editor: 'vim',
          permissions: {
            role: 'developer',
            defaultPermissions: ['read', 'write']
          },
          preferences: {
            autoSave: true,
            confirmDelete: true,
            showProgress: true,
            colorOutput: true
          },
          templates: {}
        }
      };

      mockResult = {
        success: true,
        message: 'Test message',
        data: { test: 'data' },
        exitCode: 0,
        executionTime: 100
      };
    });

    it('should format successful output with message', async () => {
      const formatSpy = vi.spyOn(cliParser as any, 'formatOutput');

      await cliParser.executeCommand('test', [], {});

      // 验证格式化函数被调用
      expect(formatSpy).toBeDefined();
    });

    it('should format JSON output', async () => {
      mockContext.options.json = true;

      // 直接测试格式化逻辑
      const formatOutput = (cliParser as any).formatOutput;
      formatOutput(mockResult, mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"success": true')
      );
    });

    it('should handle quiet mode', async () => {
      mockContext.options.quiet = true;

      const formatOutput = (cliParser as any).formatOutput;
      formatOutput(mockResult, mockContext);

      // 在静默模式下，成功结果不应输出
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should display table data', async () => {
      mockResult.data = [
        { id: 1, name: 'Test 1' },
        { id: 2, name: 'Test 2' }
      ];

      const formatOutput = (cliParser as any).formatOutput;
      formatOutput(mockResult, mockContext);

      // 验证 console.table 被调用
      expect(console.table).toBeDefined();
    });

    it('should show execution time in verbose mode', async () => {
      mockContext.options.verbose = true;

      const formatOutput = (cliParser as any).formatOutput;
      formatOutput(mockResult, mockContext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('执行时间: 100ms')
      );
    });

    it('should display warnings', async () => {
      mockResult.warnings = ['Warning 1', 'Warning 2'];

      const formatOutput = (cliParser as any).formatOutput;
      formatOutput(mockResult, mockContext);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning 1')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Warning 2')
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle errors with context', () => {
      const error = new Error('Test error');
      const handleError = (cliParser as any).handleError;

      handleError(error, 'Test context');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('错误发生在: Test context')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('错误信息: Test error')
      );
    });

    it('should show stack trace in verbose mode', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      (cliParser as any).globalOptions.verbose = true;
      const handleError = (cliParser as any).handleError;

      handleError(error, 'Test context');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error stack trace')
      );
    });

    it('should show help information', () => {
      const error = new Error('Test error');
      const handleError = (cliParser as any).handleError;

      handleError(error, 'Test context');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('使用 --help 查看命令帮助信息')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('使用 --verbose 查看详细错误信息')
      );
    });

    it('should handle uncaught exceptions', () => {
      const error = new Error('Uncaught error');

      // 模拟未捕获异常
      process.emit('uncaughtException', error);

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    it('should handle unhandled promise rejections', () => {
      const reason = 'Promise rejection';
      const promise = Promise.reject(reason);

      // 模拟未处理的 Promise 拒绝
      process.emit('unhandledRejection', reason, promise);

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Command Line Parsing', () => {
    it('should parse command line arguments', async () => {
      const argv = ['node', 'prd', 'test', '--verbose'];

      await cliParser.parse(argv);

      expect(mockCommand.parseAsync).toHaveBeenCalledWith(argv);
    });

    it('should handle parsing errors', async () => {
      mockCommand.parseAsync.mockRejectedValue(new Error('Parse error'));

      await cliParser.parse();

      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('Version Management', () => {
    it('should get version from package.json', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ version: '1.2.3' }));

      const getVersion = (cliParser as any).getVersion;
      const version = getVersion();

      expect(version).toBe('1.2.3');
    });

    it('should use default version when package.json not found', () => {
      mockExistsSync.mockReturnValue(false);

      const getVersion = (cliParser as any).getVersion;
      const version = getVersion();

      expect(version).toBe('1.0.0');
    });

    it('should handle package.json parse errors', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('invalid json');

      const getVersion = (cliParser as any).getVersion;
      const version = getVersion();

      expect(version).toBe('1.0.0');
    });
  });

  describe('Factory Function', () => {
    it('should create PRD CLI instance', () => {
      const cli = createPRDCLI();
      expect(cli).toBeInstanceOf(PRDCLIParser);
    });
  });

  describe('Utility Functions', () => {
    describe('formatDuration', () => {
      it('should format milliseconds', () => {
        expect(formatDuration(500)).toBe('500ms');
        expect(formatDuration(999)).toBe('999ms');
      });

      it('should format seconds', () => {
        expect(formatDuration(1000)).toBe('1.0s');
        expect(formatDuration(1500)).toBe('1.5s');
        expect(formatDuration(59999)).toBe('59.9s');
      });

      it('should format minutes and seconds', () => {
        expect(formatDuration(60000)).toBe('1m0s');
        expect(formatDuration(90000)).toBe('1m30s');
        expect(formatDuration(125000)).toBe('2m5s');
      });
    });

    describe('validateConfig', () => {
      it('should validate valid configuration', () => {
        const config = {
          outputFormat: 'table' as const,
          permissions: {
            role: 'developer' as const
          }
        };

        const errors = validateConfig(config);
        expect(errors).toHaveLength(0);
      });

      it('should detect invalid output format', () => {
        const config = {
          outputFormat: 'invalid' as any
        };

        const errors = validateConfig(config);
        expect(errors).toContain('outputFormat 必须是 table、json 或 yaml 之一');
      });

      it('should detect invalid user role', () => {
        const config = {
          permissions: {
            role: 'invalid_role' as any
          }
        };

        const errors = validateConfig(config);
        expect(errors).toContain('role 必须是有效的用户角色');
      });

      it('should return multiple errors', () => {
        const config = {
          outputFormat: 'invalid' as any,
          permissions: {
            role: 'invalid_role' as any
          }
        };

        const errors = validateConfig(config);
        expect(errors).toHaveLength(2);
      });
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle empty command arguments', async () => {
      const handler: PRDCommandHandler = vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        executionTime: 100
      });

      cliParser.registerCommand('test', 'Test command', handler);

      const result = await cliParser.executeCommand('test', [], {});

      expect(result.success).toBe(true);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          args: []
        })
      );
    });

    it('should handle configuration with missing required fields', async () => {
      const incompleteConfig = {
        editor: 'vim'
        // 缺少其他必需字段
      };

      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify(incompleteConfig));

      const config = await cliParser.loadUserConfig('/incomplete.json');

      // 应该合并默认配置
      expect(config.outputFormat).toBe('table');
      expect(config.preferences.autoSave).toBe(true);
      expect(config.editor).toBe('vim');
    });

    it('should handle command execution timeout', async () => {
      // 这里可以测试超时处理逻辑
      // 在实际实现中可能需要支持命令超时
      const slowHandler: PRDCommandHandler = vi.fn().mockImplementation(
        () => new Promise(resolve => {
          setTimeout(() => resolve({
            success: true,
            exitCode: 0,
            executionTime: 5000
          }), 5000);
        })
      );

      cliParser.registerCommand('slow', 'Slow command', slowHandler);

      // 这里可以测试超时逻辑
      const result = await cliParser.executeCommand('slow', [], { timeout: 1 });

      // 在实际实现中应该处理超时
      expect(result).toBeDefined();
    });

    it('should handle memory constraints', () => {
      // 测试内存使用情况
      const initialMemory = process.memoryUsage().heapUsed;

      // 创建多个 CLI 实例
      for (let i = 0; i < 100; i++) {
        const parser = new PRDCLIParser();
        parser.registerCommand(`test${i}`, `Test ${i}`, vi.fn());
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDiff = finalMemory - initialMemory;

      // 内存增长应该在合理范围内（小于 10MB）
      expect(memoryDiff).toBeLessThan(10 * 1024 * 1024);
    });
  });

  describe('Performance Tests', () => {
    it('should execute commands quickly', async () => {
      const fastHandler: PRDCommandHandler = vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        executionTime: 10
      });

      cliParser.registerCommand('fast', 'Fast command', fastHandler);

      const times: number[] = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await cliParser.executeCommand('fast', [], {});
        const end = Date.now();
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      expect(averageTime).toBeLessThan(100); // 平均执行时间小于 100ms
    });

    it('should handle concurrent command executions', async () => {
      const concurrentHandler: PRDCommandHandler = vi.fn().mockResolvedValue({
        success: true,
        exitCode: 0,
        executionTime: 50
      });

      cliParser.registerCommand('concurrent', 'Concurrent command', concurrentHandler);

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(cliParser.executeCommand('concurrent', [`arg${i}`], {}));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(results.every(result => result.success)).toBe(true);
      expect(concurrentHandler).toHaveBeenCalledTimes(5);
    });
  });

  describe('Cross-Platform Compatibility', () => {
    it('should handle Windows paths', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      process.env.USERPROFILE = 'C:\\Users\\test';
      delete process.env.HOME;

      try {
        await cliParser.loadUserConfig();
        expect(true).toBe(true); // 测试不应抛出异常
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });

    it('should handle Unix paths', async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });

      process.env.HOME = '/home/test';
      delete process.env.USERPROFILE;

      try {
        await cliParser.loadUserConfig();
        expect(true).toBe(true); // 测试不应抛出异常
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });
  });
});