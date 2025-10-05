/**
 * 基础任务执行器
 * 处理任务的同步执行、结果记录和状态更新
 */

import { performance } from 'perf_hooks';
import type { Task } from '../types.js';
import { BasicQueueOperations } from './basic-operations.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * 任务处理器函数类型
 */
export type TaskHandler = (payload: Record<string, unknown>) => Promise<unknown> | unknown;

/**
 * 任务执行选项
 */
export interface ExecutionOptions {
  timeout?: number; // milliseconds
  retryCount?: number;
  logExecution?: boolean;
}

export interface ResourceRequirements {
  memory: number; // bytes
  cpu: number; // percentage
  disk: number; // bytes
}

export interface BasicTaskExecutorOptions {
  queuePath?: string;
  maxConcurrency?: number;
  resourceDefaults?: Partial<ResourceRequirements>;
  collectMemoryUsage?: boolean;
}

/**
 * 任务执行结果
 */
export interface ExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number;
  retryCount: number;
  startTime: Date;
  endTime: Date;
  metrics?: ExecutionMetrics;
}
export interface ExecutionMetrics {
  durationMs: number;
  waitTimeMs?: number;
  handlerLatencyMs?: number;
  memoryUsage?: NodeJS.MemoryUsage;
}

export interface ExecutionStats {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  averageExecutionTime: number;
  successRate: number;
}

export interface TaskExecutorCapabilities {
  supportedTypes: string[];
  maxConcurrency: number;
  averageExecutionTime: number;
  resourceRequirements: ResourceRequirements;
}

/**
 * 任务执行上下文
 */
export interface ExecutionContext {
  task: Task;
  attempt: number;
  startTime: Date;
  options: ExecutionOptions;
}

/**
 * 预定义任务类型
 */
export const BUILT_IN_TASK_TYPES = {
  SHELL_COMMAND: 'shell:command',
  FILE_OPERATION: 'file:operation',
  HTTP_REQUEST: 'http:request',
  DATA_PROCESSING: 'data:processing',
  VALIDATION: 'validation:check',
  NOTIFICATION: 'notification:send',
} as const;

/**
 * 基础任务执行器类
 */
export class BasicTaskExecutor {
  private readonly queueOps: BasicQueueOperations;
  private readonly taskHandlers: Map<string, TaskHandler> = new Map();
  private executionLog: ExecutionResult[] = [];
  private readonly maxLogSize: number = 1000;
  private readonly maxConcurrency: number;
  private readonly resourceDefaults: ResourceRequirements;
  private readonly collectMemoryUsage: boolean;

  constructor(queuePath?: string, options?: BasicTaskExecutorOptions);
  constructor(options?: BasicTaskExecutorOptions);
  constructor(
    queuePathOrOptions?: string | BasicTaskExecutorOptions,
    options: BasicTaskExecutorOptions = {}
  ) {
    const resolved = this.resolveOptions(queuePathOrOptions, options);
    const queueConfig = resolved.queuePath ? { queuePath: resolved.queuePath } : {};
    this.queueOps = new BasicQueueOperations(queueConfig);
    this.maxConcurrency = resolved.maxConcurrency ?? 1;
    this.resourceDefaults = {
      memory: resolved.resourceDefaults?.memory ?? 32 * 1024 * 1024,
      cpu: resolved.resourceDefaults?.cpu ?? 50,
      disk: resolved.resourceDefaults?.disk ?? 16 * 1024 * 1024,
    };
    this.collectMemoryUsage = resolved.collectMemoryUsage ?? true;
    this.registerBuiltInHandlers();
  }

  /**
   * 注册任务处理器
   */
  registerTaskHandler(taskType: string, handler: TaskHandler): void {
    this.taskHandlers.set(taskType, handler);
  }

  /**
   * 移除任务处理器
   */
  unregisterTaskHandler(taskType: string): boolean {
    return this.taskHandlers.delete(taskType);
  }

  /**
   * 获取已注册的任务类型
   */
  getRegisteredTaskTypes(): string[] {
    return Array.from(this.taskHandlers.keys());
  }

