/// <reference types="node" resolution-mode="require"/>
import type { SpawnOptions } from 'child_process';
export declare const LEGACY_SCRIPTS: {
    readonly start: string;
    readonly job: string;
    readonly runTests: string;
    readonly common: string;
    readonly presets: string;
    readonly updateAgentContext: string;
    readonly checkPrerequisites: string;
    readonly createNewFeature: string;
};
export interface ScriptResult {
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
}
export interface ScriptOptions extends Omit<SpawnOptions, 'stdio'> {
    timeout?: number;
    captureOutput?: boolean;
    workingDirectory?: string;
}
export declare function executeScript(scriptPath: string, args?: string[], options?: ScriptOptions): Promise<ScriptResult>;
export declare class LegacyScriptRunner {
    static start(args?: string[], options?: ScriptOptions): Promise<ScriptResult>;
    static job(args?: string[], options?: ScriptOptions): Promise<ScriptResult>;
    static runTests(args?: string[], options?: ScriptOptions): Promise<ScriptResult>;
    static updateAgentContext(agent?: string, options?: ScriptOptions): Promise<ScriptResult>;
    static checkPrerequisites(flags?: string[], options?: ScriptOptions): Promise<ScriptResult>;
    static createNewFeature(featureName: string, options?: ScriptOptions): Promise<ScriptResult>;
}
export declare const MIGRATION_STATUS: {
    readonly migrated: Set<string>;
    readonly planned: Set<string>;
    readonly keepAsShell: Set<string>;
};
export declare function checkScriptStatus(scriptPath: string): Promise<{
    exists: boolean;
    executable: boolean;
}>;
export declare function validateScript(scriptPath: string): Promise<boolean>;
export declare function getScriptStatus(): Promise<Record<string, {
    path: string;
    exists: boolean;
    executable: boolean;
    migrationStatus: 'migrated' | 'planned' | 'keepAsShell' | 'unknown';
}>>;
