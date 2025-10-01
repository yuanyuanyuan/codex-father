import winston from 'winston';
import type { LoggingConfig } from '../lib/types.js';
export declare class LoggerManager {
    private static logger;
    private static config;
    static initialize(loggingConfig?: LoggingConfig): Promise<winston.Logger>;
    private static createTransports;
    static getLogger(): winston.Logger;
    static isInitialized(): boolean;
    static reconfigure(loggingConfig: LoggingConfig): Promise<void>;
    static shutdown(): Promise<void>;
    static getConfig(): LoggingConfig | null;
}
export declare class LogPathFactory {
    static getDefaultLogDir(): string;
    static getApplicationLogPath(): string;
    static getErrorLogPath(): string;
    static getAuditLogPath(): string;
    static getPerformanceLogPath(): string;
}
export declare class LogContext {
    private static context;
    static setGlobalContext(context: Record<string, any>): void;
    static clearGlobalContext(): void;
    static getContext(): Record<string, any>;
    static createContextLogger(additionalContext?: Record<string, any>): {
        error: (message: string, meta?: any) => winston.Logger;
        warn: (message: string, meta?: any) => winston.Logger;
        info: (message: string, meta?: any) => winston.Logger;
        debug: (message: string, meta?: any) => winston.Logger;
    };
}
export declare const log: {
    error: (message: string, meta?: any) => Promise<void>;
    warn: (message: string, meta?: any) => Promise<void>;
    info: (message: string, meta?: any) => Promise<void>;
    debug: (message: string, meta?: any) => Promise<void>;
};
export declare function setupDevelopmentLogging(): void;
export declare function createPerformanceLogger(): {
    start: (operation: string) => void;
    end: (operation: string, meta?: any) => void;
};
