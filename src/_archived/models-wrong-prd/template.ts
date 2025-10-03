/**
 * Template model definitions and helpers (T012)
 *
 * Provides lightweight structures, validation utilities, and a
 * factory consistent with the spec-driven unit tests.
 */

/** Supported section content types */
export type SectionType = 'text' | 'diagram' | 'table' | 'list' | 'code';

/** Permissions applied at either section or template scope */
export interface PermissionMatrix {
  read?: string[];
  write?: string[];
  review?: string[];
  approve?: string[];
  publish?: string[];
}

/** Metadata associated with an individual section */
export interface SectionMetadata {
  order?: number;
  helpText?: string;
  placeholder?: string;
  diagramType?: string;
  theme?: string;
  validation?: Record<string, unknown>;
  ui?: Record<string, unknown>;
  workflow?: Record<string, unknown>;
  dependsOn?: string[];
  [key: string]: unknown;
}

/** Template section definition */
export interface TemplateSection {
  id: string;
  title: string;
  type: SectionType;
  required: boolean;
  content: string;
  permissions?: PermissionMatrix;
  metadata?: SectionMetadata;
}

/** Metadata associated with a template */
export interface TemplateMetadata {
  version: string;
  author: string;
  tags: string[];
  reviewRequired?: boolean;
  estimatedTime?: number;
  complexity?: 'low' | 'medium' | 'high';
  [key: string]: unknown;
}

/** Optional usage statistics */
export interface TemplateUsage {
  count: number;
  lastUsed?: Date;
}

/** Template entity */
export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  sections: TemplateSection[];
  metadata: TemplateMetadata;
  permissions?: PermissionMatrix;
  usage?: TemplateUsage;
  createdAt: Date;
  updatedAt: Date;
}

/** Validation error payload */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

/** Validation result wrapper */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

const ID_PATTERN = /^[a-z][a-z0-9_-]{0,99}$/;
const SECTION_ID_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const NAME_MAX_LENGTH = 255;
const DESCRIPTION_MAX_LENGTH = 2000;
const SECTION_TITLE_MAX_LENGTH = 255;
const SECTION_CONTENT_MAX_LENGTH = 1_000_000; // 1MB text equivalent
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z-]+)*)?$/;
const ALLOWED_CATEGORIES = new Set([
  'standard',
  'agile',
  'waterfall',
  'technical',
  'business',
  'research',
  'custom',
  'test',
]);
const PERMISSION_KEYS: (keyof PermissionMatrix)[] = [
  'read',
  'write',
  'review',
  'approve',
  'publish',
];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.valueOf());

let templateIdCounter = 0;

const generateTemplateId = (): string => {
  templateIdCounter = (templateIdCounter + 1) % 10_000;
  const suffix = templateIdCounter.toString().padStart(4, '0');
  return `template-${Date.now()}${suffix}`;
};

const validateString = (
  value: unknown,
  field: string,
  errors: ValidationError[],
  { min = 1, max = Infinity }: { min?: number; max?: number } = {}
): void => {
  if (typeof value !== 'string') {
    errors.push({ field, message: `${field} must be a string`, code: 'invalid_type' });
    return;
  }
  const trimmed = value.trim();
  if (trimmed.length < min) {
    errors.push({
      field,
      message: `${field} must be at least ${min} characters`,
      code: 'too_short',
    });
  }
  if (trimmed.length > max) {
    errors.push({ field, message: `${field} must be at most ${max} characters`, code: 'too_long' });
  }
};

