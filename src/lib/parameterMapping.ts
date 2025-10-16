// 参数映射表
export interface ParameterMapping {
  name: string;
  minVersion: string;
  description: string;
}

export const PARAMETER_MAPPING: Record<string, ParameterMapping> = {
  // 通用参数（0.42起支持）
  model: {
    name: 'model',
    minVersion: '0.42.0',
    description: 'AI model to use for task execution',
  },
  cwd: {
    name: 'cwd',
    minVersion: '0.42.0',
    description: 'Current working directory',
  },
  approvalPolicy: {
    name: 'approvalPolicy',
    minVersion: '0.42.0',
    description: 'Approval policy for task execution',
  },
  sandbox: {
    name: 'sandbox',
    minVersion: '0.42.0',
    description: 'Sandbox environment for task execution',
  },

  // 0.44 独有参数
  profile: {
    name: 'profile',
    minVersion: '0.44.0',
    description: 'Profile configuration for task execution',
  },
  'sendUserTurn.effort': {
    name: 'sendUserTurn.effort',
    minVersion: '0.44.0',
    description: 'Effort level for user turn processing',
  },
  'sendUserTurn.summary': {
    name: 'sendUserTurn.summary',
    minVersion: '0.44.0',
    description: 'Summary for user turn processing',
  },
};

export function getParamMinVersion(param: string): string | null {
  const mapping = PARAMETER_MAPPING[param];
  return mapping ? mapping.minVersion : null;
}

export function isParamSupported(param: string, version: string): boolean {
  const minVersion = getParamMinVersion(param);
  if (!minVersion) return false;

  return compareVersions(version, minVersion) >= 0;
}

export function getIncompatibleParams(version: string): string[] {
  return Object.entries(PARAMETER_MAPPING)
    .filter(([_, mapping]) => compareVersions(version, mapping.minVersion) < 0)
    .map(([name, _]) => name);
}

export function getAllParamNames(): string[] {
  return Object.keys(PARAMETER_MAPPING);
}

export function compareVersions(version1: string, version2: string): number {
  const parts1 = version1.split('.').map(Number);
  const parts2 = version2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}
