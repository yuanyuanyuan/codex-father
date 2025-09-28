/**
 * Review status model helpers (T014)
 *
 * Implements a lightweight review workflow entity with validation,
 * state transitions, status calculation, and factory helpers to satisfy
 * the TDD contract used by the unit tests.
 */

export type ReviewPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ReviewStage =
  | 'submitted'
  | 'assigned'
  | 'technical_review'
  | 'business_review'
  | 'final_review'
  | 'approved'
  | 'rejected'
  | 'revision_required';
export type ReviewDecision = 'approve' | 'reject' | 'request_changes';
export type ReviewOverallStatus =
  | 'pending'
  | 'in_progress'
  | 'approved'
  | 'rejected'
  | 'changes_requested';

export interface ReviewDecisionEntry {
  reviewerId: string;
  decision: ReviewDecision;
  comments: string;
  timestamp: Date;
  section?: string;
  severity?: 'minor' | 'major' | 'critical';
}

export interface ReviewTimelineEntry {
  stage: ReviewStage;
  timestamp: Date;
  actor: string;
  description: string;
}

export interface ReviewProgress {
  completed: number;
  total: number;
  percentage: number;
}

export interface ReviewMetadata {
  estimatedDuration?: number;
  complexity?: 'low' | 'medium' | 'high';
  tags?: string[];
  [key: string]: unknown;
}

