import { ValidationResult } from '../types.js';
export interface TestLayer {
    name: 'unit' | 'integration' | 'e2e';
    directory: string;
    patterns: string[];
    tools: string[];
    parallelExecution: boolean;
    timeout: number;
}
export interface CoverageRequirement {
    scope: 'core' | 'critical-path' | 'overall';
    type: 'line' | 'branch' | 'function' | 'statement';
    threshold: number;
    enforcement: 'strict' | 'warning';
}
export interface AutomationStrategy {
    ciProvider: 'github-actions' | 'gitlab-ci' | 'none';
    triggers: Array<'push' | 'pr' | 'schedule'>;
}
export interface ContainerTestConfig {
    enabled: boolean;
    image?: string;
    resources?: {
        cpu?: string;
        memory?: string;
    };
}
export interface TestArchitectureFramework {
    id: string;
    framework: 'vitest' | 'jest' | 'mocha';
    layers: TestLayer[];
    coverageRequirements: CoverageRequirement[];
    automationStrategy: AutomationStrategy;
    containerizedTesting: ContainerTestConfig;
}
export declare function validateTestFramework(fr: TestArchitectureFramework): ValidationResult;
