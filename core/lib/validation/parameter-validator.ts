export class ParameterValidatorLib {
  static validateRequired(value: unknown, name: string): void {
    if (value === undefined || value === null || value === '') {
      throw new Error(`Required parameter '${name}' is missing`);
    }
  }

  static validateRange(value: number, min: number, max: number, name: string): void {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new Error(`Parameter '${name}' must be a number`);
    }
    if (value < min || value > max) {
      throw new Error(`Parameter '${name}' must be between ${min} and ${max}, got ${value}`);
    }
  }

  static validateEnum(value: string, allowedValues: string[], name: string): void {
    if (!allowedValues.includes(value)) {
      throw new Error(
        `Parameter '${name}' must be one of: ${allowedValues.join(', ')}, got '${value}'`
      );
    }
  }

  static validatePath(value: string, name: string, mustExist = false): void {
    if (!value || typeof value !== 'string') {
      throw new Error(`Parameter '${name}' must be a valid path`);
    }
    if (mustExist) {
      const fs = require('fs');
      if (!fs.existsSync(value)) {
        throw new Error(`Path '${value}' for parameter '${name}' does not exist`);
      }
    }
  }
}

export interface ParameterMetadata {
  introducedIn: string;
  deprecatedIn?: string;
  description?: string;
}

export const PARAMETER_MAPPINGS: Record<string, ParameterMetadata> = {
  model: { introducedIn: '0.42.0' },
  cwd: { introducedIn: '0.42.0' },
  approvalPolicy: { introducedIn: '0.42.0' },
  sandbox: { introducedIn: '0.42.0' },
  instructions: { introducedIn: '0.42.0' },
  includePlanTool: { introducedIn: '0.42.0' },
  includeApplyPatchTool: { introducedIn: '0.42.0' },
  plan: { introducedIn: '0.42.0' },
  planSummary: { introducedIn: '0.42.0' },
  maxConcurrency: { introducedIn: '0.42.0' },
  retries: { introducedIn: '0.42.0' },
  timeout: { introducedIn: '0.42.0' },
  allowNetwork: { introducedIn: '0.42.0' },
  runTests: { introducedIn: '0.42.0' },
  coverage: { introducedIn: '0.42.0' },
  outputFormat: { introducedIn: '0.42.0' },
  verbose: { introducedIn: '0.42.0' },
  debug: { introducedIn: '0.42.0' },
  dryRun: { introducedIn: '0.42.0' },
  detach: { introducedIn: '0.42.0' },
  review: { introducedIn: '0.42.0' },
  testPattern: { introducedIn: '0.42.0' },
  skipLint: { introducedIn: '0.42.0' },
  useProxy: { introducedIn: '0.42.0' },
  featureFlags: { introducedIn: '0.42.0' },
  profile: { introducedIn: '0.44.0' },
  'sendUserTurn.effort': { introducedIn: '0.44.0' },
  'sendUserTurn.summary': { introducedIn: '0.44.0' },
  'sendUserTurn.intent': { introducedIn: '0.44.0' },
  'sendUserTurn.attachments': { introducedIn: '0.44.0' },
  'sendUserTurn.metadata': { introducedIn: '0.44.0' },
  toolVersion: { introducedIn: '0.43.0' },
  preferredModel: { introducedIn: '0.43.0' },
  checkpointPolicy: { introducedIn: '0.43.0' },
  failFast: { introducedIn: '0.43.0' },
  continueOnError: { introducedIn: '0.43.0' },
  auditLog: { introducedIn: '0.43.0' },
  telemetry: { introducedIn: '0.43.0' },
};

export function getParamMinVersion(name: string): string | null {
  return PARAMETER_MAPPINGS[name]?.introducedIn ?? null;
}

export function isParamSupported(name: string, version: string): boolean {
  if (!name || !version) {
    return false;
  }
  const metadata = PARAMETER_MAPPINGS[name];
  if (!metadata) {
    return false;
  }
  const parsedVersion = parseSemver(version);
  const introduced = parseSemver(metadata.introducedIn);
  if (!parsedVersion || !introduced) {
    return false;
  }
  if (compareSemver(parsedVersion, introduced) < 0) {
    return false;
  }

  if (metadata.deprecatedIn) {
    const deprecated = parseSemver(metadata.deprecatedIn);
    if (deprecated && compareSemver(parsedVersion, deprecated) >= 0) {
      return false;
    }
  }

  return true;
}

export function getIncompatibleParams(version: string): string[] {
  const parsedVersion = parseSemver(version);
  if (!parsedVersion) {
    return [];
  }

  return Object.entries(PARAMETER_MAPPINGS)
    .filter(([, meta]) => {
      const introduced = parseSemver(meta.introducedIn);
      if (!introduced) return false;
      return compareSemver(parsedVersion, introduced) < 0;
    })
    .map(([name]) => name);
}

export function getAllParamNames(): string[] {
  return Object.keys(PARAMETER_MAPPINGS);
}

function parseSemver(version: string): [number, number, number] | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemver(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) {
    const aVal = a[i];
    const bVal = b[i];
    if (aVal !== undefined && bVal !== undefined) {
      if (aVal > bVal) return 1;
      if (aVal < bVal) return -1;
    }
  }
  return 0;
}
