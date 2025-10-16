import { Request, Response } from 'express';
import { TaskRunner } from '../../core/TaskRunner.js';
import { TaskConfig } from '../../core/types.js';
import { ErrorHandler } from '../../core/utils.js';
import { WebSocketManager } from './websocket.js';
import { z } from 'zod';

function getRequestId(res: Response): string {
  return (
    (res.locals?.requestId as string) ||
    res.get('X-Request-ID') ||
    `req-${Math.random().toString(36).substr(2, 9)}`
  );
}

// Request schemas
const submitTaskSchema = z
  .object({
    id: z.string().optional(),
    prompt: z.string().optional(),
    command: z.string().optional(),
    files: z.array(z.string()).default([]),
    environment: z.enum(['shell', 'nodejs', 'python']).default('shell'),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
    dependencies: z.array(z.string()).default([]),
    timeout: z.number().positive().optional(),
    workingDirectory: z.string().optional(),
  })
  .refine((data) => data.prompt || data.command, {
    message: "Either 'prompt' or 'command' must be provided",
  });

const replyTaskSchema = z.object({
  message: z.string(),
  files: z.array(z.string()).default([]),
});

const getTaskSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9._-]+$/, 'Invalid task id'),
});

export class TaskController {
  private runner: TaskRunner;
  private wsManager: WebSocketManager;

  constructor(runner: TaskRunner, wsManager: WebSocketManager) {
    this.runner = runner;
    this.wsManager = wsManager;
  }

