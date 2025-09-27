import { describe, expect, it } from 'vitest';
import { join } from 'node:path';

import {
  createQueueConfiguration,
  DEFAULT_QUEUE_CONFIGURATION,
  validateQueueConfiguration,
} from '../queue/config.js';
import { DEFAULT_TASK_RETRY_POLICY } from '../queue/task-definition.js';

describe('Queue Configuration Contract (T018)', () => {
  it('provides safe defaults aligned with contract', () => {
    const config = createQueueConfiguration();

    expect(config.baseDirectory).toBe(join(process.cwd(), '.codex-father/queue'));
    expect(config.maxConcurrentTasks).toBe(4);
    expect(config.maxQueueSize).toBe(1000);
    expect(config.defaultTimeout).toBe(30_000);
    expect(config.cleanupInterval).toBe(300_000);
    expect(config.archiveCompletedTasks).toBe(true);
    expect(config.archiveAfterDays).toBe(7);
    expect(config.defaultRetryPolicy).toEqual(DEFAULT_TASK_RETRY_POLICY);

    expect(config.monitoring).toEqual({
      enabled: true,
      logLevel: 'info',
      metricsInterval: 60_000,
      alertThresholds: {
        queueDepth: 500,
        failureRate: 20,
        averageWaitTime: 120_000,
        diskUsage: 85,
      },
    });

    expect(config.performance).toEqual({
      batchSize: 25,
      processingInterval: 1_000,
      indexingEnabled: true,
      compressionEnabled: false,
      cacheSize: 256,
      optimizationLevel: 'basic',
    });
  });

  it('merges overrides deeply while enforcing constraints', () => {
    const config = createQueueConfiguration({
      maxConcurrentTasks: 12,
      monitoring: {
        enabled: false,
        logLevel: 'debug',
        alertThresholds: {
          queueDepth: 800,
        },
      },
      performance: {
        optimizationLevel: 'aggressive',
        cacheSize: 512,
      },
    });

    expect(config.maxConcurrentTasks).toBe(12);
    expect(config.monitoring.enabled).toBe(false);
    expect(config.monitoring.logLevel).toBe('debug');
    expect(config.monitoring.alertThresholds.queueDepth).toBe(800);
    expect(config.monitoring.alertThresholds.diskUsage).toBe(85);
    expect(config.performance.optimizationLevel).toBe('aggressive');
    expect(config.performance.cacheSize).toBe(512);
  });

  it('sanitizes invalid overrides and reports validation errors', () => {
    const config = createQueueConfiguration({
      maxConcurrentTasks: 0,
      performance: {
        batchSize: -5,
        optimizationLevel: 'extreme' as any,
      },
      monitoring: {
        logLevel: 'verbose' as any,
        metricsInterval: 100,
        alertThresholds: {
          failureRate: 200,
        },
      },
    });

    // sanitized values
    expect(config.maxConcurrentTasks).toBe(1);
    expect(config.performance.batchSize).toBe(1);
    expect(config.performance.optimizationLevel).toBe('basic');
    expect(config.monitoring.logLevel).toBe('info');
    expect(config.monitoring.metricsInterval).toBe(5_000);
    expect(config.monitoring.alertThresholds.failureRate).toBe(100);

    const result = validateQueueConfiguration({
      ...config,
      baseDirectory: '',
      maxQueueSize: -10,
      defaultTimeout: 0,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'baseDirectory must be a non-empty string',
      'maxQueueSize must be >= 0',
      'defaultTimeout must be > 0',
    ]));
  });

  it('exposes immutable default configuration snapshot', () => {
    expect(() => {
      (DEFAULT_QUEUE_CONFIGURATION.performance as any).batchSize = 999;
    }).toThrow(TypeError);

    expect(DEFAULT_QUEUE_CONFIGURATION.performance.batchSize).toBe(25);
  });
});
