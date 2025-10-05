import { ValidationError, ValidationResult } from '../types.js';

export interface FormattingConfig {
  tool: 'prettier' | 'none';
  configFile?: string;
}

export interface LintingConfig {
  tool: 'eslint' | 'tslint';
  configFile: string;
  rules: Record<string, unknown>;
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

export function validateCodeQualityStandard(std: CodeQualityStandard): ValidationResult {
  const errors: ValidationError[] = [];
  if (!std.id) {
    errors.push({ field: 'id', message: 'id required', code: 'CQ_ID_REQUIRED' });
  }
  if (!std.linting?.configFile) {
    errors.push({
      field: 'linting.configFile',
      message: 'config file required',
      code: 'CQ_LINT_CFG',
    });
  }
  if (!Array.isArray(std.qualityGates)) {
    errors.push({
      field: 'qualityGates',
      message: 'qualityGates required',
      code: 'CQ_QG_REQUIRED',
    });
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}

export function evaluateQualityGates(
  metrics: Record<string, number>,
  gates: QualityGate[]
): { pass: boolean; failed: QualityGate[] } {
  const failed: QualityGate[] = [];
  for (const gate of gates) {
    const value = metrics[gate.metric];
    let ok = false;

    if (typeof value !== 'number') {
      if (gate.required) {
        failed.push(gate);
      }
      continue;
    }
    switch (gate.operator) {
      case 'gt':
        ok = value > gate.threshold;
        break;
      case 'gte':
        ok = value >= gate.threshold;
        break;
      case 'lt':
        ok = value < gate.threshold;
        break;
      case 'lte':
        ok = value <= gate.threshold;
        break;
      case 'eq':
        ok = value === gate.threshold;
        break;
    }
    if (!ok && gate.required) {
      failed.push(gate);
    }
  }
  return { pass: failed.length === 0, failed };
}
