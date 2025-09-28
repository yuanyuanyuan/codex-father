import { ValidationError, ValidationResult } from '../types.js';

export interface EnvironmentVariable {
  name: string;
  value?: string;
  required?: boolean;
}

export interface Environment {
  name: string;
  description: string;
  variables: EnvironmentVariable[];
  inheritsFrom?: string;
}

export interface ConfigSchemaField {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
}

export interface ConfigSchema {
  fields: Record<string, ConfigSchemaField>;
}

export interface ValidationRule {
  field: string;
  validator: (value: any) => boolean;
  message: string;
}

export interface ConfigFile {
  path: string;
  format: 'json' | 'yaml' | 'toml' | 'env';
  schema: string;
  environment: string[];
  encrypted: boolean;
  required: boolean;
}

export interface ConfigurationManagement {
  id: string;
  configFiles: ConfigFile[];
  environments: Environment[];
  schema: ConfigSchema;
  validation: ValidationRule[];
}

export function validateConfiguration(
  config: ConfigurationManagement,
  obj: Record<string, any>
): ValidationResult {
  const errors: ValidationError[] = [];
  // schema validation (minimal)
  for (const [key, field] of Object.entries(config.schema.fields)) {
    const val = (obj as any)[key];
    if (field.required && (val === undefined || val === null)) {
      errors.push({ field: key, message: 'is required', code: 'CFG_REQUIRED' });
      continue;
    }
    if (val !== undefined && val !== null) {
      const ok =
        (field.type === 'string' && typeof val === 'string') ||
        (field.type === 'number' && typeof val === 'number') ||
        (field.type === 'boolean' && typeof val === 'boolean') ||
        (field.type === 'object' && typeof val === 'object' && !Array.isArray(val)) ||
        (field.type === 'array' && Array.isArray(val));
      if (!ok) {
        errors.push({ field: key, message: `expected ${field.type}`, code: 'CFG_TYPE' });
      }
    }
  }
  // custom rules
  for (const rule of config.validation) {
    const v = (obj as any)[rule.field];
    if (!rule.validator(v)) {
      errors.push({ field: rule.field, message: rule.message, code: 'CFG_RULE' });
    }
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}
