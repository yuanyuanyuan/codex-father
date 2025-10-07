/**
 * Utility helpers for masking sensitive values before data is persisted to disk.
 */

const MASK = '[REDACTED]' as const;

export type RedactionPattern = RegExp | string;

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function ensureFlag(flags: string, flag: string): string {
  return flags.includes(flag) ? flags : flags + flag;
}

function removeFlag(flags: string, flag: string): string {
  return flags.replace(new RegExp(flag, 'g'), '');
}

type NormalizedPattern = {
  source: string;
  valueRegex: RegExp;
  keyRegex: RegExp;
  kvRegex: RegExp;
};

function normalizePattern(pattern: RedactionPattern): NormalizedPattern {
  if (pattern instanceof RegExp) {
    const valueFlags = ensureFlag(pattern.flags, 'g');
    const keyFlags = ensureFlag(removeFlag(pattern.flags, 'g'), 'i');
    return {
      source: pattern.source,
      valueRegex: new RegExp(pattern.source, valueFlags),
      keyRegex: new RegExp(pattern.source, keyFlags),
      kvRegex: new RegExp(`(${pattern.source})(\\s*[=:]\\s*)("[^"]*"|'[^']*'|[^\\s,;]+)`, 'gi'),
    };
  }

  const escaped = escapeRegExp(pattern);
  return {
    source: escaped,
    valueRegex: new RegExp(escaped, 'gi'),
    keyRegex: new RegExp(escaped, 'i'),
    kvRegex: new RegExp(`(${escaped})(\\s*[=:]\\s*)("[^"]*"|'[^']*'|[^\\s,;]+)`, 'gi'),
  };
}

function redactString(value: string, patterns: NormalizedPattern[]): string {
  let result = value;
  for (const pattern of patterns) {
    result = result.replace(
      pattern.kvRegex,
      (_match, key: string, sep: string, rawValue: string) => {
        if (rawValue.length > 1) {
          const quoted =
            (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
            (rawValue.startsWith("'") && rawValue.endsWith("'"));
          if (quoted) {
            const quote = rawValue[0];
            return `${key}${sep}${quote}${MASK}${quote}`;
          }
        }
        return `${key}${sep}${MASK}`;
      }
    );

    result = result.replace(pattern.valueRegex, MASK);
  }
  return result;
}

const ENV_LIKE_KEYS = new Set([
  'env',
  'envs',
  'environment',
  'environments',
  'envvars',
  'env_variables',
  'environmentvars',
  'environmentvariables',
  'environmentsnapshot',
  'processenv',
  'process_env',
  'envsnapshot',
  'env_snapshot',
  'contextenv',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isLikelyEnvObject(value: Record<string, unknown>): boolean {
  const entries = Object.entries(value);
  if (entries.length === 0) {
    return false;
  }
  let uppercaseKeys = 0;
  for (const [key, val] of entries) {
    if (/(key|secret|token|password|authorization)/i.test(key)) {
      return true;
    }
    if (typeof val === 'string' && /(key|secret|token|password|authorization)/i.test(val)) {
      return true;
    }
    if (key === key.toUpperCase() && key.length > 1) {
      uppercaseKeys += 1;
    }
  }
  return uppercaseKeys >= Math.ceil(entries.length / 2);
}

function isEnvStyleArray(value: unknown[]): boolean {
  if (value.length === 0) {
    return false;
  }
  return value.every((item) => typeof item === 'string' && item.includes('='));
}

export const DEFAULT_REDACTION_PATTERNS: ReadonlyArray<RedactionPattern> = Object.freeze([
  /sk-[a-z0-9-_]{8,}/i,
  /api[-_]?key/i,
  /access[-_]?key/i,
  /secret[-_]?key/i,
  /token/i,
  /password/i,
  /passwd/i,
  /pwd/i,
  /authorization/i,
]);

export type SensitiveRedactor = <T>(value: T) => T;

export function createSensitiveRedactor(
  patterns: ReadonlyArray<RedactionPattern>
): SensitiveRedactor {
  if (!patterns || patterns.length === 0) {
    return <T>(value: T): T => value;
  }

  const normalized = patterns.map(normalizePattern);
  const seen = new WeakSet<object>();

  const shouldRedactKey = (key: string): boolean =>
    normalized.some((pattern) => pattern.keyRegex.test(key));

  const redactValue = (value: unknown): unknown => {
    if (typeof value === 'string') {
      return redactString(value, normalized);
    }

    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null ||
      value === undefined
    ) {
      return value;
    }

    if (
      value instanceof Date ||
      value instanceof RegExp ||
      value instanceof Error ||
      value instanceof Map ||
      value instanceof Set
    ) {
      return value;
    }

    if (Array.isArray(value)) {
      if (isEnvStyleArray(value)) {
        return value.map(() => MASK);
      }
      return value.map((item) => redactValue(item));
    }

    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return value;
      }
      seen.add(value);
      const output: Record<string, unknown> = {};
      for (const [key, original] of Object.entries(value as Record<string, unknown>)) {
        const lowerKey = key.toLowerCase();
        const isArray = Array.isArray(original);
        const isPojo = isPlainObject(original);
        const looksLikeEnvContainer =
          ENV_LIKE_KEYS.has(lowerKey) ||
          ((lowerKey.includes('env') || lowerKey.includes('environment')) && (isArray || isPojo));

        if (looksLikeEnvContainer) {
          if (isArray && isEnvStyleArray(original as unknown[])) {
            output[key] = (original as unknown[]).map(() => MASK);
            continue;
          }
          if (isPojo && isLikelyEnvObject(original as Record<string, unknown>)) {
            output[key] = MASK;
            continue;
          }
        }

        if (shouldRedactKey(key)) {
          if (typeof original === 'string') {
            output[key] = MASK;
          } else if (Array.isArray(original)) {
            output[key] = (original as unknown[]).map(() => MASK);
          } else if (isPlainObject(original)) {
            output[key] = MASK;
          } else {
            output[key] = MASK;
          }
          continue;
        }

        output[key] = redactValue(original);
      }
      seen.delete(value);
      return output;
    }

    return value;
  };

  return <T>(value: T): T => redactValue(value) as T;
}

export const SENSITIVE_VALUE_PLACEHOLDER = MASK;
