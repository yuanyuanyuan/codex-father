export type ConfigCategory = 'architecture/technical-spec' | 'architecture/directory-standard' | 'architecture/quality-rules' | 'testing/framework-config' | 'testing/coverage-requirements' | 'security/sandbox-policies' | 'security/audit-config' | 'environments/development' | 'environments/testing' | 'environments/production';
export declare class ConfigStorage {
    private fs;
    constructor(baseDir?: string);
    private map;
    read<T>(category: ConfigCategory): T;
    write(category: ConfigCategory, data: any): void;
    backup(category: ConfigCategory): string;
}
