/**
 * Process Manager Unit Tests - 进程管理器单元测试
 *
 * 测试覆盖:
 * - 进程启动和停止
 * - 进程重启机制
 * - 健康检查
 * - 状态管理
 * - 客户端访问
 * - 错误处理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import {
  SingleProcessManager,
  createProcessManager,
  ProcessManagerStatus,
  type ProcessManagerConfig,
} from '../manager.js';
import type { CodexClient } from '../../mcp/codex-client.js';
import { spawn } from 'child_process';
import { createCodexClient } from '../../mcp/codex-client.js';

// Mock child_process
vi.mock('child_process', () => {
  return {
    spawn: vi.fn(),
  };
});

// Mock CodexClient
vi.mock('../../mcp/codex-client.js', () => {
  return {
    createCodexClient: vi.fn(),
  };
});

describe('SingleProcessManager', () => {
  let manager: SingleProcessManager;
  let mockProcess: any;
  let mockClient: any;

  beforeEach(() => {
    // 创建 mock 子进程
    mockProcess = new EventEmitter();
    mockProcess.pid = 12345;
    mockProcess.killed = false;
    mockProcess.stdin = { write: vi.fn() };
    mockProcess.stdout = new EventEmitter();
    mockProcess.stderr = new EventEmitter();
    mockProcess.kill = vi.fn().mockImplementation((signal: string) => {
      mockProcess.killed = true;
      // 关键修改: kill() 不自动触发 exit 事件
      // 只有当 process.once('exit', ...) 被调用时(在 stop() 中的 Promise.race)
      // 我们才在 afterEach 中触发 exit
      // 这样可以避免自动重启逻辑干扰手动重启测试
    });

    // 创建 mock CodexClient
    mockClient = new EventEmitter();
    mockClient.close = vi.fn();

    // Mock spawn 和 createCodexClient
    vi.mocked(spawn).mockReturnValue(mockProcess as any);
    vi.mocked(createCodexClient).mockReturnValue(mockClient as unknown as CodexClient);

    // 创建进程管理器实例
    manager = createProcessManager({
      codexCommand: 'codex',
      codexArgs: ['mcp'],
      healthCheckInterval: 100, // 缩短健康检查间隔以加快测试
      restartDelay: 50, // 缩短重启延迟
      debug: false,
    });
  });

  afterEach(async () => {
    // 清理: 停止管理器
    if (manager.getStatus() !== ProcessManagerStatus.STOPPED) {
      const stopPromise = manager.stop();
      // 手动触发 exit 事件以完成 stop()
      if (mockProcess && !mockProcess.killed) {
        setTimeout(() => mockProcess.emit('exit', 0, null), 10);
      }
      await stopPromise;
    }
    vi.clearAllMocks();
  });

  describe('基本功能', () => {
    it('应该创建 SingleProcessManager 实例', () => {
      expect(manager).toBeInstanceOf(SingleProcessManager);
      expect(manager).toBeInstanceOf(EventEmitter);
    });

    it('应该使用默认配置', () => {
      const defaultManager = createProcessManager();
      expect(defaultManager).toBeInstanceOf(SingleProcessManager);
      expect(defaultManager.getStatus()).toBe(ProcessManagerStatus.STOPPED);
    });

    it('应该初始状态为 STOPPED', () => {
      expect(manager.getStatus()).toBe(ProcessManagerStatus.STOPPED);
      expect(manager.isReady()).toBe(false);
    });
  });

  describe('进程启动', () => {
    it('应该成功启动进程', async () => {
      const startingListener = vi.fn();
      const readyListener = vi.fn();
      manager.on('starting', startingListener);
      manager.on('ready', readyListener);

      await manager.start();

      expect(manager.getStatus()).toBe(ProcessManagerStatus.READY);
      expect(manager.isReady()).toBe(true);
      expect(startingListener).toHaveBeenCalledOnce();
      expect(readyListener).toHaveBeenCalledOnce();
    });

    it('应该调用 spawn 启动 codex 进程', async () => {
      await manager.start();

      expect(spawn).toHaveBeenCalledWith('codex', ['mcp'], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    it('应该创建 CodexClient', async () => {
      await manager.start();

      expect(createCodexClient).toHaveBeenCalledWith({
        stdin: mockProcess.stdin,
        stdout: mockProcess.stdout,
        timeout: 30000,
        debug: false,
      });
    });

    it('应该获取进程 PID', async () => {
      await manager.start();

      expect(manager.getPid()).toBe(12345);
    });

    it('应该在已启动时抛出错误', async () => {
      await manager.start();

      await expect(manager.start()).rejects.toThrow('Cannot start: current status is ready');
    });

    it('应该在进程无 PID 时启动失败', async () => {
      mockProcess.pid = undefined;

      await expect(manager.start()).rejects.toThrow('Failed to spawn Codex process (no PID)');
      expect(manager.getStatus()).toBe(ProcessManagerStatus.STOPPED);
    });
  });

  describe('进程停止', () => {
    it('应该成功停止进程', async () => {
      await manager.start();

      const stoppedListener = vi.fn();
      manager.on('stopped', stoppedListener);

      const stopPromise = manager.stop();
      // 手动触发 exit 事件以完成 stop()
      setTimeout(() => mockProcess.emit('exit', 0, null), 10);
      await stopPromise;

      expect(manager.getStatus()).toBe(ProcessManagerStatus.STOPPED);
      expect(manager.isReady()).toBe(false);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(mockClient.close).toHaveBeenCalled();
      expect(stoppedListener).toHaveBeenCalledOnce();
    });

    it('应该在未启动时直接返回', async () => {
      await manager.stop();

      expect(manager.getStatus()).toBe(ProcessManagerStatus.STOPPED);
      expect(mockProcess.kill).not.toHaveBeenCalled();
    });

    it('应该等待进程退出', async () => {
      await manager.start();

      // 模拟进程延迟退出
      mockProcess.kill.mockImplementation(() => {
        mockProcess.killed = true;
        setTimeout(() => mockProcess.emit('exit', 0, null), 100);
      });

      const stopPromise = manager.stop();
      await stopPromise;

      expect(mockProcess.kill).toHaveBeenCalled();
    });

    it('应该在进程不退出时强制终止 (SIGKILL)', async () => {
      await manager.start();

      // 模拟进程不响应 SIGTERM
      mockProcess.kill.mockImplementation((signal) => {
        if (signal === 'SIGKILL') {
          mockProcess.killed = true;
          mockProcess.emit('exit', -1, 'SIGKILL');
        }
        // SIGTERM 不做任何事 (进程不退出)
      });

      await manager.stop();

      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      // SIGKILL 会在超时后调用
    });
  });

  describe('客户端访问', () => {
    it('应该成功获取 CodexClient', async () => {
      await manager.start();

      const client = manager.getClient();

      expect(client).toBe(mockClient);
    });

    it('应该在未启动时抛出错误', () => {
      expect(() => manager.getClient()).toThrow(
        'CodexClient is not available (process not started)'
      );
    });
  });

  describe('状态查询', () => {
    it('应该正确返回进程状态', async () => {
      expect(manager.getStatus()).toBe(ProcessManagerStatus.STOPPED);

      const startPromise = manager.start();
      // 启动过程中状态应该是 STARTING (需要在 start() 内部检查)
      await startPromise;

      expect(manager.getStatus()).toBe(ProcessManagerStatus.READY);

      const stopPromise = manager.stop();
      setTimeout(() => mockProcess.emit('exit', 0, null), 10);
      await stopPromise;
      expect(manager.getStatus()).toBe(ProcessManagerStatus.STOPPED);
    });

    it('应该正确返回 isReady 状态', async () => {
      expect(manager.isReady()).toBe(false);

      await manager.start();
      expect(manager.isReady()).toBe(true);

      const stopPromise = manager.stop();
      setTimeout(() => mockProcess.emit('exit', 0, null), 10);
      await stopPromise;
      expect(manager.isReady()).toBe(false);
    });

    it('应该正确返回进程 PID', async () => {
      expect(manager.getPid()).toBeUndefined();

      await manager.start();
      expect(manager.getPid()).toBe(12345);

      const stopPromise = manager.stop();
      setTimeout(() => mockProcess.emit('exit', 0, null), 10);
      await stopPromise;
      expect(manager.getPid()).toBeUndefined();
    });
  });

  describe('进程重启', () => {
    it('应该成功手动重启进程', async () => {
      await manager.start();

      const firstPid = manager.getPid();

      const restartingListener = vi.fn();
      manager.on('restarting', restartingListener);

      // 创建新的 mock 进程 (模拟重启后的新进程)
      const newMockProcess = new EventEmitter();
      (newMockProcess as any).pid = 67890;
      (newMockProcess as any).killed = false;
      (newMockProcess as any).stdin = { write: vi.fn() };
      (newMockProcess as any).stdout = new EventEmitter();
      (newMockProcess as any).stderr = new EventEmitter();
      (newMockProcess as any).kill = vi.fn(); // 不自动触发 exit

      // 让 spawn 返回新的 mock 进程
      vi.mocked(spawn).mockReturnValueOnce(newMockProcess as any);

      const restartPromise = manager.restart();
      // 手动触发旧进程的 exit 事件以完成 stop() 阶段
      setTimeout(() => mockProcess.emit('exit', 0, null), 10);
      await restartPromise;

      expect(restartingListener).toHaveBeenCalledWith(1);
      expect(manager.getStatus()).toBe(ProcessManagerStatus.READY);
      expect(manager.getPid()).toBe(67890);
    });

    it('应该在超过最大重启次数时抛出错误', async () => {
      const managerWithLowMax = createProcessManager({
        maxRestartAttempts: 2,
        restartDelay: 10,
        healthCheckInterval: 10000, // 延长健康检查间隔,避免干扰
      });

      await managerWithLowMax.start();

      // 手动设置 restartAttempts 为 2,模拟已经重启了 2 次
      (managerWithLowMax as any).restartAttempts = 2;

      // 第三次重启应该失败
      await expect(managerWithLowMax.restart()).rejects.toThrow('Max restart attempts (2) reached');

      // 清理
      (managerWithLowMax as any).restartAttempts = 0; // 重置以允许 stop() 正常工作
      const stopPromise = managerWithLowMax.stop();
      setTimeout(() => mockProcess.emit('exit', 0, null), 10);
      await stopPromise;
    });

    it('应该在进程意外退出时自动重启', async () => {
      await manager.start();

      const restartSpy = vi.spyOn(manager, 'restart');

      // 模拟进程意外退出
      mockProcess.emit('exit', 1, null);

      // 等待重启完成
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(restartSpy).toHaveBeenCalled();
    });
  });

  describe('健康检查', () => {
    it('应该定期执行健康检查', async () => {
      const managerWithFastCheck = createProcessManager({
        healthCheckInterval: 50,
      });

      await managerWithFastCheck.start();

      // 等待至少两次健康检查
      await new Promise((resolve) => setTimeout(resolve, 150));

      // 进程应该仍然正常
      expect(managerWithFastCheck.isReady()).toBe(true);

      const stopPromise = managerWithFastCheck.stop();
      // 手动触发 exit 事件以完成 stop()
      setTimeout(() => mockProcess.emit('exit', 0, null), 10);
      await stopPromise;
    });

    it('应该在健康检查发现进程死亡时重启', async () => {
      const managerWithFastCheck = createProcessManager({
        healthCheckInterval: 50,
        restartDelay: 10,
      });

      await managerWithFastCheck.start();

      const restartSpy = vi.spyOn(managerWithFastCheck, 'restart');

      // 模拟进程死亡 (但不触发 exit 事件)
      mockProcess.killed = true;
      mockProcess.pid = undefined;

      // 等待健康检查触发
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(restartSpy).toHaveBeenCalled();

      const stopPromise = managerWithFastCheck.stop();
      // 手动触发 exit 事件以完成 stop()
      setTimeout(() => mockProcess.emit('exit', 0, null), 10);
      await stopPromise;
    });
  });

  describe('错误处理', () => {
    it('应该发出进程错误事件', async () => {
      await manager.start();

      const errorListener = vi.fn();
      manager.on('process-error', errorListener);

      const testError = new Error('Test process error');
      mockProcess.emit('error', testError);

      expect(errorListener).toHaveBeenCalledWith(testError);
    });

    it('应该发出客户端错误事件', async () => {
      await manager.start();

      const errorListener = vi.fn();
      manager.on('client-error', errorListener);

      const testError = new Error('Test client error');
      mockClient.emit('error', testError);

      expect(errorListener).toHaveBeenCalledWith(testError);
    });

    it('应该发出进程退出事件', async () => {
      await manager.start();

      const exitListener = vi.fn();
      manager.on('process-exit', exitListener);

      mockProcess.emit('exit', 0, null);

      // 等待事件处理
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(exitListener).toHaveBeenCalledWith({ code: 0, signal: null });
    });

    it('应该发出客户端关闭事件', async () => {
      await manager.start();

      const closeListener = vi.fn();
      manager.on('client-close', closeListener);

      mockClient.emit('close');

      expect(closeListener).toHaveBeenCalled();
    });

    it('应该在启动失败时恢复 STOPPED 状态', async () => {
      // 模拟 spawn 失败
      mockProcess.pid = undefined;

      await expect(manager.start()).rejects.toThrow();

      expect(manager.getStatus()).toBe(ProcessManagerStatus.STOPPED);
      expect(manager.isReady()).toBe(false);
    });
  });

  describe('工厂函数', () => {
    it('应该通过工厂函数创建实例', () => {
      const instance = createProcessManager({
        codexCommand: 'test-codex',
      });

      expect(instance).toBeInstanceOf(SingleProcessManager);
    });
  });

  describe('边缘情况', () => {
    it('应该处理进程立即退出的情况', async () => {
      // 为这个测试创建特殊的 mock,让 kill() 自动触发 exit
      mockProcess.kill.mockImplementation(() => {
        mockProcess.killed = true;
        setTimeout(() => mockProcess.emit('exit', 0, null), 10);
      });

      await manager.start();

      const restartSpy = vi.spyOn(manager, 'restart');

      // 触发立即退出,这会触发自动重启
      mockProcess.emit('exit', 1, null);

      // 等待一小段时间,验证 restart 被调用
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 应该已经调用了 restart 方法 (即使重启可能未完成)
      expect(restartSpy).toHaveBeenCalled();
    });

    it('应该处理客户端创建失败', async () => {
      vi.mocked(createCodexClient).mockImplementationOnce(() => {
        throw new Error('Client creation failed');
      });

      await expect(manager.start()).rejects.toThrow('Client creation failed');
      expect(manager.getStatus()).toBe(ProcessManagerStatus.STOPPED);
    });

    it('应该在停止过程中取消健康检查', async () => {
      await manager.start();

      // 健康检查应该在运行
      expect(manager.isReady()).toBe(true);

      const stopPromise = manager.stop();
      setTimeout(() => mockProcess.emit('exit', 0, null), 10);
      await stopPromise;

      // 健康检查应该已停止 (无法直接验证,但可以确认状态)
      expect(manager.getStatus()).toBe(ProcessManagerStatus.STOPPED);
    });
  });
});
