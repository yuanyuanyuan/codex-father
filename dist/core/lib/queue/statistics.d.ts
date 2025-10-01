import type { QueueStatistics } from '../types.js';
export interface QueueStatisticsOptions {
    maxConcurrent?: number;
    throughputWindowMs?: number;
}
export declare class QueueStatisticsCollector {
    private readonly queueOps;
    private readonly queuePath;
    private readonly maxConcurrent;
    private readonly throughputWindowMs;
    constructor(queuePath?: string, options?: QueueStatisticsOptions);
    collect(): Promise<QueueStatistics>;
    private normalizeTask;
    private ensureDate;
    private calculateAverageProcessingTime;
    private calculateProcessingCapacity;
    private calculatePerformanceMetrics;
    private calculateThroughputPerHour;
    private calculateAverageWaitTime;
    private calculateStorageMetrics;
    private scanDirectory;
}
