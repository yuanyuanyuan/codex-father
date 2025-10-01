import { ValidationResult } from '../types.js';
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
export declare function validateConfiguration(config: ConfigurationManagement, obj: Record<string, any>): ValidationResult;
