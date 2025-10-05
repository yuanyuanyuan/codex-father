import { FileStorage } from './file-storage.js';

export type ConfigCategory =
  | 'architecture/technical-spec'
  | 'architecture/directory-standard'
  | 'architecture/quality-rules'
  | 'testing/framework-config'
  | 'testing/coverage-requirements'
  | 'security/sandbox-policies'
  | 'security/audit-config'
  | 'environments/development'
  | 'environments/testing'
  | 'environments/production';

export class ConfigStorage {
  private fs: FileStorage;
  constructor(baseDir = 'config') {
    this.fs = new FileStorage(baseDir);
  }

  private map(category: ConfigCategory): string {
    const map: Record<ConfigCategory, string> = {
      'architecture/technical-spec': 'architecture/technical-spec.json',
      'architecture/directory-standard': 'architecture/directory-standard.json',
      'architecture/quality-rules': 'architecture/quality-rules.json',
      'testing/framework-config': 'testing/framework-config.json',
      'testing/coverage-requirements': 'testing/coverage-requirements.json',
      'security/sandbox-policies': 'security/sandbox-policies.json',
      'security/audit-config': 'security/audit-config.json',
      'environments/development': 'environments/development.json',
      'environments/testing': 'environments/testing.json',
      'environments/production': 'environments/production.json',
    };
    return map[category];
  }

  read<T>(category: ConfigCategory): T {
    return this.fs.readJSON<T>(this.map(category));
  }

  write<T>(category: ConfigCategory, data: T): void {
    this.fs.writeJSON(this.map(category), data);
  }

  backup(category: ConfigCategory): string {
    return this.fs.backup(this.map(category));
  }
}
