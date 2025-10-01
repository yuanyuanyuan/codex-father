/**
 * Process Manager - 进程管理器 (MVP1: 单进程模式)
 *
 * 负责管理 Codex MCP 进程的生命周期
 * 参考: specs/005-docs-prd-draft/data-model.md:324-383
 *
 * 设计原则:
 * - 单一职责: 仅负责进程生命周期管理
 * - 开闭原则: 可扩展为进程池模式 (MVP2)
 * - 依赖倒置: 通过 CodexClient 与 Codex 通信
 *
 * MVP1 特点:
 * - 单个 codex mcp 进程
 * - 自动重启机制
 * - 健康检查
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { CodexClient, createCodexClient } from '../mcp/codex-client.js';

/**
 * 进程管理器状态
 */
export enum ProcessManagerStatus {
  STOPPED = 'stopped',
  STARTING = 'starting',
  READY = 'ready',
  RESTARTING = 'restarting',
}

/**
 * 进程管理器配置
 */
export interface ProcessManagerConfig {
  codexCommand?: string; // Codex 命令路径 (默认: 'codex')
  codexArgs?: string[]; // Codex 命令参数 (默认: ['mcp'])
  cwd?: string; // 工作目录
  healthCheckInterval?: number; // 健康检查间隔(毫秒, 默认: 30000)
  maxRestartAttempts?: number; // 最大重启次数 (默认: 3)
  restartDelay?: number; // 重启延迟(毫秒, 默认: 1000)
  timeout?: number; // 请求超时时间(毫秒, 默认: 30000)
  debug?: boolean; // 是否输出调试日志
}

/**
 * 进程管理器 (MVP1: 单进程模式)
 *
 * 职责 (Single Responsibility):
 * - 启动和管理单个 codex mcp 进程
 * - 健康检查和自动重启
 * - 提供 CodexClient 访问接口
 */
export class SingleProcessManager extends EventEmitter {
  private config: Required<ProcessManagerConfig>;
  private status: ProcessManagerStatus;
  private process: ChildProcess | null;
  private client: CodexClient | null;
  private healthCheckTimer: NodeJS.Timeout | null;
  private restartAttempts: number;

  constructor(config: ProcessManagerConfig = {}) {
    super();

    this.config = {
      codexCommand: config.codexCommand || 'codex',
      codexArgs: config.codexArgs || ['mcp'],
      cwd: config.cwd || process.cwd(),
      healthCheckInterval: config.healthCheckInterval || 30000,
      maxRestartAttempts: config.maxRestartAttempts || 3,
      restartDelay: config.restartDelay || 1000,
      timeout: config.timeout || 30000,
      debug: config.debug || false,
    };

    this.status = ProcessManagerStatus.STOPPED;
    this.process = null;
    this.client = null;
    this.healthCheckTimer = null;
    this.restartAttempts = 0;
  }