  async submitTask(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = submitTaskSchema.parse(req.body);
      const {
        id,
        prompt,
        command,
        files = [],
        environment,
        priority,
        dependencies,
        timeout,
        workingDirectory,
      } = validatedData;

      const taskId = id || ErrorHandler.generateTaskId();

      // Security validation
      if (command && this.containsSecurityThreats(command)) {
        this.sendError(res, 400, {
          code: 'SECURITY_VIOLATION',
          message: 'Command contains security threats or invalid paths',
        });
        return;
      }

      // Validate parameters
      if (priority && !['low', 'normal', 'high'].includes(priority)) {
        this.sendError(res, 400, {
          code: 'BAD_REQUEST',
          message: 'Invalid priority value',
        });
        return;
      }

      if (environment && !['shell', 'nodejs', 'python'].includes(environment)) {
        this.sendError(res, 400, {
          code: 'BAD_REQUEST',
          message: 'Invalid environment type',
        });
        return;
      }

      if (timeout && (typeof timeout !== 'number' || timeout <= 0)) {
        this.sendError(res, 400, {
          code: 'BAD_REQUEST',
          message: 'Invalid timeout value',
        });
        return;
      }

      // Build execute function
      const executeFn = async () => {
        if (command) {
          return await this.executeCommand(command, environment);
        } else if (prompt) {
          return await this.executePrompt(prompt, files, environment);
        }
        throw new Error('Either prompt or command must be provided');
      };

      // Create task config
      const taskConfig: TaskConfig = {
        id: taskId,
        execute: executeFn,
        timeout,
        dependencies,
        priority,
        environment,
        workingDirectory,
        metadata: { files, prompt, command },
      };

      // Submit task to runner
      await this.runner.run(taskConfig);

      // Broadcast task started
      this.wsManager.broadcastUpdate({
        type: 'task_started',
        data: {
          taskId,
          prompt: prompt || command,
          environment,
        },
        timestamp: new Date().toISOString(),
      });

      this.sendSuccess(res, 201, {
        taskId,
        status: 'started',
        message: 'Task submitted successfully',
      });
    } catch (error: any) {
      console.error('Submit task error:', error);

      if (error instanceof z.ZodError) {
        this.sendError(res, 400, {
          code: 'BAD_REQUEST',
          message: 'Invalid request parameters',
          details: error.errors,
        });
      } else {
        this.sendError(res, 500, {
          code: 'INTERNAL_ERROR',
          message: error.message,
        });
      }
    }
  }

  async getTask(req: Request, res: Response): Promise<void> {
    try {
      const validatedParams = getTaskSchema.parse(req.params);
      const { id } = validatedParams;
      const result = this.runner.getResult(id);

      if (!result) {
        this.sendError(res, 404, {
          code: 'TASK_NOT_FOUND',
          message: `Task ${id} not found`,
        });
        return;
      }

      this.sendSuccess(res, 200, {
        taskId: id,
        status: result.success ? 'completed' : 'failed',
        startTime:
          result.startTime instanceof Date ? result.startTime.toISOString() : result.startTime,
        endTime: result.endTime instanceof Date ? result.endTime.toISOString() : result.endTime,
        duration: result.duration,
        result: result.success ? result.result : undefined,
        error: result.success ? undefined : result.error,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        this.sendError(res, 400, {
          code: 'BAD_REQUEST',
          message: 'Invalid request parameters',
          details: error.errors,
        });
        return;
      }

      console.error('Get task error:', error);
      this.sendError(res, 500, {
        code: 'GET_ERROR',
        message: error.message,
      });
    }
  }

  async listTasks(req: Request, res: Response): Promise<void> {
    try {
      const { status, limit = 20 } = req.query;
      const runnerStatus = this.runner.getStatus();

      const filters = Array.isArray(status) ? status : status ? [status] : [];
      const tasks = [];

      this.sendSuccess(res, 200, {
        tasks,
        total: tasks.length,
        hasMore: false,
        status: runnerStatus,
        filters,
        limit: Number(limit),
      });
    } catch (error: any) {
      console.error('List tasks error:', error);
      this.sendError(res, 500, {
        code: 'LIST_ERROR',
        message: error.message,
      });
    }
  }

  async replyTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = replyTaskSchema.parse(req.body);
      const { message, files = [] } = validatedData;

      // Security validation for file paths
      if (files.some((file) => this.containsSecurityThreats(file))) {
        this.sendError(res, 400, {
          code: 'SECURITY_VIOLATION',
          message: 'File paths contain security threats',
        });
        return;
      }

      // Check if task exists and is running
      const result = this.runner.getResult(id);
      if (!result) {
        this.sendError(res, 404, {
          code: 'TASK_NOT_FOUND',
          message: `Task ${id} not found`,
        });
        return;
      }

      if (result.success) {
        this.sendError(res, 409, {
          code: 'TASK_COMPLETED',
          message: `Task ${id} is already completed`,
        });
        return;
      }

      // In a real implementation, this would add context to the running task
      // For now, we'll just acknowledge and broadcast the reply
      this.wsManager.broadcastUpdate({
        type: 'task_reply',
        data: {
          taskId: id,
          message,
          files,
        },
        timestamp: new Date().toISOString(),
      });

      this.sendSuccess(res, 200, {
        message: 'Reply added to task',
        taskId: id,
      });
    } catch (error: any) {
      console.error('Reply task error:', error);

      if (error instanceof z.ZodError) {
        this.sendError(res, 400, {
          code: 'BAD_REQUEST',
          message: 'Invalid request parameters',
          details: error.errors,
        });
      } else {
        this.sendError(res, 500, {
          code: 'REPLY_ERROR',
          message: error.message,
        });
      }
    }
  }

  async cancelTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const cancelled = await this.runner.cancel(id);

      if (cancelled) {
        // Broadcast task cancelled
        this.wsManager.broadcastUpdate({
          type: 'task_cancelled',
          data: {
            taskId: id,
          },
          timestamp: new Date().toISOString(),
        });

        this.sendSuccess(res, 200, {
          message: 'Task cancelled successfully',
          taskId: id,
        });
      } else {
        this.sendError(res, 404, {
          code: 'TASK_NOT_FOUND',
          message: `Task ${id} is not running or not found`,
        });
      }
    } catch (error: any) {
      console.error('Cancel task error:', error);
      this.sendError(res, 500, {
        code: 'CANCEL_ERROR',
        message: error.message,
      });
    }
  }

  private async executeCommand(command: string, environment: string): Promise<any> {
    // Simplified command execution - would use appropriate exec methods
    return {
      type: 'command',
      command,
      environment,
      output: `Command executed: ${command}`,
      exitCode: 0,
    };
  }

  private async executePrompt(prompt: string, files: string[], environment: string): Promise<any> {
    // Simplified prompt execution - would use AI/LLM
    return {
      type: 'prompt',
      prompt,
      files,
      environment,
      output: `Prompt processed: ${prompt}`,
      filesCreated: files.length,
    };
  }

  private containsSecurityThreats(command: string): boolean {
    // Check for dangerous path patterns
    const dangerousPatterns = [
      /\.\.\//g, // Parent directory traversal
      /\/etc\//, // System files
      /\/proc\//, // Process files
      /\/sys\//, // System files
      /rm\s+-rf/, // Dangerous file operations
      />\/dev\/null/, // Data destruction
    ];

    return dangerousPatterns.some((pattern) => pattern.test(command));
  }

  private buildResponseMeta(res: Response) {
    const requestId = getRequestId(res);
    return {
      requestId,
      timestamp: new Date().toISOString(),
    };
  }

  private sendSuccess<T extends Record<string, any>>(
    res: Response,
    statusCode: number,
    payload: T
  ) {
    const meta = this.buildResponseMeta(res);
    res.status(statusCode).json({
      success: true,
      ...meta,
      ...payload,
    });
  }

  private sendError(
    res: Response,
    statusCode: number,
    error: { code: string; message: string; details?: unknown }
  ) {
    const meta = this.buildResponseMeta(res);
    res.status(statusCode).json({
      success: false,
      ...meta,
      error: {
        ...error,
        ...meta,
      },
    });
  }
}
