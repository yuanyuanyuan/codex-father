/**
 * PRDDraft model definitions and helpers (T011)
 *
 * Provides a lightweight representation of PRD drafts plus
 * validation, type guards, and a factory aligned with the unit tests
 * and specs data model essentials.
 */

/** Allowed PRD lifecycle statuses */
export type PRDStatus = 'draft' | 'in_review' | 'approved' | 'published' | 'archived';

/** Access control definition used for quick permission checks */
export interface PRDPermissions {
  read?: string[];
  write?: string[];
  review?: string[];
}

/** Optional metadata captured on a PRD draft */
export interface DocumentMetadata {
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  visibility?: 'public' | 'internal' | 'team' | 'restricted' | 'confidential' | 'private';
  estimatedReadTime?: number;
  wordCount?: number;
  lastEditor?: string;
  lastEditedAt?: Date;
  custom?: Record<string, unknown>;
}

/** Minimal representation of a structured PRD section */
export interface DocumentSection {
  id: string;
  title: string;
  order: number;
  content: string;
  level?: number;
  required?: boolean;
  editableBy?: string[];
}

/** Core PRD draft shape */
export interface PRDDraft {
  id: string;
  title: string;
  description?: string;
  content: Record<string, string>;
  templateId: string;
  author: string;
  status: PRDStatus;
  version: string;
  tags?: string[];
  reviewStatus?: string;
  permissions?: PRDPermissions;
  createdAt: Date;
  updatedAt: Date;
  archivedAt?: Date;
  metadata?: DocumentMetadata;
}

/** Validation error metadata */
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

const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_TAGS = 20;
const MAX_CONTENT_BYTES = 10 * 1024 * 1024; // 10MB
const ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,254})$/;
const TAG_PATTERN = /^[^\s]+$/u;
const SECTION_KEY_PATTERN = /^[A-Za-z0-9_-]+$/;
const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z]+(?:\.[0-9A-Za-z-]+)*)?$/;

const PERMISSION_KEYS: (keyof PRDPermissions)[] = ['read', 'write', 'review'];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.valueOf());

let generatedIdCounter = 0;

/**
 * Generate a unique, predictable id prefixed with "prd-".
 */
const generateId = (): string => {
  const now = Date.now();
  generatedIdCounter = (generatedIdCounter + 1) % 1000;
  const suffix = generatedIdCounter.toString().padStart(3, '0');
  return `prd-${now}${suffix}`;
};

/**
 * Run structural and business-rule validation for a PRD draft.
 */