  /**
   * 启动进程管理器
   */
  async start(): Promise<void> {
    if (this.status !== ProcessManagerStatus.STOPPED) {
      throw new Error(`Cannot start: current status is ${this.status}`);
    }

    this.status = ProcessManagerStatus.STARTING;
    this.emit('starting');

    try {
      // 启动 Codex 进程
      await this.spawnProcess();

      // 启动健康检查
      this.startHealthCheck();

      this.status = ProcessManagerStatus.READY;
      this.restartAttempts = 0; // 重置重启计数
      this.emit('ready');

      if (this.config.debug) {
        console.log('[ProcessManager] Started successfully');
      }
    } catch (error) {
      this.status = ProcessManagerStatus.STOPPED;
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * 停止进程管理器
   */
  async stop(): Promise<void> {
    if (this.status === ProcessManagerStatus.STOPPED) {
      return;
    }

    if (this.config.debug) {
      console.log('[ProcessManager] Stopping...');
    }

    // 停止健康检查
    this.stopHealthCheck();

    // 关闭客户端
    if (this.client) {
      this.client.close();
      this.client = null;
    }

    // 终止进程
    if (this.process) {
      this.process.kill('SIGTERM');

      // 等待进程退出 (最多 5 秒)
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process?.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = null;
    }

    this.status = ProcessManagerStatus.STOPPED;
    this.emit('stopped');

    if (this.config.debug) {
      console.log('[ProcessManager] Stopped');
    }
  }

  /**
   * 重启进程
   */
  async restart(): Promise<void> {
    if (this.restartAttempts >= this.config.maxRestartAttempts) {
      const error = new Error(`Max restart attempts (${this.config.maxRestartAttempts}) reached`);
      this.emit('error', error);
      throw error;
    }

    this.restartAttempts++;
    this.status = ProcessManagerStatus.RESTARTING;
    this.emit('restarting', this.restartAttempts);

    if (this.config.debug) {
      console.log(
        `[ProcessManager] Restarting (attempt ${this.restartAttempts}/${this.config.maxRestartAttempts})...`
      );
    }

    // 停止当前进程
    await this.stop();

    // 延迟后重新启动
    await new Promise((resolve) => setTimeout(resolve, this.config.restartDelay));

    await this.start();
  }

  /**
   * 获取 Codex 客户端
   */
  getClient(): CodexClient {
    if (!this.client) {
      throw new Error('CodexClient is not available (process not started)');
    }
    return this.client;
  }

  /**
   * 检查进程是否就绪
   */
  isReady(): boolean {
    return this.status === ProcessManagerStatus.READY && this.client !== null;
  }

  /**
   * 获取进程状态
   */
  getStatus(): ProcessManagerStatus {
    return this.status;
  }

  /**
   * 获取进程 PID
   */
  getPid(): number | undefined {
    return this.process?.pid;
  }

  /**
   * 启动 Codex 进程 (私有方法)
   */
  private async spawnProcess(): Promise<void> {
    if (this.config.debug) {
      console.log(
        `[ProcessManager] Spawning: ${this.config.codexCommand} ${this.config.codexArgs.join(' ')}`
      );
    }

    // 启动子进程
    this.process = spawn(this.config.codexCommand, this.config.codexArgs, {
      cwd: this.config.cwd,
      stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
    });

    if (!this.process.pid) {
      throw new Error('Failed to spawn Codex process (no PID)');
    }

    // 创建 Codex 客户端
    this.client = createCodexClient({
      stdin: this.process.stdin!,
      stdout: this.process.stdout!,
      timeout: this.config.timeout,
      debug: this.config.debug,
    });

    // 监听进程事件
    this.process.on('error', (error) => {
      console.error('[ProcessManager] Process error:', error);
      this.emit('process-error', error);
    });

    this.process.on('exit', (code, signal) => {
      if (this.config.debug) {
        console.log(`[ProcessManager] Process exited: code=${code}, signal=${signal}`);
      }

      this.emit('process-exit', { code, signal });

      // 如果不是主动停止,尝试重启
      if (this.status !== ProcessManagerStatus.STOPPED) {
        this.restart().catch((error) => {
          console.error('[ProcessManager] Auto-restart failed:', error);
        });
      }
    });

    // 监听 stderr (调试输出)
    if (this.config.debug && this.process.stderr) {
      this.process.stderr.on('data', (data) => {
        console.error('[Codex stderr]:', data.toString());
      });
    }

    // 监听客户端事件
    this.client.on('error', (error) => {
      console.error('[ProcessManager] Client error:', error);
      this.emit('client-error', error);
    });

    this.client.on('close', () => {
      if (this.config.debug) {
        console.log('[ProcessManager] Client closed');
      }
      this.emit('client-close');
    });

    // 等待进程准备就绪 (简单策略: 延迟 1 秒)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (this.config.debug) {
      console.log(`[ProcessManager] Process spawned successfully (PID: ${this.process.pid})`);
    }
  }

  /**
   * 启动健康检查 (私有方法)
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      return; // 已经在运行
    }

    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);

    if (this.config.debug) {
      console.log(
        `[ProcessManager] Health check started (interval: ${this.config.healthCheckInterval}ms)`
      );
    }
  }

  /**
   * 停止健康检查 (私有方法)
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;

      if (this.config.debug) {
        console.log('[ProcessManager] Health check stopped');
      }
    }
  }

  /**
   * 执行健康检查 (私有方法)
   */
  private performHealthCheck(): void {
    if (!this.process || this.process.killed || !this.process.pid) {
      if (this.config.debug) {
        console.warn('[ProcessManager] Health check failed: process not alive');
      }

      // 进程已死亡,尝试重启
      this.restart().catch((error) => {
        console.error('[ProcessManager] Health check restart failed:', error);
      });
    } else {
      if (this.config.debug) {
        console.log('[ProcessManager] Health check passed');
      }
    }
  }
}

/**
 * 创建进程管理器的工厂函数
 *
 * @param config 配置对象
 * @returns SingleProcessManager 实例
 */
export function createProcessManager(config?: ProcessManagerConfig): SingleProcessManager {
  return new SingleProcessManager(config);
}
