/**
 * Task Queue System Contract
 * 定义基于文件系统的任务队列接口规范
 */

// ============================================================================
// 核心任务队列接口
// ============================================================================

export interface TaskQueue {
  enqueue(task: TaskDefinition): Promise<EnqueueResult>;
  dequeue(priority?: number): Promise<Task | null>;
  getTask(taskId: string): Promise<Task | null>;
  updateTaskStatus(taskId: string, status: TaskStatus, result?: any, error?: string): Promise<void>;
  listTasks(filter?: TaskFilter): Promise<Task[]>;
  cancelTask(taskId: string): Promise<CancelResult>;
  retryTask(taskId: string): Promise<RetryResult>;
  purgeCompletedTasks(olderThan?: Date): Promise<PurgeResult>;
  getQueueStats(): Promise<QueueStatistics>;
  shutdown(): Promise<void>;
}

// ============================================================================
// 任务定义和状态
// ============================================================================

export interface TaskDefinition {
  type: string;
  priority: number;
  payload: Record<string, any>;
  scheduledAt?: Date;
  timeout?: number; // milliseconds
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
  metadata: TaskMetadata;
  timeout: number;
  retryPolicy: TaskRetryPolicy;
}

export type TaskStatus =
  | 'pending'     // 等待执行
  | 'scheduled'   // 已调度但未到执行时间
  | 'processing'  // 正在执行
  | 'completed'   // 执行成功
  | 'failed'      // 执行失败（已达最大重试次数）
  | 'retrying'    // 准备重试
  | 'cancelled'   // 已取消
  | 'timeout';    // 执行超时

export interface TaskMetadata {
  source: string;
  userId?: string;
  sessionId?: string;
  correlationId?: string;
  tags: string[];
  environment: string;
  version: string;
}

export interface TaskRetryPolicy {
  maxAttempts: number;
  baseDelay: number; // milliseconds
  maxDelay: number;  // milliseconds
  backoffStrategy: 'linear' | 'exponential' | 'fixed';
  retryableErrors?: string[]; // error codes that allow retry
}

// ============================================================================
// 队列操作结果
// ============================================================================

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

export interface PurgeResult {
  totalPurged: number;
  tasksRemaining: number;
  diskSpaceFreed: number; // bytes
}

// ============================================================================
// 查询和过滤
// ============================================================================

export interface TaskFilter {
  status?: TaskStatus[];
  type?: string[];
  priority?: {
    min?: number;
    max?: number;
  };
  createdAt?: {
    from?: Date;
    to?: Date;
  };
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'priority' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface QueueStatistics {
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  tasksByType: Record<string, number>;
  tasksByPriority: Record<number, number>;
  averageProcessingTime: number; // milliseconds
  queueDepth: number;
  processingCapacity: {
    maxConcurrent: number;
    currentlyProcessing: number;
    availableSlots: number;
  };
  performance: {
    throughputPerHour: number;
    averageWaitTime: number;
    successRate: number;
    retryRate: number;
  };
  storage: {
    diskUsage: number; // bytes
    fileCount: number;
    oldestTask?: Date;
    newestTask?: Date;
  };
}

// ============================================================================
// 任务执行接口
// ============================================================================

export interface TaskExecutor {
  execute(task: Task): Promise<TaskExecutionResult>;
  canHandle(taskType: string): boolean;
  getCapabilities(): TaskExecutorCapabilities;
}

export interface TaskExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
  metrics?: TaskExecutionMetrics;
  artifacts?: TaskArtifact[];
}

export interface TaskExecutorCapabilities {
  supportedTypes: string[];
  maxConcurrency: number;
  averageExecutionTime: number; // milliseconds
  resourceRequirements: {
    memory: number; // bytes
    cpu: number;    // percentage
    disk: number;   // bytes
  };
}

export interface TaskExecutionMetrics {
  startTime: Date;
  endTime: Date;
  duration: number; // milliseconds
  memoryUsed: number; // bytes
  cpuUsed: number;    // percentage
  diskIO: {
    bytesRead: number;
    bytesWritten: number;
    operations: number;
  };
  networkIO?: {
    bytesReceived: number;
    bytesSent: number;
    requests: number;
  };
}

