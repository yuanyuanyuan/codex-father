export interface ErrorDefinition {
  code: string;
  message: string;
  category: 'validation' | 'io' | 'queue' | 'config' | 'unknown';
}

export class ErrorManager {
  private static registry = new Map<string, ErrorDefinition>();

  static register(def: ErrorDefinition): void {
    this.registry.set(def.code, def);
  }

  static create(code: string, details?: Record<string, unknown>): Error {
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

  static has(code: string): boolean {
    return this.registry.has(code);
  }
}

// Pre-register a few common errors used by storage/validation
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
