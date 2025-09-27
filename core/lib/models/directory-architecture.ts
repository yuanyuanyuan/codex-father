import { ValidationError, ValidationResult } from '../types.js';

export type DirectoryNodeType = 'directory' | 'file';

export interface DirectoryNode {
  name: string;
  type: DirectoryNodeType;
  description: string;
  children?: DirectoryNode[];
  purpose: string;
  owner: string;
}

export interface NamingConvention {
  scope: 'file' | 'directory' | 'variable' | 'function' | 'class';
  pattern: string; // regex string
  examples: string[];
  exceptions: string[];
}

export interface LayeringRule {
  layer: string; // e.g. "core", "app", "infra"
  canDependOn: string[]; // allowed lower layers
}

export interface MigrationStep {
  name: string;
  description: string;
  fromVersion: string;
  toVersion: string;
}

export type DirectoryStandardStatus = 'draft' | 'review' | 'approved' | 'implemented';

export interface DirectoryArchitectureStandard {
  id: string;
  name: string;
  structure: DirectoryNode;
  namingConventions: NamingConvention[];
  layeringStrategy: LayeringRule[];
  migrationPlan: MigrationStep[];
  status?: DirectoryStandardStatus;
}

export function canTransitionDirectoryStatus(
  current: DirectoryStandardStatus,
  next: DirectoryStandardStatus
): boolean {
  const order: DirectoryStandardStatus[] = ['draft', 'review', 'approved', 'implemented'];
  return order.indexOf(next) - order.indexOf(current) === 1;
}

export function validateDirectoryArchitecture(standard: DirectoryArchitectureStandard): ValidationResult {
  const errors: ValidationError[] = [];

  if (!standard.id) errors.push({ field: 'id', message: 'id is required', code: 'DA_ID_REQUIRED' });
  if (!standard.structure) errors.push({ field: 'structure', message: 'structure required', code: 'DA_STRUCTURE_REQUIRED' });

  // Validate regex patterns are compilable
  for (const conv of standard.namingConventions) {
    try {
      // eslint-disable-next-line no-new
      new RegExp(conv.pattern);
    } catch {
      errors.push({ field: `namingConventions.${conv.scope}`, message: 'invalid regex pattern', code: 'DA_REGEX_INVALID' });
    }
  }

  // Validate layering graph: no upward dependency cycles (simple check)
  const layerIndex = new Map<string, number>();
  standard.layeringStrategy.forEach((l, i) => layerIndex.set(l.layer, i));
  for (const l of standard.layeringStrategy) {
    for (const dep of l.canDependOn) {
      if ((layerIndex.get(dep) ?? Infinity) > (layerIndex.get(l.layer) ?? -Infinity)) {
        errors.push({ field: 'layeringStrategy', message: `layer '${l.layer}' cannot depend upward on '${dep}'`, code: 'DA_LAYER_ORDER' });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}

