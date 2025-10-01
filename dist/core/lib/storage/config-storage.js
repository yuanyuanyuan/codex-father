import { FileStorage } from './file-storage.js';
export class ConfigStorage {
    fs;
    constructor(baseDir = 'config') {
        this.fs = new FileStorage(baseDir);
    }
    map(category) {
        const map = {
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
    read(category) {
        return this.fs.readJSON(this.map(category));
    }
    write(category, data) {
        this.fs.writeJSON(this.map(category), data);
    }
    backup(category) {
        return this.fs.backup(this.map(category));
    }
}
