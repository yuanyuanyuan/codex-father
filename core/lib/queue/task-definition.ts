import { randomUUID } from 'node:crypto';

import type { Task, TaskDefinition, TaskMetadata, TaskRetryPolicy, TaskStatus } from '../types.js';
import { PROJECT_VERSION } from '../version.js';

export interface CreateTaskOptions {
  now?: Date;
  idGenerator?: () => string;
  environment?: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;

export const DEFAULT_TASK_RETRY_POLICY: TaskRetryPolicy = Object.freeze({
  maxAttempts: 3,
  baseDelay: 1_000,
  maxDelay: 30_000,
  backoffStrategy: 'exponential',
  retryableErrors: [],
});

const DEFAULT_VERSION = process.env.npm_package_version ?? PROJECT_VERSION;

export const DEFAULT_TASK_METADATA: TaskMetadata = Object.freeze({
  source: 'cli',
  tags: [],
  environment: process.env.CODEX_ENV || process.env.NODE_ENV || 'development',
  version: DEFAULT_VERSION,
});

export const TASK_STATUS_TRANSITIONS: Array<{ from: TaskStatus; to: TaskStatus[] }> = [
  { from: 'pending', to: ['processing', 'scheduled', 'cancelled'] },
  { from: 'scheduled', to: ['pending', 'cancelled'] },
  { from: 'processing', to: ['completed', 'failed', 'timeout', 'retrying', 'cancelled'] },
  { from: 'retrying', to: ['processing', 'failed', 'cancelled'] },
  { from: 'timeout', to: ['retrying', 'failed', 'cancelled'] },
  { from: 'failed', to: ['retrying', 'cancelled'] },
  { from: 'completed', to: [] },
  { from: 'cancelled', to: [] },
];

export function isValidStatusTransition(from: TaskStatus, to: TaskStatus): boolean {
  const entry = TASK_STATUS_TRANSITIONS.find((item) => item.from === from);
  if (!entry) {
    return false;
  }
  return entry.to.includes(to);
}

function mergeRetryPolicy(definition?: TaskRetryPolicy): TaskRetryPolicy {
  const base = DEFAULT_TASK_RETRY_POLICY;
  if (!definition) {
    return {
      ...base,
      retryableErrors: [...(base.retryableErrors || [])],
    };
  }

  return {
    ...base,
    ...definition,
    retryableErrors: definition.retryableErrors
      ? [...definition.retryableErrors]
      : [...(base.retryableErrors || [])],
  };
}

function mergeMetadata(definition?: TaskMetadata, environmentOverride?: string): TaskMetadata {
  const base = DEFAULT_TASK_METADATA;
  const environment = environmentOverride || definition?.environment || base.environment;

  return {
    ...base,
    ...definition,
    environment,
    tags: definition?.tags ? [...definition.tags] : [...base.tags],
  };
}

function resolveInitialStatus(scheduledAt: Date | undefined, now: Date): TaskStatus {
  if (scheduledAt && scheduledAt.getTime() >= now.getTime()) {
    return 'scheduled';
  }

  return 'pending';
}

function resolveTimeout(timeout?: number): number {
  if (typeof timeout === 'number' && timeout > 0) {
    return timeout;
  }
  return DEFAULT_TIMEOUT_MS;
}

export function createTaskFromDefinition(
  definition: TaskDefinition,
  options: CreateTaskOptions = {}
): Task {
  if (!definition.type) {
    throw new Error('TaskDefinition.type is required');
  }
  if (typeof definition.priority !== 'number') {
    throw new Error('TaskDefinition.priority must be a number');
  }

  const now = options.now ?? new Date();
  const generateId = options.idGenerator ?? randomUUID;
  const retryPolicy = mergeRetryPolicy(definition.retryPolicy);
  const metadata = mergeMetadata(definition.metadata, options.environment);
  const timeout = resolveTimeout(definition.timeout);
  const status = resolveInitialStatus(definition.scheduledAt, now);

  const task: Task = {
    id: generateId(),
    type: definition.type,
    priority: definition.priority,
    payload: definition.payload,
    status,
    createdAt: now,
    updatedAt: now,
    attempts: 0,
    maxAttempts: retryPolicy.maxAttempts,
    metadata,
    timeout,
    retryPolicy,
  };

  if (definition.scheduledAt) {
    task.scheduledAt = definition.scheduledAt;
  }

  return task;
}
