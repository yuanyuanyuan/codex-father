import type { QueueConfiguration } from '../types.js';
import { QueueStatisticsCollector } from './statistics.js';
export interface MonitoringSnapshot {
    timestamp: string;
    stats: Awaited<ReturnType<QueueStatisticsCollector['collect']>>;
    alerts: string[];
}
export declare class QueueMonitor {
    private readonly collector;
    constructor(queuePath?: string);
    collect(config?: QueueConfiguration): Promise<MonitoringSnapshot>;
    private evaluateAlerts;
}
