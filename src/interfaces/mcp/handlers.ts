import { TaskRunner } from '../../core/TaskRunner.js';
import { TaskConfig, ErrorHandler } from '../../core/types.js';
import { Session, Message } from '../../core/types.js';

export class MCPToolHandlers {
  private runner: TaskRunner;
  private sessions: Map<string, Session> = new Map();

  constructor(runner: TaskRunner) {
    this.runner = runner;
  }

  async handleExec(args: any): Promise<any> {
    const {
      prompt,
      command,
      files = [],
      taskId,
      priority = 'normal',
      dependencies,
      environment = 'shell',
      timeout,
    } = args;

    const generatedTaskId = taskId || ErrorHandler.generateTaskId();

    // Create session
    const session: Session = {
      id: `session-${generatedTaskId}`,
      taskId: generatedTaskId,
      status: 'running',
      startTime: new Date(),
      messages: [],
    };

    this.sessions.set(session.id, session);

    // Add initial message
    session.messages.push({
      role: 'user',
      content: prompt || command || 'Task execution',
      timestamp: new Date(),
    });

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
      id: generatedTaskId,
      execute: executeFn,
      timeout,
      dependencies,
      priority,
      environment,
      metadata: { files, prompt, command },
    };

    try {
      // Submit task to runner
      await this.runner.run(taskConfig);

      return {
        content: [
          {
            type: 'text',
            text: `✅ Task accepted: ${generatedTaskId}\n建议每 2 秒轮询 codex_status 或按需拉取 codex_logs。`,
          },
        ],
      };
    } catch (error: any) {
      session.status = 'failed';
      session.endTime = new Date();
      throw error;
    }
  }

  async handleStatus(args: any): Promise<any> {
    const { taskId, includeResult = false } = args;

    const result = this.runner.getResult(taskId);
    const status = this.runner.getStatus();

    if (!result) {
      return {
        content: [
          {
            type: 'text',
            text: `Task ${taskId} not found or still pending.`,
          },
        ],
      };
    }

    let responseText = `Task: ${taskId}\n`;
    responseText += `Status: ${result.success ? '✅ Completed' : '❌ Failed'}\n`;
    responseText += `Duration: ${result.duration}ms\n`;
    responseText += `Started: ${result.startTime.toISOString()}\n`;
    responseText += `Ended: ${result.endTime.toISOString()}\n`;

    if (includeResult && result.result) {
      responseText += `\nResult:\n${JSON.stringify(result.result, null, 2)}`;
    }

    if (!result.success && result.error) {
      responseText += `\nError: ${result.error}`;
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  }

  async handleLogs(args: any): Promise<any> {
    const { taskId, tailLines = 50 } = args;

    const result = this.runner.getResult(taskId);

    if (!result) {
      return {
        content: [
          {
            type: 'text',
            text: `No logs found for task ${taskId}`,
          },
        ],
      };
    }

    const logs = result.logs || [];
    const tailLogs = logs.slice(-tailLines);

    if (tailLogs.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No logs available for task ${taskId}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Logs for task ${taskId} (last ${tailLogs.length} lines):\n\n${tailLogs.join('\n')}`,
        },
      ],
    };
  }

  async handleReply(args: any): Promise<any> {
    const { taskId, message, files = [] } = args;

    const session = Array.from(this.sessions.values()).find((s) => s.taskId === taskId);

    if (!session) {
      return {
        content: [
          {
            type: 'text',
            text: `No active session found for task ${taskId}`,
          },
        ],
      };
    }

    // Add message to session
    session.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
      metadata: { files },
    });

    // In a real implementation, this would continue the task with new context
    // For now, we'll just acknowledge the reply
    return {
      content: [
        {
          type: 'text',
          text: `✅ Reply added to task ${taskId}: ${message}`,
        },
      ],
    };
  }

  async handleList(args: any): Promise<any> {
    const { status, limit = 20 } = args;

    const runnerStatus = this.runner.getStatus();
    let responseText = `Task Runner Status:\n`;
    responseText += `Running: ${runnerStatus.running}\n`;
    responseText += `Pending: ${runnerStatus.pending}\n`;
    responseText += `Completed: ${runnerStatus.completed}\n`;
    responseText += `Max Concurrency: ${runnerStatus.maxConcurrency}\n\n`;

    responseText += `Active Sessions: ${this.sessions.size}\n`;

    if (this.sessions.size > 0) {
      responseText += '\nRecent Tasks:\n';
      const recentSessions = Array.from(this.sessions.values()).slice(-limit).reverse();

      recentSessions.forEach((session) => {
        const result = this.runner.getResult(session.taskId);
        const statusIcon = result ? (result.success ? '✅' : '❌') : '⏳';
        responseText += `${statusIcon} ${session.taskId} (${session.status})\n`;
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: responseText,
        },
      ],
    };
  }

  async handleCancel(args: any): Promise<any> {
    const { taskId } = args;

    try {
      const cancelled = await this.runner.cancel(taskId);

      if (cancelled) {
        // Update session if exists
        const session = Array.from(this.sessions.values()).find((s) => s.taskId === taskId);
        if (session) {
          session.status = 'failed';
          session.endTime = new Date();
        }

        return {
          content: [
            {
              type: 'text',
              text: `✅ Task ${taskId} cancelled successfully`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ Task ${taskId} could not be cancelled (not running or not found)`,
            },
          ],
        };
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `❌ Failed to cancel task ${taskId}: ${error.message}`,
          },
        ],
      };
    }
  }

  private async executeCommand(command: string, environment: string): Promise<any> {
    // Simplified command execution - in real implementation would use appropriate exec methods
    return {
      type: 'command',
      command,
      environment,
      output: `Command executed: ${command}`,
      exitCode: 0,
    };
  }

  private async executePrompt(prompt: string, files: string[], environment: string): Promise<any> {
    // Simplified prompt execution - in real implementation would use AI/LLM
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