export interface ReviewStatus {
  id: string;
  draftId: string;
  submittedBy: string;
  submittedAt: Date;
  reviewers: string[];
  currentStage: ReviewStage;
  priority: ReviewPriority;
  message?: string;
  deadline?: Date;
  decisions: ReviewDecisionEntry[];
  overallStatus: ReviewOverallStatus;
  progress?: ReviewProgress;
  timeline: ReviewTimelineEntry[];
  metadata?: ReviewMetadata;
  createdAt: Date;
  updatedAt: Date;
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

export interface CreateReviewStatusInput {
  draftId: string;
  submittedBy: string;
  reviewers: string[];
  priority: ReviewPriority;
  message?: string;
  id?: string;
  currentStage?: ReviewStage;
  deadline?: Date;
  metadata?: ReviewMetadata;
}

const REVIEW_ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/;
const DRAFT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const REVIEWER_ID_PATTERN = /^[A-Za-z0-9_-]{1,120}$/;
const MESSAGE_MAX_LENGTH = 1000;
const MAX_REVIEWERS = 20;
const VALID_PRIORITIES: ReviewPriority[] = ['low', 'normal', 'high', 'urgent'];
const VALID_STAGES: ReviewStage[] = [
  'submitted',
  'assigned',
  'technical_review',
  'business_review',
  'final_review',
  'approved',
  'rejected',
  'revision_required',
];
const VALID_DECISIONS: ReviewDecision[] = ['approve', 'reject', 'request_changes'];
const GENERIC_COMMENTS = [
  /^change$/i,
  /^changes?$/i,
  /^modify$/i,
  /^modified?$/i,
  /^修改了一些东西$/,
  /^修改一些东西$/,
  /^缺少章节名$/,
  /^!+$/,
];

const STAGE_TRANSITIONS: Record<ReviewStage, ReviewStage[]> = {
  submitted: ['assigned', 'technical_review'],
  assigned: ['technical_review', 'business_review', 'final_review'],
  technical_review: ['business_review', 'final_review', 'revision_required', 'rejected'],
  business_review: ['final_review', 'revision_required', 'rejected'],
  final_review: ['approved', 'revision_required', 'rejected'],
  approved: [],
  rejected: [],
  revision_required: ['technical_review', 'business_review', 'final_review'],
};

const OVERALL_TRANSITIONS: Record<
  ReviewOverallStatus | 'published',
  (ReviewOverallStatus | 'published')[]
> = {
  pending: ['in_progress'],
  in_progress: ['approved', 'rejected', 'changes_requested'],
  approved: ['published'],
  rejected: [],
  changes_requested: ['in_progress', 'rejected'],
  published: [],
};

let reviewIdCounter = 0;

const generateId = (): string => {
  reviewIdCounter = (reviewIdCounter + 1) % 1000;
  return `review-${Date.now()}${reviewIdCounter.toString().padStart(3, '0')}`;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDate = (value: unknown): value is Date =>
  value instanceof Date && !Number.isNaN(value.valueOf());

const validateString = (
  value: unknown,
  field: string,
  errors: ValidationError[],
  { min = 1, max = Infinity, pattern }: { min?: number; max?: number; pattern?: RegExp } = {}
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
  if (pattern && trimmed.length > 0 && !pattern.test(trimmed)) {
    errors.push({ field, message: `${field} format is invalid`, code: 'invalid_format' });
  }
};

const validateReviewers = (reviewers: unknown, errors: ValidationError[]): void => {
  if (!Array.isArray(reviewers)) {
    errors.push({
      field: 'reviewers',
      message: 'reviewers must be an array',
      code: 'invalid_type',
    });
    return;
  }
  if (reviewers.length > MAX_REVIEWERS) {
    errors.push({
      field: 'reviewers',
      message: `reviewers cannot exceed ${MAX_REVIEWERS}`,
      code: 'too_many',
    });
  }
  const seen = new Set<string>();
  reviewers.forEach((reviewer, index) => {
    validateString(reviewer, `reviewers[${index}]`, errors, {
      min: 1,
      max: 120,
      pattern: REVIEWER_ID_PATTERN,
    });
    if (typeof reviewer === 'string') {
      const key = reviewer.trim();
      if (seen.has(key)) {
        errors.push({
          field: `reviewers[${index}]`,
          message: 'duplicate reviewer',
          code: 'duplicate',
        });
      }
      seen.add(key);
    }
  });
};

const validateDecisions = (decisions: unknown, errors: ValidationError[]): void => {
  if (!Array.isArray(decisions)) {
    errors.push({
      field: 'decisions',
      message: 'decisions must be an array',
      code: 'invalid_type',
    });
    return;
  }
  decisions.forEach((entry, idx) => {
    if (!isPlainObject(entry)) {
      errors.push({
        field: `decisions[${idx}]`,
        message: 'decision must be an object',
        code: 'invalid_type',
      });
      return;
    }
    const decision = entry as ReviewDecisionEntry;
    validateString(decision.reviewerId, `decisions[${idx}].reviewerId`, errors, {
      min: 1,
      max: 120,
      pattern: REVIEWER_ID_PATTERN,
    });
    if (!VALID_DECISIONS.includes(decision.decision)) {
      errors.push({
        field: `decisions[${idx}].decision`,
        message: 'invalid decision value',
        code: 'invalid_value',
      });
    }
    validateString(decision.comments, `decisions[${idx}].comments`, errors, { min: 3, max: 1000 });
    if (
      typeof decision.comments === 'string' &&
      GENERIC_COMMENTS.some((pattern) => pattern.test(decision.comments.trim()))
    ) {
      errors.push({
        field: `decisions[${idx}].comments`,
        message: 'comments too generic',
        code: 'generic_comment',
      });
    }
    if (!isDate(decision.timestamp)) {
      errors.push({
        field: `decisions[${idx}].timestamp`,
        message: 'timestamp must be a Date',
        code: 'invalid_type',
      });
    }
  });
};

const validateTimeline = (timeline: unknown, errors: ValidationError[]): void => {
  if (!Array.isArray(timeline)) {
    errors.push({ field: 'timeline', message: 'timeline must be an array', code: 'invalid_type' });
    return;
  }
  let previous: Date | undefined;
  timeline.forEach((entry, idx) => {
    if (!isPlainObject(entry)) {
      errors.push({
        field: `timeline[${idx}]`,
        message: 'timeline entry must be an object',
        code: 'invalid_type',
      });
      return;
    }
    const cast = entry as ReviewTimelineEntry;
    if (!VALID_STAGES.includes(cast.stage)) {
      errors.push({
        field: `timeline[${idx}].stage`,
        message: 'invalid stage',
        code: 'invalid_value',
      });
    }
    if (!isDate(cast.timestamp)) {
      errors.push({
        field: `timeline[${idx}].timestamp`,
        message: 'timestamp must be a Date',
        code: 'invalid_type',
      });
    } else if (previous && cast.timestamp < previous) {
      errors.push({
        field: `timeline[${idx}].timestamp`,
        message: 'timeline timestamps must be non-decreasing',
        code: 'invalid_order',
      });
    }
    validateString(cast.actor, `timeline[${idx}].actor`, errors, { min: 1, max: 120 });
    validateString(cast.description, `timeline[${idx}].description`, errors, { min: 1, max: 500 });
    if (isDate(cast.timestamp)) {
      previous = cast.timestamp;
    }
  });
};

const validateProgress = (progress: unknown, errors: ValidationError[]): void => {
  if (progress === undefined) {
    return;
  }
  if (!isPlainObject(progress)) {
    errors.push({ field: 'progress', message: 'progress must be an object', code: 'invalid_type' });
    return;
  }
  const { completed, total, percentage } = progress as ReviewProgress;
  if (typeof completed !== 'number' || completed < 0) {
    errors.push({
      field: 'progress.completed',
      message: 'completed must be a non-negative number',
      code: 'invalid_value',
    });
  }
  if (typeof total !== 'number' || total < 0) {
    errors.push({
      field: 'progress.total',
      message: 'total must be a non-negative number',
      code: 'invalid_value',
    });
  }
  if (typeof percentage !== 'number' || percentage < 0 || percentage > 100) {
    errors.push({
      field: 'progress.percentage',
      message: 'percentage must be between 0 and 100',
      code: 'invalid_value',
    });
  }
  if (
    typeof completed === 'number' &&
    typeof total === 'number' &&
    typeof percentage === 'number'
  ) {
    if (total === 0) {
      if (completed !== 0 || percentage !== 0) {
        errors.push({
          field: 'progress',
          message: 'When total is 0, completed and percentage must be 0',
          code: 'invalid_value',
        });
      }
    } else {
      const expected = Math.round((completed / total) * 100);
      if (Math.abs(expected - percentage) > 1) {
        errors.push({
          field: 'progress.percentage',
          message: 'percentage does not match completed/total',
          code: 'invalid_value',
        });
      }
      if (completed > total) {
        errors.push({
          field: 'progress.completed',
          message: 'completed cannot exceed total',
          code: 'invalid_value',
        });
      }
    }
  }
};

const validateTags = (tags: unknown, errors: ValidationError[]): void => {
  if (tags === undefined) {
    return;
  }
  if (!Array.isArray(tags)) {
    errors.push({ field: 'metadata.tags', message: 'tags must be an array', code: 'invalid_type' });
    return;
  }
  tags.forEach((tag, idx) => {
    validateString(tag, `metadata.tags[${idx}]`, errors, { min: 1, max: 50 });
  });
};

export const validateReviewStatus = (value: unknown): ValidationResult => {
  if (!isPlainObject(value)) {
    return {
      valid: false,
      errors: [
        { field: 'reviewStatus', message: 'ReviewStatus must be an object', code: 'invalid_type' },
      ],
    };
  }

  const errors: ValidationError[] = [];
  const status = value as ReviewStatus;

  validateString(status.id, 'id', errors, { min: 1, max: 120, pattern: REVIEW_ID_PATTERN });
  validateString(status.draftId, 'draftId', errors, {
    min: 1,
    max: 128,
    pattern: DRAFT_ID_PATTERN,
  });
  validateString(status.submittedBy, 'submittedBy', errors, { min: 1, max: 120 });
  if (!isDate(status.submittedAt)) {
    errors.push({
      field: 'submittedAt',
      message: 'submittedAt must be a Date',
      code: 'invalid_type',
    });
  }
  validateReviewers(status.reviewers, errors);
  if (!VALID_STAGES.includes(status.currentStage)) {
    errors.push({ field: 'currentStage', message: 'invalid stage value', code: 'invalid_value' });
  }
  if (!VALID_PRIORITIES.includes(status.priority)) {
    errors.push({ field: 'priority', message: 'invalid priority value', code: 'invalid_value' });
  }
  if (status.message !== undefined) {
    validateString(status.message, 'message', errors, { min: 3, max: MESSAGE_MAX_LENGTH });
  }
  if (status.deadline !== undefined && !isDate(status.deadline)) {
    errors.push({ field: 'deadline', message: 'deadline must be a Date', code: 'invalid_type' });
  }
  if (status.deadline && isDate(status.submittedAt) && status.deadline < status.submittedAt) {
    errors.push({
      field: 'deadline',
      message: 'deadline cannot be earlier than submittedAt',
      code: 'invalid_value',
    });
  }
  validateDecisions(status.decisions, errors);
  if (
    !['pending', 'in_progress', 'approved', 'rejected', 'changes_requested'].includes(
      status.overallStatus
    )
  ) {
    errors.push({
      field: 'overallStatus',
      message: 'invalid overallStatus value',
      code: 'invalid_value',
    });
  }
  validateTimeline(status.timeline, errors);
  if (!isDate(status.createdAt)) {
    errors.push({ field: 'createdAt', message: 'createdAt must be a Date', code: 'invalid_type' });
  }
  if (!isDate(status.updatedAt)) {
    errors.push({ field: 'updatedAt', message: 'updatedAt must be a Date', code: 'invalid_type' });
  }
  if (
    status.deadline &&
    status.overallStatus !== 'approved' &&
    status.overallStatus !== 'rejected'
  ) {
    const now = new Date();
    if (status.deadline < now) {
      errors.push({
        field: 'deadline',
        message: 'deadline has passed for active review',
        code: 'deadline_expired',
      });
    }
  }
  if (status.metadata) {
    if (!isPlainObject(status.metadata)) {
      errors.push({
        field: 'metadata',
        message: 'metadata must be an object',
        code: 'invalid_type',
      });
    } else {
      if (
        typeof status.metadata.estimatedDuration === 'number' &&
        status.metadata.estimatedDuration < 0
      ) {
        errors.push({
          field: 'metadata.estimatedDuration',
          message: 'estimatedDuration must be positive',
          code: 'invalid_value',
        });
      }
      validateTags(status.metadata.tags, errors);
    }
  }

  const decisionsArray = Array.isArray(status.decisions) ? status.decisions : [];
  const reviewersArray = Array.isArray(status.reviewers) ? status.reviewers : [];
  const uniqueDecisionReviewers = new Set(decisionsArray.map((decision) => decision.reviewerId));
  const computedTotal = reviewersArray.length;
  const computedCompleted = uniqueDecisionReviewers.size;
  const computedPercentage =
    computedTotal === 0 ? 0 : Math.round((computedCompleted / computedTotal) * 100);
  const computedProgress: ReviewProgress = {
    completed: computedCompleted,
    total: computedTotal,
    percentage: computedPercentage,
  };
  status.progress = computedProgress;
  validateProgress(status.progress, errors);

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const isReviewStatus = (value: unknown): value is ReviewStatus =>
  validateReviewStatus(value).valid;

export const calculateOverallStatus = (
  decisions: ReviewDecisionEntry[],
  reviewers: string[]
): ReviewOverallStatus => {
  if (!decisions.length) {
    return 'pending';
  }
  const seen = new Map<string, ReviewDecision>();
  decisions.forEach((decision) => {
    seen.set(decision.reviewerId, decision.decision);
  });
  const requiredCount = reviewers.length;
  const approved = Array.from(seen.values()).filter((value) => value === 'approve').length;
  const rejected = Array.from(seen.values()).filter((value) => value === 'reject').length;
  const requests = Array.from(seen.values()).filter((value) => value === 'request_changes').length;

  if (rejected > 0) {
    return 'rejected';
  }
  if (requests > 0) {
    return 'changes_requested';
  }
  if (approved >= requiredCount && requiredCount > 0) {
    return 'approved';
  }
  return 'in_progress';
};

export const isValidStatusTransition = (
  from: ReviewOverallStatus | 'published',
  to: ReviewOverallStatus | 'published'
): boolean => {
  const allowed = OVERALL_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
};

export const createReviewStatus = (input: CreateReviewStatusInput): ReviewStatus => {
  const {
    draftId,
    submittedBy,
    reviewers,
    priority,
    message,
    id = generateId(),
    currentStage = 'submitted',
    deadline,
    metadata,
  } = input;

  if (!Array.isArray(reviewers) || reviewers.length === 0) {
    throw new Error('At least one reviewer is required');
  }

  const now = new Date();

  const status: ReviewStatus = {
    id,
    draftId,
    submittedBy,
    submittedAt: now,
    reviewers,
    currentStage,
    priority,
    message,
    deadline,
    decisions: [],
    overallStatus: 'pending',
    progress: {
      completed: 0,
      total: reviewers.length,
      percentage: reviewers.length === 0 ? 0 : Math.round((0 / reviewers.length) * 100),
    },
    timeline: [
      {
        stage: 'submitted',
        timestamp: now,
        actor: submittedBy,
        description: 'Review submitted',
      },
    ],
    metadata,
    createdAt: now,
    updatedAt: now,
  };

  const result = validateReviewStatus(status);
  if (!result.valid) {
    const summary = result.errors.map((err) => `${err.field}: ${err.message}`).join('; ');
    throw new Error(`Failed to create ReviewStatus: ${summary}`);
  }

  return status;
};
