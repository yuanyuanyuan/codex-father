import { ErrorType } from './types.js';

export class ErrorHandler {
  static async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    if (!ms || ms <= 0) {
      return promise;
    }

    return Promise.race([
      promise,
      new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Timeout')), ms)),
    ]);
  }

  static categorizeError(error: any): ErrorType {
    if (error?.message === 'Timeout') {
      return ErrorType.TIMEOUT;
    }
    if (error?.message?.includes('Security')) {
      return ErrorType.SECURITY_VIOLATION;
    }
    if (error?.message?.includes('Dependency')) {
      return ErrorType.DEPENDENCY_FAILED;
    }
    return ErrorType.EXECUTION_ERROR;
  }

  static logError(taskId: string, error: unknown): void {
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? (error as { message?: unknown }).message
        : undefined;

    console.error(
      `[${new Date().toISOString()}] Task ${taskId} failed:`,
      typeof message === 'string' && message.length > 0 ? message : String(error)
    );
  }

  static generateTaskId(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static validateTask(task: any): void {
    if (!task?.id || typeof task.execute !== 'function') {
      throw new Error('Invalid task: id and execute are required');
    }
  }
}
