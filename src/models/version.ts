import { createHash } from 'crypto';

/** Allowed change types recorded in a version */
export type VersionChangeType = 'create' | 'update' | 'delete' | 'move' | 'rename';

/** Single change entry recorded in a version */
export interface VersionChange {
  type: VersionChangeType;
  section: string;
  description: string;
  before?: string;
  after?: string;
  from?: string;
  to?: string;
  oldName?: string;
  newName?: string;
  lineNumber?: number;
  author?: string;
}

/** Snapshot of document state associated with a version */
export interface VersionSnapshot {
  content: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

/** Core version entity */
export interface Version {
  id: string;
  draftId: string;
  version: string;
  message: string;
  changes: VersionChange[];
  author: string;
  createdAt: Date;
  snapshot?: VersionSnapshot;
  size?: number;
  checksum?: string;
  tags?: string[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

export interface CreateVersionInput {
  draftId: string;
  message: string;
  changes: VersionChange[];
  author: string;
  version?: string;
  content?: Record<string, unknown>;
  snapshotMetadata?: Record<string, unknown>;
  tags?: string[];
}

const VERSION_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;
const DRAFT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MESSAGE_MAX_LENGTH = 500;
const DESCRIPTION_MIN_LENGTH = 4;
const DESCRIPTION_MAX_LENGTH = 1000;
const VERSION_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
const CHECKSUM_PATTERN = /^(sha256|sha1|md5|crc32):[a-z0-9]{4,}$/;
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
let idCounter = 0;
const GENERIC_DESCRIPTION_PATTERNS = [
  /^change$/i,
  /^changes?$/i,
  /^update$/i,
  /^updated?$/i,
  /^modify$/i,
  /^modified?$/i,
  /^修改了一些东西$/,
  /^修改一些东西$/,
  /^缺少章节名$/,
  /^!+$/,
];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.valueOf());

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0;

const generateId = (): string => {
  idCounter = (idCounter + 1) % 1000;
  return `version-${Date.now()}${idCounter.toString().padStart(3, '0')}`;
};

const pushError = (
  errors: ValidationError[],
  field: string,
  message: string,
  code: string
): void => {
  errors.push({ field, message, code });
};

const validateString = (
  value: unknown,
  field: string,
  errors: ValidationError[],
  { min = 1, max = Infinity, pattern }: { min?: number; max?: number; pattern?: RegExp } = {}
): void => {
  if (typeof value !== 'string') {
    pushError(errors, field, `${field} must be a string`, 'invalid_type');
    return;
  }
  const trimmed = value.trim();
  if (trimmed.length < min) {
    pushError(errors, field, `${field} must be at least ${min} characters`, 'too_short');
  }
  if (trimmed.length > max) {
    pushError(errors, field, `${field} must be at most ${max} characters`, 'too_long');
  }
  if (pattern && trimmed.length > 0 && !pattern.test(trimmed)) {
    pushError(errors, field, `${field} format is invalid`, 'invalid_format');
  }
};

const validateDescriptionQuality = (
  description: string,
  errors: ValidationError[],
  field: string
): void => {
  const trimmed = description.trim();
  validateString(trimmed, field, errors, {
    min: DESCRIPTION_MIN_LENGTH,
    max: DESCRIPTION_MAX_LENGTH,
  });
  if (!/[A-Za-z0-9\u4e00-\u9fa5]/u.test(trimmed)) {
    pushError(errors, field, `${field} must contain descriptive characters`, 'invalid_value');
  }
  if (trimmed.length > 0 && GENERIC_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    pushError(errors, field, `${field} is too generic`, 'generic_description');
  }
};

const validateChange = (change: unknown, index: number, errors: ValidationError[]): void => {
  if (!isPlainObject(change)) {
    pushError(errors, `changes[${index}]`, 'change must be an object', 'invalid_type');
    return;
  }

  const changeErrors: ValidationError[] = [];
  const entry = change as VersionChange;

  if (!['create', 'update', 'delete', 'move', 'rename'].includes(entry.type as string)) {
    pushError(
      changeErrors,
      'type',
      'type must be one of create, update, delete, move, rename',
      'invalid_value'
    );
  }

  const hasSectionProp = Object.prototype.hasOwnProperty.call(change, 'section');
  if (!hasSectionProp) {
    pushError(changeErrors, 'section', 'section is required', 'required');
  }
  validateString(entry.section, 'section', changeErrors, { min: 1, max: 120 });
  if (entry.section && entry.section.trim().length === 0) {
    pushError(changeErrors, 'section', 'section must not be empty', 'too_short');
  }

  if (typeof entry.description !== 'string') {
    pushError(changeErrors, 'description', 'description is required', 'required');
  } else {
    validateDescriptionQuality(entry.description, changeErrors, 'description');
  }

  if (entry.lineNumber !== undefined && !isPositiveInteger(entry.lineNumber)) {
    pushError(changeErrors, 'lineNumber', 'lineNumber must be a positive integer', 'invalid_value');
  }

  if (entry.author !== undefined) {
    validateString(entry.author, 'author', changeErrors, { min: 1, max: 120 });
  }

  if (entry.type === 'update') {
    if (typeof entry.before !== 'string' || typeof entry.after !== 'string') {
      pushError(
        changeErrors,
        'beforeAfter',
        'update change must include before and after strings',
        'missing_fields'
      );
    }
  }
  if (entry.type === 'move') {
    const hasFrom = typeof entry.from === 'string' && entry.from.trim().length > 0;
    const hasTo = typeof entry.to === 'string' && entry.to.trim().length > 0;
    if ((hasFrom && !hasTo) || (!hasFrom && hasTo)) {
      pushError(
        changeErrors,
        'fromTo',
        'move change must include both from and to when specified',
        'missing_fields'
      );
    }
  }
  if (entry.type === 'rename') {
    const hasOld = typeof entry.oldName === 'string' && entry.oldName.trim().length > 0;
    const hasNew = typeof entry.newName === 'string' && entry.newName.trim().length > 0;
    if ((hasOld && !hasNew) || (!hasOld && hasNew)) {
      pushError(
        changeErrors,
        'rename',
        'rename change must include both oldName and newName when specified',
        'missing_fields'
      );
    }
  }

  changeErrors.forEach((err) => {
    errors.push({ field: `changes[${index}].${err.field}`, message: err.message, code: err.code });
  });
};

const validateSnapshot = (snapshot: unknown, errors: ValidationError[]): void => {
  if (snapshot === undefined) {
    return;
  }
  if (!isPlainObject(snapshot)) {
    pushError(errors, 'snapshot', 'snapshot must be an object', 'invalid_type');
    return;
  }
  const keys = Object.keys(snapshot);
  if (keys.some((key) => key !== 'content' && key !== 'metadata')) {
    pushError(
      errors,
      'snapshot',
      'snapshot can only contain content and metadata',
      'invalid_structure'
    );
  }

  const { content, metadata } = snapshot as VersionSnapshot;
  if (content !== undefined && !isPlainObject(content)) {
    pushError(errors, 'snapshot.content', 'snapshot.content must be an object', 'invalid_type');
  }
  if (metadata !== undefined && !isPlainObject(metadata)) {
    pushError(errors, 'snapshot.metadata', 'snapshot.metadata must be an object', 'invalid_type');
  }
};

const validateTags = (tags: unknown, errors: ValidationError[]): void => {
  if (tags === undefined) {
    return;
  }
  if (!Array.isArray(tags)) {
    pushError(errors, 'tags', 'tags must be an array', 'invalid_type');
    return;
  }
  if (tags.length > 20) {
    pushError(errors, 'tags', 'tags cannot exceed 20 entries', 'too_many');
  }
  const seen = new Set<string>();
  tags.forEach((tag, index) => {
    if (typeof tag !== 'string') {
      pushError(errors, `tags[${index}]`, 'tag must be a string', 'invalid_type');
      return;
    }
    const trimmed = tag.trim();
    if (trimmed.length === 0) {
      pushError(errors, `tags[${index}]`, 'tag cannot be empty', 'too_short');
    }
    if (seen.has(trimmed)) {
      pushError(errors, `tags[${index}]`, 'duplicate tag', 'duplicate');
    }
    seen.add(trimmed);
  });
};

export const validateVersion = (value: unknown): ValidationResult => {
  if (!isPlainObject(value)) {
    return {
      valid: false,
      errors: [{ field: 'version', message: 'Version must be an object', code: 'invalid_type' }],
    };
  }

  const errors: ValidationError[] = [];
  const version = value as Version;

  if (version.id === undefined) {
    pushError(errors, 'id', 'id is required', 'required');
  } else {
    validateString(version.id, 'id', errors, { min: 3, max: 160, pattern: VERSION_ID_PATTERN });
  }

  validateString(version.draftId, 'draftId', errors, {
    min: 1,
    max: 128,
    pattern: DRAFT_ID_PATTERN,
  });

  if (typeof version.version !== 'string' || !VERSION_PATTERN.test(version.version)) {
    pushError(errors, 'version', 'version must follow semantic versioning', 'invalid_format');
  }

  validateString(version.message, 'message', errors, { min: 3, max: MESSAGE_MAX_LENGTH });

  if (!Array.isArray(version.changes)) {
    pushError(errors, 'changes', 'changes must be an array', 'invalid_type');
  } else {
    version.changes.forEach((change, index) => validateChange(change, index, errors));
  }

  validateString(version.author, 'author', errors, { min: 1, max: 120 });

  if (!isDate(version.createdAt)) {
    pushError(errors, 'createdAt', 'createdAt must be a Date', 'invalid_type');
  }

  validateSnapshot(version.snapshot, errors);

  if (version.size !== undefined) {
    if (
      typeof version.size !== 'number' ||
      Number.isNaN(version.size) ||
      version.size < 0 ||
      version.size > MAX_SIZE_BYTES
    ) {
      pushError(errors, 'size', 'size must be a number between 0 and 10MB', 'invalid_value');
    }
  }

  if (version.checksum !== undefined) {
    if (typeof version.checksum !== 'string' || !CHECKSUM_PATTERN.test(version.checksum)) {
      pushError(errors, 'checksum', 'checksum must follow algorithm:hex pattern', 'invalid_format');
    }
  }

  validateTags(version.tags, errors);

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const isVersion = (value: unknown): value is Version => validateVersion(value).valid;

export const parseVersion = (input: string): ParsedVersion => {
  const match = VERSION_PATTERN.exec(input);
  if (!match) {
    throw new Error(`Invalid version string: ${input}`);
  }
  const [, major, minor, patch, prerelease, build] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    prerelease: prerelease || undefined,
    build: build || undefined,
  };
};

const compareIdentifiers = (a: string, b: string): number => {
  const numericA = /^\d+$/.test(a);
  const numericB = /^\d+$/.test(b);

  if (numericA && numericB) {
    const diff = Number(a) - Number(b);
    if (diff < 0) {
      return -1;
    }
    if (diff > 0) {
      return 1;
    }
    return 0;
  }

  if (numericA && !numericB) {
    return -1;
  }
  if (!numericA && numericB) {
    return 1;
  }

  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
};

export const compareVersions = (a: string, b: string): number => {
  const parsedA = parseVersion(a);
  const parsedB = parseVersion(b);

  if (parsedA.major !== parsedB.major) {
    return parsedA.major < parsedB.major ? -1 : 1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor < parsedB.minor ? -1 : 1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch < parsedB.patch ? -1 : 1;
  }

  const preA = parsedA.prerelease;
  const preB = parsedB.prerelease;

  if (preA === preB) {
    return 0;
  }

  if (!preA) {
    return 1;
  }
  if (!preB) {
    return -1;
  }

  const segmentsA = preA.split('.');
  const segmentsB = preB.split('.');
  const length = Math.max(segmentsA.length, segmentsB.length);

  for (let i = 0; i < length; i += 1) {
    const identA = segmentsA[i];
    const identB = segmentsB[i];
    if (identA === undefined) {
      return -1;
    }
    if (identB === undefined) {
      return 1;
    }
    const diff = compareIdentifiers(identA, identB);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
};

export const createVersion = (input: CreateVersionInput): Version => {
  const {
    draftId,
    message,
    changes,
    author,
    version = '1.0.0',
    content,
    snapshotMetadata,
    tags,
  } = input;

  const baseSnapshot: VersionSnapshot | undefined = content
    ? {
        content,
        metadata: {
          ...(snapshotMetadata ?? {}),
          generatedAt: new Date().toISOString(),
        },
      }
    : undefined;

  const serializedContent = baseSnapshot ? JSON.stringify(baseSnapshot.content) : '';
  const size = baseSnapshot ? Buffer.byteLength(serializedContent, 'utf8') : undefined;
  const checksum = baseSnapshot
    ? `sha256:${createHash('sha256').update(serializedContent, 'utf8').digest('hex')}`
    : undefined;

  const versionObject: Version = {
    id: generateId(),
    draftId,
    version,
    message,
    changes,
    author,
    createdAt: new Date(),
    snapshot: baseSnapshot,
    size,
    checksum,
    tags,
  };

  const result = validateVersion(versionObject);
  if (!result.valid) {
    const messageSummary = result.errors.map((err) => `${err.field}: ${err.message}`).join('; ');
    throw new Error(`Failed to create Version: ${messageSummary}`);
  }

  return versionObject;
};
