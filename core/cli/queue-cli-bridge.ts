/**
 * 任务队列 CLI 集成桥梁
 * 连接 CLI 命令与任务队列系统
 */

import chalk from 'chalk';
import type { CommandContext, CommandResult } from '../lib/types.js';
import { BasicQueueOperations, CreateTaskOptions } from '../lib/queue/basic-operations.js';
import {
  TaskStatusQuery,
  TaskFilter,
  TaskSortOptions,
  PaginationOptions,
} from '../lib/queue/status-query.js';
import {
  BasicTaskExecutor,
  ExecutionOptions,
  BUILT_IN_TASK_TYPES,
} from '../lib/queue/basic-executor.js';
import { ErrorFormatter } from './error-boundary.js';

/**
 * CLI 任务创建选项
 */
export interface CLICreateTaskOptions extends CreateTaskOptions {
  execute?: boolean; // 是否立即执行
  wait?: boolean; // 是否等待执行完成
  timeout?: number; // 执行超时（毫秒）
}

/**
 * CLI 任务查询选项
 */
export interface CLIQueryOptions {
  status?: string[]; // 状态过滤
  type?: string[]; // 类型过滤
  limit?: number; // 结果限制
  page?: number; // 页码
  sort?: string; // 排序字段
  order?: 'asc' | 'desc'; // 排序方向
  format?: 'table' | 'json' | 'list'; // 输出格式
}

/**
 * 任务队列 CLI 桥梁类
 */
export class QueueCLIBridge {
  private queueOps: BasicQueueOperations;
  private statusQuery: TaskStatusQuery;
  private executor: BasicTaskExecutor;

  constructor(queuePath?: string) {
    this.queueOps = new BasicQueueOperations({ queuePath });
    this.statusQuery = new TaskStatusQuery(queuePath);
    this.executor = new BasicTaskExecutor(queuePath);
  }

  /**
   * 创建任务命令处理器
   */
  async handleCreateTask(
    context: CommandContext,
    options: CLICreateTaskOptions
  ): Promise<CommandResult> {
    try {
      const { type, payload, execute = false, wait = false, timeout } = options;

      // 验证任务类型
      if (!type) {
        return {
          success: false,
          message: 'Task type is required',
          errors: ['Please specify a task type using --type'],
          executionTime: 0,
        };
      }

      // 创建任务
      const enqueueResult = await this.queueOps.enqueueTask({ type, payload });
      const { taskId, queuePosition, estimatedStartTime, scheduledAt } = enqueueResult;

      const result: any = {
        taskId,
        queuePosition,
        estimatedStartTime,
        scheduledAt,
      };
      let executionTime = 0;
      const startTime = Date.now();

      // 如果需要立即执行
      if (execute) {
        const execOptions: ExecutionOptions = { timeout };
        const execResult = await this.executor.executeTask(taskId, execOptions);
        result.execution = execResult;
        executionTime = execResult.executionTime;

        if (!execResult.success && !wait) {
          return {
            success: false,
            message: `Task created but execution failed: ${execResult.error}`,
            data: result,
            errors: [execResult.error || 'Unknown execution error'],
            executionTime: Date.now() - startTime,
          };
        }
      }

      executionTime = executionTime || Date.now() - startTime;

      if (context.json) {
        return {
          success: true,
          data: result,
          executionTime,
        };
      }

      const messages = [`✅ Task created: ${chalk.cyan(taskId)}`];
      if (typeof queuePosition === 'number') {
        messages.push(`📬 Queue position: ${queuePosition}`);
      }
      if (estimatedStartTime instanceof Date) {
        messages.push(`⏱️ Estimated start: ${estimatedStartTime.toISOString()}`);
      }
      if (execute) {
        const execResult = result.execution;
        if (execResult.success) {
          messages.push(
            `✅ Task executed successfully in ${execResult.executionTime.toFixed(2)}ms`
          );
        } else {
          messages.push(`❌ Task execution failed: ${execResult.error}`);
        }
      }

      return {
        success: true,
        message: messages.join('\\n'),
        data: context.verbose ? result : undefined,
        executionTime,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to create task',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        executionTime: 0,
      };
    }
  }

