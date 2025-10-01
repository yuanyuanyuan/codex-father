import type { CommandResult } from '../lib/types.js';
export declare const EXIT_CODES: {
    readonly SUCCESS: 0;
    readonly GENERAL_ERROR: 1;
    readonly INVALID_USAGE: 2;
    readonly COMMAND_NOT_FOUND: 127;
    readonly PERMISSION_DENIED: 126;
    readonly CONFIGURATION_ERROR: 78;
    readonly NETWORK_ERROR: 68;
    readonly TIMEOUT_ERROR: 124;
    readonly INTERRUPTED: 130;
    readonly INTERNAL_ERROR: 70;
};
export declare enum ErrorCategory {
    VALIDATION = "validation",
    CONFIGURATION = "configuration",
    NETWORK = "network",
    FILESYSTEM = "filesystem",
    PERMISSION = "permission",
    TIMEOUT = "timeout",
    INTERNAL = "internal",
    USER = "user",
    EXTERNAL = "external"
}
interface ErrorInfo {
    category: ErrorCategory;
    code: number;
    message: string;
    userMessage?: string;
    suggestions?: string[];
    recovery?: string[];
    context?: Record<string, any>;
}
export declare class AppError extends Error {
    readonly category: ErrorCategory;
    readonly code: number;
    readonly userMessage?: string | undefined;
    readonly suggestions?: string[] | undefined;
    readonly recovery?: string[] | undefined;
    readonly context?: Record<string, any> | undefined;
    constructor(info: ErrorInfo, cause?: Error);
}
export declare class ValidationError extends AppError {
    constructor(message: string, field?: string, suggestions?: string[]);
}
export declare class ConfigurationError extends AppError {
    constructor(message: string, configPath?: string, suggestions?: string[]);
}
export declare class NetworkError extends AppError {
    constructor(message: string, url?: string, statusCode?: number);
}
export declare class TimeoutError extends AppError {
    constructor(operation: string, timeout: number);
}
export declare class PermissionError extends AppError {
    constructor(message: string, path?: string);
}
export declare class ErrorFormatter {
    static formatError(error: Error, options?: {
        verbose?: boolean;
        json?: boolean;
        colors?: boolean;
    }): string;
    private static formatErrorAsJson;
    private static formatErrorAsText;
    static formatCommandResult(result: CommandResult, options?: {
        json?: boolean;
        colors?: boolean;
    }): string;
}
export declare class ErrorBoundary {
    private static handlers;
    private static isSetup;
    static setup(options?: {
        verbose?: boolean;
        json?: boolean;
        exitOnError?: boolean;
    }): void;
    private static handleFatalError;
    private static handleInterrupt;
    private static handleTermination;
    private static gracefulExit;
    static registerHandler(type: string, handler: (error: Error) => void): void;
    static removeHandler(type: string): void;
    static handleError(error: Error, options?: {
        verbose?: boolean;
        json?: boolean;
        exit?: boolean;
    }): Promise<void>;
}
export declare function withErrorBoundary<T>(operation: () => Promise<T>, context?: Record<string, any>): Promise<T>;
export declare const createError: {
    validation: (message: string, field?: string, suggestions?: string[]) => ValidationError;
    configuration: (message: string, configPath?: string, suggestions?: string[]) => ConfigurationError;
    network: (message: string, url?: string, statusCode?: number) => NetworkError;
    timeout: (operation: string, timeout: number) => TimeoutError;
    permission: (message: string, path?: string) => PermissionError;
    internal: (message: string, context?: Record<string, any>) => AppError;
};
export {};
