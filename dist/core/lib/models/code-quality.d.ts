import { ValidationResult } from '../types.js';
export interface FormattingConfig {
    tool: 'prettier' | 'none';
    configFile?: string;
}
export interface LintingConfig {
    tool: 'eslint' | 'tslint';
    configFile: string;
    rules: Record<string, any>;
    ignorePatterns: string[];
}
export interface ReviewChecklistItem {
    id: string;
    text: string;
    required: boolean;
}
export interface QualityGate {
    name: string;
    metric: string;
    threshold: number;
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
    required: boolean;
}
export interface CodeQualityStandard {
    id: string;
    language: 'typescript' | 'javascript' | 'shell';
    linting: LintingConfig;
    formatting: FormattingConfig;
    qualityGates: QualityGate[];
    reviewChecklist: ReviewChecklistItem[];
}
export declare function validateCodeQualityStandard(std: CodeQualityStandard): ValidationResult;
export declare function evaluateQualityGates(metrics: Record<string, number>, gates: QualityGate[]): {
    pass: boolean;
    failed: QualityGate[];
};
