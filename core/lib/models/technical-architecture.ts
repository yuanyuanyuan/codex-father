import { ValidationError, ValidationResult } from '../types.js';

export interface EnforcementRule {
  rule: string;
  description: string;
  level: 'error' | 'warn';
}

export interface ExportedInterface {
  name: string;
  description?: string;
  version?: string; // semver
}

export interface InterfaceStandard {
  name: string;
  version: string; // semver
  description?: string;
  methods: Array<{ name: string; request: string; response: string }>;
}

export interface IntegrationRule {
  name: string;
  description: string;
  requiredInterfaces: string[]; // names of InterfaceStandard
}

export interface DesignPrinciple {
  name: string;
  description: string;
  priority: 'critical' | 'important' | 'recommended';
  enforcement: EnforcementRule[];
}

export interface ModuleDefinition {
  name: string;
  path: string;
  responsibilities: string[];
  dependencies: string[];
  exports: ExportedInterface[];
}

export interface TechnicalArchitectureSpec {
  id: string;
  name: string;
  version: string; // semver
  principles: DesignPrinciple[];
  modules: ModuleDefinition[];
  interfaces: InterfaceStandard[];
  integrationRules: IntegrationRule[];
  createdAt: Date;
  updatedAt: Date;
}

export function isSemver(v: string): boolean {
  // Accepts X.Y.Z with optional pre-release/build
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/.test(v);
}

export function detectModuleCircularDependencies(mods: ModuleDefinition[]): string[][] {
  const graph = new Map<string, string[]>();
  for (const m of mods) graph.set(m.name, [...m.dependencies]);

  const visited = new Set<string>();
  const stack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(node: string, path: string[]) {
    if (stack.has(node)) {
      const idx = path.indexOf(node);
      cycles.push(path.slice(idx).concat(node));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    const next = graph.get(node) || [];
    for (const n of next) dfs(n, path.concat(n));
    stack.delete(node);
  }

  for (const key of graph.keys()) dfs(key, [key]);
  return cycles;
}

export function validateTechnicalArchitectureSpec(
  spec: TechnicalArchitectureSpec,
  existingIds?: Set<string>
): ValidationResult {
  const errors: ValidationError[] = [];

  if (!spec.id || typeof spec.id !== 'string') {
    errors.push({ field: 'id', message: 'id is required', code: 'TA_ID_REQUIRED' });
  } else if (existingIds && existingIds.has(spec.id)) {
    errors.push({ field: 'id', message: `id '${spec.id}' must be unique`, code: 'TA_ID_UNIQUE' });
  }

  if (!isSemver(spec.version)) {
    errors.push({ field: 'version', message: `version '${spec.version}' is not semver`, code: 'TA_VERSION_SEMVER' });
  }

  const cycles = detectModuleCircularDependencies(spec.modules);
  if (cycles.length > 0) {
    errors.push({
      field: 'modules',
      message: `circular dependencies detected: ${cycles.map(c => c.join(' -> ')).join(' | ')}`,
      code: 'TA_MODULE_CYCLE',
    });
  }

  // simple interface version checks
  for (const iface of spec.interfaces) {
    if (!isSemver(iface.version)) {
      errors.push({ field: `interfaces.${iface.name}.version`, message: 'invalid semver', code: 'TA_IFACE_SEMVER' });
    }
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

