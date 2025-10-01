export interface ConfigMetadata {
    createdAt: string;
    updatedAt: string;
    version: string;
}
export interface ConfigStore {
    global: Record<string, unknown>;
    environments: Record<string, Record<string, unknown>>;
    metadata: ConfigMetadata;
}
export interface SetConfigOptions {
    key: string;
    value: unknown;
    environment?: string;
    secure?: boolean;
}
export interface GetConfigOptions {
    key: string;
    environment?: string;
    reveal?: boolean;
}
export interface ConfigAccessResult {
    configPath: string;
    warnings: string[];
}
export declare class ConfigAccess {
    private readonly configPath;
    private readonly warnings;
    constructor(workingDirectory: string);
    getWarnings(): string[];
    getConfigPath(): string;
    init(environment?: string): ConfigAccessResult;
    set(options: SetConfigOptions): {
        encrypted: boolean;
        environment?: string;
        value: unknown;
    };
    get(options: GetConfigOptions): {
        value?: unknown;
        encrypted: boolean;
        environment?: string;
    };
    list(): ConfigStore;
    private getEncryptionKey;
}
export declare function maskSensitive(value: unknown): unknown;
export declare function summarise(store: ConfigStore): {
    global: Record<string, unknown>;
    environments: Record<string, Record<string, unknown>>;
};
