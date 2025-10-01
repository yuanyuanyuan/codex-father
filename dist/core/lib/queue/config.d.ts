import type { QueueConfiguration } from '../types.js';
import type { DeepPartial } from '../types.js';
export declare const DEFAULT_QUEUE_CONFIGURATION: QueueConfiguration;
export interface QueueConfigurationValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}
export declare function createQueueConfiguration(overrides?: DeepPartial<QueueConfiguration>): QueueConfiguration;
export declare function validateQueueConfiguration(config: QueueConfiguration): QueueConfigurationValidationResult;
