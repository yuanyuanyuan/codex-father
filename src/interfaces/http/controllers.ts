import { Request, Response } from 'express';
import { TaskRunner } from '../../core/TaskRunner.js';
import { TaskConfig, ErrorHandler } from '../../core/types.js';
import { WebSocketManager } from '../http/websocket.js';
import { z } from 'zod';

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

      res.status(201).json({
        success: true,
        taskId,
        status: 'started',
        message: 'Task submitted successfully',
      });
    } catch (error: any) {
      console.error('Submit task error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: error.errors,
          },
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'SUBMIT_ERROR',
            message: error.message,
          },
        });
      }
    }
  }

  async getTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = this.runner.getResult(id);

      if (!result) {
        res.status(404).json({
          success: false,
          error: {
            code: 'TASK_NOT_FOUND',
            message: `Task ${id} not found`,
          },
        });
        return;
      }

      const response = {
        taskId: id,
        status: result.success ? 'completed' : 'failed',
        progress: 100,
        startTime: result.startTime.toISOString(),
        endTime: result.endTime.toISOString(),
        duration: result.duration,
        result: result.result,
        error: result.error,
        logs: result.logs,
      };

      res.json(response);
    } catch (error: any) {
      console.error('Get task error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GET_ERROR',
          message: error.message,
        },
      });
    }
  }

  async listTasks(req: Request, res: Response): Promise<void> {
    try {
      const { status, limit = 20, orderBy = 'createdAt', order = 'desc' } = req.query;

      const runnerStatus = this.runner.getStatus();

      // This is a simplified implementation
      // In a real implementation, we would query actual task storage
      const tasks = [];

      const response = {
        tasks,
        total: tasks.length,
        hasMore: false,
        status: runnerStatus,
      };

      res.json(response);
    } catch (error: any) {
      console.error('List tasks error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LIST_ERROR',
          message: error.message,
        },
      });
    }
  }

  async replyTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = replyTaskSchema.parse(req.body);
      const { message, files = [] } = validatedData;

      // Check if task exists and is running
      const result = this.runner.getResult(id);
      if (!result) {
        res.status(404).json({
          success: false,
          error: {
            code: 'TASK_NOT_FOUND',
            message: `Task ${id} not found`,
          },
        });
        return;
      }

      if (result.success) {
        res.status(409).json({
          success: false,
          error: {
            code: 'TASK_COMPLETED',
            message: `Task ${id} is already completed`,
          },
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

      res.json({
        success: true,
        message: 'Reply added to task',
        taskId: id,
      });
    } catch (error: any) {
      console.error('Reply task error:', error);

      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: error.errors,
          },
        });
      } else {
        res.status(500).json({
          success: false,
          error: {
            code: 'REPLY_ERROR',
            message: error.message,
          },
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

        res.json({
          success: true,
          message: 'Task cancelled successfully',
          taskId: id,
        });
      } else {
        res.status(404).json({
          success: false,
          error: {
            code: 'TASK_NOT_RUNNING',
            message: `Task ${id} is not running or not found`,
          },
        });
      }
    } catch (error: any) {
      console.error('Cancel task error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CANCEL_ERROR',
          message: error.message,
        },
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
}
