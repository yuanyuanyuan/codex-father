import type { QueueDirectoryStructure } from '../types.js';
export declare function resolveQueuePath(base?: string): string;
export declare function ensureQueueStructure(basePath?: string): QueueDirectoryStructure;
export declare function readJSONSafe<T = any>(path: string): {
    ok: true;
    value: T;
} | {
    ok: false;
    error: string;
};
export declare function now(): Date;
export declare function toIso(d?: Date): string | undefined;
