import { CodexConfigSchema, type CodexConfig } from '../models/configuration';
import { getRecommendedWireApi, validateWireApiForModel, type WireApi } from '../queue/api';

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
  suggestion?: string;
}

export interface ValidationSuggestion {
  action: string;
  target: string;
  newValue?: string;
  description?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
}

export class DataValidator {
  static semverRegex =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/;

  static validateSemver(value: string, field = 'version'): ValidationResult {
    const valid = DataValidator.semverRegex.test(value);
    const errors = valid ? [] : [{ field, message: 'invalid semver', code: 'VAL_SEMVER' }];
    return { valid, errors, warnings: [], suggestions: [] };
  }

  static validateUniqueId(id: string, existing: Set<string>, field = 'id'): ValidationResult {
    const valid = id !== '' && !existing.has(id);
    const errors = valid ? [] : [{ field, message: 'id must be unique', code: 'VAL_UNIQUE' }];
    return { valid, errors, warnings: [], suggestions: [] };
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
    return { valid: errors.length === 0, errors, warnings: [], suggestions: [] };
  }
}

export function validateConfig(
  config: CodexConfig,
  codexVersion: string
): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: ValidationSuggestion[] = [];

  const parsed = CodexConfigSchema.safeParse(config);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        field: issue.path.join('.') || '<root>',
        message: issue.message,
        code: 'SCHEMA_VALIDATION_ERROR',
      });
    }
    return Promise.resolve({
      valid: false,
      errors,
      warnings,
      suggestions,
    });
  }

  const value = parsed.data;
  const model = value.model;
  const wireApi = value.model_providers?.openai?.wire_api as WireApi | undefined;

  const fatalCompatibility = checkWireApiCompatibility(model ?? null, wireApi ?? null);
  if (fatalCompatibility) {
    errors.push({
      field: 'model_providers.openai.wire_api',
      message: fatalCompatibility,
      code: 'WIRE_API_MISMATCH',
    });
    const recommended = model ? getRecommendedWireApi(model) : null;
    if (recommended) {
      suggestions.push({
        action: 'change_wire_api',
        target: 'model_providers.openai.wire_api',
        newValue: recommended,
        description: `Use wire_api="${recommended}" for model ${model}`,
      });
    }
  } else if (model && model.startsWith('gpt-4') && wireApi === 'responses') {
    warnings.push({
      field: 'model_providers.openai.wire_api',
      message: 'gpt-4 models work best with wire_api="chat"',
      code: 'WIRE_API_NOT_RECOMMENDED',
      suggestion: 'Consider switching wire_api to "chat" for optimal compatibility',
    });
    suggestions.push({
      action: 'change_wire_api',
      target: 'model_providers.openai.wire_api',
      newValue: 'chat',
      description: 'Switch wire_api to "chat" for improved compatibility with gpt-4 models',
    });
  }

  return Promise.resolve({
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  });
}

export function checkWireApiCompatibility(
  model: string | null | undefined,
  wireApi: WireApi | null | undefined
): string | null {
  if (!model || !wireApi) {
    return null;
  }

  const recommended = getRecommendedWireApi(model);
  if (!recommended) {
    return null;
  }

  if (model === 'gpt-5-codex' && !validateWireApiForModel(model, wireApi)) {
    return 'gpt-5-codex requires wire_api="responses"';
  }

  return null;
}

export function validateParametersCompatibility(
  codexVersion: string,
  parameters: string[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const suggestions: ValidationSuggestion[] = [];

  const version = parseSemver(codexVersion);
  if (!version) {
    errors.push({
      field: 'codexVersion',
      message: `Invalid codex version: ${codexVersion}`,
      code: 'INVALID_VERSION',
    });
    return { valid: false, errors, warnings, suggestions };
  }

  if (compareSemver(version, parseSemver('0.44.0')!) < 0 && parameters.includes('profile')) {
    errors.push({
      field: 'profile',
      message: 'profile parameter is not supported before Codex 0.44.0',
      code: 'PARAMETER_NOT_SUPPORTED',
    });
    suggestions.push({
      action: 'upgrade_codex',
      target: 'codex',
      newValue: '0.44.0',
      description: 'Upgrade Codex to v0.44.0 or later to use profile parameter',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    suggestions,
  };
}

export function parseSemver(version: string): [number, number, number] | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function compareSemver(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return 1;
    if (a[i] < b[i]) return -1;
  }
  return 0;
}
