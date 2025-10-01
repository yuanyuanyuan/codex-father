export interface OptimizeResult {
    indexed: number;
    prunedArchives: number;
    savingsBytes: number;
}
export declare class QueueOptimizer {
    private readonly base;
    constructor(queuePath?: string);
    optimize(): Promise<OptimizeResult>;
    optimizeIndex(): Promise<number>;
    pruneArchived(olderThanDays: number): Promise<{
        count: number;
        saved: number;
    }>;
}