export const validateTemplateSection = (section: unknown): ValidationResult => {
  if (!isPlainObject(section)) {
    return {
      valid: false,
      errors: [
        { field: 'section', message: 'TemplateSection must be an object', code: 'invalid_type' },
      ],
    };
  }

  const errors: ValidationError[] = [];

  // id
  if (section.id === undefined) {
    errors.push({ field: 'id', message: 'id is required', code: 'required' });
  } else if (typeof section.id !== 'string' || !SECTION_ID_PATTERN.test(section.id)) {
    errors.push({
      field: 'id',
      message:
        'id must start with a lowercase letter and only include lowercase letters, numbers, hyphen or underscore',
      code: 'invalid_format',
    });
  }

  // title
  validateString(section.title, 'title', errors, { min: 1, max: SECTION_TITLE_MAX_LENGTH });

  // type
  if (
    !section.type ||
    typeof section.type !== 'string' ||
    !['text', 'diagram', 'table', 'list', 'code'].includes(section.type)
  ) {
    errors.push({
      field: 'type',
      message: 'type must be one of text, diagram, table, list, code',
      code: 'invalid_value',
    });
  }

  // required
  if (typeof section.required !== 'boolean') {
    errors.push({ field: 'required', message: 'required must be a boolean', code: 'invalid_type' });
  }

  // content
  if (typeof section.content !== 'string') {
    errors.push({ field: 'content', message: 'content must be a string', code: 'invalid_type' });
  } else if (section.content.length > SECTION_CONTENT_MAX_LENGTH) {
    errors.push({
      field: 'content',
      message: 'content exceeds maximum allowed length',
      code: 'too_long',
    });
  }

  // permissions
  if (section.permissions !== undefined && section.permissions !== null) {
    if (!isPlainObject(section.permissions)) {
      errors.push({
        field: 'permissions',
        message: 'permissions must be an object',
        code: 'invalid_type',
      });
    } else {
      const permissions = section.permissions as Record<string, unknown>;
      for (const key of Object.keys(permissions)) {
        if (!PERMISSION_KEYS.includes(key as keyof PermissionMatrix)) {
          errors.push({
            field: 'permissions',
            message: `Invalid permission key: ${key}`,
            code: 'invalid_key',
          });
          continue;
        }
        const list = permissions[key];
        if (!Array.isArray(list)) {
          errors.push({
            field: 'permissions',
            message: `${key} permission must be an array`,
            code: 'invalid_type',
          });
          continue;
        }
        for (const entry of list) {
          if (typeof entry !== 'string' || entry.length === 0) {
            errors.push({
              field: 'permissions',
              message: `${key} entries must be non-empty strings`,
              code: 'invalid_value',
            });
          }
        }
      }
    }
  }

  // metadata
  if (section.metadata === undefined) {
    // No metadata provided – acceptable for most section types
  } else if (section.metadata === null) {
    errors.push({ field: 'metadata', message: 'metadata must be an object', code: 'invalid_type' });
  } else if (!isPlainObject(section.metadata)) {
    errors.push({ field: 'metadata', message: 'metadata must be an object', code: 'invalid_type' });
  } else {
    const metadata = section.metadata as SectionMetadata;
    if (metadata.order !== undefined) {
      if (
        typeof metadata.order !== 'number' ||
        Number.isNaN(metadata.order) ||
        metadata.order < 0 ||
        metadata.order > 1000
      ) {
        errors.push({
          field: 'metadata.order',
          message: 'order must be a number between 0 and 1000',
          code: 'invalid_value',
        });
      }
    }
    if (metadata.dependsOn !== undefined) {
      if (
        !Array.isArray(metadata.dependsOn) ||
        metadata.dependsOn.some((dep) => typeof dep !== 'string')
      ) {
        errors.push({
          field: 'metadata.dependsOn',
          message: 'dependsOn must be an array of section IDs',
          code: 'invalid_type',
        });
      }
    }
    if (section.type === 'diagram') {
      const hasKeys = Object.keys(metadata).length > 0;
      const hasDiagramType =
        typeof metadata.diagramType === 'string' && metadata.diagramType.trim().length > 0;
      if (!hasKeys || (metadata.diagramType !== undefined && !hasDiagramType)) {
        errors.push({
          field: 'metadata.diagramType',
          message: 'diagram sections must specify metadata.diagramType',
          code: 'missing_diagram_type',
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

const detectDependencyIssues = (sections: TemplateSection[]): ValidationError[] => {
  const idSet = new Set<string>();
  const errors: ValidationError[] = [];

  sections.forEach((section) => {
    idSet.add(section.id);
  });

  const adjacency = new Map<string, string[]>();
  for (const section of sections) {
    const dependsOn = section.metadata?.dependsOn ?? [];
    if (!Array.isArray(dependsOn)) {
      continue;
    }
    adjacency.set(section.id, dependsOn);
    for (const dep of dependsOn) {
      if (!idSet.has(dep)) {
        errors.push({
          field: 'sections',
          message: `章节 "${section.id}" 依赖未定义的章节 "${dep}"`,
          code: 'missing_dependency',
        });
      }
    }
  }

  const tempMark = new Set<string>();
  const permMark = new Set<string>();

  const visit = (node: string, path: string[]): boolean => {
    if (permMark.has(node)) {
      return false;
    }
    if (tempMark.has(node)) {
      errors.push({
        field: 'sections',
        message: `检测到章节循环依赖: ${[...path, node].join(' -> ')}`,
        code: 'circular_dependency',
      });
      return true;
    }
    tempMark.add(node);
    const neighbors = adjacency.get(node) ?? [];
    for (const neighbor of neighbors) {
      visit(neighbor, [...path, node]);
    }
    tempMark.delete(node);
    permMark.add(node);
    return false;
  };

  for (const section of sections) {
    if (!permMark.has(section.id)) {
      visit(section.id, []);
    }
  }

  return errors;
};

export const validateTemplate = (template: unknown): ValidationResult => {
  if (!isPlainObject(template)) {
    return {
      valid: false,
      errors: [{ field: 'template', message: 'Template must be an object', code: 'invalid_type' }],
    };
  }

  const errors: ValidationError[] = [];

  // id
  if (template.id === undefined) {
    errors.push({ field: 'id', message: 'id is required', code: 'required' });
  } else if (typeof template.id !== 'string' || !ID_PATTERN.test(template.id)) {
    errors.push({
      field: 'id',
      message:
        'id must start with a lowercase letter and only include lowercase letters, numbers, hyphen or underscore',
      code: 'invalid_format',
    });
  }

  // name / description
  validateString(template.name, 'name', errors, { min: 1, max: NAME_MAX_LENGTH });
  validateString(template.description, 'description', errors, {
    min: 1,
    max: DESCRIPTION_MAX_LENGTH,
  });

  // category
  if (typeof template.category !== 'string' || !ALLOWED_CATEGORIES.has(template.category)) {
    errors.push({
      field: 'category',
      message:
        'category must be one of standard, agile, waterfall, technical, business, research, custom, test',
      code: 'invalid_value',
    });
  }

  // sections
  if (!Array.isArray(template.sections)) {
    errors.push({ field: 'sections', message: 'sections must be an array', code: 'invalid_type' });
  } else {
    const seenIds = new Set<string>();
    template.sections.forEach((entry, index) => {
      const result = validateTemplateSection(entry);
      if (!result.valid) {
        result.errors.forEach((err) => {
          errors.push({
            field: `sections[${index}].${err.field}`,
            message: err.message,
            code: err.code,
          });
        });
      }
      const section = entry as TemplateSection;
      if (seenIds.has(section.id)) {
        errors.push({
          field: 'sections',
          message: `章节 ID 重复: ${section.id}`,
          code: 'duplicate_section',
        });
      }
      seenIds.add(section.id);
    });
    errors.push(...detectDependencyIssues((template.sections as TemplateSection[]) ?? []));
  }

  // metadata
  if (!isPlainObject(template.metadata)) {
    errors.push({
      field: 'metadata',
      message: 'metadata is required and must be an object',
      code: 'invalid_type',
    });
  } else {
    const metadata = template.metadata as TemplateMetadata;
    if (typeof metadata.version !== 'string' || !SEMVER_PATTERN.test(metadata.version)) {
      errors.push({
        field: 'metadata.version',
        message: 'version must follow semantic versioning',
        code: 'invalid_format',
      });
    }
    validateString(metadata.author, 'metadata.author', errors, { min: 1, max: 200 });
    if (!Array.isArray(metadata.tags)) {
      errors.push({
        field: 'metadata.tags',
        message: 'tags must be an array of strings',
        code: 'invalid_type',
      });
    } else {
      const seenTags = new Set<string>();
      metadata.tags.forEach((tag) => {
        if (typeof tag !== 'string') {
          errors.push({
            field: 'metadata.tags',
            message: 'tags must contain only strings',
            code: 'invalid_type',
          });
          return;
        }
        const trimmed = tag.trim();
        if (trimmed.length === 0) {
          errors.push({
            field: 'metadata.tags',
            message: 'tags cannot be empty',
            code: 'too_short',
          });
        }
        if (seenTags.has(trimmed)) {
          errors.push({
            field: 'metadata.tags',
            message: `duplicate tag detected: ${trimmed}`,
            code: 'duplicate',
          });
        }
        seenTags.add(trimmed);
      });
    }
    if (
      metadata.estimatedTime !== undefined &&
      (typeof metadata.estimatedTime !== 'number' || metadata.estimatedTime < 0)
    ) {
      errors.push({
        field: 'metadata.estimatedTime',
        message: 'estimatedTime must be a positive number',
        code: 'invalid_value',
      });
    }
    if (
      metadata.complexity !== undefined &&
      !['low', 'medium', 'high'].includes(metadata.complexity)
    ) {
      errors.push({
        field: 'metadata.complexity',
        message: 'complexity must be low, medium or high',
        code: 'invalid_value',
      });
    }
  }

  // permissions
  if (template.permissions !== undefined && template.permissions !== null) {
    if (!isPlainObject(template.permissions)) {
      errors.push({
        field: 'permissions',
        message: 'permissions must be an object',
        code: 'invalid_type',
      });
    } else {
      const permissions = template.permissions as PermissionMatrix;
      for (const key of Object.keys(permissions)) {
        if (!PERMISSION_KEYS.includes(key as keyof PermissionMatrix)) {
          errors.push({
            field: 'permissions',
            message: `Invalid permission key: ${key}`,
            code: 'invalid_key',
          });
          continue;
        }
        const list = (permissions as Record<string, unknown>)[key];
        if (!Array.isArray(list)) {
          errors.push({
            field: 'permissions',
            message: `${key} permission must be an array`,
            code: 'invalid_type',
          });
          continue;
        }
        for (const entry of list) {
          if (typeof entry !== 'string' || entry.length === 0) {
            errors.push({
              field: 'permissions',
              message: `${key} entries must be non-empty strings`,
              code: 'invalid_value',
            });
          }
        }
      }
    }
  }

  // usage
  if (template.usage !== undefined) {
    if (!isPlainObject(template.usage)) {
      errors.push({ field: 'usage', message: 'usage must be an object', code: 'invalid_type' });
    } else {
      const usage = template.usage as TemplateUsage;
      if (typeof usage.count !== 'number' || usage.count < 0) {
        errors.push({
          field: 'usage.count',
          message: 'usage.count must be a non-negative number',
          code: 'invalid_value',
        });
      }
      if (usage.lastUsed !== undefined && !isDate(usage.lastUsed)) {
        errors.push({
          field: 'usage.lastUsed',
          message: 'usage.lastUsed must be a Date',
          code: 'invalid_type',
        });
      }
    }
  }

  // createdAt / updatedAt
  if (!isDate(template.createdAt)) {
    errors.push({ field: 'createdAt', message: 'createdAt must be a Date', code: 'invalid_type' });
  }
  if (!isDate(template.updatedAt)) {
    errors.push({ field: 'updatedAt', message: 'updatedAt must be a Date', code: 'invalid_type' });
  } else if (isDate(template.createdAt) && template.updatedAt < template.createdAt) {
    errors.push({
      field: 'updatedAt',
      message: 'updatedAt cannot be earlier than createdAt',
      code: 'invalid_value',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const isTemplate = (value: unknown): value is Template => validateTemplate(value).valid;

export interface CreateTemplateInput {
  name: string;
  description: string;
  category: string;
  sections: TemplateSection[];
  author: string;
  id?: string;
  version?: string;
  tags?: string[];
  reviewRequired?: boolean;
  estimatedTime?: number;
  complexity?: 'low' | 'medium' | 'high';
  permissions?: PermissionMatrix;
  usage?: TemplateUsage;
  createdAt?: Date;
  updatedAt?: Date;
}

export const createTemplate = (input: CreateTemplateInput): Template => {
  const {
    name,
    description,
    category,
    sections,
    author,
    id = generateTemplateId(),
    version = '1.0.0',
    tags = [],
    reviewRequired,
    estimatedTime,
    complexity,
    permissions,
    usage,
    createdAt = new Date(),
    updatedAt,
  } = input;

  const template: Template = {
    id,
    name,
    description,
    category,
    sections,
    metadata: {
      version,
      author,
      tags,
      reviewRequired,
      estimatedTime,
      complexity,
    },
    permissions,
    usage,
    createdAt,
    updatedAt: updatedAt ?? createdAt,
  };

  const validation = validateTemplate(template);
  if (!validation.valid) {
    const message = validation.errors.map((err) => `${err.field}: ${err.message}`).join('; ');
    throw new Error(`Failed to create Template: ${message}`);
  }

  return template;
};
