import { join } from 'node:path';

import type { QueueConfiguration } from '../types.js';
import { DEFAULT_TASK_RETRY_POLICY } from './task-definition.js';
import type { DeepPartial } from '../types.js';

const logLevels = new Set(['debug', 'info', 'warn', 'error']);
const optimizationLevels = new Set(['none', 'basic', 'aggressive']);

const DEFAULT_BASE_DIRECTORY = join(process.cwd(), '.codex-father/queue');

const defaultConfig: QueueConfiguration = deepFreeze({
  baseDirectory: DEFAULT_BASE_DIRECTORY,
  maxConcurrentTasks: 4,
  maxQueueSize: 1000,
  defaultTimeout: 30_000,
  defaultRetryPolicy: DEFAULT_TASK_RETRY_POLICY,
  cleanupInterval: 300_000,
  archiveCompletedTasks: true,
  archiveAfterDays: 7,
  monitoring: {
    enabled: true,
    logLevel: 'info' as const,
    metricsInterval: 60_000,
    alertThresholds: {
      queueDepth: 500,
      failureRate: 20,
      averageWaitTime: 120_000,
      diskUsage: 85,
    },
  },
  performance: {
    batchSize: 25,
    processingInterval: 1_000,
    indexingEnabled: true,
    compressionEnabled: false,
    cacheSize: 256,
    optimizationLevel: 'basic' as const,
  },
});

export const DEFAULT_QUEUE_CONFIGURATION: QueueConfiguration = deepFreeze(structuredClone(defaultConfig));

export interface QueueConfigurationValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function createQueueConfiguration(
  overrides: DeepPartial<QueueConfiguration> = {}
): QueueConfiguration {
  const merged = mergeDeep(DEFAULT_QUEUE_CONFIGURATION, overrides);
  const sanitized = sanitizeConfiguration(merged);
  return sanitized;
}

export function validateQueueConfiguration(config: QueueConfiguration): QueueConfigurationValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config.baseDirectory || typeof config.baseDirectory !== 'string') {
    errors.push('baseDirectory must be a non-empty string');
  }

  if (!Number.isFinite(config.maxConcurrentTasks) || config.maxConcurrentTasks < 1) {
    errors.push('maxConcurrentTasks must be >= 1');
  }

  if (!Number.isFinite(config.maxQueueSize) || config.maxQueueSize < 0) {
    errors.push('maxQueueSize must be >= 0');
  }

  if (!Number.isFinite(config.defaultTimeout) || config.defaultTimeout <= 0) {
    errors.push('defaultTimeout must be > 0');
  }

  if (!Number.isFinite(config.cleanupInterval) || config.cleanupInterval < 60_000) {
    warnings.push('cleanupInterval below recommended minimum (60s)');
  }

  if (!Number.isFinite(config.archiveAfterDays) || config.archiveAfterDays < 0) {
    errors.push('archiveAfterDays must be >= 0');
  }

  const retry = config.defaultRetryPolicy;
  if (!Number.isFinite(retry.maxAttempts) || retry.maxAttempts < 1) {
    errors.push('defaultRetryPolicy.maxAttempts must be >= 1');
  }
  if (!Number.isFinite(retry.baseDelay) || retry.baseDelay < 0) {
    errors.push('defaultRetryPolicy.baseDelay must be >= 0');
  }
  if (!Number.isFinite(retry.maxDelay) || retry.maxDelay < retry.baseDelay) {
    errors.push('defaultRetryPolicy.maxDelay must be >= baseDelay');
  }

  if (!logLevels.has(config.monitoring.logLevel)) {
    errors.push('monitoring.logLevel must be one of debug|info|warn|error');
  }

  if (!Number.isFinite(config.monitoring.metricsInterval) || config.monitoring.metricsInterval < 1_000) {
    errors.push('monitoring.metricsInterval must be >= 1000');
  }

  const thresholds = config.monitoring.alertThresholds;
  if (!Number.isFinite(thresholds.queueDepth) || thresholds.queueDepth < 0) {
    errors.push('monitoring.alertThresholds.queueDepth must be >= 0');
  }
  if (!Number.isFinite(thresholds.failureRate) || thresholds.failureRate < 0 || thresholds.failureRate > 100) {
    errors.push('monitoring.alertThresholds.failureRate must be between 0 and 100');
  }
  if (!Number.isFinite(thresholds.averageWaitTime) || thresholds.averageWaitTime < 0) {
    errors.push('monitoring.alertThresholds.averageWaitTime must be >= 0');
  }
  if (!Number.isFinite(thresholds.diskUsage) || thresholds.diskUsage < 0 || thresholds.diskUsage > 100) {
    errors.push('monitoring.alertThresholds.diskUsage must be between 0 and 100');
  }

  if (!optimizationLevels.has(config.performance.optimizationLevel)) {
    errors.push('performance.optimizationLevel must be one of none|basic|aggressive');
  }
  if (!Number.isFinite(config.performance.batchSize) || config.performance.batchSize < 1) {
    errors.push('performance.batchSize must be >= 1');
  }
  if (!Number.isFinite(config.performance.processingInterval) || config.performance.processingInterval < 1) {
    errors.push('performance.processingInterval must be >= 1');
  }
  if (!Number.isFinite(config.performance.cacheSize) || config.performance.cacheSize < 0) {
    errors.push('performance.cacheSize must be >= 0');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function mergeDeep<T>(base: T, overrides: DeepPartial<T>): T {
  const result: any = structuredClone(base);

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null) {
      continue;
    }
    const baseValue = (result as any)[key];
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      (result as any)[key] = mergeDeep(baseValue, value as any);
    } else {
      (result as any)[key] = value;
    }
  }

  return result;
}