  /**
   * 列出任务命令处理器
   */
  async handleListTasks(
    context: CommandContext,
    options: CLIQueryOptions = {}
  ): Promise<CommandResult> {
    try {
      const startTime = Date.now();

      // 构建过滤器
      const filter: TaskFilter = {};
      if (options.status) {
        filter.status = options.status as any[];
      }
      if (options.type) {
        filter.type = options.type;
      }

      // 构建排序选项
      const sort: TaskSortOptions | undefined = options.sort
        ? {
            field: options.sort as any,
            direction: options.order || 'desc',
          }
        : undefined;

      // 构建分页选项
      const pagination: PaginationOptions | undefined = options.limit
        ? {
            page: options.page || 1,
            limit: options.limit,
          }
        : undefined;

      // 查询任务
      const queryResult = await this.statusQuery.queryTasks(filter, sort, pagination);

      const executionTime = Date.now() - startTime;

      if (context.json) {
        return {
          success: true,
          data: queryResult,
          executionTime,
        };
      }

      // 格式化输出
      const message = this.formatTaskList(queryResult.tasks, options.format || 'table');

      return {
        success: true,
        message,
        data: context.verbose ? queryResult : undefined,
        executionTime,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to list tasks',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        executionTime: 0,
      };
    }
  }

  /**
   * 查看任务状态命令处理器
   */
  async handleTaskStatus(context: CommandContext, taskId: string): Promise<CommandResult> {
    try {
      const startTime = Date.now();

      if (!taskId) {
        return {
          success: false,
          message: 'Task ID is required',
          errors: ['Please provide a task ID'],
          executionTime: 0,
        };
      }

      const task = await this.queueOps.getTask(taskId);
      if (!task) {
        return {
          success: false,
          message: `Task not found: ${taskId}`,
          errors: [`No task found with ID: ${taskId}`],
          executionTime: Date.now() - startTime,
        };
      }

      if (context.json) {
        return {
          success: true,
          data: task,
          executionTime: Date.now() - startTime,
        };
      }

      const message = this.formatTaskDetails(task);

      return {
        success: true,
        message,
        data: context.verbose ? task : undefined,
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get task status',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        executionTime: 0,
      };
    }
  }

  /**
   * 执行任务命令处理器
   */
  async handleExecuteTask(
    context: CommandContext,
    taskId: string,
    options: ExecutionOptions = {}
  ): Promise<CommandResult> {
    try {
      const startTime = Date.now();

      if (!taskId) {
        return {
          success: false,
          message: 'Task ID is required',
          errors: ['Please provide a task ID'],
          executionTime: 0,
        };
      }

      const execResult = await this.executor.executeTask(taskId, options);

      if (context.json) {
        return {
          success: execResult.success,
          data: execResult,
          executionTime: Date.now() - startTime,
        };
      }

      const message = execResult.success
        ? `✅ Task executed successfully in ${execResult.executionTime.toFixed(2)}ms`
        : `❌ Task execution failed: ${execResult.error}`;

      return {
        success: execResult.success,
        message,
        data: context.verbose ? execResult : undefined,
        errors: execResult.success ? undefined : [execResult.error || 'Unknown error'],
        executionTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to execute task',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        executionTime: 0,
      };
    }
  }

  /**
   * 队列统计命令处理器
   */
  async handleQueueStats(context: CommandContext): Promise<CommandResult> {
    try {
      const startTime = Date.now();

      const [queueStats, taskStats, executionStats, healthStatus] = await Promise.all([
        this.queueOps.getQueueStats(),
        this.statusQuery.getTaskStatistics(),
        this.executor.getExecutionStats(),
        this.statusQuery.getQueueHealth(),
      ]);

      const stats = {
        queue: queueStats,
        tasks: taskStats,
        execution: executionStats,
        health: healthStatus,
      };

      const executionTime = Date.now() - startTime;

      if (context.json) {
        return {
          success: true,
          data: stats,
          executionTime,
        };
      }

      const message = this.formatQueueStats(stats);

      return {
        success: true,
        message,
        data: context.verbose ? stats : undefined,
        executionTime,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get queue statistics',
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        executionTime: 0,
      };
    }
  }

  /**
   * 注册任务处理器命令
   */
  registerTaskHandler(taskType: string, handler: any): void {
    this.executor.registerTaskHandler(taskType, handler);
  }

  /**
   * 获取可用任务类型
   */
  getAvailableTaskTypes(): string[] {
    return [...this.executor.getRegisteredTaskTypes(), ...Object.values(BUILT_IN_TASK_TYPES)];
  }

  /**
   * 格式化任务列表
   */
  private formatTaskList(tasks: any[], format: string): string {
    if (tasks.length === 0) {
      return '📭 No tasks found';
    }

    switch (format) {
      case 'json':
        return JSON.stringify(tasks, null, 2);

      case 'list':
        return tasks
          .map((task) => {
            const status = this.getStatusIcon(task.status);
            const time = new Date(task.createdAt).toLocaleString();
            return `${status} ${chalk.cyan(task.id)} [${chalk.yellow(task.type)}] - ${time}`;
          })
          .join('\\n');

      case 'table':
      default:
        const headers = ['ID', 'Type', 'Status', 'Created', 'Updated'];
        const rows = tasks.map((task) => [
          task.id.substring(0, 8) + '...',
          task.type,
          this.getStatusIcon(task.status) + ' ' + task.status,
          new Date(task.createdAt).toLocaleString(),
          new Date(task.updatedAt).toLocaleString(),
        ]);

        return this.formatTable(headers, rows);
    }
  }

