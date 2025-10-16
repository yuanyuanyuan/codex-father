import { TaskConfig } from '../../core/types.js';
import * as path from 'path';

export class SecurityManager {
  private networkDisabled: boolean = true;
  private allowedPaths: string[];
  private maxExecutionTime: number = 600000; // 10 minutes
  private allowedCommands: string[] = [
    'npm',
    'node',
    'python',
    'python3',
    'bash',
    'sh',
    'ls',
    'cat',
    'echo',
    'mkdir',
    'rm',
    'cp',
    'mv',
  ];

  constructor(allowedPaths?: string[]) {
    this.allowedPaths = allowedPaths || [process.cwd()];
  }

  validateCommand(command: string): boolean {
    if (this.networkDisabled && this.containsNetworkAccess(command)) {
      return false;
    }

    // Check if command starts with allowed command
    const commandParts = command.trim().split(/\s+/);
    const baseCommand = commandParts[0];

    return this.allowedCommands.includes(baseCommand);
  }

  validateFilePath(filePath: string): boolean {
    const resolvedPath = path.resolve(filePath);

    return this.allowedPaths.some((allowedPath) => {
      const resolvedAllowedPath = path.resolve(allowedPath);
      return resolvedPath.startsWith(resolvedAllowedPath);
    });
  }

  enforceSecurityPolicy(task: TaskConfig): void {
    // Validate environment
    if (task.environment && !['shell', 'nodejs', 'python'].includes(task.environment)) {
      throw new Error(`Unsupported environment: ${task.environment}`);
    }

    // Validate working directory
    if (task.workingDirectory && !this.validateFilePath(task.workingDirectory)) {
      throw new Error(`Working directory not allowed: ${task.workingDirectory}`);
    }

    // Validate timeout
    if (task.timeout && task.timeout > this.maxExecutionTime) {
      throw new Error(
        `Timeout exceeds maximum allowed: ${task.timeout}ms > ${this.maxExecutionTime}ms`
      );
    }

    // Additional security checks could be added here
    this.validateTaskMetadata(task.metadata);
  }

  private containsNetworkAccess(command: string): boolean {
    const networkKeywords = [
      'curl',
      'wget',
      'nc',
      'netcat',
      'telnet',
      'ssh',
      'ftp',
      'http',
      'https',
      'fetch',
      'axios',
      'request',
      'download',
      'upload',
    ];

    const lowerCommand = command.toLowerCase();
    return networkKeywords.some((keyword) => lowerCommand.includes(keyword));
  }

  private validateTaskMetadata(metadata?: Record<string, any>): void {
    if (!metadata) {
      return;
    }

    // Check for potentially dangerous metadata
    const dangerousKeys = ['eval', 'exec', 'system', 'shell'];
    for (const key of dangerousKeys) {
      if (key in metadata) {
        throw new Error(`Potentially dangerous metadata key: ${key}`);
      }
    }
  }

  // Configuration methods
  setNetworkDisabled(disabled: boolean): void {
    this.networkDisabled = disabled;
  }

  addAllowedPath(path: string): void {
    const resolvedPath = path.resolve(path);
    if (!this.allowedPaths.includes(resolvedPath)) {
      this.allowedPaths.push(resolvedPath);
    }
  }

  removeAllowedPath(path: string): void {
    const resolvedPath = path.resolve(path);
    const index = this.allowedPaths.indexOf(resolvedPath);
    if (index !== -1) {
      this.allowedPaths.splice(index, 1);
    }
  }

  addAllowedCommand(command: string): void {
    if (!this.allowedCommands.includes(command)) {
      this.allowedCommands.push(command);
    }
  }

  setMaxExecutionTime(maxTime: number): void {
    this.maxExecutionTime = maxTime;
  }

  // Security status methods
  getSecurityStatus(): {
    networkDisabled: boolean;
    allowedPaths: string[];
    maxExecutionTime: number;
    allowedCommands: string[];
  } {
    return {
      networkDisabled: this.networkDisabled,
      allowedPaths: [...this.allowedPaths],
      maxExecutionTime: this.maxExecutionTime,
      allowedCommands: [...this.allowedCommands],
    };
  }

  // Audit log for security events
  logSecurityEvent(event: string, details?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      severity: 'warning',
    };

    console.warn('[Security]', JSON.stringify(logEntry));
  }
}
