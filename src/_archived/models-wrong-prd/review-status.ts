/**
 * Review status model helpers (T014)
 *
 * Implements a lightweight review workflow entity with validation,
 * state transitions, status calculation, and factory helpers to satisfy
 * the TDD contract used by the unit tests.
 */

import type { RoleType } from './user-role.js';

export type ReviewPriority = 'low' | 'normal' | 'high' | 'urgent';

export const ReviewPhase = {
  Submitted: 'submitted',
  Assigned: 'assigned',
  TechnicalReview: 'technical_review',
  BusinessReview: 'business_review',
  FinalReview: 'final_review',
  Approved: 'approved',
  Rejected: 'rejected',
  RevisionRequired: 'revision_required',
} as const;

export type ReviewPhase = (typeof ReviewPhase)[keyof typeof ReviewPhase];

export type ReviewStage = ReviewPhase;

export const StatusType = {
  Pending: 'pending',
  InProgress: 'in_progress',
  Approved: 'approved',
  Rejected: 'rejected',
  ChangesRequested: 'changes_requested',
} as const;

export type StatusType = (typeof StatusType)[keyof typeof StatusType];

export type ReviewDecision = 'approve' | 'reject' | 'request_changes';
export type ReviewOverallStatus = StatusType;

export interface ReviewAssignee {
  userId: string;
  role: RoleType | 'external';
  specialty?: string[];
  assignedAt: Date;
  dueAt?: Date;
  loadFactor?: number;
  isPrimary?: boolean;
}

export interface ReviewComment {
  id: string;
  authorId: string;
  role: RoleType | 'external';
  message: string;
  createdAt: Date;
  section?: string;
  resolvesCommentId?: string;
  isResolved?: boolean;
  attachments?: string[];
}

export interface Review {
  id: string;
  phase: ReviewPhase;
  assigneeId: string;
  startedAt: Date;
  completedAt?: Date;
  decision?: ReviewDecisionEntry;
  comments: ReviewComment[];
  metadata?: Record<string, unknown>;
}

export interface ReviewPhaseState {
  phase: ReviewPhase;
  status: ReviewOverallStatus;
  startedAt: Date;
  completedAt?: Date;
  assigneeIds?: string[];
  notes?: string;
}

export interface ReviewWorkflowSettings {
  requireAllApprovals: boolean;
  allowSelfReview: boolean;
  autoMerge: boolean;
  requiredReviewers: number;
  escalation?: {
    enabled: boolean;
    timeoutHours: number;
    notifyRoles: (RoleType | 'external')[];
  };
  reminders?: {
    intervalHours: number;
    maxReminders: number;
  };
}

export interface ReviewWorkflowStatistics {
  totalReviews: number;
  approvedReviews: number;
  rejectedReviews: number;
  averageReviewTime: number;
  currentPhaseProgress: number;
  lastUpdated?: Date;
}

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
  assignees?: ReviewAssignee[];
  phases?: ReviewPhaseState[];
  reviews?: Review[];
  settings?: ReviewWorkflowSettings;
  statistics?: ReviewWorkflowStatistics;
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
const COMMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/;
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
const ASSIGNEE_ROLES: (RoleType | 'external')[] = [
  'architect',
  'product_manager',
  'developer',
  'tester',
  'reviewer',
  'viewer',
  'external',
];
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
  assigned: ['technical_review', 'business_review', 'final_review', 'approved'],
  technical_review: [
    'business_review',
    'final_review',
    'revision_required',
    'rejected',
    'approved',
  ],
  business_review: ['final_review', 'revision_required', 'rejected', 'approved'],
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

