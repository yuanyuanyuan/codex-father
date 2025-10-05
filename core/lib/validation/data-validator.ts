import { ValidationError, ValidationResult } from '../types.js';

export class DataValidator {
  static semverRegex =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

  static validateSemver(value: string, field = 'version'): ValidationResult {
    const valid = DataValidator.semverRegex.test(value);
    const errors: ValidationError[] = valid
      ? []
      : [{ field, message: 'invalid semver', code: 'VAL_SEMVER' }];
    return { valid, errors, warnings: [] };
  }

  static validateUniqueId(id: string, existing: Set<string>, field = 'id'): ValidationResult {
    const valid = id !== '' && !existing.has(id);
    const errors: ValidationError[] = valid
      ? []
      : [{ field, message: 'id must be unique', code: 'VAL_UNIQUE' }];
    return { valid, errors, warnings: [] };
  }

  static detectCycles(nodes: string[], edges: Array<[string, string]>): string[][] {
    const graph = new Map<string, string[]>();
    nodes.forEach((n) => graph.set(n, []));
    edges.forEach(([a, b]) => graph.get(a)?.push(b));

    const visited = new Set<string>();
    const stack = new Set<string>();
    const cycles: string[][] = [];

    function dfs(n: string, path: string[]): void {
      if (stack.has(n)) {
        const idx = path.indexOf(n);
        cycles.push(path.slice(idx).concat(n));
        return;
      }
      if (visited.has(n)) {
        return;
      }
      visited.add(n);
      stack.add(n);
      for (const m of graph.get(n) || []) {
        dfs(m, path.concat(m));
      }
      stack.delete(n);
    }
    for (const n of graph.keys()) {
      dfs(n, [n]);
    }
    return cycles;
  }

  // Minimal schema validator supporting required + type
  static validateAgainstSchema(
    obj: Record<string, unknown>,
    schema: Record<string, { type: string; required?: boolean }>
  ): ValidationResult {
    const errors: ValidationError[] = [];
    for (const [k, s] of Object.entries(schema)) {
      const v = obj[k];
      if (s.required && (v === undefined || v === null)) {
        errors.push({ field: k, message: 'is required', code: 'VAL_REQ' });
        continue;
      }
      if (v !== undefined && v !== null) {
        const t = Array.isArray(v) ? 'array' : typeof v;
        if (t !== s.type) {
          errors.push({ field: k, message: `expected ${s.type}`, code: 'VAL_TYPE' });
        }
      }
    }
    return { valid: errors.length === 0, errors, warnings: [] };
  }
}
