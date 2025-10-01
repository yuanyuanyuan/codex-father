export declare class FileLock {
    private lockPath;
    constructor(lockPath: string);
    release(): void;
}
export declare class FileStorage {
    private baseDir;
    constructor(baseDir: string);
    private ensureDir;
    resolvePath(path: string): string;
    readJSON<T = any>(path: string): T;
    writeJSON(path: string, data: any): void;
    acquireLock(path: string, timeoutMs?: number): FileLock;
    size(path: string): number;
    backup(path: string, destDir?: string): string;
}
