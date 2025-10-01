import { ValidationResult } from '../types.js';
export interface EnforcementRule {
    rule: string;
    description: string;
    level: 'error' | 'warn';
}
export interface ExportedInterface {
    name: string;
    description?: string;
    version?: string;
}
export interface InterfaceStandard {
    name: string;
    version: string;
    description?: string;
    methods: Array<{
        name: string;
        request: string;
        response: string;
    }>;
}
export interface IntegrationRule {
    name: string;
    description: string;
    requiredInterfaces: string[];
}
export interface DesignPrinciple {
    name: string;
    description: string;
    priority: 'critical' | 'important' | 'recommended';
    enforcement: EnforcementRule[];
}
export interface ModuleDefinition {
    name: string;
    path: string;
    responsibilities: string[];
    dependencies: string[];
    exports: ExportedInterface[];
}
export interface TechnicalArchitectureSpec {
    id: string;
    name: string;
    version: string;
    principles: DesignPrinciple[];
    modules: ModuleDefinition[];
    interfaces: InterfaceStandard[];
    integrationRules: IntegrationRule[];
    createdAt: Date;
    updatedAt: Date;
}
export declare function isSemver(v: string): boolean;
export declare function detectModuleCircularDependencies(mods: ModuleDefinition[]): string[][];
export declare function validateTechnicalArchitectureSpec(spec: TechnicalArchitectureSpec, existingIds?: Set<string>): ValidationResult;