const validateAssignees = (assignees: unknown, errors: ValidationError[]): void => {
  if (assignees === undefined) {
    return;
  }
  if (!Array.isArray(assignees)) {
    errors.push({
      field: 'assignees',
      message: 'assignees must be an array',
      code: 'invalid_type',
    });
    return;
  }
  const seen = new Set<string>();
  assignees.forEach((entry, idx) => {
    if (!isPlainObject(entry)) {
      errors.push({
        field: `assignees[${idx}]`,
        message: 'assignee must be an object',
        code: 'invalid_type',
      });
      return;
    }
    const cast = entry as ReviewAssignee;
    validateString(cast.userId, `assignees[${idx}].userId`, errors, {
      min: 1,
      max: 120,
      pattern: REVIEWER_ID_PATTERN,
    });
    if (typeof cast.userId === 'string') {
      const key = cast.userId.trim();
      if (seen.has(key)) {
        errors.push({
          field: `assignees[${idx}].userId`,
          message: 'duplicate assignee userId',
          code: 'duplicate',
        });
      }
      seen.add(key);
    }
    if (!ASSIGNEE_ROLES.includes(cast.role)) {
      errors.push({
        field: `assignees[${idx}].role`,
        message: 'invalid role',
        code: 'invalid_value',
      });
    }
    if (!isDate(cast.assignedAt)) {
      errors.push({
        field: `assignees[${idx}].assignedAt`,
        message: 'assignedAt must be a Date',
        code: 'invalid_type',
      });
    }
    if (cast.dueAt && !isDate(cast.dueAt)) {
      errors.push({
        field: `assignees[${idx}].dueAt`,
        message: 'dueAt must be a Date',
        code: 'invalid_type',
      });
    }
    if (typeof cast.loadFactor !== 'undefined') {
      if (typeof cast.loadFactor !== 'number' || cast.loadFactor < 0 || cast.loadFactor > 1) {
        errors.push({
          field: `assignees[${idx}].loadFactor`,
          message: 'loadFactor must be between 0 and 1',
          code: 'invalid_value',
        });
      }
    }
  });
};

const validateReviewComments = (
  comments: unknown,
  baseField: string,
  errors: ValidationError[]
): void => {
  if (!Array.isArray(comments)) {
    errors.push({ field: baseField, message: 'comments must be an array', code: 'invalid_type' });
    return;
  }
  comments.forEach((comment, idx) => {
    if (!isPlainObject(comment)) {
      errors.push({
        field: `${baseField}[${idx}]`,
        message: 'comment must be an object',
        code: 'invalid_type',
      });
      return;
    }
    const cast = comment as ReviewComment;
    validateString(cast.id, `${baseField}[${idx}].id`, errors, {
      min: 1,
      max: 160,
      pattern: COMMENT_ID_PATTERN,
    });
    validateString(cast.authorId, `${baseField}[${idx}].authorId`, errors, {
      min: 1,
      max: 120,
      pattern: REVIEWER_ID_PATTERN,
    });
    if (!ASSIGNEE_ROLES.includes(cast.role)) {
      errors.push({
        field: `${baseField}[${idx}].role`,
        message: 'invalid role',
        code: 'invalid_value',
      });
    }
    validateString(cast.message, `${baseField}[${idx}].message`, errors, { min: 1, max: 2000 });
    if (!isDate(cast.createdAt)) {
      errors.push({
        field: `${baseField}[${idx}].createdAt`,
        message: 'createdAt must be a Date',
        code: 'invalid_type',
      });
    }
    if (cast.resolvesCommentId !== undefined) {
      validateString(cast.resolvesCommentId, `${baseField}[${idx}].resolvesCommentId`, errors, {
        min: 1,
        max: 160,
        pattern: COMMENT_ID_PATTERN,
      });
    }
    if (cast.isResolved !== undefined && typeof cast.isResolved !== 'boolean') {
      errors.push({
        field: `${baseField}[${idx}].isResolved`,
        message: 'isResolved must be a boolean',
        code: 'invalid_type',
      });
    }
    if (cast.attachments) {
      if (!Array.isArray(cast.attachments)) {
        errors.push({
          field: `${baseField}[${idx}].attachments`,
          message: 'attachments must be an array',
          code: 'invalid_type',
        });
      } else if (cast.attachments.some((attachment) => typeof attachment !== 'string')) {
        errors.push({
          field: `${baseField}[${idx}].attachments`,
          message: 'attachments must contain only strings',
          code: 'invalid_value',
        });
      }
    }
  });
};

