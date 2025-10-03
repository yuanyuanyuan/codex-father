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

export interface EnqueueResult {
  taskId: string;
  queuePosition?: number;
  estimatedStartTime?: Date;
  scheduledAt?: Date;
}

export interface CancelResult {
  taskId: string;
  cancelled: boolean;
  reason?: string;
  wasRunning: boolean;
}

export interface RetryResult {
  taskId: string;
  retryScheduled: boolean;
  nextAttemptAt?: Date;
  attemptNumber: number;
  reason?: string;
}

export interface QueueProcessingCapacity {
  maxConcurrent: number;
  currentlyProcessing: number;
  availableSlots: number;
}

export interface QueuePerformanceMetrics {
  throughputPerHour: number;
  averageWaitTime: number;
  successRate: number;
  retryRate: number;
}

export interface QueueStorageMetrics {
  diskUsage: number;
  fileCount: number;
  oldestTask?: Date;
  newestTask?: Date;
}

export interface QueueStatistics {
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByType: Record<string, number>;
  tasksByPriority: Record<number, number>;
  averageProcessingTime: number;
  queueDepth: number;
  processingCapacity: QueueProcessingCapacity;
  performance: QueuePerformanceMetrics;
  storage: QueueStorageMetrics;
}

export type QueueStatusDirectory =
  | 'pending'
  | 'scheduled'
  | 'processing'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled';

export interface QueueDirectoryStructure {
  base: string;
  statuses: Record<QueueStatusDirectory, string>;
  tasks: Record<QueueStatusDirectory, string>;
  metadata: Record<QueueStatusDirectory, string>;
  logs: string;
  index: string;
  locks: string;
  tmp: string;
  archived: string;
  all: string[];
}

export interface CorruptionIssue {
  type:
    | 'missing_file'
    | 'invalid_json'
    | 'inconsistent_status'
    | 'orphaned_file'
    | 'permission_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  path: string;
  description: string;
  autoFixable: boolean;
  recommendation: string;
}

export interface IntegrityCheckResult {
  valid: boolean;
  issues: CorruptionIssue[];
  recommendations: string[];
  checkedFiles: number;
  corruptedFiles: number;
  orphanedFiles: number;
  summary: string;
}

export interface RepairResult {
  repaired: boolean;
  issuesFixed: number;
  issuesRemaining: number;
  backupCreated: boolean;
  backupPath?: string;
  summary: string;
}

export interface BackupResult {
  success: boolean;
  backupPath: string;
  fileCount: number;
  totalSize: number; // bytes
  duration: number; // milliseconds
  compression: number; // ratio
}

export interface RestoreResult {
  success: boolean;
  restoredFiles: number;
  skippedFiles: number;
  errors: string[];
  duration: number; // milliseconds
}

export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  migratedTasks: number;
  backupPath: string;
  duration: number; // milliseconds
  warnings: string[];
}

export type QueueEvent =
  | 'task_enqueued'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_cancelled'
  | 'task_retrying'
  | 'queue_full'
  | 'queue_empty'
  | 'executor_started'
  | 'executor_stopped'
  | 'corruption_detected'
  | 'performance_warning';

export interface QueueEventData {
  event: QueueEvent;
  timestamp: Date;
  taskId?: string;
  details: Record<string, any>;
}

export type QueueEventListener = (data: QueueEventData) => void;

export interface QueueEventEmitter {
  on(event: QueueEvent, listener: QueueEventListener): void;
  off(event: QueueEvent, listener: QueueEventListener): void;
  emit(event: QueueEvent, data: Partial<QueueEventData>): void;
}

export const TASK_QUEUE_ERROR_CODES = {
  QUEUE_FULL: 'TQ001',
  QUEUE_CORRUPTED: 'TQ002',
  QUEUE_LOCKED: 'TQ003',
  QUEUE_NOT_INITIALIZED: 'TQ004',
  TASK_NOT_FOUND: 'TQ101',
  TASK_INVALID_STATUS: 'TQ102',
  TASK_TIMEOUT: 'TQ103',
  TASK_CANCELLED: 'TQ104',
  TASK_RETRY_EXHAUSTED: 'TQ105',
  PERMISSION_DENIED: 'TQ201',
  DISK_SPACE_FULL: 'TQ202',
  FILE_CORRUPTED: 'TQ203',
  DIRECTORY_NOT_FOUND: 'TQ204',
  EXECUTOR_NOT_FOUND: 'TQ301',
  EXECUTOR_OVERLOADED: 'TQ302',
  EXECUTOR_FAILED: 'TQ303',
} as const;

export type TaskQueueErrorCode =
  (typeof TASK_QUEUE_ERROR_CODES)[keyof typeof TASK_QUEUE_ERROR_CODES];

export class TaskQueueError extends Error {
  constructor(
    message: string,
    public readonly code: TaskQueueErrorCode,
    public readonly taskId?: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = 'TaskQueueError';
  }
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

// ============================================================================
// 队列配置类型（供 queue/config.ts 与监控/优化等组件使用）
// ============================================================================

export interface QueueMonitoringConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metricsInterval: number; // ms
  alertThresholds: {
    queueDepth: number;
    failureRate: number; // 0-100
    averageWaitTime: number; // ms
    diskUsage: number; // 0-100
  };
}

export interface QueuePerformanceConfig {
  batchSize: number;
  processingInterval: number;
  indexingEnabled: boolean;
  compressionEnabled: boolean;
  cacheSize: number;
  optimizationLevel: 'none' | 'basic' | 'aggressive';
}

export interface QueueConfiguration {
  baseDirectory: string;
  maxConcurrentTasks: number;
  maxQueueSize: number;
  defaultTimeout: number;
  defaultRetryPolicy: TaskRetryPolicy;
  cleanupInterval: number;
  archiveCompletedTasks: boolean;
  archiveAfterDays: number;
  monitoring: QueueMonitoringConfig;
  performance: QueuePerformanceConfig;
}
