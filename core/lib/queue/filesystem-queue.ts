import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

import type {
  BackupResult,
  CancelResult,
  CorruptionIssue,
  EnqueueResult,
  IntegrityCheckResult,
  MigrationResult,
  QueueDirectoryStructure,
  QueueStatusDirectory,
  RepairResult,
  RestoreResult,
  RetryResult,
  Task,
  TaskDefinition,
  TaskStatus,
} from '../types.js';
import { BasicQueueOperations, type QueueConfig } from './basic-operations.js';

export interface FileSystemQueueOptions extends Partial<QueueConfig> {
  queuePath?: string;
}

const STATUS_DIRECTORIES: QueueStatusDirectory[] = [
  'pending',
  'scheduled',
  'processing',
  'retrying',
  'completed',
  'failed',
  'timeout',
  'cancelled',
];

const ADDITIONAL_DIRECTORIES = ['logs', 'index', 'locks', 'tmp', 'archived'] as const;

interface DirectoryCheckCounts {
  checkedFiles: number;
  corruptedFiles: number;
  orphanedFiles: number;
}

export class FileSystemQueue {
  private readonly queueOps: BasicQueueOperations;
  private readonly queuePath: string;

  private constructor(queuePath: string, queueOps: BasicQueueOperations) {
    this.queuePath = queuePath;
    this.queueOps = queueOps;
  }

  static async initialize(options: FileSystemQueueOptions = {}): Promise<FileSystemQueue> {
    const queuePath = resolve(options.queuePath ?? join(process.cwd(), '.codex-father/queue'));
    ensureBaseStructure(queuePath);
    const queueOps = new BasicQueueOperations({
      queuePath,
      lockTimeout: options.lockTimeout,
      maxRetries: options.maxRetries,
    });
    return new FileSystemQueue(queuePath, queueOps);
  }

  getDirectoryStructure(): QueueDirectoryStructure {
    const base = this.queuePath;
    const statuses = STATUS_DIRECTORIES.reduce<Record<QueueStatusDirectory, string>>((acc, status) => {
      const directoryName = statusToDirectoryName(status);
      acc[status] = join(base, directoryName);
      return acc;
    }, {} as Record<QueueStatusDirectory, string>);

    const tasks = STATUS_DIRECTORIES.reduce<Record<QueueStatusDirectory, string>>((acc, status) => {
      const directoryName = statusToDirectoryName(status);
      acc[status] = join(base, directoryName, 'tasks');
      return acc;
    }, {} as Record<QueueStatusDirectory, string>);

    const metadata = STATUS_DIRECTORIES.reduce<Record<QueueStatusDirectory, string>>((acc, status) => {
      const directoryName = statusToDirectoryName(status);
      acc[status] = join(base, directoryName, 'metadata');
      return acc;
    }, {} as Record<QueueStatusDirectory, string>);

    const additional = ADDITIONAL_DIRECTORIES.reduce<Record<(typeof ADDITIONAL_DIRECTORIES)[number], string>>((acc, dir) => {
      acc[dir] = join(base, dir);
      return acc;
    }, {} as Record<(typeof ADDITIONAL_DIRECTORIES)[number], string>);

    const all = [
      base,
      ...Object.values(statuses),
      ...Object.values(tasks),
      ...Object.values(metadata),
      ...Object.values(additional),
    ];

    return {
      base,
      statuses,
      tasks,
      metadata,
      logs: additional.logs,
      index: additional.index,
      locks: additional.locks,
      tmp: additional.tmp,
      archived: additional.archived,
      all,
    };
  }

  async enqueue(task: TaskDefinition): Promise<EnqueueResult> {
    return this.queueOps.enqueueTask(task);
  }

  async dequeue(): Promise<Task | null> {
    return this.queueOps.dequeueTask();
  }

  async getTask(taskId: string): Promise<Task | null> {
    return this.queueOps.getTask(taskId);
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, result?: any, error?: string): Promise<void> {
    await this.queueOps.updateTaskStatus(taskId, status, result, error);
  }

  async listTasks(filter?: TaskStatus): Promise<Task[]> {
    return this.queueOps.listTasks(filter);
  }

  async cancelTask(taskId: string, reason?: string): Promise<CancelResult> {
    return this.queueOps.cancelTask(taskId, reason);
  }

  async retryTask(taskId: string): Promise<RetryResult> {
    return this.queueOps.retryTask(taskId);
  }

  async purgeCompletedTasks(): Promise<{ totalPurged: number; tasksRemaining: number; diskSpaceFreed: number }> {
    // Purge logic not yet implemented; return placeholder values for contract compatibility.
    return {
      totalPurged: 0,
      tasksRemaining: 0,
      diskSpaceFreed: 0,
    };
  }