const validateReviewsDetail = (reviews: unknown, errors: ValidationError[]): void => {
  if (reviews === undefined) {
    return;
  }
  if (!Array.isArray(reviews)) {
    errors.push({ field: 'reviews', message: 'reviews must be an array', code: 'invalid_type' });
    return;
  }
  reviews.forEach((review, idx) => {
    if (!isPlainObject(review)) {
      errors.push({
        field: `reviews[${idx}]`,
        message: 'review must be an object',
        code: 'invalid_type',
      });
      return;
    }
    const cast = review as Review;
    validateString(cast.id, `reviews[${idx}].id`, errors, {
      min: 1,
      max: 120,
      pattern: REVIEW_ID_PATTERN,
    });
    if (!VALID_STAGES.includes(cast.phase)) {
      errors.push({
        field: `reviews[${idx}].phase`,
        message: 'invalid review phase',
        code: 'invalid_value',
      });
    }
    validateString(cast.assigneeId, `reviews[${idx}].assigneeId`, errors, {
      min: 1,
      max: 120,
      pattern: REVIEWER_ID_PATTERN,
    });
    if (!isDate(cast.startedAt)) {
      errors.push({
        field: `reviews[${idx}].startedAt`,
        message: 'startedAt must be a Date',
        code: 'invalid_type',
      });
    }
    if (cast.completedAt) {
      if (!isDate(cast.completedAt)) {
        errors.push({
          field: `reviews[${idx}].completedAt`,
          message: 'completedAt must be a Date',
          code: 'invalid_type',
        });
      } else if (isDate(cast.startedAt) && cast.completedAt < cast.startedAt) {
        errors.push({
          field: `reviews[${idx}].completedAt`,
          message: 'completedAt cannot be earlier than startedAt',
          code: 'invalid_value',
        });
      }
    }
    if (cast.decision) {
      validateDecisions([cast.decision], errors);
    }
    if (!Array.isArray(cast.comments)) {
      errors.push({
        field: `reviews[${idx}].comments`,
        message: 'comments must be provided as an array',
        code: 'invalid_type',
      });
    } else {
      validateReviewComments(cast.comments, `reviews[${idx}].comments`, errors);
    }
  });
};

const validatePhases = (phases: unknown, errors: ValidationError[]): void => {
  if (phases === undefined) {
    return;
  }
  if (!Array.isArray(phases)) {
    errors.push({ field: 'phases', message: 'phases must be an array', code: 'invalid_type' });
    return;
  }
  let previousPhase: ReviewStage | undefined;
  phases.forEach((phase, idx) => {
    if (!isPlainObject(phase)) {
      errors.push({
        field: `phases[${idx}]`,
        message: 'phase entry must be an object',
        code: 'invalid_type',
      });
      return;
    }
    const cast = phase as ReviewPhaseState;
    if (!VALID_STAGES.includes(cast.phase)) {
      errors.push({
        field: `phases[${idx}].phase`,
        message: 'invalid phase',
        code: 'invalid_value',
      });
    }
    if (
      cast.status &&
      !['pending', 'in_progress', 'approved', 'rejected', 'changes_requested'].includes(cast.status)
    ) {
      errors.push({
        field: `phases[${idx}].status`,
        message: 'invalid status',
        code: 'invalid_value',
      });
    }
    if (cast.phase && previousPhase && !isValidPhaseTransition(previousPhase, cast.phase)) {
      errors.push({
        field: `phases[${idx}].phase`,
        message: `invalid transition from ${previousPhase} to ${cast.phase}`,
        code: 'invalid_transition',
      });
    }
    if (!isDate(cast.startedAt)) {
      errors.push({
        field: `phases[${idx}].startedAt`,
        message: 'startedAt must be a Date',
        code: 'invalid_type',
      });
    }
    if (cast.completedAt) {
      if (!isDate(cast.completedAt)) {
        errors.push({
          field: `phases[${idx}].completedAt`,
          message: 'completedAt must be a Date',
          code: 'invalid_type',
        });
      } else if (isDate(cast.startedAt) && cast.completedAt < cast.startedAt) {
        errors.push({
          field: `phases[${idx}].completedAt`,
          message: 'completedAt cannot be earlier than startedAt',
          code: 'invalid_value',
        });
      }
    }
    if (
      cast.assigneeIds &&
      (!Array.isArray(cast.assigneeIds) || cast.assigneeIds.some((id) => typeof id !== 'string'))
    ) {
      errors.push({
        field: `phases[${idx}].assigneeIds`,
        message: 'assigneeIds must be an array of strings',
        code: 'invalid_type',
      });
    }
    previousPhase = cast.phase;
  });
};

