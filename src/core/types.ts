export interface TaskConfig {
  id: string;
  execute: () => Promise<any>;
  timeout?: number;
  dependencies?: string[];
  priority?: 'low' | 'normal' | 'high';
  metadata?: Record<string, any>;
  environment?: 'shell' | 'nodejs' | 'python';
  workingDirectory?: string;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  result?: any;
  error?: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  logs?: string[];
  metadata?: Record<string, any>;
  cancelled?: boolean;
}

export interface RunnerStatus {
  running: number;
  maxConcurrency: number;
  pending: number;
  completed: number;
  systemLoad?: {
    cpuUsage: number;
    memoryUsage: number;
  };
}

export interface Session {
  id: string;
  taskId: string;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  messages: Message[];
  metadata?: Record<string, any>;
}

export interface Message {
  role: 'user' | 'system' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export enum ErrorType {
  TIMEOUT = 'TIMEOUT',
  DEPENDENCY_FAILED = 'DEPENDENCY_FAILED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  EXECUTION_ERROR = 'EXECUTION_ERROR',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
}

export interface SystemState {
  tasks: {
    running: string[];
    completed: string[];
    results: Record<string, TaskResult>;
  };
  sessions: Record<string, Session>;
  config: {
    maxConcurrency: number;
    defaultTimeout: number;
    security: {
      networkDisabled: boolean;
      allowedPaths: string[];
    };
  };
}
