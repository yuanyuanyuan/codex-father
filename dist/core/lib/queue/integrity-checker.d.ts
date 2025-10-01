import type { IntegrityCheckResult } from '../types.js';
export declare class QueueIntegrityChecker {
    private readonly queuePath?;
    constructor(queuePath?: string | undefined);
    check(): Promise<IntegrityCheckResult>;
    private issue;
}