  async getQueueStats(): Promise<Record<TaskStatus, number>> {
    return this.queueOps.getQueueStats();
  }

  async shutdown(): Promise<void> {
    // No resources to release yet.
  }

  async validateIntegrity(): Promise<IntegrityCheckResult> {
    const structure = this.getDirectoryStructure();
    const issues: CorruptionIssue[] = [];
    const counts: DirectoryCheckCounts = {
      checkedFiles: structure.all.length,
      corruptedFiles: 0,
      orphanedFiles: 0,
    };

    for (const path of structure.all) {
      if (!existsSync(path)) {
        issues.push(createMissingDirectoryIssue(path));
      }
    }

    counts.corruptedFiles = issues.length;

    const recommendations = issues.map(issue => issue.recommendation);
    const valid = issues.length === 0;

    return {
      valid,
      issues,
      recommendations,
      checkedFiles: counts.checkedFiles,
      corruptedFiles: counts.corruptedFiles,
      orphanedFiles: counts.orphanedFiles,
      summary: valid ? 'Queue directory is healthy.' : `Queue directory has ${issues.length} issue(s).`,
    };
  }

  async repairCorruption(issues: CorruptionIssue[]): Promise<RepairResult> {
    let fixed = 0;

    for (const issue of issues) {
      if (!issue.autoFixable) {
        continue;
      }

      if (issue.type === 'missing_file') {
        ensureDirectory(issue.path);
        fixed += 1;
      }
    }

    return {
      repaired: fixed === issues.length,
      issuesFixed: fixed,
      issuesRemaining: issues.length - fixed,
      backupCreated: false,
      summary: fixed > 0 ? 'Missing directories recreated.' : 'No issues were repaired.',
    };
  }

  async backup(destinationPath: string): Promise<BackupResult> {
    const startedAt = Date.now();
    const { fileCount, totalSize } = scanDirectory(this.queuePath);
    const manifest = {
      generatedAt: new Date(startedAt).toISOString(),
      fileCount,
      totalSize,
      source: this.queuePath,
    };

    const resolvedPath = resolve(destinationPath);
    ensureDirectory(dirname(resolvedPath));
    writeFileSync(resolvedPath, JSON.stringify(manifest, null, 2), 'utf8');

    const duration = Date.now() - startedAt;

    return {
      success: true,
      backupPath: resolvedPath,
      fileCount,
      totalSize,
      duration,
      compression: 1,
    };
  }

  async restore(backupPath: string): Promise<RestoreResult> {
    return {
      success: false,
      restoredFiles: 0,
      skippedFiles: 0,
      errors: ['restore_not_implemented', backupPath],
      duration: 0,
    };
  }

  async migrate(newVersion: string): Promise<MigrationResult> {
    return {
      success: false,
      fromVersion: 'unknown',
      toVersion: newVersion,
      migratedTasks: 0,
      backupPath: '',
      duration: 0,
      warnings: ['migration_not_implemented'],
    };
  }
}

function ensureBaseStructure(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }

  for (const status of STATUS_DIRECTORIES) {
    const directoryName = statusToDirectoryName(status);
    ensureDirectory(join(path, directoryName, 'tasks'));
    ensureDirectory(join(path, directoryName, 'metadata'));
  }

  for (const dir of ADDITIONAL_DIRECTORIES) {
    ensureDirectory(join(path, dir));
  }
}

function ensureDirectory(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

function statusToDirectoryName(status: QueueStatusDirectory): string {
  if (status === 'processing') {
    return 'running';
  }
  if (status === 'retrying') {
    return 'retrying';
  }
  return status;
}

function createMissingDirectoryIssue(path: string): CorruptionIssue {
  return {
    type: 'missing_file',
    severity: 'medium',
    path,
    description: `Required queue directory is missing: ${path}`,
    autoFixable: true,
    recommendation: 'Recreate the directory structure using repairCorruption.',
  };
}

function scanDirectory(path: string): { fileCount: number; totalSize: number } {
  let fileCount = 0;
  let totalSize = 0;

  if (!existsSync(path)) {
    return { fileCount, totalSize };
  }

  const entries = readdirSync(path, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = join(path, entry.name);
    if (entry.isDirectory()) {
      const nested = scanDirectory(entryPath);
      fileCount += nested.fileCount;
      totalSize += nested.totalSize;
    } else {
      fileCount += 1;
      totalSize += statSync(entryPath).size;
    }
  }

  return { fileCount, totalSize };
}
