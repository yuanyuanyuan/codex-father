import { QueueStatisticsCollector } from './statistics.js';
import { ensureQueueStructure } from './tools.js';
export class QueueMonitor {
    collector;
    constructor(queuePath) {
        const dir = ensureQueueStructure(queuePath).base;
        this.collector = new QueueStatisticsCollector(dir);
    }
    async collect(config) {
        const stats = await this.collector.collect();
        const alerts = this.evaluateAlerts(stats, config);
        return { timestamp: new Date().toISOString(), stats, alerts };
    }
    evaluateAlerts(stats, config) {
        const alerts = [];
        if (!config?.monitoring?.enabled) {
            return alerts;
        }
        const th = config.monitoring.alertThresholds;
        const queueDepth = stats.queueDepth;
        const failureRate = (stats.tasksByStatus.failed / Math.max(1, stats.totalTasks)) * 100;
        const avgWait = stats.performance.averageWaitTime;
        const diskUsage = stats.storage.diskUsage > 0 && stats.storage.fileCount > 0
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
