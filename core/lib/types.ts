/**
 * 核心类型定义
 * 定义项目中使用的通用接口和类型
 */

// ============================================================================
// CLI 相关类型
// ============================================================================

export interface CommandContext {
  args: string[];
  options: Record<string, any>;
  workingDirectory: string;
  configPath: string;
  verbose: boolean;
  dryRun: boolean;
  json: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: any;
  errors?: string[];
  warnings?: string[];
  executionTime: number;
}

// ============================================================================
// 配置相关类型
// ============================================================================

export interface ProjectConfig {
  version: string;
  environment: 'development' | 'testing' | 'production';
  logging: LoggingConfig;
  performance: PerformanceConfig;
  security: SecurityConfig;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  format: 'text' | 'json';
  outputs: LogOutput[];
}

export interface LogOutput {
  type: 'console' | 'file' | 'syslog';
  path?: string;
  rotation?: boolean;
  maxSize?: string;
}

export interface PerformanceConfig {
  maxExecutionTime: number; // milliseconds
  maxMemoryUsage: number; // bytes
  enableProfiling: boolean;
}

export interface SecurityConfig {
  sandboxMode: 'readonly' | 'workspace-write' | 'full';
  auditLogging: boolean;
  redactSensitiveData: boolean;
}

// ============================================================================
// 任务相关类型
// ============================================================================

export type TaskStatus =
  | 'pending'
  | 'scheduled'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'retrying'
  | 'cancelled'
  | 'timeout';

export interface TaskRetryPolicy {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number; // milliseconds
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  retryableErrors?: string[];
}

export interface TaskMetadata {
  source: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  tags: string[];
  environment: string;
  version: string;
}

export interface TaskDefinition {
  type: string;
  priority: number;
  payload: Record<string, any>;
  scheduledAt?: Date;
  timeout?: number;
  retryPolicy?: TaskRetryPolicy;
  metadata?: TaskMetadata;
}

export interface Task {
  id: string;
  type: string;
  priority: number;
  payload: Record<string, any>;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  result?: any;
  error?: string;
  metadata: TaskMetadata;
  timeout: number;
  retryPolicy: TaskRetryPolicy;
}

// ============================================================================
// 验证相关类型
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// ============================================================================
// 工具类型
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// ============================================================================
// 错误类型
// ============================================================================

export class CodexError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'CodexError';
  }
}
