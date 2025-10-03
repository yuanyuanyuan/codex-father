import { ValidationError, ValidationResult } from '../types.js';

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
  threshold: number; // percentage
  enforcement: 'strict' | 'warning';
}

export interface AutomationStrategy {
  ciProvider: 'github-actions' | 'gitlab-ci' | 'none';
  triggers: Array<'push' | 'pr' | 'schedule'>;
}

export interface ContainerTestConfig {
  enabled: boolean;
  image?: string;
  resources?: { cpu?: string; memory?: string };
}

export interface TestArchitectureFramework {
  id: string;
  framework: 'vitest' | 'jest' | 'mocha';
  layers: TestLayer[];
  coverageRequirements: CoverageRequirement[];
  automationStrategy: AutomationStrategy;
  containerizedTesting: ContainerTestConfig;
}

export function validateTestFramework(fr: TestArchitectureFramework): ValidationResult {
  const errors: ValidationError[] = [];
  if (!fr.id) {
    errors.push({ field: 'id', message: 'id required', code: 'TAF_ID_REQUIRED' });
  }
  if (!Array.isArray(fr.layers) || fr.layers.length === 0) {
    errors.push({
      field: 'layers',
      message: 'at least one test layer',
      code: 'TAF_LAYER_REQUIRED',
    });
  }
  for (const l of fr.layers) {
    if (l.timeout <= 0) {
      errors.push({
        field: `layers.${l.name}.timeout`,
        message: 'timeout must be > 0',
        code: 'TAF_TIMEOUT',
      });
    }
  }
  for (const c of fr.coverageRequirements) {
    if (c.threshold < 0 || c.threshold > 100) {
      errors.push({
        field: `coverage.${c.scope}.${c.type}`,
        message: 'threshold 0-100',
        code: 'TAF_COVERAGE',
      });
    }
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}
