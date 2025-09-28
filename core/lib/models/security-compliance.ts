import { ValidationError, ValidationResult } from '../types.js';

export interface Permission {
  name: string;
  description?: string;
}

export interface Restriction {
  name: string;
  description?: string;
}

export interface SandboxStrategy {
  name: 'readonly' | 'workspace-write' | 'container-full';
  description: string;
  permissions: Permission[];
  restrictions: Restriction[];
  defaultFor: string[];
}

export interface AuditOutput {
  type: 'file' | 'console';
  target?: string; // file path when type=file
}

export interface AuditConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  retention: number; // days
  sensitiveDataHandling: 'redact' | 'encrypt' | 'exclude';
  outputs: AuditOutput[];
}

export interface DataProtectionRule {
  name: string;
  description: string;
  appliesTo: Array<'logs' | 'config' | 'tasks' | 'secrets'>;
}

export interface ComplianceCheck {
  id: string;
  description: string;
  run: () => boolean;
}

export interface SecurityComplianceFramework {
  id: string;
  sandboxStrategies: SandboxStrategy[];
  dataProtection: DataProtectionRule[];
  auditLogging: AuditConfig;
  complianceChecks: ComplianceCheck[];
}

export function validateSecurityCompliance(fr: SecurityComplianceFramework): ValidationResult {
  const errors: ValidationError[] = [];
  if (!fr.id) {
    errors.push({ field: 'id', message: 'id required', code: 'SC_ID_REQUIRED' });
  }
  if (!fr.auditLogging) {
    errors.push({
      field: 'auditLogging',
      message: 'audit config required',
      code: 'SC_AUDIT_REQUIRED',
    });
  }
  if (fr.auditLogging && fr.auditLogging.enabled) {
    const hasOutput = Array.isArray(fr.auditLogging.outputs) && fr.auditLogging.outputs.length > 0;
    if (!hasOutput) {
      errors.push({
        field: 'auditLogging.outputs',
        message: 'at least one output',
        code: 'SC_AUDIT_OUTPUT',
      });
    }
  }
  return { valid: errors.length === 0, errors, warnings: [] };
}
