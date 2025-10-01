import type { ProjectConfig } from '../lib/types.js';
type ConfigSource = 'default' | 'file' | 'env' | 'cli';
interface ConfigLoadResult {
    config: ProjectConfig;
    sources: Record<string, ConfigSource>;
    warnings: string[];
    errors: string[];
}
type Environment = 'development' | 'testing' | 'production';
export declare class ConfigLoader {
    private configValues;
    private searchPaths;
    private warnings;
    private errors;
    constructor(searchPaths?: string[]);
    private getDefaultSearchPaths;
    private findProjectRoot;
    load(options?: {
        configFile?: string;
        environment?: Environment;
        overrides?: Partial<ProjectConfig>;
    }): Promise<ConfigLoadResult>;
    private reset;
    private loadDefaultConfig;
    private loadFileConfig;
    private findConfigFile;
    private parseConfigFile;
    private loadEnvironmentConfig;
    private parseEnvironmentValue;
    private loadOverrides;
    private applyEnvironmentConfig;
    private setConfigValue;
    private buildFinalConfig;
    private setNestedValue;
    private validateConfig;
    private getConfigSources;
}
export declare function getConfig(options?: {
    reload?: boolean;
    configFile?: string;
    environment?: Environment;
    overrides?: Partial<ProjectConfig>;
}): Promise<ProjectConfig>;
export declare function reloadConfig(options?: Parameters<typeof getConfig>[0]): Promise<ProjectConfig>;
export declare function getConfigValue<T>(path: string, defaultValue?: T): T | undefined;
export declare function isConfigLoaded(): boolean;
export {};
