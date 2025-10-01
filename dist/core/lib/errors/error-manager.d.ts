export interface ErrorDefinition {
    code: string;
    message: string;
    category: 'validation' | 'io' | 'queue' | 'config' | 'unknown';
}
export declare class ErrorManager {
    private static registry;
    static register(def: ErrorDefinition): void;
    static create(code: string, details?: Record<string, any>): Error;
    static has(code: string): boolean;
}