export const validatePRDDraft = (draft: unknown): ValidationResult => {
  if (!isPlainObject(draft)) {
    return {
      valid: false,
      errors: [
        {
          field: 'root',
          message: 'PRDDraft must be an object',
          code: 'invalid_type',
        },
      ],
    };
  }

  const errors: ValidationError[] = [];

  const pushError = (field: string, message: string, code: string): void => {
    errors.push({ field, message, code });
  };

  const validateString = (
    value: unknown,
    field: string,
    { min = 1, max }: { min?: number; max?: number } = {}
  ): void => {
    if (typeof value !== 'string') {
      pushError(field, `${field} must be a string`, 'invalid_type');
      return;
    }
    const trimmed = value.trim();
    if (trimmed.length < min) {
      pushError(field, `${field} must be at least ${min} characters`, 'too_short');
    }
    if (typeof max === 'number' && trimmed.length > max) {
      pushError(field, `${field} must be at most ${max} characters`, 'too_long');
    }
  };

  // id
  if (draft.id === undefined) {
    pushError('id', 'id is required', 'required');
  } else if (typeof draft.id !== 'string') {
    pushError('id', 'id must be a string', 'invalid_type');
  } else if (!ID_PATTERN.test(draft.id)) {
    pushError(
      'id',
      'id must use lowercase alphanumeric, hyphen or underscore characters and start with an alphanumeric',
      'invalid_format'
    );
  }

  // title
  validateString(draft.title, 'title', { min: 1, max: MAX_TITLE_LENGTH });

  // description (optional)
  if (draft.description !== undefined) {
    if (typeof draft.description !== 'string') {
      pushError('description', 'description must be a string', 'invalid_type');
    } else if (draft.description.trim().length === 0) {
      pushError('description', 'description cannot be empty', 'too_short');
    } else if (draft.description.length > MAX_DESCRIPTION_LENGTH) {
      pushError(
        'description',
        `description must be at most ${MAX_DESCRIPTION_LENGTH} characters`,
        'too_long'
      );
    }
  }

  // templateId
  validateString(draft.templateId, 'templateId', { min: 1, max: 128 });

  // author
  validateString(draft.author, 'author', { min: 1, max: 128 });

  // status
  if (
    !draft.status ||
    typeof draft.status !== 'string' ||
    !['draft', 'in_review', 'approved', 'published', 'archived'].includes(draft.status)
  ) {
    pushError(
      'status',
      'status must be one of draft, in_review, approved, published, archived',
      'invalid_value'
    );
  }

  // version
  if (typeof draft.version !== 'string' || draft.version.trim().length === 0) {
    pushError('version', 'version is required', 'required');
  } else if (!SEMVER_PATTERN.test(draft.version)) {
    pushError(
      'version',
      'version must follow semantic versioning (e.g. 1.0.0, 1.0.0-alpha)',
      'invalid_format'
    );
  }

  // content
  if (!isPlainObject(draft.content)) {
    pushError('content', 'content must be an object map of sections', 'invalid_type');
  } else {
    const content = draft.content as Record<string, unknown>;
    let totalBytes = 0;
    const entries = Object.entries(content);
    for (const [sectionKey, value] of entries) {
      if (
        typeof sectionKey !== 'string' ||
        sectionKey.length === 0 ||
        !SECTION_KEY_PATTERN.test(sectionKey)
      ) {
        pushError(
          'content',
          `section key "${sectionKey}" must contain only letters, numbers, hyphen or underscore`,
          'invalid_section_key'
        );
      }
      if (typeof value !== 'string') {
        pushError(
          'content',
          `content for section "${sectionKey}" must be a string`,
          'invalid_section_value'
        );
      } else {
        totalBytes += Buffer.byteLength(value, 'utf8');
      }
    }
    if (totalBytes > MAX_CONTENT_BYTES) {
      pushError('content', 'content exceeds maximum size of 10MB', 'too_large');
    }
  }

  // tags
  if (draft.tags !== undefined && draft.tags !== null) {
    if (!Array.isArray(draft.tags)) {
      pushError('tags', 'tags must be an array of strings', 'invalid_type');
    } else {
      if (draft.tags.length > MAX_TAGS) {
        pushError('tags', `tags cannot exceed ${MAX_TAGS} entries`, 'too_many');
      }
      const seen = new Set<string>();
      for (const tag of draft.tags) {
        if (typeof tag !== 'string') {
          pushError('tags', 'each tag must be a string', 'invalid_type');
          continue;
        }
        const value = tag.trim();
        if (value.length === 0) {
          pushError('tags', 'tags cannot be empty', 'too_short');
        } else if (!TAG_PATTERN.test(value) || /\s/.test(value)) {
          pushError('tags', 'tags may not contain whitespace characters', 'invalid_format');
        }
        if (seen.has(value)) {
          pushError('tags', `duplicate tag detected: ${value}`, 'duplicate');
        }
        seen.add(value);
      }
    }
  }

  // permissions
  if (draft.permissions !== undefined && draft.permissions !== null) {
    if (!isPlainObject(draft.permissions)) {
      pushError('permissions', 'permissions must be an object', 'invalid_type');
    } else {
      const permissions = draft.permissions as Record<string, unknown>;
      for (const key of Object.keys(permissions)) {
        if (!PERMISSION_KEYS.includes(key as keyof PRDPermissions)) {
          pushError('permissions', `invalid permission key: ${key}`, 'invalid_key');
          continue;
        }
        const list = permissions[key];
        if (!Array.isArray(list)) {
          pushError(
            'permissions',
            `${key} permission list must be an array of user identifiers`,
            'invalid_type'
          );
          continue;
        }
        for (const user of list) {
          if (typeof user !== 'string') {
            pushError('permissions', `${key} entries must be strings`, 'invalid_type');
          } else if (user.length === 0) {
            pushError('permissions', `${key} entries cannot be empty`, 'too_short');
          }
        }
      }
    }
  }

  // createdAt / updatedAt / archivedAt
  if (!isDate(draft.createdAt)) {
    pushError('createdAt', 'createdAt must be a valid Date', 'invalid_type');
  }
  if (!isDate(draft.updatedAt)) {
    pushError('updatedAt', 'updatedAt must be a valid Date', 'invalid_type');
  } else if (isDate(draft.createdAt) && draft.updatedAt < draft.createdAt) {
    pushError('updatedAt', 'updatedAt cannot be earlier than createdAt', 'invalid_value');
  }
  if (draft.archivedAt !== undefined && !isDate(draft.archivedAt)) {
    pushError('archivedAt', 'archivedAt must be a valid Date when provided', 'invalid_type');
  }

  // metadata (optional)
  if (draft.metadata !== undefined) {
    if (!isPlainObject(draft.metadata)) {
      pushError('metadata', 'metadata must be an object', 'invalid_type');
    } else {
      const metadata = draft.metadata as Record<string, unknown>;
      const lastEditedAt = metadata.lastEditedAt;
      if (lastEditedAt !== undefined && !isDate(lastEditedAt)) {
        pushError('metadata.lastEditedAt', 'lastEditedAt must be a valid Date', 'invalid_type');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Boolean type guard using the validation logic.
 */
export const isPRDDraft = (value: unknown): value is PRDDraft => validatePRDDraft(value).valid;

export interface CreatePRDDraftInput {
  title: string;
  description: string;
  templateId: string;
  author: string;
  id?: string;
  status?: PRDStatus;
  version?: string;
  content?: Record<string, string>;
  tags?: string[];
  reviewStatus?: string;
  permissions?: PRDPermissions;
  metadata?: DocumentMetadata;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Factory method for creating a PRDDraft with sane defaults.
 */
export const createPRDDraft = (input: CreatePRDDraftInput): PRDDraft => {
  const {
    title,
    description,
    templateId,
    author,
    id = generateId(),
    status = 'draft',
    version = '1.0.0',
    content = {},
    tags = [],
    reviewStatus,
    permissions,
    metadata,
    createdAt = new Date(),
    updatedAt,
  } = input;

  const draft: PRDDraft = {
    id,
    title,
    description,
    content,
    templateId,
    author,
    status,
    version,
    tags,
    reviewStatus,
    permissions,
    createdAt,
    updatedAt: updatedAt ?? createdAt,
    metadata,
  };

  const validation = validatePRDDraft(draft);
  if (!validation.valid) {
    const message = validation.errors.map((err) => `${err.field}: ${err.message}`).join('; ');
    throw new Error(`Failed to create PRDDraft: ${message}`);
  }

  return draft;
};
