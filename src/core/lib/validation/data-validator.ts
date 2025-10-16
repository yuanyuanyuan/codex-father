import { CodexConfig, type WireApi } from '../models/configuration.js';

export interface ValidationError {
  code: string;
  message: string;
  path?: string[];
}

export interface ValidationWarning {
  code: string;
  message: string;
  path?: string[];
}

export interface ValidationSuggestion {
  code: string;
  message: string;
  action?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export async function validateConfig(
  config: CodexConfig,
  version: string
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: ValidationSuggestion[] = [];

  // 基本类型验证
  if (typeof config.model !== 'string') {
    errors.push({
      code: 'SCHEMA_VALIDATION_ERROR',
      message: 'model must be a string',
      path: ['model']
    });
  }

  if (!config.model_providers || typeof config.model_providers !== 'object') {
    errors.push({
      code: 'SCHEMA_VALIDATION_ERROR', 
      message: 'model_providers must be an object',
      path: ['model_providers']
    });
  } else {
    // 验证wire_api兼容性
    for (const [provider, config] of Object.entries(config.model_providers)) {
      if (config.wire_api) {
        const compatResult = checkWireApiCompatibility(config.wire_api, version);
        if (!compatResult.compatible) {
          errors.push({
            code: 'WIRE_API_INCOMPATIBLE',
            message: compatResult.error || 'Wire API version incompatible',
            path: ['model_providers', provider, 'wire_api']
          });
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}

export function checkWireApiCompatibility(
  wireApi: WireApi,
  version: string
): { compatible: boolean; error?: string } {
  // 简单的兼容性检查
  if (version.startsWith('0.42')) {
    if (wireApi === 'function_calling_v2') {
      return {
        compatible: false,
        error: `Wire API '${wireApi}' requires Codex >= 0.44, current version is ${version}`
      };
    }
  }

  return { compatible: true };
}

export function validateParametersCompatibility(
  params: Record<string, any>,
  version: string
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: ValidationSuggestion[] = [];

  // 检查不兼容的参数
  if (version.startsWith('0.42')) {
    const incompatibleParams = ['profile', 'function_calling_v2'];
    for (const param of incompatibleParams) {
      if (params[param] !== undefined) {
        errors.push({
          code: 'PARAMETER_INCOMPATIBLE',
          message: `Parameter '${param}' requires Codex >= 0.44, current version is ${version}`,
          path: [param]
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions
  };
}