export interface TaskArtifact {
  type: string;
  name: string;
  path: string;
  size: number;
  mimeType?: string;
  description?: string;
}

// ============================================================================
// 队列配置
// ============================================================================

export interface QueueConfiguration {
  baseDirectory: string;
  maxConcurrentTasks: number;
  maxQueueSize: number;
  defaultTimeout: number; // milliseconds
  defaultRetryPolicy: TaskRetryPolicy;
  cleanupInterval: number; // milliseconds
  archiveCompletedTasks: boolean;
  archiveAfterDays: number;
  monitoring: QueueMonitoringConfig;
  performance: QueuePerformanceConfig;
}

export interface QueueMonitoringConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metricsInterval: number; // milliseconds
  alertThresholds: {
    queueDepth: number;
    failureRate: number; // percentage
    averageWaitTime: number; // milliseconds
    diskUsage: number; // percentage
  };
}

export interface QueuePerformanceConfig {
  batchSize: number;
  processingInterval: number; // milliseconds
  indexingEnabled: boolean;
  compressionEnabled: boolean;
  cacheSize: number; // number of tasks to cache
  optimizationLevel: 'none' | 'basic' | 'aggressive';
}

// ============================================================================
// 文件系统队列实现接口
// ============================================================================

export interface FileSystemQueue extends TaskQueue {
  getDirectoryStructure(): QueueDirectoryStructure;
  validateIntegrity(): Promise<IntegrityCheckResult>;
  repairCorruption(issues: CorruptionIssue[]): Promise<RepairResult>;
  backup(destinationPath: string): Promise<BackupResult>;
  restore(backupPath: string): Promise<RestoreResult>;
  migrate(newVersion: string): Promise<MigrationResult>;
}

export interface QueueDirectoryStructure {
  base: string;
  pending: string;
  processing: string;
  completed: string;
  failed: string;
  retry: string;
  cancelled: string;
  archived: string;
  logs: string;
  index: string;
  locks: string;
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

export interface CorruptionIssue {
  type: 'missing_file' | 'invalid_json' | 'inconsistent_status' | 'orphaned_file' | 'permission_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  path: string;
  description: string;
  autoFixable: boolean;
  recommendation: string;
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
  duration: number;  // milliseconds
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

// ============================================================================
// 事件和通知
// ============================================================================

export interface QueueEventEmitter {
  on(event: QueueEvent, listener: QueueEventListener): void;
  off(event: QueueEvent, listener: QueueEventListener): void;
  emit(event: QueueEvent, data: any): void;
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

export type QueueEventListener = (data: QueueEventData) => void;

export interface QueueEventData {
  event: QueueEvent;
  timestamp: Date;
  taskId?: string;
  details: Record<string, any>;
}

// ============================================================================
// 错误处理
// ============================================================================

export class TaskQueueError extends Error {
  constructor(
    message: string,
    public code: string,
    public taskId?: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'TaskQueueError';
  }
}

export const TASK_QUEUE_ERROR_CODES = {
  // 队列操作错误
  QUEUE_FULL: 'TQ001',
  QUEUE_CORRUPTED: 'TQ002',
  QUEUE_LOCKED: 'TQ003',
  QUEUE_NOT_INITIALIZED: 'TQ004',

  // 任务错误
  TASK_NOT_FOUND: 'TQ101',
  TASK_INVALID_STATUS: 'TQ102',
  TASK_TIMEOUT: 'TQ103',
  TASK_CANCELLED: 'TQ104',
  TASK_RETRY_EXHAUSTED: 'TQ105',

  // 文件系统错误
  PERMISSION_DENIED: 'TQ201',
  DISK_SPACE_FULL: 'TQ202',
  FILE_CORRUPTED: 'TQ203',
  DIRECTORY_NOT_FOUND: 'TQ204',

  // 执行器错误
  EXECUTOR_NOT_FOUND: 'TQ301',
  EXECUTOR_OVERLOADED: 'TQ302',
  EXECUTOR_FAILED: 'TQ303',
} as const;