const validateSettings = (settings: unknown, errors: ValidationError[]): void => {
  if (settings === undefined) {
    return;
  }
  if (!isPlainObject(settings)) {
    errors.push({ field: 'settings', message: 'settings must be an object', code: 'invalid_type' });
    return;
  }
  const cast = settings as ReviewWorkflowSettings;
  if (typeof cast.requireAllApprovals !== 'boolean') {
    errors.push({
      field: 'settings.requireAllApprovals',
      message: 'requireAllApprovals must be a boolean',
      code: 'invalid_type',
    });
  }
  if (typeof cast.allowSelfReview !== 'boolean') {
    errors.push({
      field: 'settings.allowSelfReview',
      message: 'allowSelfReview must be a boolean',
      code: 'invalid_type',
    });
  }
  if (typeof cast.autoMerge !== 'boolean') {
    errors.push({
      field: 'settings.autoMerge',
      message: 'autoMerge must be a boolean',
      code: 'invalid_type',
    });
  }
  if (
    typeof cast.requiredReviewers !== 'number' ||
    Number.isNaN(cast.requiredReviewers) ||
    cast.requiredReviewers < 0
  ) {
    errors.push({
      field: 'settings.requiredReviewers',
      message: 'requiredReviewers must be a non-negative number',
      code: 'invalid_value',
    });
  }
  if (cast.escalation) {
    if (!isPlainObject(cast.escalation)) {
      errors.push({
        field: 'settings.escalation',
        message: 'escalation must be an object',
        code: 'invalid_type',
      });
    } else {
      if (typeof cast.escalation.enabled !== 'boolean') {
        errors.push({
          field: 'settings.escalation.enabled',
          message: 'enabled must be a boolean',
          code: 'invalid_type',
        });
      }
      if (typeof cast.escalation.timeoutHours !== 'number' || cast.escalation.timeoutHours <= 0) {
        errors.push({
          field: 'settings.escalation.timeoutHours',
          message: 'timeoutHours must be a positive number',
          code: 'invalid_value',
        });
      }
      if (
        cast.escalation.notifyRoles &&
        (!Array.isArray(cast.escalation.notifyRoles) ||
          cast.escalation.notifyRoles.some((role) => !ASSIGNEE_ROLES.includes(role)))
      ) {
        errors.push({
          field: 'settings.escalation.notifyRoles',
          message: 'notifyRoles must be an array of valid roles',
          code: 'invalid_value',
        });
      }
    }
  }
  if (cast.reminders) {
    if (!isPlainObject(cast.reminders)) {
      errors.push({
        field: 'settings.reminders',
        message: 'reminders must be an object',
        code: 'invalid_type',
      });
    } else {
      if (typeof cast.reminders.intervalHours !== 'number' || cast.reminders.intervalHours <= 0) {
        errors.push({
          field: 'settings.reminders.intervalHours',
          message: 'intervalHours must be a positive number',
          code: 'invalid_value',
        });
      }
      if (typeof cast.reminders.maxReminders !== 'number' || cast.reminders.maxReminders < 0) {
        errors.push({
          field: 'settings.reminders.maxReminders',
          message: 'maxReminders must be a non-negative number',
          code: 'invalid_value',
        });
      }
    }
  }
};

