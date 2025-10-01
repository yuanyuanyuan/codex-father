export class ErrorManager {
    static registry = new Map();
    static register(def) {
        this.registry.set(def.code, def);
    }
    static create(code, details) {
        const def = this.registry.get(code);
        if (!def) {
            return Object.assign(new Error(`Unknown error: ${code}`), { code, details });
        }
        return Object.assign(new Error(def.message), {
            code: def.code,
            category: def.category,
            details,
        });
    }
    static has(code) {
        return this.registry.has(code);
    }
}
ErrorManager.register({
    code: 'VAL_SEMVER',
    message: 'Invalid semantic version',
    category: 'validation',
});
ErrorManager.register({
    code: 'FS_LOCK_TIMEOUT',
    message: 'Timeout acquiring file lock',
    category: 'io',
});
ErrorManager.register({
    code: 'CFG_REQUIRED',
    message: 'Configuration value required',
    category: 'config',
});
