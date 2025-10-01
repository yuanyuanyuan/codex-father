import { ValidationResult } from '../types.js';
export type DirectoryNodeType = 'directory' | 'file';
export interface DirectoryNode {
    name: string;
    type: DirectoryNodeType;
    description: string;
    children?: DirectoryNode[];
    purpose: string;
    owner: string;
}
export interface NamingConvention {
    scope: 'file' | 'directory' | 'variable' | 'function' | 'class';
    pattern: string;
    examples: string[];
    exceptions: string[];
}
export interface LayeringRule {
    layer: string;
    canDependOn: string[];
}
export interface MigrationStep {
    name: string;
    description: string;
    fromVersion: string;
    toVersion: string;
}
export type DirectoryStandardStatus = 'draft' | 'review' | 'approved' | 'implemented';
export interface DirectoryArchitectureStandard {
    id: string;
    name: string;
    structure: DirectoryNode;
    namingConventions: NamingConvention[];
    layeringStrategy: LayeringRule[];
    migrationPlan: MigrationStep[];
    status?: DirectoryStandardStatus;
}
export declare function canTransitionDirectoryStatus(current: DirectoryStandardStatus, next: DirectoryStandardStatus): boolean;
export declare function validateDirectoryArchitecture(standard: DirectoryArchitectureStandard): ValidationResult;
