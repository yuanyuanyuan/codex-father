import { z } from 'zod';

import { ValidationError, ValidationResult } from '../types.js';

export const APPROVAL_POLICIES = ['untrusted', 'on-request', 'on-failure', 'never'] as const;
export type ApprovalPolicy = (typeof APPROVAL_POLICIES)[number];
export const ApprovalPolicySchema = z.enum(APPROVAL_POLICIES);

export const SANDBOX_MODES = ['read-only', 'workspace-write', 'danger-full-access'] as const;
export type SandboxMode = (typeof SANDBOX_MODES)[number];
export const SandboxModeSchema = z.enum(SANDBOX_MODES);

export const WIRE_APIS = ['chat', 'responses'] as const;
export type WireApi = (typeof WIRE_APIS)[number];
export const WireApiSchema = z.enum(WIRE_APIS);

export interface ProviderConfig {
  wire_api?: WireApi;
  api_key?: string;
  deployment_id?: string;
  [key: string]: unknown;
}

export interface CodexConfig {
  model?: string;
  approval_policy?: ApprovalPolicy;
  sandbox?: SandboxMode;
  cwd?: string;
  base_instructions?: string;
  include_plan_tool?: boolean;
  include_apply_patch_tool?: boolean;
  model_providers?: Record<string, ProviderConfig | undefined>;
}

const ProviderSchema = z
  .object({
    wire_api: WireApiSchema,
  })
  .extend({
    api_key: z.string().optional(),
    deployment_id: z.string().optional(),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean()]));

export const CodexConfigSchema = z
  .object({
    model: z.string().min(1).optional(),
    approval_policy: ApprovalPolicySchema.optional(),
    sandbox: SandboxModeSchema.optional(),
    cwd: z.string().min(1).optional(),
    base_instructions: z.string().optional(),
    include_plan_tool: z.boolean().optional(),
    include_apply_patch_tool: z.boolean().optional(),
    model_providers: z.record(ProviderSchema).optional(),
  })
  .strict();

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
  validator: (value: unknown) => boolean;
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
  obj: Record<string, unknown>
): ValidationResult {
  const errors: ValidationError[] = [];
  // schema validation (minimal)
  for (const [key, field] of Object.entries(config.schema.fields)) {
    const val = obj[key];
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
    const v = obj[rule.field];
    if (!rule.validator(v)) {
      errors.push({ field: rule.field, message: rule.message, code: 'CFG_RULE' });
    }
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}