const validateStatistics = (stats: unknown, errors: ValidationError[]): void => {
  if (stats === undefined) {
    return;
  }
  if (!isPlainObject(stats)) {
    errors.push({
      field: 'statistics',
      message: 'statistics must be an object',
      code: 'invalid_type',
    });
    return;
  }
  const cast = stats as ReviewWorkflowStatistics;
  const numericFields: (keyof ReviewWorkflowStatistics)[] = [
    'totalReviews',
    'approvedReviews',
    'rejectedReviews',
    'averageReviewTime',
    'currentPhaseProgress',
  ];
  numericFields.forEach((field) => {
    const value = cast[field];
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
      errors.push({
        field: `statistics.${field.toString()}`,
        message: `${field.toString()} must be a non-negative number`,
        code: 'invalid_value',
      });
    }
  });
  if (cast.currentPhaseProgress > 100) {
    errors.push({
      field: 'statistics.currentPhaseProgress',
      message: 'currentPhaseProgress cannot exceed 100',
      code: 'invalid_value',
    });
  }
  if (cast.lastUpdated && !isDate(cast.lastUpdated)) {
    errors.push({
      field: 'statistics.lastUpdated',
      message: 'lastUpdated must be a Date',
      code: 'invalid_type',
    });
  }
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
  if (status.deadline && status.overallStatus === 'pending') {
    const now = new Date();
    if (status.deadline < now) {
      errors.push({
        field: 'deadline',
        message: 'deadline has passed for pending review',
        code: 'deadline_expired',
      });
    }
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

  validateAssignees(status.assignees, errors);
  validatePhases(status.phases, errors);
  validateReviewsDetail(status.reviews, errors);
  validateSettings(status.settings, errors);
  validateStatistics(status.statistics, errors);

  const decisionsArray = Array.isArray(status.decisions) ? status.decisions : [];
  const reviewersArray = Array.isArray(status.reviewers) ? status.reviewers : [];
  const uniqueDecisionReviewers = new Set(decisionsArray.map((decision) => decision.reviewerId));
  const computedTotal = reviewersArray.length;
  const computedCompleted =
    computedTotal === 0 ? 0 : Math.min(uniqueDecisionReviewers.size, computedTotal);
  const computedPercentage =
    computedTotal === 0 ? 0 : Math.round((computedCompleted / computedTotal) * 100);
  const computedProgress: ReviewProgress = {
    completed: computedCompleted,
    total: computedTotal,
    percentage: computedPercentage,
  };
  const hadProgress = status.progress !== undefined;
  if (hadProgress) {
    validateProgress(status.progress, errors);
  }
  status.progress = computedProgress;

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

export const isValidPhaseTransition = (from: ReviewStage, to: ReviewStage): boolean => {
  if (!VALID_STAGES.includes(from) || !VALID_STAGES.includes(to)) {
    return false;
  }
  if (from === to) {
    return true;
  }
  const allowed = STAGE_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
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
    assignees: reviewers.map((userId, index) => ({
      userId,
      role: 'reviewer',
      assignedAt: now,
      isPrimary: index === 0,
    })),
    phases: [
      {
        phase: 'submitted',
        status: 'pending',
        startedAt: now,
        assigneeIds: reviewers,
      },
    ],
    reviews: [],
    settings: {
      requireAllApprovals: reviewers.length > 1,
      allowSelfReview: false,
      autoMerge: false,
      requiredReviewers: Math.max(1, reviewers.length),
      reminders: {
        intervalHours: 24,
        maxReminders: 3,
      },
      escalation: {
        enabled: reviewers.length > 3,
        timeoutHours: 48,
        notifyRoles: ['architect', 'product_manager'],
      },
    },
    statistics: {
      totalReviews: 0,
      approvedReviews: 0,
      rejectedReviews: 0,
      averageReviewTime: 0,
      currentPhaseProgress: reviewers.length === 0 ? 0 : Math.round((0 / reviewers.length) * 100),
      lastUpdated: now,
    },
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