  /**
   * 执行单个任务
   */
  async executeTask(taskId: string, options: ExecutionOptions = {}): Promise<ExecutionResult> {
    const defaultOptions: ExecutionOptions = {
      timeout: 30000, // 30 seconds
      retryCount: 0,
      logExecution: true,
      ...options,
    };

    const task = await this.queueOps.getTask(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    if (task.status !== 'processing' && task.status !== 'pending') {
      throw new Error(`Task ${taskId} is not in executable state. Current status: ${task.status}`);
    }

    const context: ExecutionContext = {
      task,
      attempt: defaultOptions.retryCount || 0,
      startTime: new Date(),
      options: defaultOptions,
    };

    return this.executeTaskWithContext(context);
  }

  /**
   * 从队列中获取并执行下一个任务
   */
  async executeNextTask(options: ExecutionOptions = {}): Promise<ExecutionResult | null> {
    const task = await this.queueOps.dequeueTask();
    if (!task) {
      return null; // 没有待执行的任务
    }

    return this.executeTask(task.id, options);
  }

  /**
   * 批量执行多个任务
   */
  async executeTasks(
    taskIds: string[],
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const taskId of taskIds) {
      try {
        const result = await this.executeTask(taskId, options);
        results.push(result);
      } catch (error) {
        const errorResult: ExecutionResult = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          executionTime: 0,
          retryCount: 0,
          startTime: new Date(),
          endTime: new Date(),
        };
        results.push(errorResult);
      }
    }

