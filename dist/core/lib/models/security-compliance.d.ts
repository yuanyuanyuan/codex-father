import { ValidationResult } from '../types.js';
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
    target?: string;
}
export interface AuditConfig {
    enabled: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    retention: number;
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
export declare function validateSecurityCompliance(fr: SecurityComplianceFramework): ValidationResult;
