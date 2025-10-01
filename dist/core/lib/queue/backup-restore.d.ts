import type { BackupResult, RestoreResult } from '../types.js';
export declare class QueueBackupManager {
    private readonly base;
    constructor(queuePath?: string);
    createBackup(manifestPath: string): Promise<BackupResult>;
    restoreFromBackup(manifestPath: string, targetDir?: string): Promise<RestoreResult>;
    private scan;
}
