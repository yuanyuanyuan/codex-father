import { ValidationResult } from '../types.js';
export declare class DataValidator {
    static semverRegex: RegExp;
    static validateSemver(value: string, field?: string): ValidationResult;
    static validateUniqueId(id: string, existing: Set<string>, field?: string): ValidationResult;
    static detectCycles(nodes: string[], edges: Array<[string, string]>): string[][];
    static validateAgainstSchema(obj: Record<string, any>, schema: Record<string, {
        type: string;
        required?: boolean;
    }>): ValidationResult;
}
