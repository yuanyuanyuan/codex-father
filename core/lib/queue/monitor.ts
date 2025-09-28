import type { QueueConfiguration } from '../types.js';
import { QueueStatisticsCollector } from './statistics.js';
import { ensureQueueStructure } from './tools.js';

export interface MonitoringSnapshot {
  timestamp: string;
  stats: Awaited<ReturnType<QueueStatisticsCollector['collect']>>;
  alerts: string[];
}

export class QueueMonitor {
  private readonly collector: QueueStatisticsCollector;

  constructor(queuePath?: string) {
    const dir = ensureQueueStructure(queuePath).base;
    this.collector = new QueueStatisticsCollector(dir);
  }

  async collect(config?: QueueConfiguration): Promise<MonitoringSnapshot> {
    const stats = await this.collector.collect();
    const alerts = this.evaluateAlerts(stats, config);
    return { timestamp: new Date().toISOString(), stats, alerts };
  }

  private evaluateAlerts(
    stats: Awaited<ReturnType<QueueStatisticsCollector['collect']>>,
    config?: QueueConfiguration
  ): string[] {
    const alerts: string[] = [];
    if (!config?.monitoring?.enabled) {
      return alerts;
    }
    const th = config.monitoring.alertThresholds;
    const queueDepth = stats.queueDepth;
    const failureRate = (stats.tasksByStatus.failed / Math.max(1, stats.totalTasks)) * 100;
    const avgWait = stats.performance.averageWaitTime;
    const diskUsage =
      stats.storage.diskUsage > 0 && stats.storage.fileCount > 0
        ? Math.min(100, Math.round((stats.storage.diskUsage / (1024 * 1024 * 1024)) * 100))
        : 0;

    if (queueDepth > th.queueDepth) {
      alerts.push(`queueDepth>${th.queueDepth}`);
    }
    if (failureRate > th.failureRate) {
      alerts.push(`failureRate>${th.failureRate}%`);
    }
    if (avgWait > th.averageWaitTime) {
      alerts.push(`averageWaitTime>${th.averageWaitTime}ms`);
    }
    if (diskUsage > th.diskUsage) {
      alerts.push(`diskUsage>${th.diskUsage}%`);
    }
    return alerts;
  }
}
