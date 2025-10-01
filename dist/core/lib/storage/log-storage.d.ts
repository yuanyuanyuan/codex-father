export interface LogRotateOptions {
    maxSizeBytes: number;
    keep: number;
}
export declare class LogStorage {
    private baseDir;
    constructor(baseDir?: string);
    private ensureDir;
    private filePath;
    append(category: 'audit' | 'tasks' | 'system', line: string): void;
    rotate(category: 'audit' | 'tasks' | 'system', opts: LogRotateOptions): void;
}