  /**
   * 格式化任务详情
   */
  private formatTaskDetails(task: any): string {
    const lines = [
      `📋 Task Details: ${chalk.cyan(task.id)}`,
      '',
      `${chalk.bold('Type:')} ${task.type}`,
      `${chalk.bold('Status:')} ${this.getStatusIcon(task.status)} ${task.status}`,
      `${chalk.bold('Created:')} ${new Date(task.createdAt).toLocaleString()}`,
      `${chalk.bold('Updated:')} ${new Date(task.updatedAt).toLocaleString()}`,
    ];

    if (task.result) {
      lines.push('', `${chalk.bold('Result:')}`, JSON.stringify(task.result, null, 2));
    }

    if (task.error) {
      lines.push('', `${chalk.bold('Error:')} ${chalk.red(task.error)}`);
    }

    if (task.payload && Object.keys(task.payload).length > 0) {
      lines.push('', `${chalk.bold('Payload:')}`, JSON.stringify(task.payload, null, 2));
    }

    return lines.join('\\n');
  }

  /**
   * 格式化队列统计
   */
  private formatQueueStats(stats: any): string {
    const lines = [
      '📊 Queue Statistics',
      '',
      `${chalk.bold('Queue Status:')}`,
      `  Pending: ${chalk.yellow(stats.queue.pending)}`,
      `  Running: ${chalk.blue(stats.queue.processing)}`,
      `  Completed: ${chalk.green(stats.queue.completed)}`,
      `  Failed: ${chalk.red(stats.queue.failed)}`,
      `  Cancelled: ${chalk.gray(stats.queue.cancelled)}`,
      '',
      `${chalk.bold('Task Statistics:')}`,
      `  Total Tasks: ${stats.tasks.total}`,
      `  Success Rate: ${(stats.tasks.successRate * 100).toFixed(1)}%`,
    ];

    if (stats.tasks.averageExecutionTime) {
      lines.push(`  Average Execution Time: ${stats.tasks.averageExecutionTime.toFixed(2)}ms`);
    }

    if (stats.execution.totalExecutions > 0) {
      lines.push(
        '',
        `${chalk.bold('Execution Statistics:')}`,
        `  Total Executions: ${stats.execution.totalExecutions}`,
        `  Success Count: ${chalk.green(stats.execution.successCount)}`,
        `  Failure Count: ${chalk.red(stats.execution.failureCount)}`,
        `  Average Time: ${stats.execution.averageExecutionTime.toFixed(2)}ms`
      );
    }

    lines.push(
      '',
      `${chalk.bold('Health Status:')} ${stats.health.healthy ? '✅ Healthy' : '⚠️  Issues Detected'}`
    );

    if (!stats.health.healthy) {
      lines.push('Issues:', ...stats.health.issues.map((issue: string) => `  - ${issue}`));
    }

    return lines.join('\\n');
  }

  /**
   * 获取状态图标
   */
  private getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      pending: '⏳',
      processing: '🔄',
      completed: '✅',
      failed: '❌',
      cancelled: '🚫',
    };
    return icons[status] || '❓';
  }

  /**
   * 格式化表格
   */
  private formatTable(headers: string[], rows: string[][]): string {
    if (rows.length === 0) {
      return 'No data';
    }

    // 计算列宽
    const colWidths = headers.map((header, i) => {
      const dataWidth = Math.max(...rows.map((row) => (row[i] || '').length));
      return Math.max(header.length, dataWidth);
    });

    // 创建分隔线
    const separator = '┼' + colWidths.map((w) => '─'.repeat(w + 2)).join('┼') + '┼';
    const topBorder = '┌' + colWidths.map((w) => '─'.repeat(w + 2)).join('┬') + '┐';
    const bottomBorder = '└' + colWidths.map((w) => '─'.repeat(w + 2)).join('┴') + '┘';

    // 格式化行
    const formatRow = (row: string[]) => {
      return '│' + row.map((cell, i) => ` ${(cell || '').padEnd(colWidths[i])} `).join('│') + '│';
    };

    // 组装表格
    const lines = [
      topBorder,
      formatRow(headers.map((h) => chalk.bold(h))),
      separator,
      ...rows.map(formatRow),
      bottomBorder,
    ];

    return lines.join('\\n');
  }
}