function sanitizeConfiguration(config: QueueConfiguration): QueueConfiguration {
  const sanitized: QueueConfiguration = {
    ...config,
    baseDirectory: config.baseDirectory || DEFAULT_BASE_DIRECTORY,
    maxConcurrentTasks: clampInt(config.maxConcurrentTasks, 1),
    maxQueueSize: clampInt(config.maxQueueSize, 0),
    defaultTimeout: clampInt(config.defaultTimeout, 1),
    defaultRetryPolicy: {
      ...config.defaultRetryPolicy,
      maxAttempts: clampInt(config.defaultRetryPolicy.maxAttempts, 1),
      baseDelay: clampInt(config.defaultRetryPolicy.baseDelay, 0),
      maxDelay: clampInt(config.defaultRetryPolicy.maxDelay, config.defaultRetryPolicy.baseDelay),
    },
    cleanupInterval: clampInt(config.cleanupInterval, 60_000),
    archiveCompletedTasks: Boolean(config.archiveCompletedTasks),
    archiveAfterDays: clampInt(config.archiveAfterDays, 0),
    monitoring: {
      enabled: Boolean(config.monitoring.enabled),
      logLevel: logLevels.has(config.monitoring.logLevel) ? config.monitoring.logLevel : 'info',
      metricsInterval: clampInt(config.monitoring.metricsInterval, 5_000),
      alertThresholds: {
        queueDepth: clampInt(config.monitoring.alertThresholds.queueDepth, 0),
        failureRate: clampRange(config.monitoring.alertThresholds.failureRate, 0, 100),
        averageWaitTime: clampInt(config.monitoring.alertThresholds.averageWaitTime, 0),
        diskUsage: clampRange(config.monitoring.alertThresholds.diskUsage, 0, 100),
      },
    },
    performance: {
      batchSize: clampInt(config.performance.batchSize, 1),
      processingInterval: clampInt(config.performance.processingInterval, 1),
      indexingEnabled: Boolean(config.performance.indexingEnabled),
      compressionEnabled: Boolean(config.performance.compressionEnabled),
      cacheSize: clampInt(config.performance.cacheSize, 0),
      optimizationLevel: optimizationLevels.has(config.performance.optimizationLevel)
        ? config.performance.optimizationLevel
        : 'basic',
    },
  };

  if (sanitized.defaultRetryPolicy.maxDelay < sanitized.defaultRetryPolicy.baseDelay) {
    sanitized.defaultRetryPolicy.maxDelay = sanitized.defaultRetryPolicy.baseDelay;
  }

  return sanitized;
}

function clampInt(value: number, min: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.floor(value));
}

function clampRange(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  const frozen = value as Record<string, any>;
  for (const key of Object.keys(frozen)) {
    const item = frozen[key];
    if (typeof item === 'object' && item !== null) {
      deepFreeze(item);
    }
  }
  return Object.freeze(value);
}