    return results;
  }

  /**
   * 获取执行日志
   */
  getExecutionLog(): ExecutionResult[] {
    return [...this.executionLog];
  }

  /**
   * 清理执行日志
   */
  clearExecutionLog(): void {
    this.executionLog = [];
  }

  /**
   * 获取执行统计信息
   */
  getExecutionStats(): ExecutionStats {
    const total = this.executionLog.length;
    const successful = this.executionLog.filter((r) => r.success).length;
    const avgTime =
      total > 0 ? this.executionLog.reduce((sum, r) => sum + r.executionTime, 0) / total : 0;

    return {
      totalExecutions: total,
      successCount: successful,
      failureCount: total - successful,
      averageExecutionTime: avgTime,
      successRate: total > 0 ? successful / total : 0,
    };
  }

  canHandle(taskType: string): boolean {
    return this.taskHandlers.has(taskType);
  }

  getCapabilities(): TaskExecutorCapabilities {
    const stats = this.getExecutionStats();
    return {
      supportedTypes: this.getRegisteredTaskTypes(),
      maxConcurrency: this.maxConcurrency,
      averageExecutionTime: stats.averageExecutionTime,
      resourceRequirements: { ...this.resourceDefaults },
    };
  }

  /**
   * 使用上下文执行任务
   */
  private async executeTaskWithContext(context: ExecutionContext): Promise<ExecutionResult> {
    const { task, options } = context;
    const measurementStart = performance.now();

    // 预计算等待时间（基于读取到的任务创建时间）
    const waitTimeFromContext = this.calculateWaitTimeFromContext(task, context.startTime);

    // 确保任务状态为处理中
    await this.queueOps.updateTaskStatus(task.id, 'processing');

    const handler = this.taskHandlers.get(task.type);
    if (!handler) {
      throw new Error(`No handler registered for task type: ${task.type}`);
    }

    const processingSnapshot = await this.queueOps.getTask(task.id);
    const attemptNumber = processingSnapshot?.attempts ?? context.attempt + 1;
    const startedAt = this.ensureDate(processingSnapshot?.startedAt) ?? context.startTime;
    const effectiveWait =
      waitTimeFromContext ?? this.calculateWaitTime(processingSnapshot, startedAt);

    const handlerStart = performance.now();

    try {
      const result = options.timeout
        ? await this.executeWithTimeout(handler, task.payload, options.timeout)
        : await handler(task.payload);

      const handlerEnd = performance.now();
      const metrics: ExecutionMetrics = {
        durationMs: Math.max(handlerEnd - measurementStart, 0),
        handlerLatencyMs: Math.max(handlerEnd - handlerStart, 0),
        ...(effectiveWait !== undefined ? { waitTimeMs: effectiveWait } : {}),
        ...(this.collectMemoryUsage ? { memoryUsage: process.memoryUsage() } : {}),
      };

      await this.queueOps.updateTaskStatus(task.id, 'completed', result);

      const executionResult: ExecutionResult = {
        success: true,
        result,
        executionTime: metrics.durationMs,
        retryCount: attemptNumber,
        startTime: context.startTime,
        endTime: new Date(),
        metrics,
      };

      if (options.logExecution) {
        this.addToExecutionLog(executionResult);
      }

      return executionResult;
    } catch (error) {
      const handlerEnd = performance.now();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.queueOps.updateTaskStatus(task.id, 'failed', undefined, errorMessage);

      const metrics: ExecutionMetrics = {
        durationMs: Math.max(handlerEnd - measurementStart, 0),
        handlerLatencyMs: Math.max(handlerEnd - handlerStart, 0),
        ...(effectiveWait !== undefined ? { waitTimeMs: effectiveWait } : {}),
        ...(this.collectMemoryUsage ? { memoryUsage: process.memoryUsage() } : {}),
      };

      const executionResult: ExecutionResult = {
        success: false,
        error: errorMessage,
        executionTime: metrics.durationMs,
        retryCount: attemptNumber,
        startTime: context.startTime,
        endTime: new Date(),
        metrics,
      };

      if (options.logExecution) {
        this.addToExecutionLog(executionResult);
      }

      return executionResult;
    }
  }

  /**
   * 带超时的任务执行
   */
  private async executeWithTimeout(
    handler: TaskHandler,
    payload: Record<string, unknown>,
    timeout: number
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Task execution timed out after ${timeout}ms`));
      }, timeout);

      Promise.resolve(handler(payload))
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * 添加到执行日志
   */
  private addToExecutionLog(result: ExecutionResult): void {
    this.executionLog.push(result);

    // 保持日志大小在限制内
    if (this.executionLog.length > this.maxLogSize) {
      this.executionLog = this.executionLog.slice(-this.maxLogSize);
    }
  }

  private resolveOptions(
    queuePathOrOptions?: string | BasicTaskExecutorOptions,
    options: BasicTaskExecutorOptions = {}
  ): BasicTaskExecutorOptions {
    if (typeof queuePathOrOptions === 'string') {
      return {
        ...options,
        queuePath: queuePathOrOptions,
      };
    }
    if (queuePathOrOptions) {
      return { ...queuePathOrOptions };
    }
    return { ...options };
  }

  private calculateWaitTime(task: Task | null, startedAt: Date): number | undefined {
    if (!task) {
      return undefined;
    }
    const createdAt = this.ensureDate(task.createdAt);
    if (!createdAt) {
      return undefined;
    }
    return Math.max(startedAt.getTime() - createdAt.getTime(), 0);
  }

  private calculateWaitTimeFromContext(task: Task, startedAt: Date): number | undefined {
    const createdAt = this.ensureDate(task.createdAt);
    if (!createdAt) {
      return undefined;
    }
    return Math.max(startedAt.getTime() - createdAt.getTime(), 0);
  }

  private ensureDate(value: Date | string | undefined): Date | undefined {
    if (!value) {
      return undefined;
    }
    if (value instanceof Date) {
      return value;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return undefined;
    }
    return parsed;
  }

  /**
   * 注册内置任务处理器
   */
  private registerBuiltInHandlers(): void {
    // Shell 命令执行器
    this.registerTaskHandler(BUILT_IN_TASK_TYPES.SHELL_COMMAND, async (payload) => {
      const commandValue = payload.command;
      if (typeof commandValue !== 'string' || commandValue.trim() === '') {
        throw new Error('Shell command is required');
      }

      const argsValue = payload.args;
      const normalizedArgs = Array.isArray(argsValue) ? argsValue.map((arg) => String(arg)) : [];

      // 这里可以集成 child_process 来执行 shell 命令
      // 为了安全起见，现在只返回模拟结果
      return {
        command: commandValue,
        args: normalizedArgs,
        output: `Mock execution of: ${commandValue} ${normalizedArgs.join(' ')}`,
        exitCode: 0,
        executedAt: new Date().toISOString(),
      };
    });

    // 文件操作处理器
    this.registerTaskHandler(BUILT_IN_TASK_TYPES.FILE_OPERATION, async (payload) => {
      const operationValue = payload.operation;
      const pathValue = payload.path;
      if (typeof operationValue !== 'string' || typeof pathValue !== 'string') {
        throw new Error('File operation and path are required');
      }

      const contentValue = payload.content;

      // 模拟文件操作
      return {
        operation: operationValue,
        path: pathValue,
        success: true,
        timestamp: new Date().toISOString(),
        message: `Mock ${operationValue} operation on ${pathValue}`,
        ...(contentValue !== undefined ? { contentSnapshot: contentValue } : {}),
      };
    });

    // HTTP 请求处理器
    this.registerTaskHandler(BUILT_IN_TASK_TYPES.HTTP_REQUEST, async (payload) => {
      const methodValue = typeof payload.method === 'string' ? payload.method : 'GET';
      const urlValue = payload.url;
      if (typeof urlValue !== 'string' || urlValue.trim() === '') {
        throw new Error('URL is required for HTTP request');
      }

      const headersValue = isRecord(payload.headers)
        ? Object.fromEntries(
            Object.entries(payload.headers).map(([key, value]) => [key, String(value)])
          )
        : {};
      const bodyValue = payload.body;

      // 模拟 HTTP 请求
      return {
        method: methodValue,
        url: urlValue,
        status: 200,
        statusText: 'OK',
        data: `Mock response from ${methodValue} ${urlValue}`,
        headers: { 'content-type': 'application/json' },
        requestHeaders: headersValue,
        body: bodyValue,
        timestamp: new Date().toISOString(),
      };
    });

    // 数据处理器
    this.registerTaskHandler(BUILT_IN_TASK_TYPES.DATA_PROCESSING, async (payload) => {
      const dataValue = payload.data;
      const operationValue = payload.operation;
      if (dataValue === undefined || dataValue === null) {
        throw new Error('Data is required');
      }
      if (typeof operationValue !== 'string' || operationValue.trim() === '') {
        throw new Error('Data operation is required');
      }

      const optionsValue = payload.options;

      // 模拟数据处理
      return {
        operation: operationValue,
        originalSize: Array.isArray(dataValue) ? dataValue.length : 1,
        processedData: `Processed data with operation: ${operationValue}`,
        timestamp: new Date().toISOString(),
        ...(optionsValue !== undefined ? { optionsUsed: optionsValue } : {}),
      };
    });

    // 验证处理器
    this.registerTaskHandler(BUILT_IN_TASK_TYPES.VALIDATION, async (payload) => {
      const dataValue = payload.data;
      if (dataValue === undefined || dataValue === null) {
        throw new Error('Data is required for validation');
      }

      const rulesValue = Array.isArray(payload.rules) ? payload.rules : [];
      const strictValue = typeof payload.strict === 'boolean' ? payload.strict : false;

      // 模拟验证
      return {
        valid: true,
        data: dataValue,
        appliedRules: rulesValue,
        errors: [],
        warnings: [],
        strict: strictValue,
        timestamp: new Date().toISOString(),
      };
    });

    // 通知处理器
    this.registerTaskHandler(BUILT_IN_TASK_TYPES.NOTIFICATION, async (payload) => {
      const typeValue = payload.type;
      const recipientValue = payload.recipient;
      const messageValue = payload.message;
      if (
        typeof typeValue !== 'string' ||
        typeValue.trim() === '' ||
        typeof recipientValue !== 'string' ||
        recipientValue.trim() === '' ||
        typeof messageValue !== 'string' ||
        messageValue.trim() === ''
      ) {
        throw new Error('Type, recipient, and message are required for notification');
      }

      const optionsValue = isRecord(payload.options) ? payload.options : {};

      // 模拟通知发送
      return {
        type: typeValue,
        recipient: recipientValue,
        message: messageValue,
        sent: true,
        messageId: `msg_${Date.now()}`,
        timestamp: new Date().toISOString(),
        options: optionsValue,
      };
    });
  }
}
