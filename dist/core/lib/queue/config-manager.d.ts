import type { QueueConfiguration } from '../types.js';
export declare class QueueConfigManager {
    private readonly base;
    private readonly configFile;
    constructor(queuePath?: string, fileName?: string);
    load(): QueueConfiguration;
    update(overrides: Partial<QueueConfiguration>): QueueConfiguration;
    validate(config?: QueueConfiguration): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    };
    private save;
}
